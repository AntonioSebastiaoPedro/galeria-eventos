<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Modules\Conteudos\FileDelivery;
use App\Modules\Conteudos\ImageProcessor;
use App\Modules\Conteudos\MediaRules;
use App\Modules\Eventos\EventPresenter;
use App\Modules\Eventos\EventQrCode;
use App\Modules\Eventos\Plans;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

// Eventos do organizador: criar, configurar, partilhar (link e QR Code), estatísticas e capa.
class EventController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $events = Event::where('user_id', $request->user()->id)->orderByDesc('event_date')->orderByDesc('id')->get();

        return response()->json($events->map(fn (Event $e) => EventPresenter::forManager($e)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $user = $request->user();

        $limit = config('plans.free_events_per_user');
        if (! $user->isSuperadmin() && Event::where('user_id', $user->id)->where('plan', config('plans.default'))->count() >= $limit) {
            throw ValidationException::withMessages(['title' => $limit === 1
                ? 'Já tem um evento no plano gratuito. Para criar outro, escolha um plano pago para um dos eventos.'
                : "Já tem {$limit} eventos no plano gratuito. Para criar outro, escolha um plano pago para um dos eventos."]);
        }

        $event = Event::create($data + [
            'user_id' => $user->id,
            'slug' => Event::makeSlug($data['title']),
            'access_key' => Event::makeAccessKey(),
            'plan' => config('plans.default'),
        ]);

        return response()->json(EventPresenter::forManager($event), 201);
    }

    public function show(Request $request, Event $event): JsonResponse
    {
        $this->own($request, $event);

        return response()->json(EventPresenter::forManager($event->load('user')));
    }

    public function update(Request $request, Event $event): JsonResponse
    {
        $this->own($request, $event);
        $data = $this->validated($request, $event);
        if ($request->boolean('remove_access_code')) {
            $data['access_code'] = null;
        }
        $event->update($data);

        return response()->json(EventPresenter::forManager($event));
    }

    // Apaga o evento e todos os ficheiros (fotografias, vídeos, miniaturas, capa e ZIP). Não se desfaz.
    public function destroy(Request $request, Event $event): JsonResponse
    {
        $this->own($request, $event);
        $request->validate(['confirm' => 'required|string'], ['confirm.required' => 'Escreva o nome do evento para confirmar.']);
        if (trim($request->input('confirm')) !== trim($event->title)) {
            throw ValidationException::withMessages(['confirm' => 'O nome escrito não corresponde ao do evento.']);
        }

        $disk = Storage::disk(MediaRules::disk());
        $disk->deleteDirectory("events/{$event->id}");
        $disk->deleteDirectory("exports/{$event->id}");
        $event->delete();

        return response()->json(['ok' => true]);
    }

    public function cover(Request $request, Event $event): JsonResponse
    {
        $this->own($request, $event);
        $request->validate(['cover' => 'required|file|mimetypes:image/jpeg,image/png,image/webp|max:'.(config('media.photo_max_mb') * 1024)], [
            'cover.mimetypes' => 'A capa tem de ser uma imagem JPEG, PNG ou WebP.',
            'cover.max' => 'A capa pode ter no máximo '.config('media.photo_max_mb').' MB.',
        ]);

        $disk = Storage::disk(MediaRules::disk());
        $path = "events/{$event->id}/cover/".Str::uuid().'.jpg';
        try {
            $image = ImageProcessor::load($request->file('cover')->getRealPath());
            ImageProcessor::saveScaled($image, $disk->path($path), 2048, 85);
        } catch (Throwable) {
            throw ValidationException::withMessages(['cover' => 'Não foi possível ler esta imagem.']);
        }

        if ($event->cover_path) {
            $disk->delete($event->cover_path);
        }
        $event->update(['cover_path' => $path]);

        return response()->json(EventPresenter::forManager($event));
    }

    public function removeCover(Request $request, Event $event): JsonResponse
    {
        $this->own($request, $event);
        if ($event->cover_path) {
            Storage::disk(MediaRules::disk())->delete($event->cover_path);
            $event->update(['cover_path' => null]);
        }

        return response()->json(EventPresenter::forManager($event));
    }

    // Link enviado a quem não devia: a chave antiga deixa de funcionar e quem entrou com ela tem de entrar de novo.
    public function regenerateKey(Request $request, Event $event): JsonResponse
    {
        $this->own($request, $event);
        $event->update(['access_key' => Event::makeAccessKey(), 'access_version' => $event->access_version + 1]);

        return response()->json(EventPresenter::forManager($event));
    }

    public function qr(Request $request, Event $event): JsonResponse
    {
        $this->own($request, $event);

        return response()->json(['url' => $event->guestUrl(), 'qr_png' => EventQrCode::dataUri($event)]);
    }

    // Estatísticas de participação.
    public function stats(Request $request, Event $event): JsonResponse
    {
        $this->own($request, $event);
        $visible = fn ($q) => $q->where('event_id', $event->id)->whereIn('status', ['approved', 'pending']);

        $contributors = DB::table('event_media')->where($visible)
            ->selectRaw("coalesce(nullif(guest_name, ''), 'Sem nome') as name, count(*) as total, sum(case when media_type = 'photo' then 1 else 0 end) as photos, sum(case when media_type = 'video' then 1 else 0 end) as videos")
            ->groupByRaw("coalesce(nullif(guest_name, ''), 'Sem nome')")->orderByDesc('total')->limit(10)->get();

        $byDay = DB::table('event_media')->where($visible)
            ->selectRaw('cast(created_at as date) as day, count(*) as total')
            ->groupByRaw('cast(created_at as date)')->orderBy('day')->get();

        return response()->json([
            'counts' => EventPresenter::counts($event),
            'guests' => $event->guests()->count(),
            'blocked_guests' => $event->guests()->whereNotNull('blocked_at')->count(),
            'contributors' => DB::table('event_media')->where($visible)->distinct()->count(DB::raw("coalesce(event_guest_id::text, 'u' || coalesce(user_id::text, ''))")),
            'top_contributors' => $contributors->map(fn ($r) => ['name' => $r->name, 'total' => (int) $r->total, 'photos' => (int) $r->photos, 'videos' => (int) $r->videos]),
            'by_day' => $byDay->map(fn ($r) => ['day' => (string) $r->day, 'total' => (int) $r->total]),
        ]);
    }

    // Capa da galeria, por URL assinada (aparece também aos convidados).
    public function coverFile(Event $event): Response
    {
        abort_unless($event->cover_path && Storage::disk(MediaRules::disk())->exists($event->cover_path), 404);

        return FileDelivery::send($event->cover_path, ['Content-Type' => 'image/jpeg', 'Cache-Control' => FileDelivery::CACHE_SIGNED]);
    }

    public function plans(): JsonResponse
    {
        return response()->json(Plans::all());
    }

    // Dados públicos: Multicaixa Express para mudar de plano e contacto de apoio (WhatsApp).
    public function settings(): JsonResponse
    {
        return response()->json(Plans::settings());
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Event $event = null): array
    {
        $creating = $event === null;
        $data = $request->validate([
            'title' => [$creating ? 'required' : 'sometimes', 'string', 'max:120'],
            'description' => 'nullable|string|max:2000',
            'event_type' => [$creating ? 'required' : 'sometimes', Rule::in(Event::TYPES)],
            'event_date' => [$creating ? 'required' : 'sometimes', 'date'],
            'visibility' => ['sometimes', Rule::in(['public', 'private'])],
            'access_code' => 'nullable|string|min:4|max:32',
            'upload_enabled' => 'sometimes|boolean',
            'allow_videos' => 'sometimes|boolean',
            'moderation' => ['sometimes', Rule::in(['auto', 'manual'])],
            'status' => [$creating ? 'prohibited' : 'sometimes', Rule::in(['active', 'disabled'])],
        ], [
            'title.required' => 'Indique o nome do evento.',
            'event_type.in' => 'Escolha o tipo de evento.',
            'event_date.required' => 'Indique a data do evento.',
            'access_code.min' => 'O código de acesso tem de ter pelo menos 4 caracteres.',
        ]);

        // Um código vazio não apaga o actual (para isso há remove_access_code).
        if (array_key_exists('access_code', $data) && ($data['access_code'] === null || trim($data['access_code']) === '')) {
            unset($data['access_code']);
        }

        return $data;
    }

    private function own(Request $request, Event $event): void
    {
        abort_unless($event->isManagedBy($request->user()), 404);
    }
}
