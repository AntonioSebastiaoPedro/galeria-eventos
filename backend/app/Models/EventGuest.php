<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Convidado de um evento: sem conta nem palavra-passe. É reconhecido pela sessão do navegador
 * (ver App\Modules\Eventos\GalleryAccess) e o organizador pode bloqueá-lo.
 */
#[Fillable(['event_id', 'name', 'access_version', 'blocked_at', 'ip_address', 'last_seen_at'])]
class EventGuest extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'blocked_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'access_version' => 'integer',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(EventMedia::class);
    }

    public function isBlocked(): bool
    {
        return $this->blocked_at !== null;
    }
}
