# RBAC - Users & Roles Endpoints

## Overview

RBAC (Role-Based Access Control) endpoints manage users, roles, and permissions. These endpoints are admin-only and require the `admin` role.

## Supported Authentication Methods

| Method | Supported | Notes |
|--------|-----------|-------|
| JWT Token | ✅ | Primary method for API clients |
| Session Cookie | ✅ | Automatically used by web UI |
| API Key | ✅ | Requires appropriate scope |

**Required Scopes:**
- Users read: `admin.users.read`
- Users write: `admin.users.write`
- Roles read: `admin.roles.read`
- Roles write: `admin.roles.write`
- Permissions read: `admin.permissions.read`

---

## GET /api/v1/admin/users

List all users with their roles.

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.users.read` scope)

```bash
curl https://berth.example.com/api/v1/admin/users \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "users": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "email_verified_at": "2024-01-15T10:00:00Z",
      "last_login_at": "2024-01-15T12:00:00Z",
      "totp_enabled": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-15T12:00:00Z",
      "roles": [
        {
          "id": 1,
          "name": "admin",
          "description": "System administrator with full access",
          "is_admin": true
        }
      ]
    }
  ]
}
```

---

## POST /api/v1/admin/users

Create a new user.

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.users.write` scope)

```bash
curl -X POST https://berth.example.com/api/v1/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "username": "newuser",
    "email": "newuser@example.com",
    "password": "SecurePassword123!",
    "password_confirm": "SecurePassword123!"
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| username | string | Yes | Unique username |
| email | string | Yes | Unique email address |
| password | string | Yes | Password (must meet policy) |
| password_confirm | string | Yes | Must match password |

**Success Response (201):**
```json
{
  "id": 2,
  "username": "newuser",
  "email": "newuser@example.com",
  "email_verified_at": null,
  "last_login_at": null,
  "totp_enabled": false,
  "created_at": "2024-01-15T14:00:00Z",
  "updated_at": "2024-01-15T14:00:00Z",
  "roles": []
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "error": "passwords do not match"
}
```

```json
{
  "error": "user with this username or email already exists"
}
```

---

## GET /api/v1/admin/users/:id/roles

Get a user's roles and all available roles.

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.users.read` scope)

```bash
curl https://berth.example.com/api/v1/admin/users/1/roles \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "email_verified_at": "2024-01-15T10:00:00Z",
    "last_login_at": "2024-01-15T12:00:00Z",
    "totp_enabled": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T12:00:00Z",
    "roles": [
      {
        "id": 1,
        "name": "admin",
        "description": "System administrator with full access",
        "is_admin": true
      }
    ]
  },
  "all_roles": [
    {
      "id": 1,
      "name": "admin",
      "description": "System administrator with full access"
    },
    {
      "id": 2,
      "name": "viewer",
      "description": "Read-only access"
    }
  ]
}
```

**Error Response (404):**
```json
{
  "error": "User not found"
}
```

---

## POST /api/v1/admin/users/assign-role

Assign a role to a user.

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.users.write` scope)

```bash
curl -X POST https://berth.example.com/api/v1/admin/users/assign-role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "user_id": 2,
    "role_id": 1
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| user_id | integer | Yes | User ID |
| role_id | integer | Yes | Role ID to assign |

**Success Response (200):**
```json
{
  "message": "Role assigned successfully"
}
```

---

## POST /api/v1/admin/users/revoke-role

Revoke a role from a user.

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.users.write` scope)

```bash
curl -X POST https://berth.example.com/api/v1/admin/users/revoke-role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "user_id": 2,
    "role_id": 1
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| user_id | integer | Yes | User ID |
| role_id | integer | Yes | Role ID to revoke |

**Success Response (200):**
```json
{
  "message": "Role revoked successfully"
}
```

---

## GET /api/v1/admin/roles

List all roles with their permissions.

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.roles.read` scope)

```bash
curl https://berth.example.com/api/v1/admin/roles \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "roles": [
    {
      "id": 1,
      "name": "admin",
      "description": "System administrator with full access",
      "is_admin": true,
      "permissions": []
    },
    {
      "id": 2,
      "name": "viewer",
      "description": "Read-only access",
      "is_admin": false,
      "permissions": []
    }
  ]
}
```

---

## POST /api/v1/admin/roles

Create a new role.

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.roles.write` scope)

```bash
curl -X POST https://berth.example.com/api/v1/admin/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "developer",
    "description": "Developer access with stack management"
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Unique role name |
| description | string | No | Role description |

**Success Response (201):**
```json
{
  "id": 3,
  "name": "developer",
  "description": "Developer access with stack management",
  "is_admin": false,
  "permissions": []
}
```

**Error Response (400):**
```json
{
  "error": "name is required"
}
```

---

## PUT /api/v1/admin/roles/:id

Update an existing role.

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.roles.write` scope)

```bash
curl -X PUT https://berth.example.com/api/v1/admin/roles/3 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "developer",
    "description": "Updated developer role description"
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Role name |
| description | string | No | Role description |

**Success Response (200):**
```json
{
  "id": 3,
  "name": "developer",
  "description": "Updated developer role description",
  "is_admin": false,
  "permissions": []
}
```

---

## DELETE /api/v1/admin/roles/:id

Delete a role.

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.roles.write` scope)

```bash
curl -X DELETE https://berth.example.com/api/v1/admin/roles/3 \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "message": "Role deleted successfully"
}
```

---

## GET /api/v1/admin/roles/:roleId/stack-permissions

Get a role's stack permissions and available servers/permissions.

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.roles.read` scope)

```bash
curl https://berth.example.com/api/v1/admin/roles/2/stack-permissions \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "role": {
    "id": 2,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "deleted_at": null,
    "name": "user",
    "description": "Standard user with basic permissions",
    "is_admin": false,
    "users": null
  },
  "servers": [
    {
      "id": 1,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "deleted_at": null,
      "name": "production",
      "description": "",
      "host": "server.example.com",
      "port": 8080,
      "skip_ssl_verification": true,
      "is_active": true
    }
  ],
  "permissions": [
    {
      "id": 1,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "deleted_at": null,
      "name": "stacks.read",
      "resource": "stacks",
      "action": "read",
      "description": "View stacks and containers",
      "is_api_key_only": false
    }
  ],
  "permissionRules": [
    {
      "id": 1,
      "server_id": 1,
      "permission_id": 1,
      "stack_pattern": "*",
      "is_stack_based": true
    }
  ]
}
```

**Note:** The `role`, `servers`, and `permissions` objects include GORM metadata fields. `permissionRules` is `null` if no rules are configured.

**Error Responses:**

**400 Bad Request:**
```json
{
  "error": "cannot manage server permissions for admin role"
}
```

**404 Not Found:**
```json
{
  "error": "role not found"
}
```

---

## POST /api/v1/admin/roles/:roleId/stack-permissions

Create a stack permission for a role.

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.roles.write` scope)

```bash
curl -X POST https://berth.example.com/api/v1/admin/roles/2/stack-permissions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "server_id": 1,
    "permission_id": 2,
    "stack_pattern": "production-*"
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| server_id | integer | Yes | Server ID |
| permission_id | integer | Yes | Permission ID |
| stack_pattern | string | No | Stack name pattern (default: `*` for all stacks) |

**Stack Pattern Examples:**
- `*` - All stacks on the server
- `production-*` - Stacks starting with "production-"
- `my-app` - Exact stack name match

**Success Response (201):**
```json
{
  "message": "Role stack permission created successfully"
}
```

**Error Response (400):**
```json
{
  "error": "Permission already exists for this server and stack pattern"
}
```

---

## DELETE /api/v1/admin/roles/:roleId/stack-permissions/:permissionId

Delete a stack permission from a role.

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.roles.write` scope)

```bash
curl -X DELETE https://berth.example.com/api/v1/admin/roles/2/stack-permissions/1 \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "message": "Role stack permission deleted successfully"
}
```

---

## GET /api/v1/admin/permissions

List all available permissions.

**Authentication:** Bearer token (JWT, Session, or API Key with `admin.permissions.read` scope)

**Query Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| type | string | No | Filter by type: `role` (excludes API key only permissions) |

```bash
curl https://berth.example.com/api/v1/admin/permissions \
  -H "Authorization: Bearer <token>"
```

**Success Response (200):**
```json
{
  "permissions": [
    {
      "id": 1,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "deleted_at": null,
      "name": "stacks.read",
      "resource": "stacks",
      "action": "read",
      "description": "View stacks and containers",
      "is_api_key_only": false
    },
    {
      "id": 2,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "deleted_at": null,
      "name": "stacks.manage",
      "resource": "stacks",
      "action": "manage",
      "description": "Start/stop/deploy/remove stacks",
      "is_api_key_only": false
    }
  ]
}
```

**Note:** The response includes GORM metadata fields (`created_at`, `updated_at`, `deleted_at`).

**Filter to role-assignable permissions:**
```bash
curl "https://berth.example.com/api/v1/admin/permissions?type=role" \
  -H "Authorization: Bearer <token>"
```
