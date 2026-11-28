<?php

namespace App\Http\Controllers;

use App\Models\EventMedia;
use App\Modules\Conteudos\FileDelivery;
use App\Modules\Conteudos\MediaRules;
use App\Modules\Conteudos\MediaUrls;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Entrega os ficheiros pelas URLs assinadas (MediaUrls). A assinatura é a autorização: só é gerada para quem
 * pode ver o conteúdo, e expira. Suporta pedidos parciais (Range), necessários para avançar nos vídeos.
 */
class MediaFileController extends Controller
{
    public function show(Request $request, EventMedia $media, string $variant): Response
    {
        $manager = $request->query('m') === '1';
        abort_unless($manager || $media->event->isActive(), 404);
        abort_if($media->status === 'failed', 404);

        $path = MediaUrls::path($media, $variant, $manager);
        $disk = Storage::disk(MediaRules::disk());
        abort_unless($path && $disk->exists($path), 404);

        // As versões geradas são sempre JPEG; o original guarda o tipo com que foi enviado.
        $headers = ['Cache-Control' => FileDelivery::CACHE_SIGNED, 'Content-Type' => $path !== $media->original_path ? 'image/jpeg' : $media->mime_type];
        $download = null;
        if ($variant === 'download' || $variant === 'original') {
            $download = (Str::slug(Str::limit($media->event->title, 40, '')) ?: 'evento').'-'.$media->id.'.'.pathinfo($path, PATHINFO_EXTENSION);
        }

        return FileDelivery::send($path, $headers, $download);
    }
}
