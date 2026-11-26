<?php

namespace App\Modules\Conteudos\Actions;

use App\Models\EventMedia;
use App\Modules\Conteudos\Events\MediaChanged;
use App\Modules\Conteudos\MediaRules;
use Illuminate\Support\Facades\Storage;

/**
 * Apaga um conteúdo e os seus ficheiros (original, versão reduzida e miniatura). O espaço fica logo livre.
 */
class DeleteMedia
{
    public static function handle(EventMedia $media): void
    {
        Storage::disk(MediaRules::disk())->delete($media->paths());
        $eventId = $media->event_id;
        $id = $media->id;
        $media->delete();

        MediaChanged::dispatch($eventId, $id, 'deleted');
    }
}
