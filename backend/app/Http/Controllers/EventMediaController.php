<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\EventMedia;
use App\Modules\Conteudos\Actions\DeleteMedia;
use App\Modules\Conteudos\Actions\StoreMedia;
use App\Modules\Conteudos\Events\MediaChanged;
use App\Modules\Conteudos\MediaPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

// Moderação dos conteúdos pelo organizador: ver tudo (incluindo o que espera aprovação), aprovar, apagar e enviar.
class EventMediaController extends Controller
{
    public function index(Request $request, Event $event): JsonResponse
    {
        $this->own($request, $event);
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['pending', 'approved', 'processing', 'failed'])],
            'type' => ['nullable', Rule::in(['photo', 'video'])],
            'guest_id' => 'nullable|integer',
            'per_page' => 'nullable|integer|min:10|max:100',
        ]);

        $page = $event->media()
            ->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s), fn ($q) => $q->where('status', '!=', 'failed'))
            ->when($filters['type'] ?? null, fn ($q, $t) => $q->where('media_type', $t))
            ->when($filters['guest_id'] ?? null, fn ($q, $g) => $q->where('event_guest_id', $g))
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 48);

        return response()->json($page->through(fn (EventMedia $m) => MediaPresenter::forManager($m)));
    }

    // O organizador também pode enviar (é publicado logo, sem moderação).
    public function store(Request $request, Event $event): JsonResponse
    {
        $this->own($request, $event);
        $request->validate([
            'file' => 'required|file',
            'caption' => 'nullable|string|max:'.config('media.caption_max'),
        ], ['file.uploaded' => 'Não foi possível enviar o ficheiro. Verifique o tamanho e tente outra vez.']);

        $media = StoreMedia::handle($event, $request->file('file'), null, $request->user(), $request->user()->name, $request->input('caption'));

        return response()->json(MediaPresenter::forManager($media), 201);
    }

    public function approve(Request $request, EventMedia $media): JsonResponse
    {
        $this->own($request, $media->event);
        abort_unless($media->status === 'pending', 422, 'Só é possível aprovar conteúdos à espera de aprovação.');
        $media->update(['status' => 'approved']);
        MediaChanged::dispatch($media->event_id, $media->id, 'approved');

        return response()->json(MediaPresenter::forManager($media));
    }

    public function destroy(Request $request, EventMedia $media): JsonResponse
    {
        $this->own($request, $media->event);
        DeleteMedia::handle($media);

        return response()->json(['ok' => true]);
    }

    // Aprovar ou apagar vários de uma vez (moderação depois da festa).
    public function bulk(Request $request, Event $event): JsonResponse
    {
        $this->own($request, $event);
        $data = $request->validate([
            'action' => ['required', Rule::in(['approve', 'delete'])],
            'ids' => 'required|array|min:1|max:200',
            'ids.*' => 'integer',
        ]);

        $items = $event->media()->whereIn('id', $data['ids'])->get();
        foreach ($items as $media) {
            if ($data['action'] === 'delete') {
                DeleteMedia::handle($media);
            } elseif ($media->status === 'pending') {
                $media->update(['status' => 'approved']);
                MediaChanged::dispatch($event->id, $media->id, 'approved');
            }
        }

        return response()->json(['ok' => true, 'affected' => $items->count()]);
    }

    private function own(Request $request, Event $event): void
    {
        abort_unless($event->isManagedBy($request->user()), 404);
    }
}
