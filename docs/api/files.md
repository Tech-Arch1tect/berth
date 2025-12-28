# File Management Endpoints

## Overview

File management endpoints provide access to files within Docker Compose stacks. All endpoints require stack-level RBAC permissions.

## Supported Authentication Methods

| Method | Supported | Notes |
|--------|-----------|-------|
| JWT Token | ✅ | Primary method for API clients |
| Session Cookie | ✅ | Automatically used by web UI |
| API Key | ✅ | Requires `files.read` or `files.write` scope |

**Read endpoints** require `files.read` permission.
**Write endpoints** (write, upload, mkdir, delete, rename, copy, chmod, chown) require `files.write` permission.

---

## GET /api/v1/servers/:serverid/stacks/:stackname/files

List files and directories in a stack's directory.

**Authentication:** Bearer token (JWT, Session, or API Key with `files.read` scope)

**Query Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| path | string | No | Relative path within stack directory (default: root) |

```bash
curl https://berth.example.com/api/v1/servers/1/stacks/my-app/files \
  -H "Authorization: Bearer <token>"

# List specific subdirectory
curl "https://berth.example.com/api/v1/servers/1/stacks/my-app/files?path=config" \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "path": "",
  "entries": [
    {
      "name": "docker-compose.yml",
      "path": "docker-compose.yml",
      "size": 1234,
      "is_directory": false,
      "mod_time": "2024-01-15T10:30:00Z",
      "mode": "-rw-r--r--",
      "owner": "root",
      "group": "root",
      "owner_id": 0,
      "group_id": 0,
      "extension": "yml"
    },
    {
      "name": "config",
      "path": "config",
      "size": 4096,
      "is_directory": true,
      "mod_time": "2024-01-15T10:30:00Z",
      "mode": "drwxr-xr-x",
      "owner": "root",
      "group": "root",
      "owner_id": 0,
      "group_id": 0
    }
  ]
}
```

---

## GET /api/v1/servers/:serverid/stacks/:stackname/files/read

Read the contents of a file.

**Authentication:** Bearer token (JWT, Session, or API Key with `files.read` scope)

**Query Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| path | string | Yes | Relative path to the file |

```bash
curl "https://berth.example.com/api/v1/servers/1/stacks/my-app/files/read?path=docker-compose.yml" \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "path": "docker-compose.yml",
  "content": "version: '3'\nservices:\n  web:\n    image: nginx:latest\n",
  "size": 52,
  "encoding": "utf-8"
}
```

**Error Response (400):**
```json
{
  "error": "path parameter is required"
}
```

---

## POST /api/v1/servers/:serverid/stacks/:stackname/files/write

Write content to a file (creates or overwrites).

**Authentication:** Bearer token (JWT, Session, or API Key with `files.write` scope)

```bash
curl -X POST https://berth.example.com/api/v1/servers/1/stacks/my-app/files/write \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "path": "config/app.conf",
    "content": "server_name=production\nport=8080\n",
    "mode": "0644",
    "owner_id": 1000,
    "group_id": 1000
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| path | string | Yes | Relative path for the file |
| content | string | No | File content |
| encoding | string | No | Content encoding (default: utf-8) |
| mode | string | No | File permissions (e.g., "0644") |
| owner_id | integer | No | Owner user ID |
| group_id | integer | No | Owner group ID |

**Success Response (200):**
```json
{
  "message": "success"
}
```

---

## POST /api/v1/servers/:serverid/stacks/:stackname/files/upload

Upload a file using multipart form data.

**Authentication:** Bearer token (JWT, Session, or API Key with `files.write` scope)

```bash
curl -X POST https://berth.example.com/api/v1/servers/1/stacks/my-app/files/upload \
  -H "Authorization: Bearer <token>" \
  -F "path=uploads/" \
  -F "file=@/local/path/to/file.txt"
```

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| path | string | No | Target directory path |
| file | file | Yes | File to upload |

**Success Response (200):**
```json
{
  "message": "File uploaded successfully"
}
```

---

## POST /api/v1/servers/:serverid/stacks/:stackname/files/mkdir

Create a new directory.

**Authentication:** Bearer token (JWT, Session, or API Key with `files.write` scope)

```bash
curl -X POST https://berth.example.com/api/v1/servers/1/stacks/my-app/files/mkdir \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "path": "logs/2024",
    "mode": "0755",
    "owner_id": 1000,
    "group_id": 1000
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| path | string | Yes | Directory path to create |
| mode | string | No | Directory permissions (e.g., "0755") |
| owner_id | integer | No | Owner user ID |
| group_id | integer | No | Owner group ID |

**Success Response (200):**
```json
{
  "message": "success"
}
```

---

## DELETE /api/v1/servers/:serverid/stacks/:stackname/files/delete

Delete a file or directory.

**Authentication:** Bearer token (JWT, Session, or API Key with `files.write` scope)

```bash
curl -X DELETE https://berth.example.com/api/v1/servers/1/stacks/my-app/files/delete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "path": "old-config.yml"
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| path | string | Yes | Path to delete |

**Success Response (200):**
```json
{
  "message": "success"
}
```

---

## POST /api/v1/servers/:serverid/stacks/:stackname/files/rename

Rename or move a file or directory.

**Authentication:** Bearer token (JWT, Session, or API Key with `files.write` scope)

```bash
curl -X POST https://berth.example.com/api/v1/servers/1/stacks/my-app/files/rename \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "old_path": "config.yml",
    "new_path": "config.yml.bak"
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| old_path | string | Yes | Current path |
| new_path | string | Yes | New path |

**Success Response (200):**
```json
{
  "message": "success"
}
```

---

## POST /api/v1/servers/:serverid/stacks/:stackname/files/copy

Copy a file or directory.

**Authentication:** Bearer token (JWT, Session, or API Key with `files.write` scope)

```bash
curl -X POST https://berth.example.com/api/v1/servers/1/stacks/my-app/files/copy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "source_path": "docker-compose.yml",
    "target_path": "docker-compose.yml.backup"
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| source_path | string | Yes | Source file/directory path |
| target_path | string | Yes | Destination path |

**Success Response (200):**
```json
{
  "message": "success"
}
```

---

## POST /api/v1/servers/:serverid/stacks/:stackname/files/chmod

Change file or directory permissions.

**Authentication:** Bearer token (JWT, Session, or API Key with `files.write` scope)

```bash
curl -X POST https://berth.example.com/api/v1/servers/1/stacks/my-app/files/chmod \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "path": "scripts/run.sh",
    "mode": "0755",
    "recursive": false
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| path | string | Yes | Target path |
| mode | string | Yes | New permissions (e.g., "0755") |
| recursive | boolean | No | Apply recursively to directories |

**Success Response (200):**
```json
{
  "message": "success"
}
```

---

## POST /api/v1/servers/:serverid/stacks/:stackname/files/chown

Change file or directory ownership.

**Authentication:** Bearer token (JWT, Session, or API Key with `files.write` scope)

```bash
curl -X POST https://berth.example.com/api/v1/servers/1/stacks/my-app/files/chown \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "path": "data/",
    "owner_id": 1000,
    "group_id": 1000,
    "recursive": true
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| path | string | Yes | Target path |
| owner_id | integer | No | New owner user ID |
| group_id | integer | No | New owner group ID |
| recursive | boolean | No | Apply recursively to directories |

**Note:** At least one of `owner_id` or `group_id` must be provided.

**Success Response (200):**
```json
{
  "message": "success"
}
```

---

## GET /api/v1/servers/:serverid/stacks/:stackname/files/download

Download a file.

**Authentication:** Bearer token (JWT, Session, or API Key with `files.read` scope)

**Query Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| path | string | Yes | Path to the file |
| filename | string | No | Suggested filename for download |

```bash
curl "https://berth.example.com/api/v1/servers/1/stacks/my-app/files/download?path=docker-compose.yml" \
  -H "Authorization: Bearer <token>" \
  -o docker-compose.yml
```

**Success Response (200):**

Returns the raw file content with headers:
- `Content-Type: application/octet-stream`
- `Content-Disposition: attachment; filename="<filename>"` (if filename provided)

---

## GET /api/v1/servers/:serverid/stacks/:stackname/files/stats

Get directory statistics (most common ownership and permissions).

**Authentication:** Bearer token (JWT, Session, or API Key with `files.read` scope)

**Query Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| path | string | No | Directory path (default: ".") |

```bash
curl "https://berth.example.com/api/v1/servers/1/stacks/my-app/files/stats?path=." \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "path": ".",
  "most_common_owner": 1000,
  "most_common_group": 1000,
  "most_common_mode": "644",
  "owner_name": "appuser",
  "group_name": "appgroup"
}
```
