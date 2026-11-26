<?php

namespace App\Modules\Conteudos\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Avisa o organizador (em tempo real, pelo Reverb) de que um conteúdo do evento mudou: chegou, ficou pronto,
 * falhou ou foi apagado. A interface volta a pedir as listas; o aviso não leva dados dos convidados.
 * Vai pela fila: se o Reverb estiver em baixo, os envios dos convidados não falham por isso.
 */
class MediaChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(public int $eventId, public int $mediaId, public string $status) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('events.'.$this->eventId);
    }

    public function broadcastAs(): string
    {
        return 'media.changed';
    }

    /**
     * @return array{id: int, status: string}
     */
    public function broadcastWith(): array
    {
        return ['id' => $this->mediaId, 'status' => $this->status];
    }
}
