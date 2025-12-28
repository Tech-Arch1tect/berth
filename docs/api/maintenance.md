# Maintenance Endpoints

## Overview

Maintenance endpoints provide Docker system information, pruning capabilities, and resource deletion for connected servers. Access requires appropriate permissions scoped to specific servers.

**Base Path:** `/api/v1/servers/:serverid/maintenance/`

## Supported Authentication Methods

| Method | Supported | Notes |
|--------|-----------|-------|
| JWT Token | ✅ | Primary method for API clients |
| Session Cookie | ✅ | Automatically used by web UI |
| API Key | ✅ | Requires appropriate scope |

**Required Permissions:**
- Read operations: `docker.maintenance.read`
- Write operations: `docker.maintenance.write`

---

## GET /api/v1/servers/:serverid/maintenance/permissions

Check the current user's maintenance permissions for a server.

**Authentication:** Bearer token (JWT, Session, or API Key)

```bash
curl https://berth.example.com/api/v1/servers/1/maintenance/permissions \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "maintenance": {
    "read": true,
    "write": true
  }
}
```

---

## GET /api/v1/servers/:serverid/maintenance/info

Get comprehensive Docker system information including disk usage, images, containers, volumes, networks, and build cache.

**Authentication:** Bearer token with `docker.maintenance.read` permission

```bash
curl https://berth.example.com/api/v1/servers/1/maintenance/info \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "system_info": {
    "version": "24.0.7",
    "api_version": "1.43",
    "architecture": "x86_64",
    "os": "linux",
    "kernel_version": "6.1.0-18-amd64",
    "total_memory": 16777216000,
    "ncpu": 8,
    "storage_driver": "overlay2",
    "docker_root_dir": "/var/lib/docker",
    "server_version": "24.0.7"
  },
  "disk_usage": {
    "layers_size": 5368709120,
    "images_size": 2147483648,
    "containers_size": 536870912,
    "volumes_size": 1073741824,
    "build_cache_size": 268435456,
    "total_size": 9395240960
  },
  "image_summary": {
    "total_count": 15,
    "dangling_count": 3,
    "unused_count": 5,
    "total_size": 2147483648,
    "dangling_size": 134217728,
    "unused_size": 536870912,
    "images": [
      {
        "repository": "nginx",
        "tag": "latest",
        "id": "sha256:abc123...",
        "size": 134217728,
        "created": "2024-01-15T10:00:00Z",
        "dangling": false,
        "unused": false
      }
    ]
  },
  "container_summary": {
    "running_count": 5,
    "stopped_count": 2,
    "total_count": 7,
    "total_size": 536870912,
    "containers": [
      {
        "id": "abc123...",
        "name": "nginx-proxy",
        "image": "nginx:latest",
        "state": "running",
        "status": "Up 2 days",
        "created": "2024-01-15T10:00:00Z",
        "size": 67108864,
        "labels": {
          "com.docker.compose.project": "my-stack"
        }
      }
    ]
  },
  "volume_summary": {
    "total_count": 10,
    "unused_count": 3,
    "total_size": 1073741824,
    "unused_size": 268435456,
    "volumes": [
      {
        "name": "data-volume",
        "driver": "local",
        "mountpoint": "/var/lib/docker/volumes/data-volume/_data",
        "created": "2024-01-15T10:00:00Z",
        "size": 134217728,
        "labels": {},
        "unused": false
      }
    ]
  },
  "network_summary": {
    "total_count": 8,
    "unused_count": 2,
    "networks": [
      {
        "id": "abc123...",
        "name": "my-network",
        "driver": "bridge",
        "scope": "local",
        "created": "2024-01-15T10:00:00Z",
        "internal": false,
        "labels": {},
        "unused": false,
        "subnet": "172.18.0.0/16"
      }
    ]
  },
  "build_cache_summary": {
    "total_count": 20,
    "total_size": 268435456,
    "cache": [
      {
        "id": "abc123...",
        "parent": "def456...",
        "type": "regular",
        "size": 13421772,
        "created": "2024-01-15T10:00:00Z",
        "last_used": "2024-01-15T12:00:00Z",
        "usage_count": 5,
        "in_use": false,
        "shared": true,
        "description": "apt-get install"
      }
    ]
  },
  "last_updated": "2024-01-15T14:00:00Z"
}
```

---

## POST /api/v1/servers/:serverid/maintenance/prune

Prune Docker resources to reclaim disk space.

**Authentication:** Bearer token with `docker.maintenance.write` permission

```bash
curl -X POST https://berth.example.com/api/v1/servers/1/maintenance/prune \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "type": "images",
    "force": true,
    "all": false
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | Resource type to prune |
| force | boolean | No | Force removal without confirmation |
| all | boolean | No | Remove all (not just dangling) |
| filters | string | No | JSON filters for pruning |

**Valid Prune Types:**
- `images` - Prune unused images
- `containers` - Prune stopped containers
- `volumes` - Prune unused volumes
- `networks` - Prune unused networks
- `build-cache` - Prune build cache
- `system` - Prune all unused resources

**Success Response (200):**
```json
{
  "type": "images",
  "items_deleted": [
    "sha256:abc123...",
    "sha256:def456..."
  ],
  "space_reclaimed": 268435456
}
```

**Error Response (400):**
```json
{
  "error": "Prune type is required"
}
```

```json
{
  "error": "Invalid prune type"
}
```

---

## DELETE /api/v1/servers/:serverid/maintenance/resource

Delete a specific Docker resource.

**Authentication:** Bearer token with `docker.maintenance.write` permission

```bash
curl -X DELETE https://berth.example.com/api/v1/servers/1/maintenance/resource \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "type": "image",
    "id": "sha256:abc123..."
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | Resource type |
| id | string | Yes | Resource ID to delete |

**Valid Resource Types:**
- `image` - Docker image
- `container` - Docker container
- `volume` - Docker volume
- `network` - Docker network

**Success Response (200):**
```json
{
  "type": "image",
  "id": "sha256:abc123...",
  "success": true
}
```

**Error Response (200 with error):**
```json
{
  "type": "image",
  "id": "sha256:abc123...",
  "success": false,
  "error": "image is in use by container xyz"
}
```

**Error Response (400):**
```json
{
  "error": "Resource type is required"
}
```

```json
{
  "error": "Resource ID is required"
}
```

```json
{
  "error": "Invalid resource type"
}
```
