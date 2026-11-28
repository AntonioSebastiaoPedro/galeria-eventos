<?php

use App\Http\Controllers\Admin\AdminController;
use App\Http\Controllers\Admin\PlanRequestController as AdminPlanRequestController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\EventExportController;
use App\Http\Controllers\EventGuestController;
use App\Http\Controllers\EventMediaController;
use App\Http\Controllers\Gallery\GalleryController;
use App\Http\Controllers\MediaFileController;
use App\Http\Controllers\PlanRequestController;
use Illuminate\Support\Facades\Route;

// O 3.º parâmetro do throttle é o prefixo do contador: sem ele, todas as rotas com limite partilham o mesmo contador por IP.
Route::middleware('throttle:30,1,auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
});

Route::get('/plans', [EventController::class, 'plans']);
Route::get('/settings', [EventController::class, 'settings']);

// Ficheiros: a URL assinada é a autorização (ver MediaUrls e EventPresenter::coverUrl).
Route::get('/media/{media}/{variant}', [MediaFileController::class, 'show'])->middleware('signed:relative')->name('media.file');
Route::get('/events/{event}/cover', [EventController::class, 'coverFile'])->middleware('signed:relative')->name('events.cover');

// Galeria dos convidados: sem conta; o acesso às privadas fica na sessão do navegador (GalleryAccess).
Route::prefix('g/{event:slug}')->middleware('throttle:240,1,gallery')->group(function () {
    Route::get('/', [GalleryController::class, 'show']);
    Route::post('/access', [GalleryController::class, 'access'])->middleware('throttle:20,10,gallery-access');
    Route::put('/me', [GalleryController::class, 'updateMe']);
    Route::get('/media', [GalleryController::class, 'media']);
    Route::post('/media', [GalleryController::class, 'upload'])->middleware('throttle:60,1,gallery-upload');
    Route::delete('/media/{media}', [GalleryController::class, 'destroy']);
});

Route::middleware(['auth:sanctum', 'account.enabled', 'throttle:240,1'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me', [AuthController::class, 'updateProfile']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);

    Route::get('/events', [EventController::class, 'index']);
    Route::post('/events', [EventController::class, 'store']);
    Route::get('/events/{event}', [EventController::class, 'show']);
    Route::put('/events/{event}', [EventController::class, 'update']);
    Route::delete('/events/{event}', [EventController::class, 'destroy']);
    Route::post('/events/{event}/cover', [EventController::class, 'cover']);
    Route::delete('/events/{event}/cover', [EventController::class, 'removeCover']);
    Route::post('/events/{event}/regenerate-key', [EventController::class, 'regenerateKey']);
    Route::get('/events/{event}/qr', [EventController::class, 'qr']);
    Route::get('/events/{event}/stats', [EventController::class, 'stats']);

    Route::get('/events/{event}/media', [EventMediaController::class, 'index']);
    Route::post('/events/{event}/media', [EventMediaController::class, 'store']);
    Route::post('/events/{event}/media/bulk', [EventMediaController::class, 'bulk']);
    Route::post('/media/{media}/approve', [EventMediaController::class, 'approve']);
    Route::delete('/media/{media}', [EventMediaController::class, 'destroy']);

    Route::get('/events/{event}/guests', [EventGuestController::class, 'index']);
    Route::post('/guests/{guest}/block', [EventGuestController::class, 'block']);
    Route::post('/guests/{guest}/unblock', [EventGuestController::class, 'unblock']);

    Route::get('/events/{event}/export', [EventExportController::class, 'latest']);
    Route::post('/events/{event}/export', [EventExportController::class, 'store']);
    Route::get('/exports/{export}/download', [EventExportController::class, 'download']);

    Route::get('/events/{event}/plan-request', [PlanRequestController::class, 'show']);
    Route::post('/events/{event}/plan-request', [PlanRequestController::class, 'store'])->middleware('throttle:10,10,plan-request');
    Route::delete('/plan-requests/{planRequest}', [PlanRequestController::class, 'destroy']);
    Route::get('/plan-requests/{planRequest}/proof', [PlanRequestController::class, 'proof']);

    Route::middleware('role:superadmin')->prefix('admin')->group(function () {
        Route::get('/overview', [AdminController::class, 'overview']);
        Route::get('/events', [AdminController::class, 'events']);
        Route::put('/events/{event}/plan', [AdminController::class, 'setPlan']);
        Route::get('/users', [AdminController::class, 'users']);
        Route::post('/users/{user}/disable', [AdminController::class, 'disable']);
        Route::post('/users/{user}/enable', [AdminController::class, 'enable']);
        Route::post('/users/{user}/reset-password', [AdminController::class, 'resetPassword']);

        Route::get('/plan-requests', [AdminPlanRequestController::class, 'index']);
        Route::post('/plan-requests/{planRequest}/approve', [AdminPlanRequestController::class, 'approve']);
        Route::post('/plan-requests/{planRequest}/reject', [AdminPlanRequestController::class, 'reject']);
    });
});
