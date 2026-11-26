<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\EventMedia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class EventTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    private function payload(array $extra = []): array
    {
        return $extra + ['title' => 'Casamento de Ana & Pedro', 'event_type' => 'wedding', 'event_date' => '2026-11-15'];
    }

    public function test_organizer_creates_private_event_with_link_and_free_plan(): void
    {
        $user = User::factory()->create();

        $r = $this->actingAs($user)->postJson('/api/events', $this->payload())->assertCreated()
            ->assertJsonPath('visibility', 'private')
            ->assertJsonPath('plan.key', 'free')
            ->assertJsonPath('counts.photos', 0);

        $event = Event::find($r->json('id'));
        $this->assertStringStartsWith('casamento-de-ana-pedro-', $event->slug);
        $this->assertSame(32, strlen($event->access_key));
        $this->assertStringEndsWith('/g/'.$event->slug.'?k='.$event->access_key, $r->json('guest_url'));
    }

    public function test_free_plan_is_limited_per_organizer(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->postJson('/api/events', $this->payload())->assertCreated();

        $this->actingAs($user)->postJson('/api/events', $this->payload())->assertUnprocessable()->assertJsonValidationErrors('title');

        Event::where('user_id', $user->id)->update(['plan' => 'basic']);
        $this->actingAs($user)->postJson('/api/events', $this->payload())->assertCreated();
    }

    public function test_validation_messages(): void
    {
        $this->actingAs(User::factory()->create())->postJson('/api/events', ['event_type' => 'x'])
            ->assertUnprocessable()->assertJsonValidationErrors(['title', 'event_type', 'event_date']);
    }

    public function test_only_the_owner_or_superadmin_manages_an_event(): void
    {
        $event = Event::factory()->create();

        $this->actingAs(User::factory()->create())->getJson("/api/events/{$event->id}")->assertNotFound();
        $this->actingAs(User::factory()->create())->putJson("/api/events/{$event->id}", ['title' => 'X'])->assertNotFound();
        $this->actingAs(User::factory()->superadmin()->create())->getJson("/api/events/{$event->id}")->assertOk();
        $this->actingAs($event->user)->getJson("/api/events/{$event->id}")->assertOk();
        $this->newBrowser()->getJson("/api/events/{$event->id}")->assertUnauthorized();
    }

    public function test_organizer_updates_settings_and_access_code(): void
    {
        $event = Event::factory()->private()->create();

        $this->actingAs($event->user)->putJson("/api/events/{$event->id}", [
            'title' => 'Novo nome', 'upload_enabled' => false, 'moderation' => 'manual', 'status' => 'disabled', 'access_code' => '2026',
        ])->assertOk()->assertJson(['title' => 'Novo nome', 'upload_enabled' => false, 'moderation' => 'manual', 'status' => 'disabled', 'has_access_code' => true]);

        $this->actingAs($event->user)->putJson("/api/events/{$event->id}", ['access_code' => ''])->assertJsonPath('has_access_code', true);
        $this->actingAs($event->user)->putJson("/api/events/{$event->id}", ['remove_access_code' => true])->assertJsonPath('has_access_code', false);
    }

    public function test_regenerating_key_changes_the_link(): void
    {
        $event = Event::factory()->private()->create();
        $old = $event->access_key;

        $r = $this->actingAs($event->user)->postJson("/api/events/{$event->id}/regenerate-key")->assertOk();

        $this->assertNotSame($old, $event->fresh()->access_key);
        $this->assertSame(2, $event->fresh()->access_version);
        $this->assertStringContainsString($event->fresh()->access_key, $r->json('guest_url'));
    }

    public function test_qr_code_contains_png(): void
    {
        $event = Event::factory()->create();

        $r = $this->actingAs($event->user)->getJson("/api/events/{$event->id}/qr")->assertOk();
        $this->assertStringStartsWith('data:image/png;base64,', $r->json('qr_png'));
        $this->assertStringEndsWith('/g/'.$event->slug, $r->json('url'));
    }

    public function test_cover_upload_is_served_by_signed_url(): void
    {
        $event = Event::factory()->create();

        $url = $this->actingAs($event->user)->postJson("/api/events/{$event->id}/cover", ['cover' => UploadedFile::fake()->image('capa.jpg', 3000, 2000)])
            ->assertOk()->json('cover_url');

        $this->newBrowser()->get($url)->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->get("/api/events/{$event->id}/cover")->assertForbidden();
    }

    public function test_deleting_event_requires_title_and_removes_files(): void
    {
        $event = Event::factory()->create(['title' => 'Festa']);
        Storage::disk('local')->put("events/{$event->id}/originals/a.jpg", 'x');

        $this->actingAs($event->user)->deleteJson("/api/events/{$event->id}", ['confirm' => 'Outra'])->assertUnprocessable();
        $this->actingAs($event->user)->deleteJson("/api/events/{$event->id}", ['confirm' => 'Festa'])->assertOk();

        $this->assertModelMissing($event);
        Storage::disk('local')->assertMissing("events/{$event->id}/originals/a.jpg");
    }

    public function test_stats_count_participation(): void
    {
        $event = Event::factory()->create();
        EventMedia::factory()->count(3)->for($event)->create(['guest_name' => 'Ana']);
        EventMedia::factory()->video()->for($event)->create(['guest_name' => 'Pedro']);
        EventMedia::factory()->pending()->for($event)->create(['guest_name' => 'Pedro']);

        $this->actingAs($event->user)->getJson("/api/events/{$event->id}/stats")->assertOk()
            ->assertJsonPath('counts.photos', 3)
            ->assertJsonPath('counts.videos', 1)
            ->assertJsonPath('counts.pending', 1)
            ->assertJsonPath('top_contributors.0.name', 'Ana')
            ->assertJsonPath('top_contributors.0.total', 3);
    }

    public function test_plans_are_public(): void
    {
        $this->getJson('/api/plans')->assertOk()->assertJsonCount(4)->assertJsonPath('0.key', 'free');
    }
}
