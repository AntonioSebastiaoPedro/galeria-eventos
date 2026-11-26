<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Uma conta desativada pela administração perde logo as sessões abertas: no pedido seguinte
 * a sessão termina e a interface volta à entrada (401).
 */
class EnsureAccountEnabled
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->isDisabled()) {
            Auth::guard('web')->logout();
            if ($request->hasSession()) {
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }
            abort(401, 'A sua conta foi desativada pela administração.');
        }

        return $next($request);
    }
}
