<?php

namespace App\Models;

use App\Modules\Eventos\Plans;
use Database\Factories\EventFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * Um evento é uma galeria: tem um link (/g/{slug}) e um QR Code próprios.
 */
#[Fillable(['user_id', 'title', 'slug', 'description', 'event_type', 'event_date', 'cover_path', 'visibility', 'access_key', 'access_version', 'access_code', 'upload_enabled', 'allow_videos', 'moderation', 'status', 'plan'])]
#[Hidden(['access_key', 'access_code'])]
class Event extends Model
{
    /** @use HasFactory<EventFactory> */
    use HasFactory;

    public const TYPES = ['birthday', 'wedding', 'baptism', 'graduation', 'corporate', 'party', 'other'];

    /**
     * Os mesmos valores por omissão da migração, para o modelo acabado de criar já os ter.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'visibility' => 'private',
        'access_version' => 1,
        'upload_enabled' => true,
        'allow_videos' => true,
        'moderation' => 'auto',
        'status' => 'active',
        'plan' => 'free',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'event_date' => 'date:Y-m-d',
            'upload_enabled' => 'boolean',
            'allow_videos' => 'boolean',
            'access_version' => 'integer',
            'access_code' => 'hashed',
        ];
    }

    /**
     * Slug legível com um sufixo aleatório: o link não se adivinha a partir do nome do evento.
     */
    public static function makeSlug(string $title): string
    {
        $base = Str::limit(Str::slug($title), 40, '') ?: 'evento';

        do {
            $slug = $base.'-'.Str::lower(Str::random(6));
        } while (self::where('slug', $slug)->exists());

        return $slug;
    }

    /**
     * 32 caracteres alfanuméricos (~190 bits): não se descobre por tentativa.
     */
    public static function makeAccessKey(): string
    {
        return Str::random(32);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(EventMedia::class);
    }

    public function guests(): HasMany
    {
        return $this->hasMany(EventGuest::class);
    }

    public function exports(): HasMany
    {
        return $this->hasMany(EventExport::class);
    }

    public function isPrivate(): bool
    {
        return $this->visibility === 'private';
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isManagedBy(?User $user): bool
    {
        return $user !== null && ! $user->isDisabled() && ($user->id === $this->user_id || $user->isSuperadmin());
    }

    /**
     * @return array{name: string, price_kz: int, storage_mb: int, max_photos: int|null, videos: bool, zip: bool}
     */
    public function planRules(): array
    {
        return Plans::get($this->plan);
    }

    public function videosAllowed(): bool
    {
        return $this->allow_videos && $this->planRules()['videos'];
    }

    public function storageLimitBytes(): int
    {
        return $this->planRules()['storage_mb'] * 1024 * 1024;
    }

    /**
     * Espaço ocupado pelos originais (os que falharam o processamento já não contam: foram apagados).
     */
    public function storageUsedBytes(): int
    {
        return (int) $this->media()->where('status', '!=', 'failed')->sum('file_size');
    }

    /**
     * Endereço da galeria para os convidados. Nas privadas leva a chave, por isso só o organizador o vê.
     */
    public function guestUrl(): string
    {
        $url = config('app.frontend_url').'/g/'.$this->slug;

        return $this->isPrivate() ? $url.'?k='.$this->access_key : $url;
    }
}
