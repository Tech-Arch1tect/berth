# Authentication Endpoints

## Overview

Authentication endpoints handle user login, token management, two-factor authentication (TOTP), and session management.

## Authentication Methods

Berth supports two authentication methods for accessing API endpoints:

### 1. JWT Token Authentication (API Clients)

For mobile apps, CLI tools, and programmatic API access:

1. Call `POST /api/v1/auth/login` with credentials
2. Receive `access_token` and `refresh_token`
3. Include `Authorization: Bearer <access_token>` in subsequent requests
4. Use `POST /api/v1/auth/refresh` to obtain new tokens before expiry
5. Use `POST /api/v1/auth/logout` to revoke tokens

### 2. Session Cookie Authentication (Web UI)

For browser-based access via the web interface:

1. Login via web form at `POST /auth/login` (sets `berth` session cookie)
2. Browser automatically includes cookie in subsequent requests
3. Include `X-CSRF-Token` header for POST/PUT/DELETE requests (if CSRF enabled)
4. Logout via `POST /auth/logout` (clears session)

**Using session auth with API endpoints:**

Once logged in via web UI, you can access API endpoints using the session cookie:

```bash
# After web login, the berth cookie authenticates API requests
curl https://berth.example.com/api/v1/profile \
  -b "berth=<session-cookie-value>"

# POST requests need CSRF token when using session auth
curl -X POST https://berth.example.com/api/v1/totp/enable \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <csrf-token>" \
  -b "berth=<session-cookie-value>" \
  -d '{"code": "123456"}'
```

## API Key Restrictions

| Method | Supported | Notes |
|--------|-----------|-------|
| JWT Token | ✅ | Primary method for API clients and mobile apps |
| Session Cookie | ✅ | Automatically used by web UI |
| API Key | ❌ | Not permitted for authentication endpoints |

**Why API keys are restricted:** Authentication endpoints manage user identity and session state. API keys are designed for programmatic access to resources, not identity management.

---

## JWT Authentication Endpoints

The following endpoints are designed for JWT-based authentication flows (mobile apps, CLI tools, API clients).

---

## POST /api/v1/auth/login

Authenticate a user and obtain access tokens.

**Authentication:** None required

```bash
curl -X POST https://berth.example.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user@example.com", "password": "your-password"}'
```

**Success Response (200):**
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
    "email_verified_at": "2024-01-01T00:00:00Z",
    "last_login_at": "2024-01-15T10:30:00Z",
    "totp_enabled": false,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "roles": [
      {
        "id": 1,
        "name": "admin",
        "description": "System administrator with full access",
        "is_admin": true
      }
    ]
  }
}
```

**TOTP Required Response (200):**

If the user has TOTP enabled, a temporary token is returned instead:
```json
{
  "message": "Two-factor authentication required",
  "totp_required": true,
  "temporary_token": "<temporary-jwt-token>"
}
```

**Error Response (401):**
```json
{
  "error": "invalid_credentials",
  "message": "Invalid username or password"
}
```

---

## POST /api/v1/auth/refresh

Obtain a new access token using a refresh token.

**Authentication:** None required

```bash
curl -X POST https://berth.example.com/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "<refresh-token>"}'
```

**Success Response (200):**
```json
{
  "access_token": "<new-jwt-access-token>",
  "refresh_token": "<new-refresh-token>",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_expires_in": 2591999
}
```

**Error Response (401):**
```json
{
  "error": "invalid_token",
  "message": "Invalid refresh token"
}
```

---

## POST /api/v1/auth/totp/verify

Complete authentication by verifying a TOTP code. Required when login returns `totp_required: true`.

**Authentication:** Bearer token (temporary token from login)

```bash
curl -X POST https://berth.example.com/api/v1/auth/totp/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <temporary-jwt-token>" \
  -d '{"code": "123456"}'
```

**Success Response (200):**

Returns the standard login response with access tokens.

**Error Responses:**

Invalid code (401):
```json
{
  "error": "invalid_totp_code",
  "message": "Invalid TOTP code"
}
```

Missing or invalid token (401):
```json
{
  "error": "unauthorized",
  "message": "Invalid or expired token"
}
```

---

## POST /api/v1/auth/logout

Revoke the current access and refresh tokens. This endpoint is for JWT authentication only.

**Authentication:** JWT token or session cookie

**Note:** For session-based logout (web UI), use `POST /auth/logout` instead.

```bash
curl -X POST https://berth.example.com/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-access-token>" \
  -d '{"refresh_token": "<refresh-token>"}'
```

**Success Response (200):**
```json
{
  "message": "Logout successful. Tokens have been revoked.",
  "revoked_tokens": [
    "access_token",
    "refresh_token"
  ]
}
```

---

## Protected Endpoints

The following endpoints require authentication and support both JWT and session cookie authentication.

---

## GET /api/v1/profile

Retrieve the authenticated user's profile.

**Authentication:** JWT token or session cookie

```bash
curl https://berth.example.com/api/v1/profile \
  -H "Authorization: Bearer <jwt-access-token>"
```

**Success Response (200):**
```json
{
  "id": 1,
  "username": "example",
  "email": "user@example.com",
  "email_verified_at": "2024-01-01T00:00:00Z",
  "last_login_at": "2024-01-15T10:30:00Z",
  "totp_enabled": false,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-15T10:30:00Z",
  "roles": [
    {
      "id": 1,
      "name": "admin",
      "description": "System administrator with full access",
      "is_admin": true
    }
  ]
}
```

---

## GET /api/v1/totp/status

Check whether TOTP is enabled for the authenticated user.

**Authentication:** JWT token or session cookie

```bash
curl https://berth.example.com/api/v1/totp/status \
  -H "Authorization: Bearer <jwt-access-token>"
```

**Success Response (200):**
```json
{
  "enabled": true
}
```

---

## GET /api/v1/totp/setup

Generate TOTP setup data for enabling two-factor authentication.

**Authentication:** JWT token or session cookie

```bash
curl https://berth.example.com/api/v1/totp/setup \
  -H "Authorization: Bearer <jwt-access-token>"
```

**Success Response (200):**
```json
{
  "secret": "<base32-secret>",
  "qr_code_uri": "otpauth://totp/Berth Application:user@example.com?secret=<secret>&issuer=Berth Application"
}
```

**Error Response (400):**
```json
{
  "error": "totp_already_enabled",
  "message": "TOTP is already enabled for your account"
}
```

---

## POST /api/v1/totp/enable

Enable TOTP two-factor authentication after verifying setup.

**Authentication:** JWT token or session cookie

```bash
curl -X POST https://berth.example.com/api/v1/totp/enable \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-access-token>" \
  -d '{"code": "123456"}'
```

**Success Response (200):**
```json
{
  "message": "TOTP enabled successfully"
}
```

**Error Response (400):**
```json
{
  "error": "invalid_totp_code",
  "message": "Invalid TOTP code"
}
```

---

## POST /api/v1/totp/disable

Disable TOTP two-factor authentication.

**Authentication:** JWT token or session cookie

```bash
curl -X POST https://berth.example.com/api/v1/totp/disable \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-access-token>" \
  -d '{"code": "123456"}'
```

**Success Response (200):**
```json
{
  "message": "TOTP disabled successfully"
}
```

**Error Response (400):**
```json
{
  "error": "invalid_totp_code",
  "message": "Invalid TOTP code"
}
```

---

## Session Management Endpoints

The following endpoints manage sessions for mobile apps, CLI tools, and API clients. They require the `refresh_token` from your login response to identify the current session.

**Web UI vs API Session Management:**
- **Web UI users** manage sessions via the browser at `/sessions` (not documented here as it's a web interface, not an API endpoint)
- **API clients** (mobile apps, CLI tools) use the endpoints below with JWT authentication and refresh tokens
- Web UI logout uses `POST /auth/logout`; API logout uses `POST /api/v1/auth/logout`

---

## POST /api/v1/sessions

List all active sessions for the authenticated user.

**Authentication:** JWT token (requires `refresh_token` in request body)

```bash
curl -X POST https://berth.example.com/api/v1/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-access-token>" \
  -d '{"refresh_token": "<refresh-token>"}'
```

**Success Response (200):**
```json
{
  "sessions": [
    {
      "id": 1,
      "user_id": 1,
      "type": "jwt",
      "token": "<hashed-token-id>",
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "browser": "Chrome 120.0.0.0",
      "os": "Linux x86_64",
      "device": "Desktop Computer",
      "device_type": "Desktop",
      "location": "Local",
      "current": true,
      "bot": false,
      "desktop": true,
      "mobile": false,
      "tablet": false,
      "created_at": "2024-01-15T10:30:00Z",
      "last_used": "2024-01-15T10:35:00Z",
      "expires_at": "2024-02-14T10:30:00Z"
    }
  ]
}
```

---

## POST /api/v1/sessions/revoke

Revoke a specific session by ID.

**Authentication:** JWT token (requires `refresh_token` in request body)

```bash
curl -X POST https://berth.example.com/api/v1/sessions/revoke \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-access-token>" \
  -d '{"refresh_token": "<refresh-token>", "session_id": 2}'
```

**Success Response (200):**
```json
{
  "message": "Session revoked successfully"
}
```

---

## POST /api/v1/sessions/revoke-all-others

Revoke all sessions except the current one.

**Authentication:** JWT token (requires `refresh_token` in request body)

```bash
curl -X POST https://berth.example.com/api/v1/sessions/revoke-all-others \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-access-token>" \
  -d '{"refresh_token": "<refresh-token>"}'
```

**Success Response (200):**
```json
{
  "message": "All other sessions revoked successfully"
}
```
