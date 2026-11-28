<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

// Contas dos organizadores. Os convidados nunca criam conta.
class AuthController extends Controller
{
    // A conta tem telemóvel, e-mail ou os dois: muitos organizadores não usam e-mail.
    public function register(Request $request): JsonResponse
    {
        $this->normalizeContacts($request);
        $data = $request->validate([
            'name' => 'required|string|max:120',
            ...$this->contactRules(),
            'password' => 'required|string|min:8|confirmed',
        ], $this->contactMessages());

        $user = User::create($data + ['role' => 'organizer']);
        Auth::guard('web')->login($user);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        return response()->json($this->payload($user), 201);
    }

    // Entra-se com o telemóvel ou com o e-mail, no mesmo campo. A mensagem de erro é a mesma para conta
    // inexistente e senha errada: não confirma a existência de contas.
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate(['login' => 'required|string|max:255', 'password' => 'required|string'], [
            'login.required' => 'Escreva o telemóvel ou o e-mail.',
        ]);
        $user = $this->findByLogin($data['login']);
        $key = 'login:'.Str::lower($user?->id ?? trim($data['login'])).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($key, 5)) {
            $wait = RateLimiter::availableIn($key);
            throw ValidationException::withMessages(['login' => "Muitas tentativas. Tente de novo dentro de {$wait} segundos."]);
        }

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            RateLimiter::hit($key, 60);
            throw ValidationException::withMessages(['login' => 'Telemóvel, e-mail ou senha incorretos.']);
        }
        if ($user->isDisabled()) {
            throw ValidationException::withMessages(['login' => 'A sua conta foi desativada pela administração.']);
        }

        RateLimiter::clear($key);
        Auth::guard('web')->login($user, (bool) $request->boolean('remember'));
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        return response()->json($this->payload($user));
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->payload($request->user()));
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->normalizeContacts($request);
        $data = $request->validate([
            'name' => 'required|string|max:120',
            ...$this->contactRules($user),
        ], $this->contactMessages());
        $user->update($data);

        return response()->json($this->payload($user));
    }

    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed|different:current_password',
        ], ['password.different' => 'A nova senha tem de ser diferente da atual.']);

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => 'A senha atual não está certa.']);
        }
        $user->forceFill(['password' => $data['password']])->save();

        return response()->json($this->payload($user));
    }

    // A resposta é sempre igual, exista ou não a conta.
    public function forgotPassword(Request $request): JsonResponse
    {
        $email = User::normalizeEmail($request->validate(['email' => 'required|email|max:255'])['email']);
        $user = User::where('email', $email)->first();
        if ($user && ! $user->isDisabled()) {
            Password::sendResetLink(['email' => $email]);
        }

        return response()->json(['ok' => true]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->merge(['email' => User::normalizeEmail($request->input('email'))]);
        $data = $request->validate([
            'email' => 'required|email',
            'token' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        if (User::where('email', $data['email'])->whereNotNull('disabled_at')->exists()) {
            throw ValidationException::withMessages(['email' => 'Esta conta está desativada.']);
        }

        $status = Password::reset($data, function (User $user, string $password) {
            $user->forceFill(['password' => $password])->save();
        });

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => 'Link inválido ou expirado.']);
        }

        return response()->json(['ok' => true]);
    }

    private function findByLogin(string $login): ?User
    {
        $login = trim($login);

        return str_contains($login, '@')
            ? User::where('email', User::normalizeEmail($login))->first()
            : User::where('phone', User::normalizePhone($login))->first();
    }

    private function normalizeContacts(Request $request): void
    {
        $request->merge([
            'email' => User::normalizeEmail($request->input('email')),
            'phone' => User::normalizePhone($request->input('phone')),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function contactRules(?User $ignore = null): array
    {
        return [
            'phone' => ['nullable', 'required_without:email', 'string', User::PHONE_RULE, Rule::unique('users', 'phone')->ignore($ignore?->id)],
            'email' => ['nullable', 'required_without:phone', 'email', 'max:255', Rule::unique('users', 'email')->ignore($ignore?->id)],
        ];
    }

    /**
     * @return array<string, string>
     */
    private function contactMessages(): array
    {
        return [
            'phone.required_without' => 'Indique o número de telemóvel ou o e-mail.',
            'email.required_without' => 'Indique o número de telemóvel ou o e-mail.',
            'phone.regex' => 'Número de telemóvel inválido. Ex.: 923 456 789.',
            'phone.unique' => 'Já existe uma conta com este número. Entre ou peça ajuda para recuperar a senha.',
            'email.unique' => 'Já existe uma conta com este e-mail. Entre ou recupere a senha.',
        ];
    }

    /**
     * @return array{id: int, name: string, email: string|null, phone: string|null, role: string}
     */
    private function payload(User $user): array
    {
        return $user->only('id', 'name', 'email', 'phone', 'role');
    }
}
