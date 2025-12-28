# Operations & Logs Endpoints

## Overview

Operations endpoints manage Docker Compose operations (up, down, pull, etc.) on stacks. Logs endpoints provide access to container logs and operation history.

## Supported Authentication Methods

| Method | Supported | Notes |
|--------|-----------|-------|
| JWT Token | ✅ | Primary method for API clients |
| Session Cookie | ✅ | Automatically used by web UI |
| API Key | ✅ | Requires appropriate scope |

**Required Scopes:**
- Operations: `stacks.manage`
- User operation logs: `logs.operations.read`
- Container logs: `logs.read`
- Admin operation logs: `admin.logs.read`

---

## POST /api/v1/servers/:serverid/stacks/:stackname/operations

Start a Docker Compose operation on a stack.

**Authentication:** Bearer token (JWT, Session, or API Key with `stacks.manage` scope)

```bash
curl -X POST https://berth.example.com/api/v1/servers/1/stacks/my-app/operations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "command": "up",
    "options": ["-d"],
    "services": ["web", "db"]
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| command | string | Yes | Operation command: `up`, `down`, `start`, `stop`, `restart`, `pull`, `build` |
| options | string[] | No | Command options (e.g., `["-d"]`, `["--force-recreate"]`) |
| services | string[] | No | Specific services to operate on (default: all) |
| registry_credentials | object[] | No | Registry credentials for pulling images |

**Registry Credentials:**
```json
{
  "registry_credentials": [
    {
      "registry": "ghcr.io",
      "username": "user",
      "password": "token"
    }
  ]
}
```

**Success Response (200):**
```json
{
  "operationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Note:** Use the returned `operationId` to track progress via WebSocket or query operation logs.

---

## GET /api/v1/operation-logs

List the current user's operation logs with pagination and filtering.

**Authentication:** Bearer token (JWT, Session, or API Key with `logs.operations.read` scope)

**Query Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| page | integer | No | Page number (default: 1) |
| page_size | integer | No | Items per page (default: 20, max: 100) |
| search | string | No | Search in stack_name, command, operation_id |
| server_id | integer | No | Filter by server ID |
| stack_name | string | No | Filter by stack name (partial match) |
| command | string | No | Filter by command (exact match) |
| status | string | No | Filter: `complete`, `incomplete`, `failed`, `success` |

```bash
curl "https://berth.example.com/api/v1/operation-logs?page=1&page_size=10&status=failed" \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "data": [
    {
      "id": 123,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:45Z",
      "user_id": 1,
      "user": { "id": 1, "username": "admin", "email": "admin@example.com" },
      "server_id": 1,
      "server": { "id": 1, "name": "production", "host": "server.example.com" },
      "stack_name": "my-app",
      "operation_id": "550e8400-e29b-41d4-a716-446655440000",
      "command": "up",
      "options": "[\"-d\"]",
      "services": "[\"web\",\"db\"]",
      "status": "completed",
      "queued_at": null,
      "start_time": "2024-01-15T10:30:00Z",
      "end_time": "2024-01-15T10:30:45Z",
      "last_message_at": "2024-01-15T10:30:44Z",
      "success": true,
      "exit_code": 0,
      "duration_ms": 45000,
      "summary": "Started my-app-web-1 and my-app-db-1",
      "user_name": "admin",
      "server_name": "production",
      "trigger_source": "manual",
      "is_incomplete": false,
      "formatted_date": "2024-01-15 10:30:00",
      "message_count": 25,
      "partial_duration_ms": null
    }
  ],
  "pagination": {
    "current_page": 1,
    "page_size": 10,
    "total": 50,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  }
}
```

**Note:** The `options` and `services` fields are JSON-encoded strings, not arrays.

---

## GET /api/v1/operation-logs/stats

Get statistics for the current user's operations.

**Authentication:** Bearer token (JWT, Session, or API Key with `logs.operations.read` scope)

```bash
curl https://berth.example.com/api/v1/operation-logs/stats \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "total_operations": 150,
  "incomplete_operations": 2,
  "failed_operations": 10,
  "successful_operations": 138,
  "recent_operations": 15
}
```

**Note:** `recent_operations` counts operations from the last 24 hours.

---

## GET /api/v1/operation-logs/by-operation-id/:operationId

Get operation log details by the operation UUID.

**Authentication:** Bearer token (JWT, Session, or API Key with `logs.operations.read` scope)

```bash
curl https://berth.example.com/api/v1/operation-logs/by-operation-id/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "log": {
    "id": 123,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:45Z",
    "user_id": 1,
    "user": { "id": 1, "username": "admin", "email": "admin@example.com" },
    "server_id": 1,
    "server": { "id": 1, "name": "production", "host": "server.example.com" },
    "stack_name": "my-app",
    "operation_id": "550e8400-e29b-41d4-a716-446655440000",
    "command": "up",
    "options": "[\"-d\"]",
    "services": "[]",
    "status": "completed",
    "start_time": "2024-01-15T10:30:00Z",
    "end_time": "2024-01-15T10:30:45Z",
    "success": true,
    "exit_code": 0,
    "duration_ms": 45000,
    "summary": "Started my-app-web-1",
    "user_name": "admin",
    "server_name": "production",
    "trigger_source": "manual",
    "is_incomplete": false,
    "formatted_date": "2024-01-15 10:30:00",
    "message_count": 11
  },
  "messages": [
    {
      "id": 1,
      "created_at": "2024-01-15T10:30:01Z",
      "operation_log_id": 123,
      "message_type": "stderr",
      "message_data": " Container my-app-web-1 Starting",
      "timestamp": "2024-01-15T10:30:01Z",
      "sequence_number": 1
    },
    {
      "id": 2,
      "created_at": "2024-01-15T10:30:02Z",
      "operation_log_id": 123,
      "message_type": "stderr",
      "message_data": " Container my-app-web-1 Started",
      "timestamp": "2024-01-15T10:30:02Z",
      "sequence_number": 2
    }
  ]
}
```

**Error Response (404):**
```json
{
  "error": "Operation log not found"
}
```

---

## GET /api/v1/operation-logs/:id

Get operation log details by database ID.

**Authentication:** Bearer token (JWT, Session, or API Key with `logs.operations.read` scope)

```bash
curl https://berth.example.com/api/v1/operation-logs/123 \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):** Same format as `/operation-logs/by-operation-id/:operationId`

---

## GET /api/v1/running-operations

Get the current user's currently running operations.

**Authentication:** Bearer token (JWT, Session, or API Key with `logs.operations.read` scope)

```bash
curl https://berth.example.com/api/v1/running-operations \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
[
  {
    "id": 124,
    "created_at": "2024-01-15T11:00:00Z",
    "updated_at": "2024-01-15T11:00:00Z",
    "user_id": 1,
    "user": { "id": 1, "username": "admin", "email": "admin@example.com" },
    "server_id": 1,
    "server": { "id": 1, "name": "production", "host": "server.example.com" },
    "stack_name": "my-app",
    "operation_id": "660e8400-e29b-41d4-a716-446655440001",
    "command": "pull",
    "options": "[]",
    "services": "[]",
    "status": "running",
    "start_time": "2024-01-15T11:00:00Z",
    "end_time": null,
    "user_name": "admin",
    "server_name": "production",
    "is_incomplete": true,
    "formatted_date": "2024-01-15 11:00:00",
    "message_count": 5,
    "partial_duration_ms": 30000
  }
]
```

**Note:** Returns an empty array `[]` if no operations are running. Only returns operations with activity in the last 5 minutes.

---

## GET /api/v1/servers/:serverid/stacks/:stackname/logs

Get aggregated logs from all containers in a stack.

**Authentication:** Bearer token (JWT, Session, or API Key with `logs.read` scope)

**Query Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| tail | integer | No | Number of lines (default: 100) |
| since | string | No | Only logs since timestamp (e.g., "2024-01-15T10:00:00Z" or "1h") |
| timestamps | boolean | No | Include timestamps (default: true) |

```bash
curl "https://berth.example.com/api/v1/servers/1/stacks/my-app/logs?tail=50&since=1h" \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "logs": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "message": "Server started on port 8080",
      "source": "web",
      "level": "info"
    },
    {
      "timestamp": "2024-01-15T10:30:01Z",
      "message": "Connected to database",
      "source": "web",
      "level": "info"
    }
  ]
}
```

---

## GET /api/v1/servers/:serverid/stacks/:stackname/containers/:containerName/logs

Get logs from a specific container.

**Authentication:** Bearer token (JWT, Session, or API Key with `logs.read` scope)

**Query Parameters:** Same as stack logs endpoint.

```bash
curl "https://berth.example.com/api/v1/servers/1/stacks/my-app/containers/my-app-web-1/logs?tail=100" \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):** Same format as stack logs.

---

## Admin Endpoints

### GET /api/v1/admin/operation-logs

List all operation logs (not filtered by user).

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.logs.read` scope)

**Query Parameters:** Same as `/api/v1/operation-logs`

```bash
curl "https://berth.example.com/api/v1/admin/operation-logs?page=1&page_size=20" \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):** Same format as `/api/v1/operation-logs`

---

### GET /api/v1/admin/operation-logs/stats

Get global operation statistics (all users).

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.logs.read` scope)

```bash
curl https://berth.example.com/api/v1/admin/operation-logs/stats \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):** Same format as `/api/v1/operation-logs/stats`

---

### GET /api/v1/admin/operation-logs/:id

Get operation log details (any user's operation).

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.logs.read` scope)

```bash
curl https://berth.example.com/api/v1/admin/operation-logs/123 \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):** Same format as `/api/v1/operation-logs/:id`
