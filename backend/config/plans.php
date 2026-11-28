<?php

// Planos por evento (o organizador paga por evento, não por mês). Os preços são propostas para testar
// o mercado angolano. Para subir de plano, o organizador paga a diferença por Multicaixa Express, envia o
// comprovativo e a administração confirma (ver PlanRequestController).
// storage_mb: espaço total dos ficheiros originais; max_photos: null = sem limite.
return [
    'default' => 'free',

    'plans' => [
        'free' => [
            'name' => 'Gratuito',
            'price_kz' => 0,
            'storage_mb' => 1024,
            'max_photos' => 100,
            'videos' => false,
            'zip' => false,
        ],
        'basic' => [
            'name' => 'Básico',
            'price_kz' => 5000,
            'storage_mb' => 2 * 1024,
            'max_photos' => null,
            'videos' => true,
            'zip' => false,
        ],
        'premium' => [
            'name' => 'Premium',
            'price_kz' => 12000,
            'storage_mb' => 10 * 1024,
            'max_photos' => null,
            'videos' => true,
            'zip' => true,
        ],
        'exclusive' => [
            'name' => 'Exclusivo',
            'price_kz' => 25000,
            'storage_mb' => 30 * 1024,
            'max_photos' => null,
            'videos' => true,
            'zip' => true,
        ],
    ],

    // Quantos eventos no plano gratuito cada organizador pode ter ao mesmo tempo.
    'free_events_per_user' => (int) env('FREE_EVENTS_PER_USER', 1),

    // Pagamento da mudança de plano: só Multicaixa Express (transferência para um número de telemóvel).
    // Sem número configurado, a aplicação não aceita pedidos e pede para contactar o apoio.
    'payment' => [
        'express_number' => env('PAYMENT_EXPRESS_NUMBER'),
        'express_holder' => env('PAYMENT_EXPRESS_HOLDER'),
    ],

    // Comprovativo do pagamento: imagem ou PDF.
    'proof_max_mb' => (int) env('PAYMENT_PROOF_MAX_MB', 10),

    // Contacto de apoio (WhatsApp): recuperar a senha das contas sem e-mail e dúvidas sobre pagamentos.
    'support_phone' => env('SUPPORT_PHONE'),
];
