<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Notificacoes\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_organizer_registers_and_is_logged_in(): void
    {
        $this->postJson('/api/register', ['name' => 'Ana', 'email' => ' Ana@Exemplo.AO ', 'password' => 'segredo123', 'password_confirmation' => 'segredo123'])
            ->assertCreated()->assertJson(['email' => 'ana@exemplo.ao', 'role' => 'organizer']);

        $this->getJson('/api/me')->assertOk()->assertJson(['name' => 'Ana']);
    }

    public function test_register_rejects_duplicate_email(): void
    {
        User::factory()->create(['email' => 'ana@exemplo.ao']);

        $this->postJson('/api/register', ['name' => 'Ana', 'email' => 'ANA@exemplo.ao', 'password' => 'segredo123', 'password_confirmation' => 'segredo123'])
            ->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_organizer_registers_with_only_a_phone_number(): void
    {
        $this->postJson('/api/register', ['name' => 'Ana', 'phone' => '923 456 789', 'password' => 'segredo123', 'password_confirmation' => 'segredo123'])
            ->assertCreated()->assertJson(['phone' => '+244923456789', 'email' => null]);

        $this->getJson('/api/me')->assertOk()->assertJson(['name' => 'Ana']);
    }

    #[TestWith(['923456789'])]
    #[TestWith(['+244 923 456 789'])]
    #[TestWith(['00244923456789'])]
    #[TestWith(['244-923-456-789'])]
    public function test_login_with_phone_accepts_the_usual_angolan_formats(string $typed): void
    {
        User::factory()->create(['email' => null, 'phone' => '+244923456789']);

        $this->postJson('/api/login', ['login' => $typed, 'password' => 'password'])->assertOk()->assertJson(['phone' => '+244923456789']);
    }

    public function test_register_requires_a_phone_or_an_email(): void
    {
        $this->postJson('/api/register', ['name' => 'Ana', 'password' => 'segredo123', 'password_confirmation' => 'segredo123'])
            ->assertUnprocessable()->assertJsonPath('errors.phone.0', 'Indique o número de telemóvel ou o e-mail.');
    }

    public function test_register_rejects_an_invalid_phone_number(): void
    {
        $this->postJson('/api/register', ['name' => 'Ana', 'phone' => '12345', 'password' => 'segredo123', 'password_confirmation' => 'segredo123'])
            ->assertUnprocessable()->assertJsonPath('errors.phone.0', 'Número de telemóvel inválido. Ex.: 923 456 789.');
    }

    public function test_register_rejects_a_phone_already_used_in_another_format(): void
    {
        User::factory()->create(['phone' => '+244923456789']);

        $this->postJson('/api/register', ['name' => 'Ana', 'phone' => '923 456 789', 'password' => 'segredo123', 'password_confirmation' => 'segredo123'])
            ->assertUnprocessable()->assertJsonPath('errors.phone.0', 'Já existe uma conta com este número. Entre ou peça ajuda para recuperar a senha.');
    }

    public function test_profile_can_drop_the_email_but_not_both_contacts(): void
    {
        $user = User::factory()->create(['email' => 'ana@exemplo.ao', 'phone' => null]);

        $this->actingAs($user)->putJson('/api/me', ['name' => 'Ana', 'email' => '', 'phone' => ''])
            ->assertUnprocessable()->assertJsonValidationErrors(['phone', 'email']);
        $this->actingAs($user)->putJson('/api/me', ['name' => 'Ana', 'email' => '', 'phone' => '923456789'])
            ->assertOk()->assertJson(['email' => null, 'phone' => '+244923456789']);
    }

    public function test_login_with_wrong_password_fails_with_generic_message(): void
    {
        User::factory()->create(['email' => 'ana@exemplo.ao']);

        $this->postJson('/api/login', ['login' => 'ana@exemplo.ao', 'password' => 'errada'])
            ->assertUnprocessable()->assertJsonPath('errors.login.0', 'Telemóvel, e-mail ou senha incorretos.');
    }

    public function test_disabled_account_cannot_login_and_loses_session(): void
    {
        $user = User::factory()->create(['email' => 'ana@exemplo.ao']);
        $this->postJson('/api/login', ['login' => 'ana@exemplo.ao', 'password' => 'password'])->assertOk();

        $user->forceFill(['disabled_at' => now()])->save();
        $this->app['auth']->forgetGuards(); // pedido seguinte: o utilizador volta a ser lido da base de dados
        $this->getJson('/api/me')->assertUnauthorized();

        $this->postJson('/api/login', ['login' => 'ana@exemplo.ao', 'password' => 'password'])->assertUnprocessable();
    }

    public function test_password_reset_flow(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'ana@exemplo.ao']);

        $this->postJson('/api/forgot-password', ['email' => 'ana@exemplo.ao'])->assertOk();
        $this->postJson('/api/forgot-password', ['email' => 'ninguem@exemplo.ao'])->assertOk(); // não revela se existe

        Notification::assertSentTo($user, ResetPassword::class);
        $token = Password::createToken($user);

        $this->postJson('/api/reset-password', ['email' => 'ana@exemplo.ao', 'token' => $token, 'password' => 'novasenha1', 'password_confirmation' => 'novasenha1'])->assertOk();
        $this->postJson('/api/login', ['login' => 'ana@exemplo.ao', 'password' => 'novasenha1'])->assertOk();
    }

    public function test_change_password_requires_current_one(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/change-password', ['current_password' => 'errada', 'password' => 'novasenha1', 'password_confirmation' => 'novasenha1'])
            ->assertUnprocessable()->assertJsonValidationErrors('current_password');
        $this->actingAs($user)->postJson('/api/change-password', ['current_password' => 'password', 'password' => 'novasenha1', 'password_confirmation' => 'novasenha1'])
            ->assertOk();
    }
}
