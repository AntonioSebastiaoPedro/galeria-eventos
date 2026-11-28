<?php

namespace Database\Factories;

use App\Models\Event;
use App\Models\PlanRequest;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PlanRequest>
 */
class PlanRequestFactory extends Factory
{
    /**
     * Pedido pendente de Básico para Premium (paga a diferença: 12 000 − 5 000 Kz).
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'event_id' => Event::factory()->plan('basic'),
            'user_id' => fn (array $attributes) => Event::find($attributes['event_id'])->user_id,
            'from_plan' => 'basic',
            'to_plan' => 'premium',
            'amount_kz' => 7000,
            'status' => 'pending',
            'proof_path' => fn (array $attributes) => "events/{$attributes['event_id']}/plan-requests/comprovativo.pdf",
            'proof_name' => 'comprovativo.pdf',
            'proof_mime' => 'application/pdf',
            'proof_size' => 1024,
        ];
    }
}
