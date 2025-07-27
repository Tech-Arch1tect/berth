<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    protected $fillable = [
        'event',
        'auditable_type',
        'auditable_id',
        'user_id',
        'user_email',
        'user_name',
        'url',
        'method',
        'old_values',
        'new_values',
        'metadata',
        'ip_address',
        'user_agent',
        'server_id',
        'stack_name',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = [
        'event_description',
        'formatted_created_at',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    public function auditable()
    {
        return $this->morphTo();
    }

    public static function createLog(array $data): self
    {
        $log = new self();
        $log->fill($data);
        
        if (auth()->check()) {
            $user = auth()->user();
            $log->user_id = $user->id;
            $log->user_email = $user->email;
            $log->user_name = $user->name;
        }
        
        if (request()) {
            $log->url = request()->fullUrl();
            $log->method = request()->method();
            $log->ip_address = request()->ip();
            $log->user_agent = request()->userAgent();
        }
        
        $log->save();
        
        return $log;
    }

    public function getFormattedCreatedAtAttribute(): string
    {
        return $this->created_at->format('Y-m-d H:i:s');
    }

    public function getEventDescriptionAttribute(): string
    {
        $eventDescriptions = [
            'created' => 'Created',
            'updated' => 'Updated',
            'deleted' => 'Deleted',
            'login' => 'User logged in',
            'logout' => 'User logged out',
            'access_denied' => 'Access denied',
            'server_created' => 'Server created',
            'server_updated' => 'Server updated',
            'server_deleted' => 'Server deleted',
            'server_health_check' => 'Server health check',
            'stack_viewed' => 'Stack viewed',
            'stack_up' => 'Stack started',
            'stack_down' => 'Stack stopped',
            'service_up' => 'Service started',
            'service_down' => 'Service stopped',
            'file_viewed' => 'File viewed',
            'file_created' => 'File created',
            'file_updated' => 'File updated',
            'file_deleted' => 'File deleted',
            'file_downloaded' => 'File downloaded',
            'file_renamed' => 'File renamed',
            'terminal_accessed' => 'Terminal accessed',
            'user_created' => 'User created',
            'user_updated' => 'User updated',
            'user_deleted' => 'User deleted',
            'role_assigned' => 'Role assigned',
            'role_removed' => 'Role removed',
            '2fa_enabled' => 'Two-factor authentication enabled',
            '2fa_disabled' => 'Two-factor authentication disabled',
            '2fa_recovery_code_used' => 'Two-factor recovery code used',
            'failed_login' => 'Failed login attempt',
            'audit_cleanup' => 'Audit log cleanup performed',
            'docker_maintenance_viewed' => 'Docker maintenance dashboard viewed',
            'docker_system_info_viewed' => 'Docker system information viewed',
            'docker_system_info_failed' => 'Docker system information fetch failed',
            'docker_disk_usage_viewed' => 'Docker disk usage viewed',
            'docker_disk_usage_failed' => 'Docker disk usage fetch failed',
            'docker_images_viewed' => 'Docker images viewed',
            'docker_images_list_failed' => 'Docker images list fetch failed',
            'docker_image_deleted' => 'Docker image deleted',
            'docker_image_delete_failed' => 'Docker image deletion failed',
            'docker_images_pruned' => 'Docker images pruned',
            'docker_images_prune_failed' => 'Docker images prune failed',
            'docker_volumes_viewed' => 'Docker volumes viewed',
            'docker_volumes_list_failed' => 'Docker volumes list fetch failed',
            'docker_volume_deleted' => 'Docker volume deleted',
            'docker_volume_delete_failed' => 'Docker volume deletion failed',
            'docker_volumes_pruned' => 'Docker volumes pruned',
            'docker_volumes_prune_failed' => 'Docker volumes prune failed',
        ];

        return $eventDescriptions[$this->event] ?? ucfirst(str_replace('_', ' ', $this->event));
    }
}
