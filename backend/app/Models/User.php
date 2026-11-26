<?php

namespace App\Models;

use App\Modules\Notificacoes\Notifications\ResetPassword;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * Organizador de eventos (role organizer) ou administração da plataforma (role superadmin).
 * Os convidados não têm conta: ver EventGuest.
 */
#[Fillable(['name', 'email', 'password', 'role'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'disabled_at' => 'datetime',
        ];
    }

    /**
     * Os e-mails guardam-se em minúsculas e sem espaços: o PostgreSQL compara com maiúsculas.
     */
    public static function normalizeEmail(mixed $email): mixed
    {
        return is_string($email) && trim($email) !== '' ? mb_strtolower(trim($email)) : (is_string($email) ? null : $email);
    }

    protected function email(): Attribute
    {
        return Attribute::make(set: fn (mixed $value) => self::normalizeEmail($value));
    }

    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new ResetPassword($token));
    }

    public function isDisabled(): bool
    {
        return $this->disabled_at !== null;
    }

    public function isSuperadmin(): bool
    {
        return $this->role === 'superadmin';
    }

    public function events(): HasMany
    {
        return $this->hasMany(Event::class);
    }
}
