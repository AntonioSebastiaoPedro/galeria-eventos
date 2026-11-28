<?php

namespace App\Http\Controllers\Gallery;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\EventMedia;
use App\Modules\Conteudos\Actions\DeleteMedia;
use App\Modules\Conteudos\Actions\StoreMedia;
use App\Modules\Conteudos\MediaPresenter;
use App\Modules\Eventos\EventPresenter;
use App\Modules\Eventos\GalleryAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

// Galeria do evento, para os convidados (sem conta): ver, entrar nas privadas, enviar e apagar o que enviaram.
class GalleryController extends Controller
{
    public function show(Request $request, Event $event): JsonResponse
    {
        $denial = GalleryAccess::denial($request, $event);
        $guest = GalleryAccess::guest($request, $event);
        $guest?->update(['last_seen_at' => now()]);
        $isManager = GalleryAccess::isManager($request, $event);

        return response()->json(EventPresenter::forGallery($event, $denial === null) + [
            'access' => $denial ?? 'granted',
            'is_manager' => $isManager,
            // Só quem gere o evento recebe o id, para o botão "Voltar à gestão" levar a este evento.
            'manage_id' => $isManager ? $event->id : null,
            'guest' => $guest && $denial === null ? ['name' => $guest->name] : null,
        ]);
    }

    // Entrar numa galeria privada com a chave do link/QR Code ou com o código de acesso.
    public function access(Request $request, Event $event): JsonResponse
    {
        abort_unless($event->isActive(), 423, 'Esta galeria está temporariamente indisponível.');
        $data = $request->validate(['key' => 'nullable|string|max:64', 'code' => 'nullable|string|max:64']);

        $guest = GalleryAccess::guest($request, $event);
        if ($guest?->isBlocked()) {
            abort(403, 'O organizador retirou-lhe o acesso a esta galeria.');
        }

        $byKey = ! empty($data['key']) && hash_equals($event->access_key, $data['key']);
        $byCode = ! empty($data['code']) && $event->access_code && Hash::check(trim($data['code']), $event->access_code);
        if ($event->isPrivate() && ! $byKey && ! $byCode) {
            throw ValidationException::withMessages(match (true) {
                ! empty($data['code']) => ['code' => 'Código de acesso incorrecto.'],
                ! empty($data['key']) => ['key' => 'Este link já não é válido. Peça ao organizador o link actualizado ou o código de acesso.'],
                default => ['code' => 'Indique o código de acesso.'],
            });
        }

        GalleryAccess::admit($request, $event);

        return $this->show($request, $event);
    }

    // O nome (ou pseudónimo) com que o convidado assina o que envia. Não é verificado.
    public function updateMe(Request $request, Event $event): JsonResponse
    {
        $this->ensureCanView($request, $event);
        $name = trim($request->validate(['name' => 'required|string|max:60'], ['name.required' => 'Escreva o seu nome ou um pseudónimo.'])['name']);
        $guest = GalleryAccess::admit($request, $event);
        $guest->update(['name' => $name]);

        return response()->json(['name' => $guest->name]);
    }

    public function media(Request $request, Event $event): JsonResponse
    {
        $this->ensureCanView($request, $event);
        $filters = $request->validate([
            'type' => ['nullable', Rule::in(['photo', 'video'])],
            'sort' => ['nullable', Rule::in(['new', 'old'])],
        ]);
        $guest = GalleryAccess::guest($request, $event);
        $manager = GalleryAccess::isManager($request, $event);
        $direction = ($filters['sort'] ?? 'new') === 'old' ? 'asc' : 'desc';

        // Aprovados, mais os que o próprio convidado enviou e ainda esperam processamento ou aprovação.
        $page = $event->media()
            ->where(fn ($q) => $q->where('status', 'approved')
                ->when($guest, fn ($q) => $q->orWhere(fn ($q) => $q->where('event_guest_id', $guest->id)->whereIn('status', ['processing', 'pending']))))
            ->when($filters['type'] ?? null, fn ($q, $t) => $q->where('media_type', $t))
            ->orderBy('created_at', $direction)->orderBy('id', $direction)
            ->paginate(30);

        return response()->json($page->through(fn (EventMedia $m) => MediaPresenter::forGallery($m, $guest, $manager)));
    }

    // Um ficheiro por pedido: a interface envia vários em sequência e mostra o progresso de cada um.
    public function upload(Request $request, Event $event): JsonResponse
    {
        $this->ensureCanView($request, $event);
        $manager = GalleryAccess::isManager($request, $event);
        abort_unless($manager || ($event->upload_enabled && $event->isActive()), 403, 'O organizador fechou os envios para esta galeria.');

        $data = $request->validate([
            'file' => 'required|file',
            'name' => [$manager ? 'nullable' : 'required', 'string', 'max:60'],
            'caption' => 'nullable|string|max:'.config('media.caption_max'),
        ], [
            'name.required' => 'Escreva o seu nome ou um pseudónimo, para saberem quem partilhou.',
            'file.uploaded' => 'Não foi possível enviar o ficheiro. Verifique o tamanho e tente outra vez.',
        ]);

        if ($manager) {
            $media = StoreMedia::handle($event, $request->file('file'), null, $request->user(), $request->user()->name, $data['caption'] ?? null);

            return response()->json(MediaPresenter::forGallery($media, null, true), 201);
        }

        $guest = GalleryAccess::admit($request, $event);
        $key = 'guest-upload:'.$guest->id;
        if (RateLimiter::tooManyAttempts($key, config('media.guest_uploads_per_hour'))) {
            abort(429, 'Enviou muitos ficheiros na última hora. Aguarde um pouco e tente outra vez.');
        }
        RateLimiter::hit($key, 3600);

        $name = trim($data['name']);
        if ($guest->name !== $name) {
            $guest->update(['name' => $name]);
        }
        $media = StoreMedia::handle($event, $request->file('file'), $guest, null, $name, $data['caption'] ?? null);

        return response()->json(MediaPresenter::forGallery($media, $guest), 201);
    }

    // O convidado pode apagar o que ele próprio enviou (o organizador apaga qualquer conteúdo).
    public function destroy(Request $request, Event $event, EventMedia $media): JsonResponse
    {
        $this->ensureCanView($request, $event);
        abort_unless($media->event_id === $event->id, 404);
        $guest = GalleryAccess::guest($request, $event);
        abort_unless(GalleryAccess::isManager($request, $event) || ($guest && $media->event_guest_id === $guest->id), 403, 'Só pode apagar o que enviou.');

        DeleteMedia::handle($media);

        return response()->json(['ok' => true]);
    }

    private function ensureCanView(Request $request, Event $event): void
    {
        match (GalleryAccess::denial($request, $event)) {
            'disabled' => abort(423, 'Esta galeria está temporariamente indisponível.'),
            'blocked' => abort(403, 'O organizador retirou-lhe o acesso a esta galeria.'),
            'needs_access' => abort(403, 'Esta galeria é privada. Use o link ou o código de acesso do organizador.'),
            default => null,
        };
    }
}
