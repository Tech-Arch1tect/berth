<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;
use App\Traits\Auditable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasRoles, Auditable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'email_verified_at',
        'google2fa_secret',
        'two_factor_recovery_codes',
        'two_factor_confirmed_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'google2fa_secret',
        'two_factor_recovery_codes',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_recovery_codes' => 'array',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->hasRole('admin');
    }

    public function hasServerPermission(Server $server, string $permission): bool
    {
        // Admins have all permissions
        if ($this->isAdmin()) {
            return true;
        }

        // Load roles with servers relationship if not already loaded
        if (!$this->relationLoaded('roles')) {
            $this->load('roles.servers');
        } else {
            $this->roles->load('servers');
        }

        // Check if any of the user's roles have the required permission for this server
        foreach ($this->roles as $role) {
            if ($role->hasServerPermission($server, $permission)) {
                return true;
            }
        }

        return false;
    }

    public function getServerPermissions(Server $server): array
    {
        // Admins have all permissions
        if ($this->isAdmin()) {
            return [
                'access' => true, 
                'filemanager_access' => true, 
                'filemanager_write' => true, 
                'start-stop' => true, 
                'exec' => true
            ];
        }

        // Load roles with servers relationship if not already loaded
        if (!$this->relationLoaded('roles')) {
            $this->load('roles.servers');
        } else {
            $this->roles->load('servers');
        }

        $permissions = [
            'access' => false, 
            'filemanager_access' => false, 
            'filemanager_write' => false, 
            'start-stop' => false, 
            'exec' => false
        ];

        // Aggregate permissions from all roles
        foreach ($this->roles as $role) {
            $rolePermissions = $role->getServerPermissions($server);
            $permissions['access'] = $permissions['access'] || $rolePermissions['access'];
            $permissions['filemanager_access'] = $permissions['filemanager_access'] || $rolePermissions['filemanager_access'];
            $permissions['filemanager_write'] = $permissions['filemanager_write'] || $rolePermissions['filemanager_write'];
            $permissions['start-stop'] = $permissions['start-stop'] || $rolePermissions['start-stop'];
            $permissions['exec'] = $permissions['exec'] || $rolePermissions['exec'];
        }

        return $permissions;
    }

    public function getAccessibleServers(): \Illuminate\Database\Eloquent\Collection
    {
        // Admins can access all servers
        if ($this->isAdmin()) {
            return Server::all();
        }

        // Load roles with servers relationship if not already loaded
        if (!$this->relationLoaded('roles')) {
            $this->load('roles.servers');
        } else {
            $this->roles->load('servers');
        }

        // Get servers that this user has access to through their roles
        $serverIds = collect();
        
        foreach ($this->roles as $role) {
            $roleServerIds = $role->servers->pluck('id');
            $serverIds = $serverIds->merge($roleServerIds);
        }

        return Server::whereIn('id', $serverIds->unique())->get();
    }

    public function hasTwoFactorEnabled(): bool
    {
        return !empty($this->google2fa_secret) && !is_null($this->two_factor_confirmed_at);
    }

    public function generateTwoFactorSecret(): string
    {
        $google2fa = app(\PragmaRX\Google2FALaravel\Google2FA::class);
        return $google2fa->generateSecretKey();
    }

    public function getTwoFactorQrCode(): string
    {
        $google2fa = app(\PragmaRX\Google2FALaravel\Google2FA::class);
        return $google2fa->getQRCodeInline(
            config('app.name'),
            $this->email,
            $this->google2fa_secret
        );
    }

    public function verifyTwoFactorCode(string $code): bool
    {
        $google2fa = app(\PragmaRX\Google2FALaravel\Google2FA::class);
        return $google2fa->verifyKey($this->google2fa_secret, $code);
    }

    public function generateRecoveryCodes(): array
    {
        $codes = [];
        for ($i = 0; $i < 8; $i++) {
            $codes[] = substr(str_replace(['+', '/', '='], '', base64_encode(random_bytes(32))), 0, 10);
        }
        return $codes;
    }

    public function useRecoveryCode(string $code): bool
    {
        $codes = $this->two_factor_recovery_codes ?? [];
        $index = array_search($code, $codes);
        
        if ($index !== false) {
            unset($codes[$index]);
            $this->two_factor_recovery_codes = array_values($codes);
            $this->save();
            return true;
        }
        
        return false;
    }
}
