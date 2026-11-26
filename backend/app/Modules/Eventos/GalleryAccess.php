<?php

namespace App\Modules\Eventos;

use App\Models\Event;
use App\Models\EventGuest;
use Illuminate\Http\Request;

/**
 * Quem pode ver e enviar conteúdos numa galeria.
 *
 * - O organizador do evento e a administração veem sempre (mesmo com a galeria desativada).
 * - Galeria pública: qualquer pessoa com o link vê; ao enviar o primeiro conteúdo passa a ser um convidado.
 * - Galeria privada: só entra quem tem a chave do link/QR Code ou o código de acesso. A entrada fica guardada
 *   na sessão do navegador como um EventGuest; regenerar a chave (access_version) obriga a entrar de novo.
 * - Um convidado bloqueado deixa de ver e de enviar.
 */
class GalleryAccess
{
    private static function sessionKey(Event $event): string
    {
        return 'gallery_guest.'.$event->id;
    }

    /**
     * O convidado deste navegador neste evento (mesmo que bloqueado ou com acesso antigo), ou null.
     */
    public static function guest(Request $request, Event $event): ?EventGuest
    {
        if (! $request->hasSession()) {
            return null;
        }
        $id = $request->session()->get(self::sessionKey($event));

        return $id ? EventGuest::where('event_id', $event->id)->find($id) : null;
    }

    public static function isManager(Request $request, Event $event): bool
    {
        return $event->isManagedBy($request->user());
    }

    /**
     * Motivo por que este navegador não pode ver a galeria, ou null se pode.
     *
     * @return 'disabled'|'blocked'|'needs_access'|null
     */
    public static function denial(Request $request, Event $event): ?string
    {
        if (self::isManager($request, $event)) {
            return null;
        }
        if (! $event->isActive()) {
            return 'disabled';
        }
        $guest = self::guest($request, $event);
        if ($guest?->isBlocked()) {
            return 'blocked';
        }
        if ($event->isPrivate() && (! $guest || $guest->access_version !== $event->access_version)) {
            return 'needs_access';
        }

        return null;
    }

    public static function canView(Request $request, Event $event): bool
    {
        return self::denial($request, $event) === null;
    }

    /**
     * Regista a entrada deste navegador (depois de verificada a chave ou o código, nas privadas).
     */
    public static function admit(Request $request, Event $event): EventGuest
    {
        $guest = self::guest($request, $event);
        if ($guest) {
            $guest->update(['access_version' => $event->access_version, 'last_seen_at' => now()]);

            return $guest;
        }

        $guest = EventGuest::create([
            'event_id' => $event->id,
            'access_version' => $event->access_version,
            'ip_address' => $request->ip(),
            'last_seen_at' => now(),
        ]);
        if ($request->hasSession()) {
            $request->session()->put(self::sessionKey($event), $guest->id);
        }

        return $guest;
    }
}
