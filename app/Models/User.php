<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasRoles;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
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
            return ['read' => true, 'write' => true, 'start-stop' => true, 'exec' => true];
        }

        // Load roles with servers relationship if not already loaded
        if (!$this->relationLoaded('roles')) {
            $this->load('roles.servers');
        } else {
            $this->roles->load('servers');
        }

        $permissions = ['read' => false, 'write' => false, 'start-stop' => false, 'exec' => false];

        // Aggregate permissions from all roles
        foreach ($this->roles as $role) {
            $rolePermissions = $role->getServerPermissions($server);
            $permissions['read'] = $permissions['read'] || $rolePermissions['read'];
            $permissions['write'] = $permissions['write'] || $rolePermissions['write'];
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
}
