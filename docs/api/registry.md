# Registry Credentials Endpoints

## Overview

Registry endpoints manage Docker registry credentials for connected servers. Credentials can be scoped to specific stacks and image patterns, enabling automatic authentication when pulling images.

**Base Path:** `/api/servers/:server_id/registries/`

## Supported Authentication Methods

| Method | Supported | Notes |
|--------|-----------|-------|
| Session Cookie | ✅ | Required - web UI authentication |
| JWT Token | ❌ | Not supported for this endpoint |
| API Key | ❌ | Not supported for this endpoint |

**Required Permissions:**
- All operations: `registries.manage`

> **⚠️ CSRF Protection:** These endpoints require CSRF tokens. To use curl, you must:
> 1. Fetch the login page to get the CSRF token and session cookie
> 2. Include the CSRF token in all requests via `X-CSRF-Token` header
>
> Example authentication flow:
> ```bash
> # Step 1: Get CSRF token from login page
> CSRF_TOKEN=$(curl -sk -c cookies.txt https://berth.example.com/auth/login | \
>   grep -o 'csrfToken[^,]*' | sed 's/csrfToken&#34;:&#34;//' | sed 's/&#34;//')
>
> # Step 2: Login with CSRF token
> curl -sk -b cookies.txt -c cookies.txt -X POST https://berth.example.com/auth/login \
>   -H "Content-Type: application/x-www-form-urlencoded" \
>   -H "X-CSRF-Token: $CSRF_TOKEN" \
>   -d "username=myuser&password=mypassword"
>
> # Step 3: Use session cookie and CSRF token for API requests
> curl -sk -b cookies.txt https://berth.example.com/api/servers/1/registries \
>   -H "X-CSRF-Token: $CSRF_TOKEN"
> ```

---

## GET /api/servers/:server_id/registries

List all registry credentials for a server.

**Authentication:** Session cookie (web UI authentication only)

```bash
curl https://berth.example.com/api/servers/1/registries \
  -b "session=<session_cookie>"
```

**Success Response (200):**
```json
{
  "credentials": [
    {
      "id": 1,
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z",
      "deleted_at": null,
      "server_id": 1,
      "stack_pattern": "*",
      "registry_url": "docker.io",
      "image_pattern": "",
      "username": "myuser",
      "server": {
        "id": 1,
        "name": "production"
      }
    }
  ]
}
```

**Error Response (403):**
```json
{
  "error": "Insufficient permissions to manage registry credentials"
}
```

---

## GET /api/servers/:server_id/registries/:id

Get a specific registry credential.

**Authentication:** Session cookie (web UI authentication only)

```bash
curl https://berth.example.com/api/servers/1/registries/1 \
  -b "session=<session_cookie>"
```

**Success Response (200):**
```json
{
  "credential": {
    "id": 1,
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z",
    "deleted_at": null,
    "server_id": 1,
    "stack_pattern": "*",
    "registry_url": "docker.io",
    "image_pattern": "",
    "username": "myuser",
    "server": {
      "id": 1,
      "name": "production"
    }
  }
}
```

**Error Response (404):**
```json
{
  "error": "Registry credential not found"
}
```

---

## POST /api/servers/:server_id/registries

Create a new registry credential.

**Authentication:** Session cookie (web UI authentication only)

```bash
curl -X POST https://berth.example.com/api/servers/1/registries \
  -H "Content-Type: application/json" \
  -b "session=<session_cookie>" \
  -d '{
    "registry_url": "ghcr.io",
    "username": "myuser",
    "password": "mytoken",
    "stack_pattern": "production-*",
    "image_pattern": "myorg/*"
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| registry_url | string | Yes | Registry URL (e.g., docker.io, ghcr.io) |
| username | string | Yes | Registry username |
| password | string | Yes | Registry password or token |
| stack_pattern | string | No | Stack name pattern (default: `*` for all stacks) |
| image_pattern | string | No | Image pattern to match |

**Stack Pattern Examples:**
- `*` - All stacks on the server
- `production-*` - Stacks starting with "production-"
- `my-app` - Exact stack name match

**Success Response (201):**
```json
{
  "credential": {
    "id": 2,
    "created_at": "2024-01-15T14:00:00Z",
    "updated_at": "2024-01-15T14:00:00Z",
    "deleted_at": null,
    "server_id": 1,
    "stack_pattern": "production-*",
    "registry_url": "ghcr.io",
    "image_pattern": "myorg/*",
    "username": "myuser",
    "server": {
      "id": 1,
      "name": "production"
    }
  }
}
```

**Error Response (400):**
```json
{
  "error": "registry_url, username, and password are required"
}
```

---

## PUT /api/servers/:server_id/registries/:id

Update an existing registry credential.

**Authentication:** Session cookie (web UI authentication only)

```bash
curl -X PUT https://berth.example.com/api/servers/1/registries/2 \
  -H "Content-Type: application/json" \
  -b "session=<session_cookie>" \
  -d '{
    "registry_url": "ghcr.io",
    "username": "newuser",
    "password": "newtoken",
    "stack_pattern": "staging-*",
    "image_pattern": "myorg/*"
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| registry_url | string | No | Registry URL |
| username | string | No | Registry username |
| password | string | No | Registry password or token |
| stack_pattern | string | No | Stack name pattern |
| image_pattern | string | No | Image pattern to match |

**Success Response (200):**
```json
{
  "credential": {
    "id": 2,
    "created_at": "2024-01-15T14:00:00Z",
    "updated_at": "2024-01-15T15:00:00Z",
    "deleted_at": null,
    "server_id": 1,
    "stack_pattern": "staging-*",
    "registry_url": "ghcr.io",
    "image_pattern": "myorg/*",
    "username": "newuser",
    "server": {
      "id": 1,
      "name": "production"
    }
  }
}
```

**Error Response (404):**
```json
{
  "error": "Registry credential not found"
}
```

---

## DELETE /api/servers/:server_id/registries/:id

Delete a registry credential.

**Authentication:** Session cookie (web UI authentication only)

```bash
curl -X DELETE https://berth.example.com/api/servers/1/registries/1 \
  -b "session=<session_cookie>"
```

**Success Response (200):**
```json
{
  "message": "Registry credential deleted successfully"
}
```

**Error Response (404):**
```json
{
  "error": "Registry credential not found"
}
```

---

## Security Notes

- Passwords are never returned in API responses (excluded via JSON tag)
- All credential operations are logged to the security audit log
- Credentials are encrypted at rest using the server's encryption key
- Unique constraint on (server_id, stack_pattern, registry_url) prevents duplicates
