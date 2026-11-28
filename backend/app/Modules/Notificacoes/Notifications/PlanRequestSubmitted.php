<?php

namespace App\Modules\Notificacoes\Notifications;

use App\Models\PlanRequest;
use App\Modules\Eventos\Plans;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Para a administração: chegou um pedido de mudança de plano com o comprovativo do pagamento.
 */
class PlanRequestSubmitted extends Notification implements ShouldQueue
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
        $request = $this->planRequest->loadMissing('event', 'user');

        return (new MailMessage)
            ->subject('Pedido de mudança de plano: '.$request->event->title)
            ->line(($request->user?->name ?? 'Um organizador').' pediu o plano '.Plans::get($request->to_plan)['name'].' para o evento "'.$request->event->title.'".')
            ->line('Valor a confirmar no Multicaixa Express: '.number_format($request->amount_kz, 0, ',', ' ').' Kz.')
            ->action('Ver o pedido e o comprovativo', config('app.frontend_url').'/admin?separador=pedidos');
    }
}
