<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\ServerController;
use App\Http\Controllers\Admin\ServerPermissionController;
use App\Http\Controllers\StackController;
use App\Http\Middleware\CheckAdminRole;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        $user = auth()->user();
        $servers = $user->getAccessibleServers();
        
        return Inertia::render('dashboard', [
            'servers' => $servers,
            'isAdmin' => $user->isAdmin(),
        ]);
    })->name('dashboard');
    
    // Stack viewing (available to all authenticated users with server permissions)
    Route::get('servers/{server}/stacks', [StackController::class, 'index'])->name('stacks.index');
    Route::get('servers/{server}/stacks/{stackName}', [StackController::class, 'show'])->name('stacks.show');
    Route::get('servers/{server}/stacks/refresh', [StackController::class, 'refresh'])->name('stacks.refresh');
    Route::get('api/servers/{server}/stacks', [StackController::class, 'apiIndex'])->name('api.stacks.index');
    Route::get('api/servers/{server}/stacks/{stackName}/status', [StackController::class, 'getServiceStatus'])->name('api.stacks.status');
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
    
    // Server permissions
    Route::get('servers/{server}/permissions', [ServerPermissionController::class, 'index'])->name('servers.permissions.index');
    Route::post('servers/{server}/permissions/assign', [ServerPermissionController::class, 'assignRole'])->name('servers.permissions.assign');
    Route::put('servers/{server}/permissions/roles/{role}', [ServerPermissionController::class, 'updateRolePermissions'])->name('servers.permissions.update');
    Route::delete('servers/{server}/permissions/roles/{role}', [ServerPermissionController::class, 'removeRole'])->name('servers.permissions.remove');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
