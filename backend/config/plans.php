<?php

// Planos por evento (o organizador paga por evento, não por mês). Os preços são propostas para testar
// o mercado angolano; o pagamento é tratado fora da plataforma no MVP e a administração muda o plano do evento.
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
];
