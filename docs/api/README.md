# Berth API Documentation

Berth provides a REST API for managing Docker stacks across multiple remote agents.

## Base URL

All API endpoints are prefixed with `/api/v1/` for REST endpoints and `/ws/api/` for WebSocket endpoints.

## Authentication

Berth supports three authentication methods for API access:

### 1. JWT Token (Recommended for API clients)

Obtain a JWT token by logging in:

```bash
curl -X POST https://berth.example.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user@example.com", "password": "your-password"}'
```

Response:
```json
{
  "access_token": "<jwt-access-token>",
  "refresh_token": "<refresh-token>",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_expires_in": 2591999,
  "user": {
    "id": 1,
    "username": "example",
    "email": "user@example.com",
    "totp_enabled": false,
    "roles": [
      {
        "id": 1,
        "name": "admin",
        "is_admin": true
      }
    ]
  }
}
```

Use the access token in subsequent requests:
```bash
curl https://berth.example.com/api/v1/servers \
  -H "Authorization: Bearer <jwt-access-token>"
```

**Token Refresh:** Access tokens expire after 15 minutes. Use the refresh token to obtain a new access token:
```bash
curl -X POST https://berth.example.com/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "<refresh-token>"}'
```

Response:
```json
{
  "access_token": "<new-jwt-access-token>",
  "refresh_token": "<new-refresh-token>",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_expires_in": 2591999
}
```

### 2. API Key

API keys are scoped tokens for programmatic access. Create one via the web UI under Profile > API Keys.

API keys use the same `Authorization: Bearer` header as JWT tokens. The `brth_` prefix distinguishes them:

```bash
curl https://berth.example.com/api/v1/servers \
  -H "Authorization: Bearer brth_<your-api-key>"
```

API keys have configurable scopes that limit which endpoints they can access. Some endpoints (such as `/profile`, `/sessions`, and TOTP management) do not permit API key access.

### 3. Session Cookie (Web UI)

Session-based authentication is used by the web UI. This method requires CSRF tokens for state-changing requests.

## Common Response Formats

### Error Response

```json
{
  "error": "invalid_credentials",
  "message": "Invalid username or password"
}
```

Some endpoints return a simpler format:
```json
{
  "code": 401,
  "error": "Token required"
}
```

### Pagination

List endpoints support pagination:

```bash
GET /api/v1/operation-logs?page=1&limit=20
```

Response includes pagination metadata:
```json
{
  "data": [...],
  "pagination": {
    "current_page": 1,
    "page_size": 20,
    "total": 100,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  }
}
```

## Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorised - Missing or invalid authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource does not exist |
| 500 | Internal Server Error |

## API Endpoints by Domain

| Domain | Description | Documentation |
|--------|-------------|---------------|
| [Auth](./auth.md) | Authentication, sessions, TOTP | 12 endpoints |
| [Servers](./servers.md) | Server management | 8 endpoints |
| [Stacks](./stacks.md) | Stack operations and info | 10 endpoints |
| [Files](./files.md) | Stack file management | 12 endpoints |
| [Operations](./operations.md) | Docker operations and logs | 11 endpoints |
| [Admin](./admin.md) | Users, roles, permissions | 18 endpoints |
| [Maintenance](./maintenance.md) | Docker maintenance tasks | 4 endpoints |
| [WebSocket](./websocket.md) | Real-time connections | 6 endpoints |

## TOTP Two-Factor Authentication

If a user has TOTP enabled, the login response returns a temporary token instead of access tokens:

```json
{
  "message": "Two-factor authentication required",
  "totp_required": true,
  "temporary_token": "<temporary-jwt-token>"
}
```

Complete authentication by verifying the TOTP code with the temporary token:
```bash
curl -X POST https://berth.example.com/api/v1/auth/totp/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <temporary-jwt-token>" \
  -d '{"code": "123456"}'
```

On success, you receive the standard login response with `access_token` and `refresh_token`.
