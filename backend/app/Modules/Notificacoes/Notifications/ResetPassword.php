<?php

namespace App\Modules\Notificacoes\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

// Recuperação de senha pedida pelo organizador: a ligação abre a página do frontend, não a API.
class ResetPassword extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $token) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = config('app.frontend_url').'/definir-senha?token='.$this->token.'&email='.urlencode($notifiable->email);

        return (new MailMessage)
            ->subject('Recuperar a senha')
            ->greeting('Olá, '.$notifiable->name)
            ->line('Recebemos um pedido para escolher uma nova senha na sua conta.')
            ->action('Escolher nova senha', $url)
            ->line('A ligação expira dentro de pouco tempo. Se não fez este pedido, ignore este e-mail.');
    }
}
