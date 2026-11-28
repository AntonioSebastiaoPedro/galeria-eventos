<?php

// Regras dos ficheiros enviados para as galerias. O espaço total de cada evento depende do plano (config/plans.php).
return [
    // Disco onde ficam os originais, as miniaturas e os ZIP. Privado: os ficheiros só saem por URLs assinadas.
    'disk' => env('MEDIA_DISK', 'local'),

    'photo_max_mb' => (int) env('MEDIA_PHOTO_MAX_MB', 25),
    'video_max_mb' => (int) env('MEDIA_VIDEO_MAX_MB', 300),

    // Tipos aceites, pelo conteúdo do ficheiro (não pela extensão). HEIC é convertido para JPEG no telemóvel.
    'photo_mimes' => ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'],
    'video_mimes' => ['video/mp4' => 'mp4', 'video/quicktime' => 'mov', 'video/webm' => 'webm', 'video/3gpp' => '3gp'],

    // Versões geradas: miniatura para a grelha e versão de visualização (sem metadados, nem GPS).
    'thumb_px' => 480,
    'preview_px' => 2048,

    'caption_max' => 280,

    // Validade das URLs assinadas dos ficheiros, em horas. Arredondada a blocos, para o navegador poder usar a cache.
    'url_ttl_hours' => 6,

    // Em produção o nginx envia os ficheiros depois de o PHP os autorizar (X-Accel-Redirect, ver FileDelivery).
    // Exige o volume de armazenamento montado no contentor nginx (compose.prod.yml).
    'x_accel' => (bool) env('MEDIA_X_ACCEL', false),

    // Os ZIP ficam disponíveis durante estes dias e depois são apagados.
    'export_ttl_days' => 7,

    // Envios por convidado e por hora (anti-spam).
    'guest_uploads_per_hour' => (int) env('MEDIA_GUEST_UPLOADS_PER_HOUR', 150),
];
