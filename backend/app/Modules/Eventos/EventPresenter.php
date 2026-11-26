<?php

namespace App\Modules\Eventos;

use App\Models\Event;
use App\Modules\Conteudos\MediaRules;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;

/**
 * Como um evento aparece ao organizador (gestão) e aos convidados (cabeçalho da galeria).
 */
class EventPresenter
{
    /**
     * A capa sai por URL assinada, como as fotografias (ver MediaUrls).
     */
    public static function coverUrl(Event $event): ?string
    {
        if (! $event->cover_path) {
            return null;
        }
        $block = max(1, (int) config('media.url_ttl_hours')) * 3600;

        return URL::temporarySignedRoute('events.cover', (intdiv(time(), $block) + 2) * $block, ['event' => $event->id, 'v' => substr(md5($event->cover_path), 0, 8)], absolute: false);
    }

    /**
     * Contagens por tipo e estado, numa só consulta.
     *
     * @return array{photos: int, videos: int, pending: int, processing: int, storage_used: int, storage_limit: int}
     */
    public static function counts(Event $event): array
    {
        $rows = DB::table('event_media')->where('event_id', $event->id)->where('status', '!=', 'failed')
            ->selectRaw('media_type, status, count(*) as n, coalesce(sum(file_size), 0) as bytes')
            ->groupBy('media_type', 'status')->get();

        return [
            'photos' => (int) $rows->where('media_type', 'photo')->where('status', 'approved')->sum('n'),
            'videos' => (int) $rows->where('media_type', 'video')->where('status', 'approved')->sum('n'),
            'pending' => (int) $rows->where('status', 'pending')->sum('n'),
            'processing' => (int) $rows->where('status', 'processing')->sum('n'),
            'storage_used' => (int) $rows->sum('bytes'),
            'storage_limit' => $event->storageLimitBytes(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function forManager(Event $event): array
    {
        return [
            'id' => $event->id,
            'title' => $event->title,
            'slug' => $event->slug,
            'description' => $event->description,
            'event_type' => $event->event_type,
            'event_date' => $event->event_date?->format('Y-m-d'),
            'visibility' => $event->visibility,
            'has_access_code' => $event->access_code !== null,
            'upload_enabled' => $event->upload_enabled,
            'allow_videos' => $event->allow_videos,
            'moderation' => $event->moderation,
            'status' => $event->status,
            'plan' => ['key' => $event->plan] + $event->planRules(),
            'cover_url' => self::coverUrl($event),
            'guest_url' => $event->guestUrl(),
            'owner' => $event->relationLoaded('user') ? $event->user?->only('id', 'name', 'email') : null,
            'counts' => self::counts($event),
            'created_at' => $event->created_at,
        ];
    }

    /**
     * Cabeçalho da galeria para os convidados. Sem acesso, só o mínimo para a página de entrada.
     *
     * @return array<string, mixed>
     */
    public static function forGallery(Event $event, bool $canView): array
    {
        $base = [
            'slug' => $event->slug,
            'title' => $event->title,
            'event_type' => $event->event_type,
            'event_date' => $event->event_date?->format('Y-m-d'),
            'visibility' => $event->visibility,
            'has_access_code' => $event->access_code !== null,
        ];
        if (! $canView) {
            return $base;
        }
        $counts = self::counts($event);

        return $base + [
            'description' => $event->description,
            'cover_url' => self::coverUrl($event),
            'upload_enabled' => $event->upload_enabled && $event->isActive(),
            'moderation' => $event->moderation,
            'photos' => $counts['photos'],
            'videos' => $counts['videos'],
            'storage_full' => $counts['storage_used'] >= $counts['storage_limit'],
            'rules' => MediaRules::forEvent($event),
        ];
    }
}
