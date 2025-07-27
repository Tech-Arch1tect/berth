<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\Auditable;

class Server extends Model
{
    use HasFactory, Auditable;

    protected $fillable = [
        'display_name',
        'hostname',
        'port',
        'https',
        'access_secret',
    ];

    protected $casts = [
        'port' => 'integer',
        'https' => 'boolean',
        'access_secret' => 'encrypted',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $hidden = [
        'access_secret',
    ];


    public function getFullUrlAttribute(): string
    {
        $protocol = $this->https ? 'https' : 'http';
        return "{$protocol}://{$this->hostname}:{$this->port}";
    }

    public function getProtocolAttribute(): string
    {
        return $this->https ? 'HTTPS' : 'HTTP';
    }

    public function getHealthEndpointAttribute(): string
    {
        return $this->getFullUrlAttribute() . '/health';
    }

    public function roles()
    {
        return $this->belongsToMany(Role::class)
            ->withPivot(['can_access', 'can_filemanager_access', 'can_filemanager_write', 'can_start_stop', 'can_exec'])
            ->withTimestamps();
    }

    public function getRolesWithPermissions()
    {
        return $this->roles()->get()->map(function ($role) {
            return [
                'id' => $role->id,
                'name' => $role->name,
                'permissions' => [
                    'access' => $role->pivot->can_access,
                    'filemanager_access' => $role->pivot->can_filemanager_access,
                    'filemanager_write' => $role->pivot->can_filemanager_write,
                    'start-stop' => $role->pivot->can_start_stop,
                    'exec' => $role->pivot->can_exec,
                ]
            ];
        });
    }
}