<?php

namespace App\Modules\Conteudos;

use App\Models\EventGuest;
use App\Models\EventMedia;

/**
 * Como um conteúdo aparece na galeria (convidados) e na gestão (organizador).
 */
class MediaPresenter
{
    /**
     * @return array<string, mixed>
     */
    public static function forGallery(EventMedia $m, ?EventGuest $guest, bool $manager = false): array
    {
        $mine = $guest !== null && $m->event_guest_id === $guest->id;

        return [
            'id' => $m->id,
            'type' => $m->media_type,
            'status' => $m->status,
            'width' => $m->width,
            'height' => $m->height,
            'duration' => $m->duration,
            'caption' => $m->caption,
            'author' => $m->guest_name,
            'created_at' => $m->created_at,
            'mine' => $mine,
            'can_delete' => $mine || $manager,
            'thumb_url' => MediaUrls::url($m, 'thumb', $manager),
            'preview_url' => MediaUrls::url($m, 'preview', $manager),
            'stream_url' => MediaUrls::url($m, 'stream', $manager),
            'download_url' => MediaUrls::url($m, 'download', $manager),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function forManager(EventMedia $m): array
    {
        return self::forGallery($m, null, true) + [
            'guest_id' => $m->event_guest_id,
            'by_organizer' => $m->user_id !== null,
            'original_name' => $m->original_name,
            'file_size' => $m->file_size,
            'original_url' => MediaUrls::url($m, 'original', true),
        ];
    }
}
