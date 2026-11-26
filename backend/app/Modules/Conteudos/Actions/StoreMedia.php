<?php

namespace App\Modules\Conteudos\Actions;

use App\Models\Event;
use App\Models\EventGuest;
use App\Models\EventMedia;
use App\Models\User;
use App\Modules\Conteudos\Events\MediaChanged;
use App\Modules\Conteudos\Jobs\ProcessMedia;
use App\Modules\Conteudos\MediaRules;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Recebe um ficheiro de um convidado (ou do organizador), confirma o tipo pelo conteúdo, o tamanho,
 * e os limites do plano, guarda o original e põe na fila a geração das miniaturas.
 *
 * Os limites do plano (espaço e número de fotografias) verificam-se com a linha do evento bloqueada,
 * para que vários convidados a enviar ao mesmo tempo não passem juntos do limite.
 */
class StoreMedia
{
    public static function handle(Event $event, UploadedFile $file, ?EventGuest $guest, ?User $user, ?string $name, ?string $caption): EventMedia
    {
        $mime = (string) $file->getMimeType();
        $type = MediaRules::typeOf($mime);

        if ($type === null) {
            throw ValidationException::withMessages(['file' => 'Este tipo de ficheiro não é aceite. Envie fotografias (JPEG, PNG, WebP) ou vídeos (MP4, MOV, WebM).']);
        }
        if ($type === 'video' && ! $event->videosAllowed()) {
            throw ValidationException::withMessages(['file' => $event->planRules()['videos'] ? 'O organizador não permite vídeos nesta galeria.' : 'O plano deste evento não inclui vídeos.']);
        }
        if ($file->getSize() > MediaRules::maxBytes($type)) {
            $max = $type === 'video' ? config('media.video_max_mb') : config('media.photo_max_mb');

            throw ValidationException::withMessages(['file' => ($type === 'video' ? 'Cada vídeo' : 'Cada fotografia')." pode ter no máximo {$max} MB."]);
        }

        // Nome aleatório: o nome original do ficheiro (que pode ter dados pessoais) só fica na base de dados.
        $path = $file->storeAs("events/{$event->id}/originals", Str::uuid().'.'.MediaRules::extensionOf($mime), MediaRules::disk());
        if (! $path) {
            throw ValidationException::withMessages(['file' => 'Não foi possível guardar o ficheiro. Tente outra vez.']);
        }

        try {
            $media = DB::transaction(function () use ($event, $file, $guest, $user, $name, $caption, $mime, $type, $path) {
                $locked = Event::whereKey($event->id)->lockForUpdate()->first();

                if ($locked->storageUsedBytes() + $file->getSize() > $locked->storageLimitBytes()) {
                    throw ValidationException::withMessages(['file' => 'A galeria atingiu o limite de armazenamento do plano. Fale com o organizador.']);
                }
                $maxPhotos = $locked->planRules()['max_photos'];
                if ($type === 'photo' && $maxPhotos !== null && $locked->media()->where('media_type', 'photo')->where('status', '!=', 'failed')->count() >= $maxPhotos) {
                    throw ValidationException::withMessages(['file' => "A galeria atingiu o limite de {$maxPhotos} fotografias do plano. Fale com o organizador."]);
                }

                return EventMedia::create([
                    'event_id' => $locked->id,
                    'event_guest_id' => $guest?->id,
                    'user_id' => $user?->id,
                    'guest_name' => $name,
                    'media_type' => $type,
                    'status' => 'processing',
                    'original_path' => $path,
                    'original_name' => Str::limit($file->getClientOriginalName() ?: 'ficheiro', 250, ''),
                    'mime_type' => $mime,
                    'file_size' => $file->getSize(),
                    'caption' => $caption !== null && trim($caption) !== '' ? trim($caption) : null,
                ]);
            });
        } catch (Throwable $e) {
            Storage::disk(MediaRules::disk())->delete($path);

            throw $e;
        }

        ProcessMedia::dispatch($media->id)->afterCommit();
        MediaChanged::dispatch($event->id, $media->id, 'processing');

        return $media;
    }
}
