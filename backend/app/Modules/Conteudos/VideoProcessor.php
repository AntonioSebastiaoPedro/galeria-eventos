<?php

namespace App\Modules\Conteudos;

use Illuminate\Support\Facades\Process;
use RuntimeException;
use Symfony\Component\Process\ExecutableFinder;

/**
 * Vídeos com o FFmpeg: lê a duração, tira os metadados (localização GPS) e põe o índice no início do ficheiro
 * (o vídeo começa a tocar antes de descarregar todo) sem recomprimir, e extrai uma imagem para capa.
 * Sem FFmpeg instalado o vídeo é aceite tal como veio, sem capa.
 */
class VideoProcessor
{
    public static function available(): bool
    {
        return (new ExecutableFinder)->find('ffmpeg') !== null && (new ExecutableFinder)->find('ffprobe') !== null;
    }

    public static function duration(string $path): float
    {
        $result = Process::timeout(60)->run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', $path]);
        $duration = (float) trim($result->output());
        if ($result->failed() || $duration <= 0) {
            throw new RuntimeException('Ficheiro de vídeo inválido.');
        }

        return $duration;
    }

    /**
     * Copia as faixas sem recomprimir, sem metadados e com "faststart". Substitui o original se correr bem.
     */
    public static function sanitize(string $path): void
    {
        $tmp = $path.'.clean.'.pathinfo($path, PATHINFO_EXTENSION);
        $format = strtolower(pathinfo($path, PATHINFO_EXTENSION)) === 'webm' ? [] : ['-movflags', '+faststart'];
        $result = Process::timeout(600)->run(['ffmpeg', '-y', '-v', 'error', '-i', $path, '-map', '0', '-map_metadata', '-1', '-c', 'copy', ...$format, $tmp]);

        if ($result->successful() && is_file($tmp) && filesize($tmp) > 0) {
            rename($tmp, $path);
        } elseif (is_file($tmp)) {
            unlink($tmp);
        }
    }

    /**
     * Grava uma imagem do início do vídeo (com a rotação do telemóvel já aplicada).
     */
    public static function poster(string $path, string $target, int $max): void
    {
        if (! is_dir(dirname($target))) {
            mkdir(dirname($target), 0775, true);
        }
        $scale = "scale='if(gt(iw,ih),min({$max},iw),-2)':'if(gt(iw,ih),-2,min({$max},ih))'";

        foreach (['0.5', '0'] as $at) { // vídeos com menos de meio segundo: primeira imagem
            $result = Process::timeout(120)->run(['ffmpeg', '-y', '-v', 'error', '-ss', $at, '-i', $path, '-frames:v', '1', '-vf', $scale, '-q:v', '3', $target]);
            if ($result->successful() && is_file($target) && filesize($target) > 0) {
                return;
            }
        }

        throw new RuntimeException('Não foi possível ler o vídeo.');
    }
}
