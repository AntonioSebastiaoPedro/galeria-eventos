<?php

use App\Models\Event;
use Illuminate\Support\Facades\Broadcast;

// Avisos de conteúdos novos/alterados de um evento: só para quem o gere.
Broadcast::channel('events.{id}', fn ($user, int $id) => (bool) Event::find($id)?->isManagedBy($user));
