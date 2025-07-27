<?php

namespace App\Models;

use Spatie\Permission\Models\Role as SpatieRole;

class Role extends SpatieRole
{
    protected $fillable = [
        'name',
        'guard_name',
        'description',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function getCreatedAtAttribute($value)
    {
        return $this->asDateTime($value);
    }

    public function getUpdatedAtAttribute($value)
    {
        return $this->asDateTime($value);
    }

    public function servers()
    {
        return $this->belongsToMany(Server::class)
            ->withPivot(['can_access', 'can_filemanager_access', 'can_filemanager_write', 'can_start_stop', 'can_exec', 'can_docker_maintenance_read', 'can_docker_maintenance_write'])
            ->withTimestamps();
    }

    public function hasServerPermission(Server $server, string $permission): bool
    {
        $serverRole = $this->servers()->where('server_id', $server->id)->first();
        
        if (!$serverRole) {
            return false;
        }

        return match($permission) {
            'access' => $serverRole->pivot->can_access,
            'filemanager_access' => $serverRole->pivot->can_filemanager_access,
            'filemanager_write' => $serverRole->pivot->can_filemanager_write,
            'start-stop' => $serverRole->pivot->can_start_stop,
            'exec' => $serverRole->pivot->can_exec,
            'docker_maintenance_read' => $serverRole->pivot->can_docker_maintenance_read,
            'docker_maintenance_write' => $serverRole->pivot->can_docker_maintenance_write,
            default => false,
        };
    }

    public function getServerPermissions(Server $server): array
    {
        $serverRole = $this->servers()->where('server_id', $server->id)->first();
        
        if (!$serverRole) {
            return [
                'access' => false, 
                'filemanager_access' => false, 
                'filemanager_write' => false, 
                'start-stop' => false, 
                'exec' => false,
                'docker_maintenance_read' => false,
                'docker_maintenance_write' => false
            ];
        }

        return [
            'access' => $serverRole->pivot->can_access,
            'filemanager_access' => $serverRole->pivot->can_filemanager_access,
            'filemanager_write' => $serverRole->pivot->can_filemanager_write,
            'start-stop' => $serverRole->pivot->can_start_stop,
            'exec' => $serverRole->pivot->can_exec,
            'docker_maintenance_read' => $serverRole->pivot->can_docker_maintenance_read,
            'docker_maintenance_write' => $serverRole->pivot->can_docker_maintenance_write,
        ];
    }

    public function getServersWithPermissions(): array
    {
        return $this->servers()->get()->map(function ($server) {
            return [
                'id' => $server->id,
                'display_name' => $server->display_name,
                'hostname' => $server->hostname,
                'port' => $server->port,
                'https' => $server->https,
                'permissions' => [
                    'access' => $server->pivot->can_access,
                    'filemanager_access' => $server->pivot->can_filemanager_access,
                    'filemanager_write' => $server->pivot->can_filemanager_write,
                    'start-stop' => $server->pivot->can_start_stop,
                    'exec' => $server->pivot->can_exec,
                    'docker_maintenance_read' => $server->pivot->can_docker_maintenance_read,
                    'docker_maintenance_write' => $server->pivot->can_docker_maintenance_write,
                ],
            ];
        })->toArray();
    }
}