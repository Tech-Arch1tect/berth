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
            ->withPivot(['can_read', 'can_write', 'can_start_stop'])
            ->withTimestamps();
    }

    public function hasServerPermission(Server $server, string $permission): bool
    {
        $serverRole = $this->servers()->where('server_id', $server->id)->first();
        
        if (!$serverRole) {
            return false;
        }

        return match($permission) {
            'read' => $serverRole->pivot->can_read,
            'write' => $serverRole->pivot->can_write,
            'start-stop' => $serverRole->pivot->can_start_stop,
            default => false,
        };
    }

    public function getServerPermissions(Server $server): array
    {
        $serverRole = $this->servers()->where('server_id', $server->id)->first();
        
        if (!$serverRole) {
            return ['read' => false, 'write' => false, 'start-stop' => false];
        }

        return [
            'read' => $serverRole->pivot->can_read,
            'write' => $serverRole->pivot->can_write,
            'start-stop' => $serverRole->pivot->can_start_stop,
        ];
    }
}