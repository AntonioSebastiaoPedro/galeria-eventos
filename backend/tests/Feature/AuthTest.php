<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Notificacoes\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
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

    public function test_login_with_wrong_password_fails_with_generic_message(): void
    {
        User::factory()->create(['email' => 'ana@exemplo.ao']);

        $this->postJson('/api/login', ['email' => 'ana@exemplo.ao', 'password' => 'errada'])
            ->assertUnprocessable()->assertJsonPath('errors.email.0', 'E-mail ou senha incorretos.');
    }

    public function test_disabled_account_cannot_login_and_loses_session(): void
    {
        $user = User::factory()->create(['email' => 'ana@exemplo.ao']);
        $this->postJson('/api/login', ['email' => 'ana@exemplo.ao', 'password' => 'password'])->assertOk();

        $user->forceFill(['disabled_at' => now()])->save();
        $this->app['auth']->forgetGuards(); // pedido seguinte: o utilizador volta a ser lido da base de dados
        $this->getJson('/api/me')->assertUnauthorized();

        $this->postJson('/api/login', ['email' => 'ana@exemplo.ao', 'password' => 'password'])->assertUnprocessable();
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
        $this->postJson('/api/login', ['email' => 'ana@exemplo.ao', 'password' => 'novasenha1'])->assertOk();
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
