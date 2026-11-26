<?php

namespace Database\Factories;

use App\Models\Event;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Event>
 */
class EventFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $title = 'Aniversário de '.fake()->firstName();

        return [
            'user_id' => User::factory(),
            'title' => $title,
            'slug' => Event::makeSlug($title),
            'event_type' => 'birthday',
            'event_date' => now()->addDays(10)->toDateString(),
            'visibility' => 'public',
            'access_key' => Event::makeAccessKey(),
            'upload_enabled' => true,
            'allow_videos' => true,
            'moderation' => 'auto',
            'status' => 'active',
            'plan' => 'premium',
        ];
    }

    public function private(?string $code = null): static
    {
        return $this->state(fn () => ['visibility' => 'private', 'access_code' => $code]);
    }

    public function moderated(): static
    {
        return $this->state(fn () => ['moderation' => 'manual']);
    }

    public function plan(string $plan): static
    {
        return $this->state(fn () => ['plan' => $plan]);
    }
}
