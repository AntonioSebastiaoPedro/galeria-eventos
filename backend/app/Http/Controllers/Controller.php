<?php

namespace App\Http\Controllers;

use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;

abstract class Controller
{
    use AuthorizesRequests;

    public const PER_PAGE_OPTIONS = [10, 25, 50, 100];

    // Com ?per_page devolve uma página ({data, current_page, last_page, per_page, total}).
    // Sem ?per_page devolve a lista toda, para os campos de escolha (selects) que precisam de todas as opções.
    protected function listing(Builder $query, ?callable $present = null): JsonResponse
    {
        $present ??= fn ($row) => $row;

        if (! request()->has('per_page')) {
            return response()->json($query->get()->map($present)->values());
        }

        $perPage = (int) request()->query('per_page');
        $page = $query->paginate(in_array($perPage, self::PER_PAGE_OPTIONS, true) ? $perPage : 25);

        return response()->json([
            'data' => $page->getCollection()->map($present)->values(),
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
        ]);
    }
}
