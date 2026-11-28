<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\PlanRequest;
use App\Models\User;
use App\Modules\Eventos\EventPresenter;
use App\Modules\Eventos\Plans;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

// Área administrativa da plataforma: visão geral, eventos (e o plano de cada um) e organizadores.
class AdminController extends Controller
{
    public function overview(): JsonResponse
    {
        $media = DB::table('event_media')->where('status', '!=', 'failed')
            ->selectRaw("count(*) as total, coalesce(sum(file_size), 0) as bytes, sum(case when media_type = 'video' then 1 else 0 end) as videos")->first();

        return response()->json([
            'organizers' => User::where('role', 'organizer')->count(),
            'events' => Event::count(),
            'active_events' => Event::where('status', 'active')->count(),
            'events_by_plan' => Event::selectRaw('plan, count(*) as total')->groupBy('plan')->pluck('total', 'plan'),
            'media' => (int) $media->total,
            'videos' => (int) $media->videos,
            'storage_used' => (int) $media->bytes,
            'pending_plan_requests' => PlanRequest::where('status', 'pending')->count(),
        ]);
    }

    public function events(Request $request): JsonResponse
    {
        $search = $this->like($request);
        $page = Event::with('user:id,name,email,phone')
            ->when($search, fn ($q) => $q->where(fn ($q) => $q->whereRaw('title ilike ?', [$search])->orWhereRaw('slug ilike ?', [$search])
                ->orWhereHas('user', fn ($u) => $u->whereRaw('name ilike ?', [$search])->orWhereRaw('email ilike ?', [$search])->orWhereRaw('phone ilike ?', [$this->phoneLike($request)]))))
            ->when($request->query('plan'), fn ($q, $p) => $q->where('plan', $p))
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate($this->perPage($request));

        return response()->json($page->through(fn (Event $e) => EventPresenter::forManager($e)));
    }

    // Mudança directa do plano (ex.: oferta ou correcção). O caminho normal são os pedidos com comprovativo (Admin\PlanRequestController).
    public function setPlan(Request $request, Event $event): JsonResponse
    {
        $data = $request->validate(['plan' => ['required', Rule::in(Plans::keys())]]);
        $event->update($data);

        return response()->json(EventPresenter::forManager($event->load('user:id,name,email,phone')));
    }

    public function users(Request $request): JsonResponse
    {
        $search = $this->like($request);
        $page = User::withCount('events')
            ->when($search, fn ($q) => $q->where(fn ($q) => $q->whereRaw('name ilike ?', [$search])->orWhereRaw('email ilike ?', [$search])->orWhereRaw('phone ilike ?', [$this->phoneLike($request)])))
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate($this->perPage($request));

        return response()->json($page->through(fn (User $u) => $u->only('id', 'name', 'email', 'phone', 'role', 'events_count', 'created_at') + ['disabled' => $u->isDisabled()]));
    }

    // Uma conta desativada perde logo as sessões (middleware account.enabled) e as galerias deixam de aceitar a gestão.
    public function disable(Request $request, User $user): JsonResponse
    {
        abort_if($user->id === $request->user()->id, 422, 'Não pode desativar a sua própria conta.');
        $user->forceFill(['disabled_at' => now()])->save();

        return response()->json(['ok' => true]);
    }

    public function enable(User $user): JsonResponse
    {
        $user->forceFill(['disabled_at' => null])->save();

        return response()->json(['ok' => true]);
    }

    /**
     * Contas sem e-mail não recebem a ligação de recuperação: a pessoa pede ajuda (WhatsApp) e a administração
     * cria uma senha temporária, mostrada uma única vez, que a pessoa muda depois em Conta.
     */
    public function resetPassword(Request $request, User $user): JsonResponse
    {
        abort_if($user->id === $request->user()->id, 422, 'Mude a sua própria senha em Conta.');
        $password = Str::password(10, symbols: false);
        $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();

        return response()->json(['password' => $password]);
    }

    private function like(Request $request): ?string
    {
        $search = trim((string) $request->query('search'));

        return $search === '' ? null : '%'.addcslashes($search, '%_\\').'%';
    }

    // Telemóveis guardam-se sem espaços (+244923456789): a pesquisa também os ignora.
    private function phoneLike(Request $request): string
    {
        return '%'.addcslashes(preg_replace('/\s+/', '', trim((string) $request->query('search'))), '%_\\').'%';
    }

    private function perPage(Request $request): int
    {
        return min(100, max(10, (int) $request->query('per_page', 25)));
    }
}
