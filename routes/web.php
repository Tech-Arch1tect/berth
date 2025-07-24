<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\ServerController;
use App\Http\Controllers\StackController;
use App\Http\Controllers\TwoFactorController;
use App\Http\Middleware\CheckAdminRole;
use App\Http\Middleware\TwoFactorMiddleware;

Route::get('/', function () {
    return redirect()->route('dashboard');
})->name('home');

Route::middleware(['auth', 'verified', TwoFactorMiddleware::class])->group(function () {
    Route::get('dashboard', function () {
        $user = auth()->user();
        
        return Inertia::render('dashboard', [
            'isAdmin' => $user->isAdmin(),
        ]);
    })->name('dashboard');
    
    // Stack viewing (available to all authenticated users with server permissions)
    Route::get('servers/{server}/stacks', [StackController::class, 'index'])->name('stacks.index');
    Route::get('servers/{server}/stacks/{stackName}', [StackController::class, 'show'])->name('stacks.show');
    Route::get('servers/{server}/stacks/refresh', [StackController::class, 'refresh'])->name('stacks.refresh');
    Route::get('api/servers/{server}/stacks', [StackController::class, 'apiIndex'])->name('api.stacks.index');
    Route::get('api/servers/{server}/stacks/{stackName}/status', [StackController::class, 'getServiceStatus'])->name('api.stacks.status');
    Route::get('api/servers/{server}/stacks/{stackName}/logs', [StackController::class, 'getLogs'])->name('api.stacks.logs');
    Route::get('api/servers/{server}/stacks/{stackName}/files', [StackController::class, 'listFiles'])->name('api.stacks.files');
    Route::get('api/servers/{server}/stacks/{stackName}/file', [StackController::class, 'readFile'])->name('api.stacks.file');
    Route::get('api/servers/{server}/stacks/{stackName}/file/metadata', [StackController::class, 'getFileMetadata'])->name('api.stacks.file.metadata');
    Route::get('api/servers/{server}/stacks/{stackName}/file/download', [StackController::class, 'downloadFile'])->name('api.stacks.file.download');
    Route::post('api/servers/{server}/stacks/{stackName}/file', [StackController::class, 'createFile'])->name('api.stacks.file.create');
    Route::put('api/servers/{server}/stacks/{stackName}/file', [StackController::class, 'updateFile'])->name('api.stacks.file.update');
    Route::delete('api/servers/{server}/stacks/{stackName}/file', [StackController::class, 'deleteFile'])->name('api.stacks.file.delete');
    Route::post('api/servers/{server}/stacks/{stackName}/exec', [StackController::class, 'composeExec'])->name('api.stacks.exec');
    Route::get('api/servers/{server}/stacks/{stackName}/terminal/{service}', [StackController::class, 'terminalSession'])->name('api.stacks.terminal');
    
    Route::get('api/servers/{server}/stacks/{stackName}/up/stream', [StackController::class, 'composeUpStream'])->name('api.stacks.up.stream');
    Route::get('api/servers/{server}/stacks/{stackName}/down/stream', [StackController::class, 'composeDownStream'])->name('api.stacks.down.stream');
    
    // Configuration endpoints
    Route::get('api/config', [StackController::class, 'getConfig'])->name('api.config');
    
    // Two-factor authentication routes
    Route::get('two-factor', [TwoFactorController::class, 'show'])->name('two-factor.show');
    Route::post('two-factor', [TwoFactorController::class, 'store'])->name('two-factor.store');
    Route::delete('two-factor', [TwoFactorController::class, 'destroy'])->name('two-factor.destroy');
    Route::get('two-factor/recovery-codes', [TwoFactorController::class, 'recoveryCodes'])->name('two-factor.recovery-codes');
    Route::post('two-factor/recovery-codes', [TwoFactorController::class, 'newRecoveryCodes'])->name('two-factor.recovery-codes.new');
});

// 2FA Challenge routes (outside of auth middleware to avoid infinite redirects)
Route::middleware(['auth'])->group(function () {
    Route::get('two-factor/challenge', [TwoFactorController::class, 'challenge'])->name('two-factor.challenge');
    Route::post('two-factor/challenge', [TwoFactorController::class, 'verify'])->name('two-factor.verify');
});

// Admin routes
Route::middleware(['auth', 'verified', TwoFactorMiddleware::class, CheckAdminRole::class])->prefix('admin')->name('admin.')->group(function () {
    // Role management
    Route::get('roles', [RoleController::class, 'index'])->name('roles.index');
    Route::post('roles', [RoleController::class, 'store'])->name('roles.store');
    Route::put('roles/{role}', [RoleController::class, 'update'])->name('roles.update');
    Route::delete('roles/{role}', [RoleController::class, 'destroy'])->name('roles.destroy');
    
    // Role permissions management
    Route::get('roles/{role}/permissions', [RoleController::class, 'permissions'])->name('roles.permissions');
    Route::post('roles/{role}/permissions', [RoleController::class, 'updatePermissions'])->name('roles.permissions.update');
    
    // User management
    Route::get('users', [UserController::class, 'index'])->name('users.index');
    Route::post('users', [UserController::class, 'store'])->name('users.store');
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
