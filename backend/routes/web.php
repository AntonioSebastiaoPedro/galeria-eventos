<?php

use Illuminate\Support\Facades\Route;

// A interface é a SPA (frontend/). O backend só responde à API.
Route::get('/', fn () => response()->json(['name' => config('app.name')]));
