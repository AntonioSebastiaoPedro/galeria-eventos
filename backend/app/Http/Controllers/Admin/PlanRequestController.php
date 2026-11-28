<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlanRequest;
use App\Modules\Eventos\PlanRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Pedidos de mudança de plano, do lado da administração: ver o comprovativo, confirmar o pagamento ou recusar.
 */
class PlanRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $status = in_array($request->query('status'), ['pending', 'approved', 'rejected'], true) ? $request->query('status') : 'pending';
        $page = PlanRequest::with(['event:id,title,slug,plan', 'user:id,name,email,phone'])
            ->where('status', $status)
            ->orderBy($status === 'pending' ? 'created_at' : 'reviewed_at', $status === 'pending' ? 'asc' : 'desc')->orderBy('id')
            ->paginate(min(100, max(10, (int) $request->query('per_page', 25))));

        return response()->json($page->through(fn (PlanRequest $r) => PlanRequests::present($r) + [
            'event' => $r->event?->only('id', 'title', 'slug', 'plan'),
            'user' => $r->user?->only('id', 'name', 'email', 'phone'),
        ]));
    }

    public function approve(Request $request, PlanRequest $planRequest): JsonResponse
    {
        return response()->json(PlanRequests::present(PlanRequests::approve($planRequest, $request->user())));
    }

    public function reject(Request $request, PlanRequest $planRequest): JsonResponse
    {
        $data = $request->validate(['reason' => 'required|string|max:500'], ['reason.required' => 'Escreva o motivo: o organizador vai vê-lo.']);

        return response()->json(PlanRequests::present(PlanRequests::reject($planRequest, $request->user(), trim($data['reason']))));
    }
}
