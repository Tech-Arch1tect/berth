# Image Updates Endpoints

## Overview

Image update endpoints provide information about available container image updates across your Docker stacks. The system periodically checks container images against their registry to detect when newer versions are available.

**Base Path:** `/api/`

## Supported Authentication Methods

| Method | Supported | Notes |
|--------|-----------|-------|
| Session Cookie | Required | Web UI session authentication |
| JWT Token | Not Supported | Use session auth instead |
| API Key | Not Supported | Use session auth instead |

**Note:** These endpoints currently only support session-based authentication (web UI). For programmatic access, establish a session via the login endpoint first.

---

## GET /api/image-updates

List all available container image updates across all servers and stacks the user has access to.

**Authentication:** Session Cookie

**Required Permission:** `stacks.read` for each stack

```bash
# First, get login page to obtain CSRF cookie
curl -sk -c cookies.txt https://berth.example.com/auth/login -o /dev/null

# Login with CSRF token from cookie
CSRF=$(grep _csrf cookies.txt | awk '{print $7}')
curl -sk -c cookies.txt -b cookies.txt -X POST https://berth.example.com/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "X-CSRF-Token: $CSRF" \
  -d "username=admin&password=yourpassword"

# Then request image updates
curl -sk -b cookies.txt https://berth.example.com/api/image-updates
```

**Success Response (200):**
```json
{
  "updates": [
    {
      "id": 1,
      "server_id": 1,
      "stack_name": "my-stack",
      "container_name": "my-stack-web-1",
      "current_image_name": "nginx:1.24",
      "current_repo_digest": "sha256:abc123...",
      "latest_repo_digest": "sha256:def456...",
      "update_available": true,
      "last_checked_at": "2025-12-29T10:00:00Z",
      "check_error": "",
      "created_at": "2025-12-20T08:00:00Z",
      "updated_at": "2025-12-29T10:00:00Z"
    }
  ]
}
```

**Response when no updates available:**
```json
{
  "updates": []
}
```

**Error Response (302 Redirect):**

Without authentication, the endpoint redirects to the login page.

---

## GET /api/servers/:id/image-updates

List available container image updates for a specific server.

**Authentication:** Session Cookie

**Required Permission:** `stacks.read` for stacks on the server

**Path Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | integer | Yes | Server ID |

```bash
curl -sk -b cookies.txt https://berth.example.com/api/servers/1/image-updates
```

**Success Response (200):**
```json
{
  "updates": [
    {
      "id": 1,
      "server_id": 1,
      "stack_name": "my-stack",
      "container_name": "my-stack-web-1",
      "current_image_name": "nginx:1.24",
      "current_repo_digest": "sha256:abc123...",
      "latest_repo_digest": "sha256:def456...",
      "update_available": true,
      "last_checked_at": "2025-12-29T10:00:00Z",
      "check_error": "",
      "created_at": "2025-12-20T08:00:00Z",
      "updated_at": "2025-12-29T10:00:00Z"
    }
  ]
}
```

**Error Response (400):**
```json
{
  "error": "Invalid server ID"
}
```

**Error Response (403):**
```json
{
  "error": "You do not have access to this server"
}
```

---

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| id | integer | Unique identifier for the update record |
| server_id | integer | ID of the server hosting the container |
| stack_name | string | Name of the Docker Compose stack |
| container_name | string | Full container name |
| current_image_name | string | Current image name with tag |
| current_repo_digest | string | SHA256 digest of the currently running image |
| latest_repo_digest | string | SHA256 digest of the latest available image |
| update_available | boolean | Whether a newer image is available |
| last_checked_at | string | RFC3339 timestamp of last check |
| check_error | string | Error message if last check failed (empty on success) |
| created_at | string | RFC3339 timestamp when record was created |
| updated_at | string | RFC3339 timestamp when record was last updated |

## RBAC Filtering

The endpoints automatically filter results based on user permissions:

1. **Server Access:** User must have access to the server via `GetUserAccessibleServerIDs`
2. **Stack Permission:** User must have `stacks.read` permission for each stack

Updates for containers on servers or stacks the user cannot access are silently excluded from results.
