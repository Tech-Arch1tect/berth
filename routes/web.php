<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\ServerController;
use App\Http\Middleware\CheckAdminRole;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');
});

// Admin routes
Route::middleware(['auth', 'verified', CheckAdminRole::class])->prefix('admin')->name('admin.')->group(function () {
    // Role management
    Route::get('roles', [RoleController::class, 'index'])->name('roles.index');
    Route::post('roles', [RoleController::class, 'store'])->name('roles.store');
    Route::put('roles/{role}', [RoleController::class, 'update'])->name('roles.update');
    Route::delete('roles/{role}', [RoleController::class, 'destroy'])->name('roles.destroy');
    
    // User management
    Route::get('users', [UserController::class, 'index'])->name('users.index');
    Route::put('users/{user}/roles', [UserController::class, 'updateRoles'])->name('users.updateRoles');
    Route::delete('users/{user}', [UserController::class, 'destroy'])->name('users.destroy');
    
    // Server management
    Route::get('servers', [ServerController::class, 'index'])->name('servers.index');
    Route::post('servers', [ServerController::class, 'store'])->name('servers.store');
    Route::get('servers/{server}', [ServerController::class, 'show'])->name('servers.show');
    Route::put('servers/{server}', [ServerController::class, 'update'])->name('servers.update');
    Route::delete('servers/{server}', [ServerController::class, 'destroy'])->name('servers.destroy');
    Route::get('servers/{server}/health', [ServerController::class, 'healthCheck'])->name('servers.health');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
