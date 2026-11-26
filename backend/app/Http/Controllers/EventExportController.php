<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\EventExport;
use App\Modules\Conteudos\MediaRules;
use App\Modules\Exportacoes\Jobs\BuildEventZip;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

// Descarregar todas as fotografias e vídeos do evento num ZIP (planos com essa funcionalidade).
class EventExportController extends Controller
{
    public function latest(Request $request, Event $event): JsonResponse
    {
        $this->own($request, $event);
        $export = $event->exports()->latest('id')->first();

        return response()->json($export ? $this->present($export) : null);
    }

    public function store(Request $request, Event $event): JsonResponse
    {
        $this->own($request, $event);
        abort_unless($event->planRules()['zip'], 403, 'O plano deste evento não inclui descarregar tudo em ZIP. Pode descarregar cada fotografia ou vídeo na galeria.');

        // Um pedido de cada vez por evento.
        $running = $event->exports()->whereIn('status', ['queued', 'processing'])->first();
        if ($running) {
            return response()->json($this->present($running));
        }

        $export = $event->exports()->create(['user_id' => $request->user()->id, 'status' => 'queued']);
        BuildEventZip::dispatch($export->id);

        return response()->json($this->present($export->fresh()), 201);
    }

    public function download(Request $request, EventExport $export): BinaryFileResponse
    {
        $this->own($request, $export->event);
        $disk = Storage::disk(MediaRules::disk());
        abort_unless($export->status === 'ready' && $export->path && $disk->exists($export->path), 404, 'O ZIP já não está disponível. Peça outro.');

        return response()->download($disk->path($export->path), Str::slug($export->event->title).'.zip', ['X-Content-Type-Options' => 'nosniff']);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(EventExport $e): array
    {
        return $e->only('id', 'status', 'file_size', 'items', 'error', 'created_at') + [
            'expires_at' => $e->created_at?->copy()->addDays(config('media.export_ttl_days')),
        ];
    }

    private function own(Request $request, Event $event): void
    {
        abort_unless($event->isManagedBy($request->user()), 404);
    }
}
