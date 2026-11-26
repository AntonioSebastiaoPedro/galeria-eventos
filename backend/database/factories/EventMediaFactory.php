<?php

namespace Database\Factories;

use App\Models\Event;
use App\Models\EventMedia;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * Registo sem ficheiro real: para testes que só precisam da base de dados (contagens, limites, permissões).
 *
 * @extends Factory<EventMedia>
 */
class EventMediaFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'event_id' => Event::factory(),
            'guest_name' => fake()->firstName(),
            'media_type' => 'photo',
            'status' => 'approved',
            'original_path' => 'events/0/originals/'.Str::uuid().'.jpg',
            'original_name' => 'IMG_'.fake()->numerify('####').'.jpg',
            'mime_type' => 'image/jpeg',
            'file_size' => 2_000_000,
            'width' => 1600,
            'height' => 1200,
        ];
    }

    public function pending(): static
    {
        return $this->state(fn () => ['status' => 'pending']);
    }

    public function video(): static
    {
        return $this->state(fn () => ['media_type' => 'video', 'mime_type' => 'video/mp4', 'original_path' => 'events/0/originals/'.Str::uuid().'.mp4', 'duration' => 12.5]);
    }
}
