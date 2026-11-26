<?php

namespace App\Modules\Conteudos;

use App\Models\Event;

/**
 * Limites dos ficheiros (config/media.php) e o que cada evento aceita, conforme o plano e as definições.
 */
class MediaRules
{
    public static function disk(): string
    {
        return config('media.disk');
    }

    /**
     * 'photo', 'video' ou null quando o tipo não é aceite.
     */
    public static function typeOf(string $mime): ?string
    {
        return match (true) {
            array_key_exists($mime, config('media.photo_mimes')) => 'photo',
            array_key_exists($mime, config('media.video_mimes')) => 'video',
            default => null,
        };
    }

    public static function extensionOf(string $mime): string
    {
        return config('media.photo_mimes')[$mime] ?? config('media.video_mimes')[$mime] ?? 'bin';
    }

    public static function maxBytes(string $type): int
    {
        return ($type === 'video' ? config('media.video_max_mb') : config('media.photo_max_mb')) * 1024 * 1024;
    }

    /**
     * O que o formulário de envio precisa de saber, para validar no telemóvel antes de gastar dados.
     *
     * @return array{photo_max_mb: int, video_max_mb: int, videos: bool, photo_types: string[], video_types: string[], caption_max: int}
     */
    public static function forEvent(Event $event): array
    {
        return [
            'photo_max_mb' => config('media.photo_max_mb'),
            'video_max_mb' => config('media.video_max_mb'),
            'videos' => $event->videosAllowed(),
            'photo_types' => array_keys(config('media.photo_mimes')),
            'video_types' => array_keys(config('media.video_mimes')),
            'caption_max' => config('media.caption_max'),
        ];
    }
}
