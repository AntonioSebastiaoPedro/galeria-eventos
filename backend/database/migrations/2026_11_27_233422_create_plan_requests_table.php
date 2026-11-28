<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pedidos de mudança de plano de um evento: o organizador paga a diferença por Multicaixa Express,
 * envia o comprovativo, e a administração confirma (o plano muda) ou recusa (com o motivo).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plan_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete(); // quem pediu
            $table->string('from_plan', 20);
            $table->string('to_plan', 20);
            $table->unsignedInteger('amount_kz'); // diferença entre os preços dos dois planos
            $table->string('status', 20)->default('pending')->index(); // pending, approved, rejected, cancelled
            $table->string('proof_path')->nullable(); // comprovativo do pagamento (imagem ou PDF), no disco privado
            $table->string('proof_name')->nullable();
            $table->string('proof_mime', 100)->nullable();
            $table->unsignedInteger('proof_size')->nullable();
            $table->text('admin_note')->nullable(); // motivo da recusa
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['event_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plan_requests');
    }
};
