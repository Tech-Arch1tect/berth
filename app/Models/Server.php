<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Server extends Model
{
    use HasFactory;

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
}