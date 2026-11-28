<?php

namespace App\Models;

use Database\Factories\PlanRequestFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pedido de mudança de plano de um evento. O organizador paga a diferença por Multicaixa Express e envia
 * o comprovativo; a administração confirma (o plano do evento muda) ou recusa com o motivo.
 * Estados: pending, approved, rejected, cancelled (cancelado pelo organizador).
 */
#[Fillable(['event_id', 'user_id', 'from_plan', 'to_plan', 'amount_kz', 'status', 'proof_path', 'proof_name', 'proof_mime', 'proof_size', 'admin_note', 'reviewed_by', 'reviewed_at'])]
class PlanRequest extends Model
{
    /** @use HasFactory<PlanRequestFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['amount_kz' => 'integer', 'proof_size' => 'integer', 'reviewed_at' => 'datetime'];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }
}
