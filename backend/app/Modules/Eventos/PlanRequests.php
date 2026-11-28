<?php

namespace App\Modules\Eventos;

use App\Models\Event;
use App\Models\PlanRequest;
use App\Models\User;
use App\Modules\Conteudos\MediaRules;
use App\Modules\Notificacoes\Notifications\PlanRequestReviewed;
use App\Modules\Notificacoes\Notifications\PlanRequestSubmitted;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Mudança de plano de um evento: o organizador paga a diferença por Multicaixa Express e envia o comprovativo;
 * a administração confirma (o plano muda logo) ou recusa com o motivo. Um pedido pendente de cada vez por evento.
 */
class PlanRequests
{
    public static function submit(Event $event, User $user, string $toPlan, UploadedFile $proof): PlanRequest
    {
        if (Plans::settings()['payment'] === null) {
            throw ValidationException::withMessages(['plan' => 'Os pagamentos ainda não estão disponíveis. Fale com a equipa da Galeria.']);
        }

        $disk = Storage::disk(MediaRules::disk());
        $path = "events/{$event->id}/plan-requests/".Str::uuid().'.'.($proof->extension() ?: 'bin');
        $disk->putFileAs(dirname($path), $proof, basename($path));

        try {
            $planRequest = DB::transaction(function () use ($event, $user, $toPlan, $proof, $path) {
                // A linha do evento fica bloqueada: dois pedidos ao mesmo tempo não passam os dois.
                $event = Event::whereKey($event->id)->lockForUpdate()->firstOrFail();
                if ($event->planRequests()->where('status', 'pending')->exists()) {
                    throw ValidationException::withMessages(['plan' => 'Já há um pedido à espera de confirmação para este evento.']);
                }
                if (! Plans::isUpgrade($event->plan, $toPlan)) {
                    throw ValidationException::withMessages(['plan' => 'Escolha um plano acima do actual.']);
                }

                return $event->planRequests()->create([
                    'user_id' => $user->id,
                    'from_plan' => $event->plan,
                    'to_plan' => $toPlan,
                    'amount_kz' => Plans::upgradeAmount($event->plan, $toPlan),
                    'status' => 'pending',
                    'proof_path' => $path,
                    'proof_name' => Str::limit($proof->getClientOriginalName(), 180, ''),
                    'proof_mime' => $proof->getMimeType(),
                    'proof_size' => $proof->getSize(),
                ]);
            });
        } catch (Throwable $e) {
            $disk->delete($path);
            throw $e;
        }

        $admins = User::where('role', 'superadmin')->whereNull('disabled_at')->whereNotNull('email')->get();
        Notification::send($admins, new PlanRequestSubmitted($planRequest));

        return $planRequest;
    }

    public static function cancel(PlanRequest $planRequest): void
    {
        self::ensurePending($planRequest);
        Storage::disk(MediaRules::disk())->delete($planRequest->proof_path);
        $planRequest->update(['status' => 'cancelled', 'proof_path' => null]);
    }

    public static function approve(PlanRequest $planRequest, User $admin): PlanRequest
    {
        DB::transaction(function () use ($planRequest, $admin) {
            $planRequest = PlanRequest::whereKey($planRequest->id)->lockForUpdate()->firstOrFail();
            self::ensurePending($planRequest);
            $event = $planRequest->event;
            // Se entretanto o evento já subiu a um plano igual ou superior, não desce.
            if (Plans::isUpgrade($event->plan, $planRequest->to_plan)) {
                $event->update(['plan' => $planRequest->to_plan]);
            }
            $planRequest->update(['status' => 'approved', 'reviewed_by' => $admin->id, 'reviewed_at' => now()]);
        });

        return self::reviewed($planRequest);
    }

    public static function reject(PlanRequest $planRequest, User $admin, string $reason): PlanRequest
    {
        DB::transaction(function () use ($planRequest, $admin, $reason) {
            $planRequest = PlanRequest::whereKey($planRequest->id)->lockForUpdate()->firstOrFail();
            self::ensurePending($planRequest);
            $planRequest->update(['status' => 'rejected', 'admin_note' => $reason, 'reviewed_by' => $admin->id, 'reviewed_at' => now()]);
        });

        return self::reviewed($planRequest);
    }

    /**
     * @return array<string, mixed>
     */
    public static function present(PlanRequest $planRequest): array
    {
        return $planRequest->only('id', 'event_id', 'from_plan', 'to_plan', 'amount_kz', 'status', 'admin_note', 'proof_name', 'proof_mime', 'created_at', 'reviewed_at') + [
            'from_plan_name' => Plans::get($planRequest->from_plan)['name'],
            'to_plan_name' => Plans::get($planRequest->to_plan)['name'],
            'proof_url' => $planRequest->proof_path ? "/api/plan-requests/{$planRequest->id}/proof" : null,
        ];
    }

    private static function ensurePending(PlanRequest $planRequest): void
    {
        if (! $planRequest->isPending()) {
            throw ValidationException::withMessages(['status' => 'Este pedido já foi tratado.']);
        }
    }

    private static function reviewed(PlanRequest $planRequest): PlanRequest
    {
        $planRequest->refresh()->load('event.user');
        $planRequest->event->user?->notify(new PlanRequestReviewed($planRequest));

        return $planRequest;
    }
}
