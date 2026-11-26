<?php

namespace App\Modules\Conteudos;

use GdImage;
use RuntimeException;

/**
 * Gera as versões reduzidas das fotografias com o GD: endireita a fotografia (EXIF) e grava JPEG
 * sem metadados (a localização GPS da câmara não chega aos outros convidados).
 */
class ImageProcessor
{
    // Acima disto (megapíxeis) a imagem não é aberta: protege a memória do servidor de "bombas" de descompressão.
    private const MAX_MEGAPIXELS = 120;

    /**
     * @return array{0: int, 1: int} largura e altura tal como estão no ficheiro (antes da rotação EXIF)
     */
    public static function dimensions(string $path): array
    {
        $info = @getimagesize($path);
        if (! $info) {
            throw new RuntimeException('Ficheiro de imagem inválido.');
        }

        return [$info[0], $info[1]];
    }

    public static function load(string $path): GdImage
    {
        [$w, $h] = self::dimensions($path);
        if ($w * $h > self::MAX_MEGAPIXELS * 1_000_000) {
            throw new RuntimeException('Imagem demasiado grande.');
        }

        $image = match (@getimagesize($path)['mime'] ?? null) {
            'image/jpeg' => @imagecreatefromjpeg($path),
            'image/png' => @imagecreatefrompng($path),
            'image/webp' => @imagecreatefromwebp($path),
            default => false,
        };
        if (! $image) {
            throw new RuntimeException('Não foi possível abrir a imagem.');
        }

        return self::orient($image, $path);
    }

    private static function orient(GdImage $image, string $path): GdImage
    {
        if (! function_exists('exif_read_data')) {
            return $image;
        }
        $orientation = (int) (@exif_read_data($path)['Orientation'] ?? 1);

        // imagerotate roda no sentido contrário ao dos ponteiros do relógio.
        [$angle, $mirror] = match ($orientation) {
            2 => [0, true],
            3 => [180, false],
            4 => [180, true],
            5 => [270, true],
            6 => [270, false],
            7 => [90, true],
            8 => [90, false],
            default => [0, false],
        };
        if ($angle) {
            $image = imagerotate($image, $angle, 0) ?: $image;
        }
        if ($mirror) {
            imageflip($image, IMG_FLIP_HORIZONTAL);
        }

        return $image;
    }

    /**
     * Reduz (nunca amplia) para caber em $max píxeis no lado maior e grava em JPEG.
     * As transparências (PNG/WebP) ficam sobre fundo branco.
     *
     * @return array{0: int, 1: int} largura e altura gravadas
     */
    public static function saveScaled(GdImage $source, string $target, int $max, int $quality): array
    {
        $w = imagesx($source);
        $h = imagesy($source);
        $scale = min(1, $max / max($w, $h));
        $nw = max(1, (int) round($w * $scale));
        $nh = max(1, (int) round($h * $scale));

        $out = imagecreatetruecolor($nw, $nh);
        imagefill($out, 0, 0, imagecolorallocate($out, 255, 255, 255));
        imagecopyresampled($out, $source, 0, 0, 0, 0, $nw, $nh, $w, $h);
        imageinterlace($out, true); // JPEG progressivo: aparece logo em redes lentas

        if (! is_dir(dirname($target))) {
            mkdir(dirname($target), 0775, true);
        }
        if (! imagejpeg($out, $target, $quality)) {
            throw new RuntimeException('Não foi possível gravar a imagem.');
        }

        return [$nw, $nh];
    }
}
