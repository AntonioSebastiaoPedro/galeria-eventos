<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pedido de descarregar todas as fotografias e vídeos aprovados de um evento num ZIP.
 */
#[Fillable(['event_id', 'user_id', 'status', 'path', 'file_size', 'items', 'error'])]
class EventExport extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['file_size' => 'integer', 'items' => 'integer'];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }
}
