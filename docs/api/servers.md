# Server Endpoints

## Overview

Server endpoints manage connections to berth-agent instances running on Docker hosts.

## Supported Authentication Methods

| Method | Supported | Notes |
|--------|-----------|-------|
| JWT Token | ✅ | Primary method for API clients |
| Session Cookie | ✅ | Automatically used by web UI |
| API Key | ✅ | Requires `servers.read` scope for user endpoints |

**Admin endpoints** require the `admin.servers.read` or `admin.servers.write` scope.

---

## User Endpoints

These endpoints return servers the authenticated user has permission to access.

### GET /api/v1/servers

List all servers accessible to the current user.

**Authentication:** Bearer token (JWT, Session, or API Key with `servers.read` scope)

```bash
curl https://berth.example.com/api/v1/servers \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "servers": [
    {
      "id": 1,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "name": "production-docker",
      "description": "Production Docker host",
      "host": "docker.example.com",
      "port": 8080,
      "skip_ssl_verification": false,
      "is_active": true
    }
  ]
}
```

---

### GET /api/v1/servers/:serverid/statistics

Get statistics for a specific server.

**Authentication:** Bearer token (JWT, Session, or API Key with `servers.read` scope)

```bash
curl https://berth.example.com/api/v1/servers/1/statistics \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "statistics": {
    "total_stacks": 7,
    "healthy_stacks": 5,
    "unhealthy_stacks": 2
  }
}
```

---

## Admin Endpoints

These endpoints require administrator privileges and manage the server configuration.

### GET /api/v1/admin/servers

List all servers (admin view).

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.servers.read` scope)

```bash
curl https://berth.example.com/api/v1/admin/servers \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "servers": [
    {
      "id": 1,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "name": "production-docker",
      "description": "Production Docker host",
      "host": "docker.example.com",
      "port": 8080,
      "skip_ssl_verification": false,
      "is_active": true
    }
  ]
}
```

---

### GET /api/v1/admin/servers/:id

Get details of a specific server.

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.servers.read` scope)

```bash
curl https://berth.example.com/api/v1/admin/servers/1 \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "server": {
    "id": 1,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "name": "production-docker",
    "description": "Production Docker host",
    "host": "docker.example.com",
    "port": 8080,
    "skip_ssl_verification": false,
    "is_active": true
  }
}
```

**Error Response (404):**
```json
{
  "error": "Server not found"
}
```

---

### POST /api/v1/admin/servers

Create a new server connection.

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.servers.write` scope)

```bash
curl -X POST https://berth.example.com/api/v1/admin/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "staging-docker",
    "description": "Staging Docker host",
    "host": "staging.example.com",
    "port": 8080,
    "skip_ssl_verification": true,
    "access_token": "<agent-access-token>",
    "is_active": true
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Display name for the server |
| description | string | No | Optional description |
| host | string | Yes | Hostname or IP address of the agent |
| port | integer | Yes | Port the agent is listening on |
| skip_ssl_verification | boolean | No | Skip SSL certificate verification (default: true) |
| access_token | string | Yes | Authentication token for the berth-agent |
| is_active | boolean | No | Whether the server is active (default: true) |

**Success Response (201):**
```json
{
  "server": {
    "id": 2,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "name": "staging-docker",
    "description": "Staging Docker host",
    "host": "staging.example.com",
    "port": 8080,
    "skip_ssl_verification": true,
    "is_active": true
  }
}
```

**Error Response (400):**
```json
{
  "error": "bad_request",
  "message": "access token is required"
}
```

---

### PUT /api/v1/admin/servers/:id

Update an existing server.

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.servers.write` scope)

```bash
curl -X PUT https://berth.example.com/api/v1/admin/servers/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "production-docker-updated",
    "description": "Updated description",
    "host": "docker.example.com",
    "port": 8080,
    "skip_ssl_verification": false,
    "is_active": true
  }'
```

**Request Body:** Same fields as create. Omit `access_token` to keep the existing token.

**Success Response (200):**
```json
{
  "server": {
    "id": 1,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T11:00:00Z",
    "name": "production-docker-updated",
    "description": "Updated description",
    "host": "docker.example.com",
    "port": 8080,
    "skip_ssl_verification": false,
    "is_active": true
  }
}
```

---

### DELETE /api/v1/admin/servers/:id

Delete a server.

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.servers.write` scope)

```bash
curl -X DELETE https://berth.example.com/api/v1/admin/servers/1 \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "message": "Server deleted successfully"
}
```

**Error Response (404):**
```json
{
  "error": "Server not found"
}
```

---

### POST /api/v1/admin/servers/:id/test

Test connectivity to a server's berth-agent.

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.servers.write` scope)

```bash
curl -X POST https://berth.example.com/api/v1/admin/servers/1/test \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "message": "Connection successful"
}
```

**Error Response (500):**
```json
{
  "error": "connection_failed",
  "message": "Failed to connect to server: connection refused"
}
```
