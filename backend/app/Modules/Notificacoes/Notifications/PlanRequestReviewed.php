<?php

namespace App\Modules\Notificacoes\Notifications;

use App\Models\PlanRequest;
use App\Modules\Eventos\Plans;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Para o organizador: o pedido de mudança de plano foi confirmado ou recusado.
 * Quem não tem e-mail vê o resultado no resumo do evento.
 */
class PlanRequestReviewed extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public PlanRequest $planRequest) {}

    /**
     * @return string[]
     */
    public function via(object $notifiable): array
    {
        return $notifiable->email ? ['mail'] : [];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $request = $this->planRequest->loadMissing('event');
        $plan = Plans::get($request->to_plan)['name'];
        $mail = (new MailMessage)->greeting('Olá, '.$notifiable->name);

        if ($request->status === 'approved') {
            $mail->subject("Plano {$plan} activado")
                ->line("O pagamento foi confirmado: o evento \"{$request->event->title}\" já está no plano {$plan}.");
        } else {
            $mail->subject('Pedido de mudança de plano recusado')
                ->line("Não foi possível confirmar o pagamento do plano {$plan} para o evento \"{$request->event->title}\".")
                ->line('Motivo: '.$request->admin_note);
        }

        return $mail->action('Abrir o evento', config('app.frontend_url').'/eventos/'.$request->event_id);
    }
}
