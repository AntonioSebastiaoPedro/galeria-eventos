<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_superadmin_reaches_the_admin_area(): void
    {
        $this->actingAs(User::factory()->create())->getJson('/api/admin/overview')->assertForbidden();
        $this->actingAs(User::factory()->superadmin()->create())->getJson('/api/admin/overview')->assertOk()->assertJsonStructure(['organizers', 'events', 'media', 'storage_used']);
    }

    public function test_superadmin_changes_the_plan_of_an_event(): void
    {
        $event = Event::factory()->plan('free')->create();

        $this->actingAs(User::factory()->superadmin()->create())->putJson("/api/admin/events/{$event->id}/plan", ['plan' => 'exclusive'])
            ->assertOk()->assertJsonPath('plan.key', 'exclusive')->assertJsonPath('plan.storage_mb', 30 * 1024);
        $this->actingAs(User::factory()->superadmin()->create())->putJson("/api/admin/events/{$event->id}/plan", ['plan' => 'gold'])->assertUnprocessable();
    }

    public function test_superadmin_searches_events_and_users(): void
    {
        $admin = User::factory()->superadmin()->create();
        Event::factory()->create(['title' => 'Baptizado do Kiami']);
        Event::factory()->create(['title' => 'Formatura']);

        $this->actingAs($admin)->getJson('/api/admin/events?search=kiami')->assertJsonPath('total', 1)->assertJsonPath('data.0.owner.name', fn ($n) => is_string($n));
        $this->actingAs($admin)->getJson('/api/admin/users')->assertJsonPath('total', 3);
    }

    public function test_superadmin_disables_and_enables_an_organizer(): void
    {
        $admin = User::factory()->superadmin()->create();
        $user = User::factory()->create();

        $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/disable")->assertOk();
        $this->assertTrue($user->fresh()->isDisabled());
        $this->actingAs($admin)->postJson("/api/admin/users/{$admin->id}/disable")->assertUnprocessable();
        $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/enable")->assertOk();
        $this->assertFalse($user->fresh()->isDisabled());
    }

    public function test_admin_resets_the_password_of_an_account_without_email(): void
    {
        $user = User::factory()->create(['email' => null, 'phone' => '+244923456789']);

        $password = $this->actingAs(User::factory()->superadmin()->create())->postJson("/api/admin/users/{$user->id}/reset-password")
            ->assertOk()->json('password');

        $this->newBrowser();
        $this->postJson('/api/login', ['login' => '923456789', 'password' => $password])->assertOk();
        $this->newBrowser();
        $this->postJson('/api/login', ['login' => '923456789', 'password' => 'password'])->assertUnprocessable();
    }

    public function test_organizers_cannot_reset_passwords(): void
    {
        $user = User::factory()->create();

        $this->actingAs(User::factory()->create())->postJson("/api/admin/users/{$user->id}/reset-password")->assertForbidden();
    }

    public function test_admin_finds_accounts_by_phone_typed_with_spaces(): void
    {
        User::factory()->create(['name' => 'Ana', 'email' => null, 'phone' => '+244923456789']);
        User::factory()->create(['name' => 'Pedro']);

        $this->actingAs(User::factory()->superadmin()->create())->getJson('/api/admin/users?search=923 456')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Ana');
    }
}
