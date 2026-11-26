<?php

namespace App\Modules\Eventos;

/**
 * Planos por evento (config/plans.php).
 */
class Plans
{
    /**
     * @return array{name: string, price_kz: int, storage_mb: int, max_photos: int|null, videos: bool, zip: bool}
     */
    public static function get(?string $key): array
    {
        $plans = config('plans.plans');

        return $plans[$key] ?? $plans[config('plans.default')];
    }

    /**
     * @return string[]
     */
    public static function keys(): array
    {
        return array_keys(config('plans.plans'));
    }

    /**
     * @return array<int, array{key: string, name: string, price_kz: int, storage_mb: int, max_photos: int|null, videos: bool, zip: bool}>
     */
    public static function all(): array
    {
        return collect(config('plans.plans'))->map(fn (array $plan, string $key) => ['key' => $key] + $plan)->values()->all();
    }
}
