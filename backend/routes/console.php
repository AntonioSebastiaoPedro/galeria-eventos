<?php

use App\Models\EventExport;
use App\Models\EventMedia;
use App\Modules\Conteudos\MediaRules;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Storage;

// Os ZIP ficam disponíveis alguns dias (config/media.php) e depois apagam-se, para não encher o disco.
Schedule::call(function () {
    EventExport::where('created_at', '<', now()->subDays(config('media.export_ttl_days')))->each(function (EventExport $e) {
        if ($e->path) {
            Storage::disk(MediaRules::disk())->delete($e->path);
        }
        $e->delete();
    });
})->daily()->name('limpar-zip');

// Registos de envios que falharam (os ficheiros já foram apagados): só servem para o convidado ver o erro.
Schedule::call(function () {
    EventMedia::where('status', 'failed')->where('updated_at', '<', now()->subDay())->delete();
})->daily()->name('limpar-envios-falhados');

// O Telescope guarda os registos 7 dias (as exceções em produção) e depois limpa-os.
Schedule::command('telescope:prune --hours=168')->daily()->name('limpar-telescope');
