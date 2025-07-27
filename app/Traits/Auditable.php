<?php

namespace App\Traits;

use App\Services\AuditLogService;

trait Auditable
{
    protected static function bootAuditable()
    {
        static::created(function ($model) {
            if (static::shouldAuditEvent('created')) {
                AuditLogService::logModelChanges('created', $model, [], $model->toArray());
            }
        });

        static::updated(function ($model) {
            if (static::shouldAuditEvent('updated')) {
                AuditLogService::logModelChanges(
                    'updated',
                    $model,
                    $model->getOriginal(),
                    $model->getChanges()
                );
            }
        });

        static::deleted(function ($model) {
            if (static::shouldAuditEvent('deleted')) {
                AuditLogService::logModelChanges('deleted', $model, $model->toArray(), []);
            }
        });
    }

    protected static function shouldAuditEvent(string $event): bool
    {
        $auditEvents = static::getAuditEvents();
        return in_array($event, $auditEvents);
    }

    protected static function getAuditEvents(): array
    {
        return property_exists(static::class, 'auditEvents') 
            ? static::$auditEvents 
            : ['created', 'updated', 'deleted'];
    }

    public function getAuditLogs()
    {
        return \App\Models\AuditLog::where('auditable_type', get_class($this))
            ->where('auditable_id', $this->id)
            ->orderBy('created_at', 'desc');
    }
}