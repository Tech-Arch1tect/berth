# Security Audit & Migration Endpoints

## Overview

Security audit endpoints provide access to the security audit log, which tracks security-relevant events across the system. Migration endpoints allow exporting and importing system data for backup and migration purposes.

**Base Paths:**
- Security Audit: `/api/v1/admin/security-audit-logs/`
- Migration: `/api/v1/admin/migration/`

## Supported Authentication Methods

| Method | Supported | Notes |
|--------|-----------|-------|
| JWT Token | ✅ | Primary method for API clients |
| Session Cookie | ✅ | Automatically used by web UI |
| API Key | ✅ | Requires appropriate scope |

**Required Scopes:**
- Security audit: `admin.audit.read`
- Migration export: `admin.system.export`
- Migration import: `admin.system.import`

---

# Security Audit Endpoints

## GET /api/v1/admin/security-audit-logs

List security audit logs with filtering and pagination.

**Authentication:** Bearer token with `admin.audit.read` scope

```bash
curl https://berth.example.com/api/v1/admin/security-audit-logs \
  -H "Authorization: Bearer <token>"
```

**Query Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| event_type | string | No | Filter by event type (e.g., `login_success`, `role_assigned`) |
| event_category | string | No | Filter by category (e.g., `authentication`, `authorization`) |
| severity | string | No | Filter by severity (`low`, `medium`, `high`, `critical`) |
| actor_user_id | integer | No | Filter by user who performed the action |
| success | boolean | No | Filter by success status (`true` or `false`) |
| start_date | string | No | Filter events after this date (RFC3339 format) |
| end_date | string | No | Filter events before this date (RFC3339 format) |
| search | string | No | Search in actor_username, target_name, event_type |
| page | integer | No | Page number (default: 1) |
| per_page | integer | No | Items per page (default: 50, max: 100) |

**Example with filters:**
```bash
curl "https://berth.example.com/api/v1/admin/security-audit-logs?event_category=authentication&success=false&per_page=10" \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "logs": [
    {
      "id": 1,
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z",
      "deleted_at": null,
      "event_type": "login_success",
      "event_category": "authentication",
      "severity": "low",
      "actor_user_id": 1,
      "actor_username": "admin",
      "actor_ip": "192.168.1.100",
      "actor_user_agent": "Mozilla/5.0...",
      "target_user_id": null,
      "target_type": "",
      "target_id": null,
      "target_name": "",
      "success": true,
      "failure_reason": "",
      "metadata": "{}",
      "server_id": null,
      "stack_name": "",
      "session_id": "abc123"
    }
  ],
  "total": 150,
  "page": 1,
  "per_page": 50,
  "total_pages": 3
}
```

---

## GET /api/v1/admin/security-audit-logs/stats

Get security audit log statistics.

**Authentication:** Bearer token with `admin.audit.read` scope

```bash
curl https://berth.example.com/api/v1/admin/security-audit-logs/stats \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "total_events": 1500,
  "events_by_category": {
    "authentication": 500,
    "authorization": 300,
    "data_access": 400,
    "configuration": 200,
    "system": 100
  },
  "events_by_severity": {
    "low": 1000,
    "medium": 350,
    "high": 100,
    "critical": 50
  },
  "failed_events": 75,
  "recent_event_types": [
    {
      "event_type": "login_success",
      "count": 450
    },
    {
      "event_type": "stack_operation_started",
      "count": 320
    },
    {
      "event_type": "api_key_created",
      "count": 50
    }
  ],
  "events_last_24_hours": 125,
  "events_last_7_days": 750
}
```

---

## GET /api/v1/admin/security-audit-logs/:id

Get a specific security audit log entry.

**Authentication:** Bearer token with `admin.audit.read` scope

```bash
curl https://berth.example.com/api/v1/admin/security-audit-logs/1 \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "id": 1,
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-15T10:00:00Z",
  "deleted_at": null,
  "event_type": "login_success",
  "event_category": "authentication",
  "severity": "low",
  "actor_user_id": 1,
  "actor_username": "admin",
  "actor_ip": "192.168.1.100",
  "actor_user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "target_user_id": null,
  "target_type": "",
  "target_id": null,
  "target_name": "",
  "success": true,
  "failure_reason": "",
  "metadata": "{\"method\":\"password\"}",
  "server_id": null,
  "stack_name": "",
  "session_id": "abc123def456"
}
```

**Error Response (404):**
```json
{
  "error": "Log not found"
}
```

---

# Migration Endpoints

## POST /api/v1/admin/migration/export

Export all system data as an encrypted backup file.

**Authentication:** Bearer token with `admin.system.export` scope

```bash
curl -X POST https://berth.example.com/api/v1/admin/migration/export \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"password": "my-secure-backup-password"}' \
  -o berth-backup.json
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| password | string | Yes | Encryption password (minimum 12 characters) |

**Success Response (200):**

Returns an encrypted binary file with:
- Content-Type: `application/octet-stream`
- Content-Disposition: `attachment; filename="berth-backup-<timestamp>.json"`

**Error Responses:**

**400 Bad Request:**
```json
{
  "error": "Password is required"
}
```

```json
{
  "error": "Password must be at least 12 characters long"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Export failed"
}
```

---

## POST /api/v1/admin/migration/import

Import system data from an encrypted backup file.

**Authentication:** Bearer token with `admin.system.import` scope

**Note:** This endpoint uses multipart form data, not JSON.

```bash
curl -X POST https://berth.example.com/api/v1/admin/migration/import \
  -H "Authorization: Bearer <token>" \
  -F "password=my-secure-backup-password" \
  -F "backup_file=@berth-backup.json"
```

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| password | string | Yes | Decryption password used during export |
| backup_file | file | Yes | The encrypted backup file |

**Success Response (200):**
```json
{
  "success": true,
  "encryption_secret": "new-encryption-secret-if-changed",
  "summary": {
    "users_imported": 5,
    "roles_imported": 3,
    "servers_imported": 2,
    "api_keys_imported": 10
  }
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "error": "Password is required"
}
```

```json
{
  "error": "Backup file is required"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Import failed: <details>"
}
```

---

## Event Types Reference

Common event types logged by the security audit system:

| Event Type | Category | Description |
|------------|----------|-------------|
| `login_success` | authentication | Successful user login |
| `login_failed` | authentication | Failed login attempt |
| `logout` | authentication | User logout |
| `totp_enabled` | authentication | 2FA enabled for user |
| `totp_disabled` | authentication | 2FA disabled for user |
| `password_changed` | authentication | User password changed |
| `role_assigned` | authorization | Role assigned to user |
| `role_revoked` | authorization | Role removed from user |
| `api_key_created` | authorization | API key created |
| `api_key_revoked` | authorization | API key revoked |
| `stack_operation_started` | data_access | Stack operation initiated |
| `registry_credential_created` | configuration | Registry credential added |
| `registry_credential_deleted` | configuration | Registry credential removed |
| `server_created` | configuration | Server added |
| `server_deleted` | configuration | Server removed |

## Severity Levels

| Severity | Description |
|----------|-------------|
| `low` | Routine operations (successful logins, normal actions) |
| `medium` | Notable events (configuration changes, new credentials) |
| `high` | Security-relevant events (failed logins, permission changes) |
| `critical` | Security incidents (multiple failed logins, unauthorized access attempts) |
