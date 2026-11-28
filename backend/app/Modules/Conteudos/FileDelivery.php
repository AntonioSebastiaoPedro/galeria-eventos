<?php

namespace App\Modules\Conteudos;

use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Symfony\Component\HttpFoundation\Response;

/**
 * Entrega um ficheiro do disco de media depois de o PHP o autorizar.
 *
 * Em produção (media.x_accel) o PHP só responde com o cabeçalho X-Accel-Redirect e é o nginx que envia o ficheiro
 * (location /_protected/ em docker/nginx/prod.conf): o processo PHP fica livre logo, mesmo para um vídeo de
 * 300 MB visto devagar numa rede móvel, e o nginx trata dos pedidos parciais (Range), do ETag e do Last-Modified.
 * O nginx mantém do PHP os cabeçalhos Content-Type, Content-Disposition e Cache-Control.
 */
class FileDelivery
{
    // As URLs assinadas mudam a cada bloco de horas (MediaUrls) e o conteúdo de uma URL nunca muda:
    // o navegador pode reutilizar o ficheiro sem perguntar ao servidor, mesmo depois de actualizar a página.
    public const CACHE_SIGNED = 'private, max-age=43200, immutable';

    /**
     * @param  array<string, string>  $headers
     * @param  string|null  $download  nome do ficheiro quando é para descarregar (Content-Disposition: attachment)
     */
    public static function send(string $path, array $headers = [], ?string $download = null): Response
    {
        $disk = Storage::disk(MediaRules::disk());
        $headers['X-Content-Type-Options'] = 'nosniff';

        if (! config('media.x_accel')) {
            $response = response()->file($disk->path($path), $headers);
            if ($download !== null) {
                $response->setContentDisposition('attachment', $download, self::fallbackName($download));
            }

            return $response;
        }

        $headers['Content-Type'] ??= $disk->mimeType($path) ?: 'application/octet-stream';
        if ($download !== null) {
            $headers['Content-Disposition'] = HeaderUtils::makeDisposition('attachment', $download, self::fallbackName($download));
        }
        $headers['X-Accel-Redirect'] = '/_protected/'.implode('/', array_map('rawurlencode', explode('/', ltrim($path, '/'))));

        return response('', 200, $headers);
    }

    // Versão só com ASCII do nome, para navegadores antigos (o nome completo vai em filename*).
    private static function fallbackName(string $name): string
    {
        return preg_replace('/[^\x20-\x7e]|[%\/\\\\]/', '_', $name) ?? 'ficheiro';
    }
}
