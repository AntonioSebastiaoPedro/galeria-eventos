<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Os convidados são reconhecidos pela sessão, que o Sanctum só inicia nos pedidos vindos do frontend.
        $domain = config('sanctum.stateful')[0] ?? 'localhost';
        $this->withHeader('Referer', "http://{$domain}/");
    }

    /**
     * Simula outro navegador: esquece a sessão (e o convidado) e a autenticação.
     */
    protected function newBrowser(): static
    {
        $this->app['session']->driver()->flush();
        $this->app['auth']->forgetGuards();

        return $this;
    }
}
