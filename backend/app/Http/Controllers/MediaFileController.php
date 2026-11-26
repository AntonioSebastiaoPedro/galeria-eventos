<?php

namespace App\Http\Controllers;

use App\Models\EventMedia;
use App\Modules\Conteudos\MediaRules;
use App\Modules\Conteudos\MediaUrls;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;

/**
 * Entrega os ficheiros pelas URLs assinadas (MediaUrls). A assinatura é a autorização: só é gerada para quem
 * pode ver o conteúdo, e expira. Suporta pedidos parciais (Range), necessários para avançar nos vídeos.
 */
class MediaFileController extends Controller
{
    public function show(Request $request, EventMedia $media, string $variant): BinaryFileResponse
    {
        $manager = $request->query('m') === '1';
        abort_unless($manager || $media->event->isActive(), 404);
        abort_if($media->status === 'failed', 404);

        $path = MediaUrls::path($media, $variant, $manager);
        $disk = Storage::disk(MediaRules::disk());
        abort_unless($path && $disk->exists($path), 404);

        $headers = ['Cache-Control' => 'private, max-age=21600', 'X-Content-Type-Options' => 'nosniff'];
        $isJpeg = $path !== $media->original_path; // as versões geradas são sempre JPEG
        $headers['Content-Type'] = $isJpeg ? 'image/jpeg' : $media->mime_type;

        $response = response()->file($disk->path($path), $headers);
        if ($variant === 'download' || $variant === 'original') {
            $ext = pathinfo($path, PATHINFO_EXTENSION);
            $name = (Str::slug(Str::limit($media->event->title, 40, '')) ?: 'evento').'-'.$media->id.'.'.$ext;
            $response->setContentDisposition(ResponseHeaderBag::DISPOSITION_ATTACHMENT, $name);
        }

        return $response;
    }
}
