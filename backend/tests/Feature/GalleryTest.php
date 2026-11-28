<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\EventMedia;
use App\Modules\Conteudos\VideoProcessor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class GalleryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    private function upload(Event $event, ?UploadedFile $file = null, array $extra = [])
    {
        return $this->postJson("/api/g/{$event->slug}/media", $extra + [
            'file' => $file ?? UploadedFile::fake()->image('foto.jpg', 1200, 900),
            'name' => 'Ana',
        ]);
    }

    public function test_public_gallery_is_open_without_account(): void
    {
        $event = Event::factory()->create(['title' => 'Aniversário da Dicla']);

        $this->getJson("/api/g/{$event->slug}")->assertOk()
            ->assertJson(['title' => 'Aniversário da Dicla', 'access' => 'granted', 'upload_enabled' => true])
            ->assertJsonMissingPath('access_key');
        $this->getJson("/api/g/{$event->slug}/media")->assertOk()->assertJsonPath('total', 0);
    }

    public function test_private_gallery_needs_the_key_or_the_code(): void
    {
        $event = Event::factory()->private('1234')->create();

        $this->getJson("/api/g/{$event->slug}")->assertOk()->assertJson(['access' => 'needs_access', 'has_access_code' => true])
            ->assertJsonMissingPath('description')->assertJsonMissingPath('cover_url');
        $this->getJson("/api/g/{$event->slug}/media")->assertForbidden();
        $this->postJson("/api/g/{$event->slug}/access", ['code' => '0000'])->assertUnprocessable()->assertJsonValidationErrors('code');
        $this->postJson("/api/g/{$event->slug}/access", ['key' => 'errada'])->assertUnprocessable()->assertJsonValidationErrors('key');

        $this->postJson("/api/g/{$event->slug}/access", ['code' => '1234'])->assertOk()->assertJsonPath('access', 'granted');
        $this->getJson("/api/g/{$event->slug}/media")->assertOk();

        $this->newBrowser()->postJson("/api/g/{$event->slug}/access", ['key' => $event->access_key])->assertOk()->assertJsonPath('access', 'granted');
        $this->getJson("/api/g/{$event->slug}/media")->assertOk();
    }

    public function test_regenerating_the_key_sends_guests_back_to_the_entrance(): void
    {
        $event = Event::factory()->private()->create();
        $this->postJson("/api/g/{$event->slug}/access", ['key' => $event->access_key])->assertOk();

        $event->update(['access_key' => Event::makeAccessKey(), 'access_version' => 2]);

        $this->getJson("/api/g/{$event->slug}")->assertJsonPath('access', 'needs_access');
        $this->postJson("/api/g/{$event->slug}/access", ['key' => $event->access_key])->assertJsonPath('access', 'granted');
    }

    public function test_disabled_gallery_is_closed_to_guests_but_not_to_the_organizer(): void
    {
        $event = Event::factory()->create(['status' => 'disabled']);

        $this->getJson("/api/g/{$event->slug}")->assertOk()->assertJsonPath('access', 'disabled');
        $this->getJson("/api/g/{$event->slug}/media")->assertStatus(423);
        $this->actingAs($event->user)->getJson("/api/g/{$event->slug}")->assertJson(['access' => 'granted', 'is_manager' => true]);
    }

    public function test_only_the_organizer_gets_the_event_id_to_return_to_management(): void
    {
        $event = Event::factory()->create();

        $this->getJson("/api/g/{$event->slug}")->assertJson(['is_manager' => false, 'manage_id' => null]);
        $this->actingAs($event->user)->getJson("/api/g/{$event->slug}")->assertJson(['is_manager' => true, 'manage_id' => $event->id]);
    }

    public function test_guest_uploads_a_photo_that_is_processed_and_published(): void
    {
        $event = Event::factory()->create();

        $this->upload($event, null, ['caption' => 'Que noite!'])->assertCreated()->assertJson(['type' => 'photo', 'author' => 'Ana', 'mine' => true]);

        $media = EventMedia::sole();
        $this->assertSame('approved', $media->status);
        $this->assertSame([1200, 900], [$media->width, $media->height]);
        Storage::disk('local')->assertExists([$media->original_path, $media->preview_path, $media->thumbnail_path]);
        $this->assertSame('Ana', $media->guest->name);

        $item = $this->newBrowser()->getJson("/api/g/{$event->slug}/media")->assertOk()
            ->assertJsonPath('data.0.caption', 'Que noite!')->assertJsonPath('data.0.mine', false)->json('data.0');
        $this->get($item['thumb_url'])->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->assertNotNull($item['download_url']);
    }

    public function test_guest_must_give_a_name_to_upload(): void
    {
        $event = Event::factory()->create();

        $this->upload($event, null, ['name' => ''])->assertUnprocessable()->assertJsonValidationErrors('name');
    }

    public function test_files_are_only_served_with_a_valid_signature(): void
    {
        $event = Event::factory()->create();
        $this->upload($event)->assertCreated();
        $media = EventMedia::sole();

        $this->get("/api/media/{$media->id}/thumb")->assertForbidden();
        $this->get("/api/media/{$media->id}/original")->assertForbidden();
    }

    public function test_guests_download_the_version_without_metadata_and_never_the_original(): void
    {
        $event = Event::factory()->create();
        $this->upload($event)->assertCreated();
        $media = EventMedia::sole();

        $item = $this->getJson("/api/g/{$event->slug}/media")->json('data.0');
        $this->assertArrayNotHasKey('original_url', $item);
        $response = $this->get($item['download_url'])->assertOk();
        $this->assertSame(Storage::disk('local')->path($media->preview_path), $response->baseResponse->getFile()->getPathname());
    }

    public function test_in_production_nginx_sends_the_authorized_file(): void
    {
        config(['media.x_accel' => true]);
        $event = Event::factory()->create(['title' => 'Casamento']);
        $this->upload($event)->assertCreated();
        $media = EventMedia::sole();
        $item = $this->getJson("/api/g/{$event->slug}/media")->json('data.0');

        $this->get($item['thumb_url'])->assertOk()
            ->assertHeader('X-Accel-Redirect', '/_protected/'.$media->thumbnail_path)
            ->assertHeader('Content-Type', 'image/jpeg')
            ->assertHeader('Cache-Control', 'immutable, max-age=43200, private');
        $this->assertSame('', $this->get($item['thumb_url'])->getContent());

        $this->get($item['download_url'])->assertOk()
            ->assertHeader('X-Accel-Redirect', '/_protected/'.$media->preview_path)
            ->assertDownload("casamento-{$media->id}.jpg");

        $this->get("/api/media/{$media->id}/thumb")->assertForbidden()->assertHeaderMissing('X-Accel-Redirect');
    }

    public function test_manual_moderation_hides_uploads_until_approved(): void
    {
        $event = Event::factory()->moderated()->create();
        $this->upload($event)->assertCreated()->assertJsonPath('status', 'processing');
        $media = EventMedia::sole();
        $this->assertSame('pending', $media->status);

        // o próprio convidado vê o que enviou, com o estado
        $this->getJson("/api/g/{$event->slug}/media")->assertJsonPath('total', 1)->assertJsonPath('data.0.status', 'pending');
        // os outros não
        $this->newBrowser()->getJson("/api/g/{$event->slug}/media")->assertJsonPath('total', 0);

        $this->actingAs($event->user)->postJson("/api/media/{$media->id}/approve")->assertOk();
        $this->newBrowser()->getJson("/api/g/{$event->slug}/media")->assertJsonPath('total', 1);
    }

    public function test_organizer_uploads_are_published_without_moderation(): void
    {
        $event = Event::factory()->moderated()->create();

        $this->actingAs($event->user)->postJson("/api/g/{$event->slug}/media", ['file' => UploadedFile::fake()->image('a.jpg')])->assertCreated();
        $this->assertSame('approved', EventMedia::sole()->status);
    }

    public function test_closed_uploads_are_refused(): void
    {
        $event = Event::factory()->create(['upload_enabled' => false]);

        $this->upload($event)->assertForbidden();
        $this->getJson("/api/g/{$event->slug}")->assertJsonPath('upload_enabled', false);
    }

    public function test_unsupported_files_are_refused(): void
    {
        $event = Event::factory()->create();

        $this->upload($event, UploadedFile::fake()->create('virus.exe', 10, 'application/x-msdownload'))
            ->assertUnprocessable()->assertJsonValidationErrors('file');
        $this->upload($event, UploadedFile::fake()->create('foto.heic', 10, 'image/heic'))->assertUnprocessable();
        $this->assertSame(0, EventMedia::count());
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_photo_size_limit(): void
    {
        config(['media.photo_max_mb' => 1]);
        $event = Event::factory()->create();

        $this->upload($event, UploadedFile::fake()->create('grande.jpg', 2048, 'image/jpeg'))
            ->assertUnprocessable()->assertJsonPath('errors.file.0', 'Cada fotografia pode ter no máximo 1 MB.');
    }

    public function test_free_plan_has_no_videos(): void
    {
        $event = Event::factory()->plan('free')->create();

        $this->upload($event, UploadedFile::fake()->create('video.mp4', 100, 'video/mp4'))
            ->assertUnprocessable()->assertJsonPath('errors.file.0', 'O plano deste evento não inclui vídeos.');
        $this->getJson("/api/g/{$event->slug}")->assertJsonPath('rules.videos', false);
    }

    public function test_organizer_can_turn_videos_off(): void
    {
        $event = Event::factory()->create(['allow_videos' => false]);

        $this->upload($event, UploadedFile::fake()->create('video.mp4', 100, 'video/mp4'))
            ->assertUnprocessable()->assertJsonPath('errors.file.0', 'O organizador não permite vídeos nesta galeria.');
    }

    public function test_storage_limit_of_the_plan(): void
    {
        config(['plans.plans.basic.storage_mb' => 1]);
        $event = Event::factory()->plan('basic')->create();
        EventMedia::factory()->for($event)->create(['file_size' => 1024 * 1024 - 100]);

        $this->upload($event)->assertUnprocessable()->assertJsonPath('errors.file.0', 'A galeria atingiu o limite de armazenamento do plano. Fale com o organizador.');
        $this->assertSame([], Storage::disk('local')->allFiles()); // o ficheiro recusado não fica no disco
    }

    public function test_photo_count_limit_of_the_free_plan(): void
    {
        config(['plans.plans.free.max_photos' => 2]);
        $event = Event::factory()->plan('free')->create();
        EventMedia::factory()->count(2)->for($event)->create(['file_size' => 10]);

        $this->upload($event)->assertUnprocessable()->assertJsonPath('errors.file.0', 'A galeria atingiu o limite de 2 fotografias do plano. Fale com o organizador.');
    }

    public function test_invalid_image_is_marked_failed_and_removed(): void
    {
        $event = Event::factory()->create();

        $this->upload($event, UploadedFile::fake()->createWithContent('foto.jpg', 'não é uma imagem')->mimeType('image/jpeg'))->assertCreated();

        $this->assertSame('failed', EventMedia::sole()->status);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_guest_deletes_only_what_they_uploaded(): void
    {
        $event = Event::factory()->create();
        $this->upload($event)->assertCreated();
        $mine = EventMedia::sole();
        $other = EventMedia::factory()->for($event)->create();

        $this->deleteJson("/api/g/{$event->slug}/media/{$other->id}")->assertForbidden();
        $this->deleteJson("/api/g/{$event->slug}/media/{$mine->id}")->assertOk();
        $this->assertModelMissing($mine);
        Storage::disk('local')->assertMissing($mine->original_path);
    }

    public function test_blocked_guest_loses_access(): void
    {
        $event = Event::factory()->create();
        $this->upload($event)->assertCreated();
        $guest = EventMedia::sole()->guest;

        $guest->update(['blocked_at' => now()]);

        $this->getJson("/api/g/{$event->slug}")->assertJsonPath('access', 'blocked');
        $this->upload($event)->assertForbidden();
    }

    public function test_guest_name_is_remembered(): void
    {
        $event = Event::factory()->create();

        $this->putJson("/api/g/{$event->slug}/me", ['name' => '  Tia Rosa '])->assertOk()->assertJson(['name' => 'Tia Rosa']);
        $this->getJson("/api/g/{$event->slug}")->assertJsonPath('guest.name', 'Tia Rosa');
    }

    public function test_video_gets_poster_and_duration(): void
    {
        if (! VideoProcessor::available()) {
            $this->markTestSkipped('FFmpeg não está instalado.');
        }
        $path = sys_get_temp_dir().'/teste-'.uniqid().'.mp4';
        Process::run(['ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=320x240:rate=10', '-pix_fmt', 'yuv420p', $path])->throw();
        $event = Event::factory()->create();

        $this->upload($event, new UploadedFile($path, 'video.mp4', 'video/mp4', null, true))->assertCreated();

        $media = EventMedia::sole();
        $this->assertSame(['video', 'approved', 320, 240], [$media->media_type, $media->status, $media->width, $media->height]);
        $this->assertEqualsWithDelta(2.0, $media->duration, 0.2);
        Storage::disk('local')->assertExists([$media->preview_path, $media->thumbnail_path]);

        $item = $this->getJson("/api/g/{$event->slug}/media")->json('data.0');
        $this->get($item['stream_url'])->assertOk()->assertHeader('Accept-Ranges', 'bytes');
    }
}
