<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\EventGuest;
use App\Models\EventMedia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ModerationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    public function test_organizer_lists_media_by_status(): void
    {
        $event = Event::factory()->create();
        EventMedia::factory()->count(2)->for($event)->create();
        EventMedia::factory()->pending()->for($event)->create();
        EventMedia::factory()->for($event)->create(['status' => 'failed']);

        $this->actingAs($event->user)->getJson("/api/events/{$event->id}/media")->assertOk()->assertJsonPath('total', 3);
        $this->actingAs($event->user)->getJson("/api/events/{$event->id}/media?status=pending")->assertJsonPath('total', 1)
            ->assertJsonStructure(['data' => [['id', 'original_name', 'file_size', 'original_url', 'thumb_url']]]);
        $this->actingAs(User::factory()->create())->getJson("/api/events/{$event->id}/media")->assertNotFound();
    }

    public function test_only_pending_media_can_be_approved(): void
    {
        $media = EventMedia::factory()->create();

        $this->actingAs($media->event->user)->postJson("/api/media/{$media->id}/approve")->assertUnprocessable();
        $this->actingAs(User::factory()->create())->postJson("/api/media/{$media->id}/approve")->assertNotFound();
    }

    public function test_organizer_deletes_media_and_files(): void
    {
        $event = Event::factory()->create();
        $this->actingAs($event->user)->postJson("/api/events/{$event->id}/media", ['file' => UploadedFile::fake()->image('a.jpg')])->assertCreated()
            ->assertJsonPath('by_organizer', true);
        $media = EventMedia::sole();

        $this->actingAs($event->user)->deleteJson("/api/media/{$media->id}")->assertOk();

        $this->assertModelMissing($media);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_bulk_approve_and_delete_only_touch_this_event(): void
    {
        $event = Event::factory()->create();
        $pending = EventMedia::factory()->count(2)->pending()->for($event)->create();
        $foreign = EventMedia::factory()->pending()->create();

        $this->actingAs($event->user)->postJson("/api/events/{$event->id}/media/bulk", ['action' => 'approve', 'ids' => [...$pending->pluck('id'), $foreign->id]])
            ->assertOk()->assertJsonPath('affected', 2);
        $this->assertSame(['approved', 'approved'], $pending->map->fresh()->pluck('status')->all());
        $this->assertSame('pending', $foreign->fresh()->status);

        $this->actingAs($event->user)->postJson("/api/events/{$event->id}/media/bulk", ['action' => 'delete', 'ids' => $pending->pluck('id')])->assertOk();
        $this->assertSame(0, $event->media()->count());
    }

    public function test_blocking_a_guest_can_remove_everything_they_sent(): void
    {
        $event = Event::factory()->create();
        $guest = EventGuest::create(['event_id' => $event->id, 'name' => 'Spam']);
        EventMedia::factory()->count(3)->for($event)->create(['event_guest_id' => $guest->id]);
        EventMedia::factory()->for($event)->create();

        $this->actingAs($event->user)->getJson("/api/events/{$event->id}/guests")->assertJsonPath('data.0.photos', 3);
        $this->actingAs($event->user)->postJson("/api/guests/{$guest->id}/block", ['remove_media' => true])->assertOk()->assertJson(['blocked' => true, 'photos' => 0]);

        $this->assertSame(1, $event->media()->count());
        $this->actingAs($event->user)->postJson("/api/guests/{$guest->id}/unblock")->assertJson(['blocked' => false]);
    }
}
