<?php

namespace App\Modules\Exportacoes\Jobs;

use App\Models\EventExport;
use App\Models\EventMedia;
use App\Modules\Conteudos\MediaRules;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;
use ZipArchive;

/**
 * Junta num ZIP os originais de todas as fotografias e vídeos aprovados do evento.
 * Os ficheiros já estão comprimidos (JPEG, MP4…), por isso entram sem nova compressão: é muito mais rápido.
 */
class BuildEventZip implements ShouldQueue
{
    use Queueable;

    public int $timeout = 1800;

    public int $tries = 1;

    public function __construct(public int $exportId) {}

    public function handle(): void
    {
        $export = EventExport::with('event')->find($this->exportId);
        if (! $export || $export->status !== 'queued') {
            return;
        }
        $export->update(['status' => 'processing']);

        $disk = Storage::disk(MediaRules::disk());
        $path = "exports/{$export->event_id}/".Str::uuid().'.zip';
        $disk->makeDirectory(dirname($path));

        $zip = new ZipArchive;
        if ($zip->open($disk->path($path), ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Não foi possível criar o ZIP.');
        }

        $count = 0;
        EventMedia::where('event_id', $export->event_id)->where('status', 'approved')->orderBy('created_at')->orderBy('id')
            ->each(function (EventMedia $m) use ($zip, $disk, &$count) {
                if (! $disk->exists($m->original_path)) {
                    return;
                }
                $count++;
                $folder = $m->isVideo() ? 'videos' : 'fotografias';
                $author = Str::slug($m->guest_name ?: 'organizador') ?: 'convidado';
                $name = sprintf('%s/%04d-%s.%s', $folder, $count, $author, pathinfo($m->original_path, PATHINFO_EXTENSION));
                $zip->addFile($disk->path($m->original_path), $name);
                $zip->setCompressionName($name, ZipArchive::CM_STORE);
            });

        if ($count === 0) {
            $zip->addFromString('LEIA-ME.txt', "Ainda não há fotografias nem vídeos aprovados neste evento.\n");
        }
        if (! $zip->close()) {
            throw new RuntimeException('Não foi possível gravar o ZIP.');
        }

        $export->update(['status' => 'ready', 'path' => $path, 'file_size' => $disk->size($path), 'items' => $count]);
    }

    public function failed(?Throwable $e): void
    {
        EventExport::whereKey($this->exportId)->update(['status' => 'failed', 'error' => Str::limit((string) $e?->getMessage(), 250)]);
    }
}
