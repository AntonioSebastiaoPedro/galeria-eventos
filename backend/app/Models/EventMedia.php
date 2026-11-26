<?php

namespace App\Models;

use Database\Factories\EventMediaFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Fotografia ou vídeo de um evento. Estados: processing (a gerar miniaturas), pending (à espera da moderação),
 * approved (visível na galeria) e failed (ficheiro inválido; os ficheiros já foram apagados).
 */
#[Fillable(['event_id', 'event_guest_id', 'user_id', 'guest_name', 'media_type', 'status', 'original_path', 'original_name', 'mime_type', 'file_size', 'preview_path', 'thumbnail_path', 'width', 'height', 'duration', 'caption', 'processed_at'])]
class EventMedia extends Model
{
    /** @use HasFactory<EventMediaFactory> */
    use HasFactory;

    protected $table = 'event_media';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
            'duration' => 'float',
            'processed_at' => 'datetime',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function guest(): BelongsTo
    {
        return $this->belongsTo(EventGuest::class, 'event_guest_id');
    }

    public function isVideo(): bool
    {
        return $this->media_type === 'video';
    }

    /**
     * Caminhos de todos os ficheiros deste conteúdo (original e versões geradas).
     *
     * @return string[]
     */
    public function paths(): array
    {
        return array_values(array_filter([$this->original_path, $this->preview_path, $this->thumbnail_path]));
    }
}
