<?php

namespace Database\Seeders;

use App\Models\Event;
use App\Models\User;
use App\Modules\Conteudos\Actions\StoreMedia;
use App\Modules\Conteudos\Jobs\ProcessMedia;
use App\Modules\Eventos\GalleryAccess;
use Illuminate\Database\Seeder;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

/**
 * Dados de demonstração (só desenvolvimento: as contas usam a senha "password").
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(['email' => 'admin@galeria.local'], ['name' => 'Administração', 'password' => 'password', 'role' => 'superadmin']);
        $organizer = User::updateOrCreate(['email' => 'organizador@galeria.local'], ['name' => 'Dicla Manuel', 'password' => 'password', 'role' => 'organizer']);

        if ($organizer->events()->exists()) {
            return;
        }

        $event = Event::create([
            'user_id' => $organizer->id,
            'title' => 'Aniversário da Dicla',
            'slug' => Event::makeSlug('Aniversário da Dicla'),
            'description' => 'Os 30 anos da Dicla, em Luanda. Partilhe as suas fotografias e vídeos da noite!',
            'event_type' => 'birthday',
            'event_date' => now()->toDateString(),
            'visibility' => 'public',
            'access_key' => Event::makeAccessKey(),
            'plan' => 'premium',
        ]);

        $guest = GalleryAccess::admit(Request::create('/'), $event);
        $guest->update(['name' => 'Ana']);

        $palette = [[232, 85, 61], [217, 164, 65], [46, 94, 78], [29, 26, 23], [201, 123, 132], [94, 129, 172]];
        foreach (range(1, 12) as $i) {
            [$w, $h] = $i % 3 === 0 ? [1200, 1600] : [1600, 1200];
            $file = $this->photo($w, $h, $palette[$i % count($palette)], $palette[($i + 2) % count($palette)]);
            $media = StoreMedia::handle($event, new UploadedFile($file, "foto-$i.jpg", 'image/jpeg', null, true), $guest, null, $i % 2 ? 'Ana' : 'Pedro', $i === 1 ? 'Que noite incrível!' : null);
            (new ProcessMedia($media->id))->handle();
        }
    }

    /**
     * Fotografia de demonstração: um degradé entre duas cores.
     *
     * @param  array{0: int, 1: int, 2: int}  $from
     * @param  array{0: int, 1: int, 2: int}  $to
     */
    private function photo(int $w, int $h, array $from, array $to): string
    {
        $image = imagecreatetruecolor($w, $h);
        for ($y = 0; $y < $h; $y += 4) {
            $t = $y / $h;
            $color = imagecolorallocate($image, ...array_map(fn ($a, $b) => (int) ($a + ($b - $a) * $t), $from, $to));
            imagefilledrectangle($image, 0, $y, $w, $y + 3, $color);
        }
        $path = tempnam(sys_get_temp_dir(), 'seed').'.jpg';
        imagejpeg($image, $path, 85);

        return $path;
    }
}
