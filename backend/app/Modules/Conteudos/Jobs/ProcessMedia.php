<?php

namespace App\Modules\Conteudos\Jobs;

use App\Models\EventMedia;
use App\Modules\Conteudos\Events\MediaChanged;
use App\Modules\Conteudos\ImageProcessor;
use App\Modules\Conteudos\MediaRules;
use App\Modules\Conteudos\VideoProcessor;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Depois do envio: gera a miniatura e a versão de visualização (fotografias) ou a capa (vídeos).
 * No fim o conteúdo fica aprovado (moderação automática, ou enviado pelo organizador) ou à espera de aprovação.
 * Um ficheiro que não se consegue ler é marcado como "failed" e apagado: deixa de ocupar espaço.
 */
class ProcessMedia implements ShouldQueue
{
    use Queueable;

    public int $timeout = 900;

    public int $tries = 2;

    public function __construct(public int $mediaId) {}

    public function handle(): void
    {
        $media = EventMedia::with('event')->find($this->mediaId);
        if (! $media || $media->status !== 'processing') {
            return; // apagado entretanto, ou já processado
        }

        $disk = Storage::disk(MediaRules::disk());
        $dir = "events/{$media->event_id}";
        $name = Str::uuid();

        try {
            $original = $disk->path($media->original_path);
            $attributes = $media->isVideo()
                ? $this->video($original, $disk->path("$dir/previews/$name.jpg"), $disk->path("$dir/thumbs/$name.jpg"), "$dir/previews/$name.jpg", "$dir/thumbs/$name.jpg")
                : $this->photo($original, $disk->path("$dir/previews/$name.jpg"), $disk->path("$dir/thumbs/$name.jpg"), "$dir/previews/$name.jpg", "$dir/thumbs/$name.jpg");
        } catch (Throwable $e) {
            Log::warning('Conteúdo inválido', ['media' => $media->id, 'error' => $e->getMessage()]);
            $disk->delete([...$media->paths(), "$dir/previews/$name.jpg", "$dir/thumbs/$name.jpg"]);
            $media->update(['status' => 'failed', 'processed_at' => now()]);
            MediaChanged::dispatch($media->event_id, $media->id, 'failed');

            return;
        }

        // O organizador não precisa de aprovar o que ele próprio envia.
        $approved = $media->event->moderation === 'auto' || $media->user_id !== null;
        $media->update($attributes + ['status' => $approved ? 'approved' : 'pending', 'processed_at' => now()]);
        MediaChanged::dispatch($media->event_id, $media->id, $media->status);
    }

    /**
     * Esgotadas as tentativas (por exemplo, o processamento excedeu o tempo): o conteúdo não fica "a processar" para sempre.
     */
    public function failed(?Throwable $e): void
    {
        $media = EventMedia::find($this->mediaId);
        if ($media && $media->status === 'processing') {
            Storage::disk(MediaRules::disk())->delete($media->paths());
            $media->update(['status' => 'failed', 'processed_at' => now()]);
            MediaChanged::dispatch($media->event_id, $media->id, 'failed');
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function photo(string $original, string $previewAbs, string $thumbAbs, string $preview, string $thumb): array
    {
        $image = ImageProcessor::load($original);
        [$width, $height] = ImageProcessor::saveScaled($image, $previewAbs, config('media.preview_px'), 85);
        ImageProcessor::saveScaled($image, $thumbAbs, config('media.thumb_px'), 78);

        return ['preview_path' => $preview, 'thumbnail_path' => $thumb, 'width' => $width, 'height' => $height];
    }

    /**
     * @return array<string, mixed>
     */
    private function video(string $original, string $previewAbs, string $thumbAbs, string $preview, string $thumb): array
    {
        if (! VideoProcessor::available()) {
            return [];
        }

        $duration = VideoProcessor::duration($original);
        VideoProcessor::sanitize($original);
        VideoProcessor::poster($original, $previewAbs, 1280);
        $poster = ImageProcessor::load($previewAbs);
        ImageProcessor::saveScaled($poster, $thumbAbs, config('media.thumb_px'), 78);
        clearstatcache(true, $original);
        $size = filesize($original);

        return [
            ...($size ? ['file_size' => $size] : []), // sem metadados o ficheiro fica um pouco mais pequeno
            'duration' => round($duration, 2),
            'preview_path' => $preview,
            'thumbnail_path' => $thumb,
            'width' => imagesx($poster),
            'height' => imagesy($poster),
        ];
    }
}
