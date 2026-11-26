<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete(); // organizador
            $table->string('title');
            $table->string('slug')->unique(); // parte pública do link: /g/{slug}
            $table->text('description')->nullable();
            $table->string('event_type'); // birthday, wedding, baptism, graduation, corporate, other
            $table->date('event_date');
            $table->string('cover_path')->nullable();
            $table->string('visibility')->default('private'); // public, private
            // Chave secreta que vai no link e no QR Code das galerias privadas; access_version muda ao regenerá-la
            // e obriga os convidados que entraram com a chave antiga a entrar de novo.
            $table->string('access_key', 64);
            $table->unsignedInteger('access_version')->default(1);
            $table->string('access_code')->nullable(); // código opcional (hash), para dar de viva voz
            $table->boolean('upload_enabled')->default(true);
            $table->boolean('allow_videos')->default(true);
            $table->string('moderation')->default('auto'); // auto: publica logo; manual: o organizador aprova
            $table->string('status')->default('active'); // active, disabled
            $table->string('plan')->default('free');
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
        });

        // Convidados: sem conta. Ficam identificados pela sessão do navegador e por um nome (não verificado).
        Schema::create('event_guests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();
            $table->string('name')->nullable();
            $table->unsignedInteger('access_version')->default(1);
            $table->timestamp('blocked_at')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();
        });

        Schema::create('event_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('event_guest_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete(); // enviado pelo organizador
            $table->string('guest_name')->nullable();
            $table->string('media_type'); // photo, video
            $table->string('status')->default('processing'); // processing, pending, approved, failed
            $table->string('original_path');
            $table->string('original_name');
            $table->string('mime_type');
            $table->unsignedBigInteger('file_size');
            $table->string('preview_path')->nullable(); // fotografia reduzida (ou capa do vídeo), sem metadados
            $table->string('thumbnail_path')->nullable();
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->decimal('duration', 8, 2)->nullable(); // segundos (vídeos)
            $table->string('caption', 280)->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->index(['event_id', 'status', 'created_at']);
            $table->index(['event_guest_id']);
        });

        // Pedidos de descarregar o evento inteiro em ZIP: gerados numa fila e apagados ao fim de uns dias.
        Schema::create('event_exports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('status')->default('queued'); // queued, processing, ready, failed
            $table->string('path')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->unsignedInteger('items')->nullable();
            $table->string('error')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_exports');
        Schema::dropIfExists('event_media');
        Schema::dropIfExists('event_guests');
        Schema::dropIfExists('events');
    }
};
