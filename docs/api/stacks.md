# Stack Endpoints

## Overview

Stack endpoints provide access to Docker Compose stacks running on berth-agent servers. All endpoints require stack-level RBAC permissions.

## Supported Authentication Methods

| Method | Supported | Notes |
|--------|-----------|-------|
| JWT Token | ✅ | Primary method for API clients |
| Session Cookie | ✅ | Automatically used by web UI |
| API Key | ✅ | Requires `stacks.read` scope for read endpoints |

**Write endpoints** (compose preview/update) require `stacks.manage` permission.

---

## GET /api/v1/servers/:id/stacks

List all stacks on a server accessible to the current user.

**Authentication:** Bearer token (JWT, Session, or API Key with `stacks.read` scope)

```bash
curl https://berth.example.com/api/v1/servers/1/stacks \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "stacks": [
    {
      "name": "my-app",
      "path": "/opt/compose/my-app",
      "compose_file": "docker-compose.yml",
      "server_id": 1,
      "server_name": "production-docker",
      "is_healthy": true,
      "total_containers": 3,
      "running_containers": 3
    }
  ]
}
```

---

## GET /api/v1/servers/:serverid/stacks/:stackname

Get detailed information about a specific stack.

**Authentication:** Bearer token (JWT, Session, or API Key with `stacks.read` scope)

```bash
curl https://berth.example.com/api/v1/servers/1/stacks/my-app \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "name": "my-app",
  "path": "/opt/compose/my-app",
  "compose_file": "docker-compose.yml",
  "server_id": 1,
  "server_name": "production-docker",
  "services": [
    {
      "name": "web",
      "image": "nginx:latest",
      "ports": ["80:80"],
      "containers": [
        {
          "name": "my-app-web-1",
          "image": "nginx:latest",
          "state": "running",
          "ports": [{"private": 80, "public": 80, "type": "tcp"}],
          "created": "2024-01-15T10:30:00Z",
          "started": "2024-01-15T10:30:01Z",
          "health": {"status": "healthy"},
          "networks": [{"name": "my-app_default", "ip_address": "172.18.0.2"}],
          "mounts": [{"type": "bind", "source": "/data", "destination": "/app/data", "rw": true}]
        }
      ]
    }
  ]
}
```

---

## GET /api/v1/servers/:serverid/stacks/:stackname/permissions

Get the current user's permissions for a specific stack.

**Authentication:** Bearer token (JWT, Session, or API Key)

```bash
curl https://berth.example.com/api/v1/servers/1/stacks/my-app/permissions \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "permissions": ["stacks.read", "stacks.manage", "files.read", "logs.read"]
}
```

---

## GET /api/v1/servers/:serverid/stacks/:stackname/networks

Get network information for a stack.

**Authentication:** Bearer token (JWT, Session, or API Key with `stacks.read` scope)

```bash
curl https://berth.example.com/api/v1/servers/1/stacks/my-app/networks \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
[
  {
    "name": "my-app_default",
    "driver": "bridge",
    "external": false,
    "exists": true,
    "created": "2024-01-15T10:30:00Z",
    "ipam": {
      "driver": "default",
      "config": [{"subnet": "172.18.0.0/16", "gateway": "172.18.0.1"}]
    },
    "containers": {
      "my-app-web-1": {
        "name": "my-app-web-1",
        "ipv4_address": "172.18.0.2"
      }
    }
  }
]
```

---

## GET /api/v1/servers/:serverid/stacks/:stackname/volumes

Get volume information for a stack.

**Authentication:** Bearer token (JWT, Session, or API Key with `stacks.read` scope)

```bash
curl https://berth.example.com/api/v1/servers/1/stacks/my-app/volumes \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
[
  {
    "name": "my-app_data",
    "driver": "local",
    "external": false,
    "exists": true,
    "created": "2024-01-15T10:30:00Z",
    "mountpoint": "/var/lib/docker/volumes/my-app_data/_data",
    "scope": "local",
    "used_by": [
      {
        "container_name": "my-app-web-1",
        "service_name": "web",
        "mounts": [{"type": "volume", "source": "my-app_data", "target": "/data", "read_only": false}]
      }
    ]
  }
]
```

---

## GET /api/v1/servers/:serverid/stacks/:stackname/environment

Get environment variables for all services in a stack.

**Authentication:** Bearer token (JWT, Session, or API Key with `stacks.read` scope)

**Query Parameters:**

| Name | Type | Description |
|------|------|-------------|
| unmask | boolean | Show sensitive values (requires `stacks.manage` permission) |

```bash
# Masked values (default)
curl https://berth.example.com/api/v1/servers/1/stacks/my-app/environment \
  -H "Authorization: Bearer <token>"

# Unmasked values (requires stacks.manage)
curl "https://berth.example.com/api/v1/servers/1/stacks/my-app/environment?unmask=true" \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "web": [
    {
      "variables": [
        {"key": "NODE_ENV", "value": "production", "is_sensitive": false, "source": "compose", "is_from_container": false},
        {"key": "DATABASE_URL", "value": "***", "is_sensitive": true, "source": "compose", "is_from_container": false}
      ]
    }
  ]
}
```

---

## GET /api/v1/servers/:serverid/stacks/:stackname/images

Get container image details for a stack.

**Authentication:** Bearer token (JWT, Session, or API Key with `stacks.read` scope)

```bash
curl https://berth.example.com/api/v1/servers/1/stacks/my-app/images \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
[
  {
    "container_name": "my-app-web-1",
    "image_id": "sha256:abc123...",
    "image_name": "nginx:latest",
    "image_info": {
      "architecture": "amd64",
      "os": "linux",
      "size": 187234512,
      "created": "2024-01-10T08:00:00Z",
      "config": {
        "env": ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"],
        "cmd": ["nginx", "-g", "daemon off;"],
        "exposed_ports": {"80/tcp": {}}
      }
    },
    "image_history": [
      {
        "id": "sha256:abc123...",
        "created": 1704873600,
        "created_by": "/bin/sh -c #(nop) CMD [\"nginx\" \"-g\" \"daemon off;\"]",
        "size": 0
      }
    ]
  }
]
```

---

## GET /api/v1/servers/:serverid/stacks/:stackname/stats

Get real-time container statistics for a stack.

**Authentication:** Bearer token (JWT, Session, or API Key with `stacks.read` scope)

```bash
curl https://berth.example.com/api/v1/servers/1/stacks/my-app/stats \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "stack_name": "my-app",
  "containers": [
    {
      "name": "my-app-web-1",
      "service_name": "web",
      "cpu_percent": 2.5,
      "memory_usage": 52428800,
      "memory_limit": 1073741824,
      "memory_percent": 4.88,
      "network_rx_bytes": 1048576,
      "network_tx_bytes": 524288,
      "block_read_bytes": 10485760,
      "block_write_bytes": 5242880
    }
  ]
}
```

---

## POST /api/v1/servers/:serverid/stacks/:stackname/compose/preview

Preview changes to a stack's docker-compose.yml without applying them.

**Authentication:** Bearer token (JWT, Session, or API Key with `stacks.manage` scope)

```bash
curl -X POST https://berth.example.com/api/v1/servers/1/stacks/my-app/compose/preview \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "changes": {
      "service_image_updates": [
        {"service_name": "web", "new_tag": "1.25"}
      ]
    }
  }'
```

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| changes.service_image_updates | array | Image/tag changes per service |
| changes.service_port_updates | array | Port mapping changes per service |
| changes.service_env_updates | array | Environment variable changes per service |

**Service Image Update:**

| Field | Type | Description |
|-------|------|-------------|
| service_name | string | Name of the service to update |
| new_image | string | New image name (optional) |
| new_tag | string | New image tag (optional) |

**Success Response (200):**
```json
{
  "original": "version: '3'\nservices:\n  web:\n    image: nginx:latest\n",
  "preview": "version: '3'\nservices:\n  web:\n    image: nginx:1.25\n"
}
```

---

## PATCH /api/v1/servers/:serverid/stacks/:stackname/compose

Apply changes to a stack's docker-compose.yml.

**Authentication:** Bearer token (JWT, Session, or API Key with `stacks.manage` scope)

```bash
curl -X PATCH https://berth.example.com/api/v1/servers/1/stacks/my-app/compose \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "changes": {
      "service_image_updates": [
        {"service_name": "web", "new_tag": "1.25"}
      ],
      "service_env_updates": [
        {
          "service_name": "web",
          "environment": [
            {"key": "LOG_LEVEL", "value": "debug"}
          ]
        }
      ]
    }
  }'
```

**Request Body:** Same as preview endpoint.

**Success Response (200):**
```json
{
  "message": "Compose file updated successfully"
}
```

**Error Response (403):**
```json
{
  "error": "Insufficient permissions to modify this stack"
}
```
