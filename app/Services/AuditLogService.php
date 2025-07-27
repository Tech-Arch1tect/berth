<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Server;
use Illuminate\Database\Eloquent\Model;

class AuditLogService
{
    public static function log(string $event, ?Model $auditable = null, array $options = []): ?AuditLog
    {
        if (!config('audit.enabled', true)) {
            return null;
        }

        if (empty($event) || !is_string($event)) {
            throw new \InvalidArgumentException('Event name must be a non-empty string');
        }

        $data = array_merge([
            'event' => $event,
        ], $options);

        if ($auditable) {
            $data['auditable_type'] = get_class($auditable);
            $data['auditable_id'] = $auditable->id;
        }

        $data = self::filterSensitiveData($data);

        return AuditLog::createLog($data);
    }

    public static function logServerAction(string $event, ?Server $server = null, array $metadata = []): ?AuditLog
    {
        return self::log($event, $server, [
            'server_id' => $server?->id,
            'metadata' => $metadata,
        ]);
    }

    public static function logStackAction(string $event, Server $server, string $stackName, array $metadata = []): ?AuditLog
    {
        return self::log($event, null, [
            'server_id' => $server->id,
            'stack_name' => $stackName,
            'metadata' => $metadata,
        ]);
    }

    public static function logFileAction(string $event, Server $server, string $stackName, string $filePath, array $metadata = []): ?AuditLog
    {
        return self::log($event, null, [
            'server_id' => $server->id,
            'stack_name' => $stackName,
            'metadata' => array_merge($metadata, [
                'file_path' => $filePath,
            ]),
        ]);
    }

    public static function logUserAction(string $event, ?Model $user = null, array $metadata = []): ?AuditLog
    {
        return self::log($event, $user, [
            'metadata' => $metadata,
        ]);
    }

    public static function logAccessDenied(string $resource, array $metadata = []): ?AuditLog
    {
        return self::log('access_denied', null, [
            'metadata' => array_merge($metadata, [
                'resource' => $resource,
            ]),
        ]);
    }

    public static function logModelChanges(string $event, Model $model, array $oldValues = [], array $newValues = []): ?AuditLog
    {
        return self::log($event, $model, [
            'old_values' => $oldValues,
            'new_values' => $newValues,
        ]);
    }

    /**
     * Filter sensitive data from audit log data
     */
    private static function filterSensitiveData(array $data): array
    {
        $sensitiveFields = config('audit.sensitive_fields', []);

        if (isset($data['old_values']) && is_array($data['old_values'])) {
            $data['old_values'] = self::removeSensitiveFields($data['old_values'], $sensitiveFields);
        }

        if (isset($data['new_values']) && is_array($data['new_values'])) {
            $data['new_values'] = self::removeSensitiveFields($data['new_values'], $sensitiveFields);
        }

        return $data;
    }

    /**
     * Remove sensitive fields from an array
     */
    private static function removeSensitiveFields(array $values, array $sensitiveFields): array
    {
        foreach ($sensitiveFields as $field) {
            if (isset($values[$field])) {
                $values[$field] = '[REDACTED]';
            }
        }

        return $values;
    }
}