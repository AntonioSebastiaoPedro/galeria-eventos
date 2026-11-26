<?php

namespace App\Modules\Conteudos;

use App\Models\EventMedia;
use Illuminate\Support\Facades\URL;

/**
 * Os ficheiros nunca são públicos: saem por URLs assinadas e temporárias (rota media.file).
 * A validade é arredondada a blocos de horas para que a mesma imagem tenha a mesma URL durante um bloco
 * e o navegador a possa guardar em cache.
 *
 * Variantes: thumb (grelha), preview (fotografia reduzida sem metadados / capa do vídeo),
 * stream (vídeo para reproduzir), download (convidados: versão sem metadados; organizador: original)
 * e original (só para o organizador).
 */
class MediaUrls
{
    public const VARIANTS = ['thumb', 'preview', 'stream', 'download', 'original'];

    public static function url(EventMedia $media, string $variant, bool $manager = false): ?string
    {
        if (! self::path($media, $variant, $manager)) {
            return null;
        }
        $block = max(1, (int) config('media.url_ttl_hours')) * 3600;
        $expires = (intdiv(time(), $block) + 2) * $block; // entre 1 e 2 blocos de validade

        $params = ['media' => $media->id, 'variant' => $variant];
        if ($manager) {
            $params['m'] = 1; // a assinatura cobre este parâmetro: só quem gere o evento recebe URLs com ele
        }

        return URL::temporarySignedRoute('media.file', $expires, $params, absolute: false);
    }

    /**
     * Caminho no disco para a variante pedida, ou null se não existir / não for permitida.
     */
    public static function path(EventMedia $media, string $variant, bool $manager): ?string
    {
        return match ($variant) {
            'thumb' => $media->thumbnail_path,
            'preview' => $media->preview_path,
            'stream' => $media->isVideo() ? $media->original_path : null,
            'download' => $manager || $media->isVideo() ? $media->original_path : $media->preview_path,
            'original' => $manager ? $media->original_path : null,
            default => null,
        };
    }
}
