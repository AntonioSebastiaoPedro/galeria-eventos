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
     * Subir de plano é passar para um plano mais caro: o organizador paga só a diferença.
     */
    public static function isUpgrade(string $from, string $to): bool
    {
        return in_array($to, self::keys(), true) && self::get($to)['price_kz'] > self::get($from)['price_kz'];
    }

    public static function upgradeAmount(string $from, string $to): int
    {
        return max(0, self::get($to)['price_kz'] - self::get($from)['price_kz']);
    }

    /**
     * Dados públicos para pagar e pedir ajuda (sem número configurado, payment é null).
     *
     * @return array{payment: array{method: string, number: string, holder: string|null}|null, support_phone: string|null, proof_max_mb: int}
     */
    public static function settings(): array
    {
        $number = config('plans.payment.express_number');

        return [
            'payment' => $number ? ['method' => 'Multicaixa Express', 'number' => (string) $number, 'holder' => config('plans.payment.express_holder')] : null,
            'support_phone' => config('plans.support_phone') ? (string) config('plans.support_phone') : null,
            'proof_max_mb' => (int) config('plans.proof_max_mb'),
        ];
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
