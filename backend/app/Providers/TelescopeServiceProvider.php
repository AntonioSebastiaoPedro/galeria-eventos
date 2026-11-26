<?php

namespace App\Providers;

use Illuminate\Support\Facades\Gate;
use Laravel\Telescope\IncomingEntry;
use Laravel\Telescope\Telescope;
use Laravel\Telescope\TelescopeApplicationServiceProvider;

class TelescopeServiceProvider extends TelescopeApplicationServiceProvider
{
    public function register(): void
    {
        $this->hideSensitiveRequestDetails();

        // Em produção só se guardam erros (exceções e jobs falhados), para não sobrecarregar o sistema.
        // Fora de produção guarda-se tudo, para depurar.
        Telescope::filter(function (IncomingEntry $entry): bool {
            if (! $this->app->environment('production')) {
                return true;
            }

            return $entry->isReportableException() || $entry->isFailedJob();
        });
    }

    // Dados sensíveis nunca ficam guardados nos pedidos.
    protected function hideSensitiveRequestDetails(): void
    {
        if ($this->app->environment('local')) {
            return;
        }

        Telescope::hideRequestParameters(['_token', 'token', 'password', 'password_confirmation', 'current_password']);
        Telescope::hideRequestHeaders(['cookie', 'x-csrf-token', 'x-xsrf-token']);
    }

    // Só o superadmin abre o Telescope fora do ambiente local.
    protected function gate(): void
    {
        Gate::define('viewTelescope', fn ($user) => $user->isSuperadmin());
    }
}
