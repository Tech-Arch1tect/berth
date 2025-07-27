<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Audit Log Settings
    |--------------------------------------------------------------------------
    |
    | Configuration options for the audit logging system.
    |
    */

    // Maximum number of records to export at once (prevents memory issues)
    'export_limit' => env('AUDIT_EXPORT_LIMIT', 10000),

    // Number of audit logs to show per page in admin interface
    'per_page' => env('AUDIT_PER_PAGE', 50),

    // Number of days to retain audit logs (0 = never delete)
    'retention_days' => env('AUDIT_RETENTION_DAYS', 0),

    // Sensitive fields that should not be logged in old/new values
    'sensitive_fields' => [
        'password',
        'password_confirmation',
        'access_secret',
        'google2fa_secret',
        'two_factor_recovery_codes',
        'remember_token',
    ],

    // Enable/disable audit logging globally
    'enabled' => env('AUDIT_ENABLED', true),
];