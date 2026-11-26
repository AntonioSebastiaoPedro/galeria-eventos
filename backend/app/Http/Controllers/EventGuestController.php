<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\EventGuest;
use App\Modules\Conteudos\Actions\DeleteMedia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// Convidados que entraram na galeria: quem enviou o quê, e bloquear quem não deve participar.
class EventGuestController extends Controller
{
    public function index(Request $request, Event $event): JsonResponse
    {
        $this->own($request, $event);
        $search = trim((string) $request->query('search'));

        $page = $event->guests()
            ->withCount([
                'media as photos' => fn ($q) => $q->where('media_type', 'photo')->whereIn('status', ['approved', 'pending']),
                'media as videos' => fn ($q) => $q->where('media_type', 'video')->whereIn('status', ['approved', 'pending']),
            ])
            ->when($search !== '', fn ($q) => $q->whereRaw('name ilike ?', ['%'.addcslashes($search, '%_\\').'%']))
            ->orderByDesc('last_seen_at')->orderByDesc('id')
            ->paginate(min(100, max(10, (int) $request->query('per_page', 25))));

        return response()->json($page->through(fn (EventGuest $g) => $this->present($g)));
    }

    // Bloquear: deixa de ver a galeria e de enviar. Opcionalmente apaga tudo o que o convidado enviou.
    public function block(Request $request, EventGuest $guest): JsonResponse
    {
        $this->own($request, $guest->event);
        $removeMedia = $request->validate(['remove_media' => 'sometimes|boolean'])['remove_media'] ?? false;

        $guest->update(['blocked_at' => now()]);
        if ($removeMedia) {
            $guest->media()->get()->each(fn ($m) => DeleteMedia::handle($m));
        }

        return response()->json($this->present($guest->loadCount(['media as photos' => fn ($q) => $q->where('media_type', 'photo'), 'media as videos' => fn ($q) => $q->where('media_type', 'video')])));
    }

    public function unblock(Request $request, EventGuest $guest): JsonResponse
    {
        $this->own($request, $guest->event);
        $guest->update(['blocked_at' => null]);

        return response()->json($this->present($guest->loadCount(['media as photos' => fn ($q) => $q->where('media_type', 'photo'), 'media as videos' => fn ($q) => $q->where('media_type', 'video')])));
    }

    /**
     * @return array<string, mixed>
     */
    private function present(EventGuest $g): array
    {
        return [
            'id' => $g->id,
            'name' => $g->name,
            'blocked' => $g->isBlocked(),
            'photos' => (int) ($g->photos ?? 0),
            'videos' => (int) ($g->videos ?? 0),
            'last_seen_at' => $g->last_seen_at,
            'created_at' => $g->created_at,
        ];
    }

    private function own(Request $request, Event $event): void
    {
        abort_unless($event->isManagedBy($request->user()), 404);
    }
}
