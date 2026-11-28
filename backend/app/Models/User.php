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
#[Fillable(['name', 'email', 'phone', 'password', 'role'])]
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

    /**
     * Telemóvel no formato internacional. Os números angolanos podem vir como "923 456 789", "244923456789",
     * "+244 923 456 789" ou "00244923456789"; todos ficam "+244923456789". Outro texto volta limpo, para a validação o recusar.
     */
    public static function normalizePhone(mixed $phone): ?string
    {
        if (! is_string($phone) || trim($phone) === '') {
            return null;
        }
        $clean = preg_replace('/[\s().\-]/', '', trim($phone));
        if (str_starts_with($clean, '00')) {
            $clean = '+'.substr($clean, 2);
        }
        if (preg_match('/^9\d{8}$/', $clean)) {
            return '+244'.$clean;
        }
        if (preg_match('/^2449\d{8}$/', $clean)) {
            return '+'.$clean;
        }

        return $clean;
    }

    /**
     * Regra de validação do telemóvel já normalizado: angolano (+244 9XX XXX XXX) ou internacional válido.
     */
    public const PHONE_RULE = 'regex:/^(\+2449\d{8}|\+(?!244)[1-9]\d{7,14})$/';

    protected function phone(): Attribute
    {
        return Attribute::make(set: fn (mixed $value) => self::normalizePhone($value));
    }

    /**
     * Onde contactar a pessoa: e-mail, se tiver, senão o telemóvel.
     */
    public function contact(): ?string
    {
        return $this->email ?? $this->phone;
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

    /**
     * Só as contas com e-mail recebem notificações por e-mail; as outras vêem tudo na aplicação.
     */
    public function routeNotificationForMail(): ?string
    {
        return $this->email;
    }
}
