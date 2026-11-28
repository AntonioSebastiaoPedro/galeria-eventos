<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\PlanRequest;
use App\Modules\Conteudos\MediaRules;
use App\Modules\Eventos\PlanRequests;
use App\Modules\Eventos\Plans;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;

/**
 * Mudança de plano pedida pelo organizador (ver PlanRequests). A administração trata os pedidos em Admin\PlanRequestController.
 */
class PlanRequestController extends Controller
{
    // O último pedido do evento, os planos acima do actual (com o valor a pagar) e os dados do Multicaixa Express.
    public function show(Request $request, Event $event): JsonResponse
    {
        $this->own($request, $event);
        $latest = $event->planRequests()->whereIn('status', ['pending', 'approved', 'rejected'])->latest('id')->first();
        $upgrades = collect(Plans::all())->filter(fn (array $plan) => Plans::isUpgrade($event->plan, $plan['key']))
            ->map(fn (array $plan) => $plan + ['amount_kz' => Plans::upgradeAmount($event->plan, $plan['key'])])->values();

        return response()->json([
            'current' => $latest ? PlanRequests::present($latest) : null,
            'upgrades' => $upgrades,
        ] + Plans::settings());
    }

    public function store(Request $request, Event $event): JsonResponse
    {
        $this->own($request, $event);
        $data = $request->validate([
            'plan' => ['required', Rule::in(Plans::keys())],
            'proof' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:'.(config('plans.proof_max_mb') * 1024)],
        ], [
            'proof.required' => 'Envie o comprovativo do pagamento (fotografia ou PDF).',
            'proof.mimes' => 'O comprovativo tem de ser uma imagem (JPG, PNG, WebP) ou um PDF.',
            'proof.max' => 'O comprovativo pode ter até '.config('plans.proof_max_mb').' MB.',
        ]);

        $planRequest = PlanRequests::submit($event, $request->user(), $data['plan'], $data['proof']);

        return response()->json(PlanRequests::present($planRequest), 201);
    }

    public function destroy(Request $request, PlanRequest $planRequest): JsonResponse
    {
        $this->own($request, $planRequest->event);
        PlanRequests::cancel($planRequest);

        return response()->json(['ok' => true]);
    }

    // Comprovativo: só para quem gere o evento e para a administração.
    public function proof(Request $request, PlanRequest $planRequest): BinaryFileResponse
    {
        $this->own($request, $planRequest->event);
        $disk = Storage::disk(MediaRules::disk());
        abort_unless($planRequest->proof_path && $disk->exists($planRequest->proof_path), 404);

        $response = response()->file($disk->path($planRequest->proof_path), [
            'Content-Type' => $planRequest->proof_mime,
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => 'sandbox', // um PDF aberto no navegador não corre scripts com a sessão da aplicação
            'Cache-Control' => 'private, no-store',
        ]);
        $response->setContentDisposition(ResponseHeaderBag::DISPOSITION_INLINE, 'comprovativo-'.$planRequest->id.'.'.pathinfo($planRequest->proof_path, PATHINFO_EXTENSION));

        return $response;
    }

    private function own(Request $request, Event $event): void
    {
        abort_unless($event->isManagedBy($request->user()), 404);
    }
}
