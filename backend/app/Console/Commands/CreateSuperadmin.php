<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

use function Laravel\Prompts\password;

class CreateSuperadmin extends Command
{
    protected $signature = 'app:create-superadmin {email} {name=Administração} {--password= : Se omitida, é pedida sem eco no terminal}';

    protected $description = 'Cria (ou repõe a senha de) um superadministrador';

    public function handle(): int
    {
        $pass = $this->option('password') ?: password('Senha (mínimo 10 caracteres)', required: true);

        if (strlen($pass) < 10) {
            $this->error('A senha tem de ter pelo menos 10 caracteres.');

            return self::FAILURE;
        }

        $user = User::updateOrCreate(
            ['email' => User::normalizeEmail($this->argument('email'))],
            ['name' => $this->argument('name'), 'password' => $pass, 'role' => 'superadmin'],
        );

        $this->info("Superadmin {$user->email} ".($user->wasRecentlyCreated ? 'criado' : 'actualizado').'.');

        return self::SUCCESS;
    }
}
