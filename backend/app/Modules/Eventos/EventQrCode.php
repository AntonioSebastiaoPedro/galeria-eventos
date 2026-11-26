<?php

namespace App\Modules\Eventos;

use App\Models\Event;
use Endroid\QrCode\Builder\Builder;
use Endroid\QrCode\ErrorCorrectionLevel;

/**
 * QR Code com o link da galeria (com a chave, nas privadas), para imprimir nos convites, mesas e cartazes.
 */
class EventQrCode
{
    public static function png(Event $event, int $size = 800): string
    {
        return (new Builder)->build(
            data: $event->guestUrl(),
            size: $size,
            margin: 16,
            errorCorrectionLevel: ErrorCorrectionLevel::Medium, // aguenta uma impressão menos boa ou um pouco de desgaste
        )->getString();
    }

    public static function dataUri(Event $event, int $size = 800): string
    {
        return 'data:image/png;base64,'.base64_encode(self::png($event, $size));
    }
}
