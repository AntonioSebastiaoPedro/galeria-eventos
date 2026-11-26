<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\EventExport;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use ZipArchive;

class ExportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    public function test_zip_contains_the_originals_of_approved_media(): void
    {
        $event = Event::factory()->plan('premium')->create(['title' => 'Casamento']);
        foreach (['Ana', 'Pedro'] as $name) {
            $this->postJson("/api/g/{$event->slug}/media", ['file' => UploadedFile::fake()->image('a.jpg'), 'name' => $name])->assertCreated();
        }

        $this->actingAs($event->user)->postJson("/api/events/{$event->id}/export")->assertCreated();
        $export = EventExport::sole();
        $this->assertSame(['ready', 2], [$export->status, $export->items]);

        $zip = new ZipArchive;
        $zip->open(Storage::disk('local')->path($export->path));
        $this->assertSame(['fotografias/0001-ana.jpg', 'fotografias/0002-pedro.jpg'], [$zip->getNameIndex(0), $zip->getNameIndex(1)]);
        $zip->close();

        $this->actingAs($event->user)->get("/api/exports/{$export->id}/download")->assertOk()->assertDownload('casamento.zip');
        $this->actingAs($event->user)->getJson("/api/events/{$event->id}/export")->assertJsonPath('status', 'ready');
    }

    public function test_zip_requires_a_plan_that_includes_it(): void
    {
        $event = Event::factory()->plan('basic')->create();

        $this->actingAs($event->user)->postJson("/api/events/{$event->id}/export")->assertForbidden();
    }

    public function test_only_the_organizer_downloads_the_zip(): void
    {
        $event = Event::factory()->create();
        $this->actingAs($event->user)->postJson("/api/events/{$event->id}/export")->assertCreated();

        $this->newBrowser()->get('/api/exports/'.EventExport::sole()->id.'/download', ['Accept' => 'application/json'])->assertUnauthorized();
    }
}
