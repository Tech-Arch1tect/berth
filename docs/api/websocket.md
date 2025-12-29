# WebSocket Endpoints

## Overview

Berth provides WebSocket endpoints for real-time communication, including stack status monitoring, container terminal access, and operation streaming.

**Base Paths:**
- Web UI: `/ws/ui/` (Session authentication)
- API: `/ws/api/` (JWT/API Key authentication)

## Supported Authentication Methods

| Endpoint Group | Session | JWT | API Key |
|----------------|---------|-----|---------|
| `/ws/ui/*` | Required | - | - |
| `/ws/api/*` | - | Supported | Supported |

**Note:** TOTP verification is required if enabled for the user account.

## Testing with websocat

All examples use `websocat` CLI tool. Install with: `pacman -S websocat` (Arch) or equivalent.

```bash
# Get JWT token
TOKEN=$(curl -sk -X POST https://berth.example.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"pass"}' | \
  grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# Connect to WebSocket with auth
websocat -k --header="Authorization: Bearer $TOKEN" \
  wss://berth.example.com/ws/api/stack-status/1
```

---

# Stack Status WebSocket

Real-time stack and container status updates via pub/sub subscriptions.

## Endpoints

| Path | Authentication |
|------|----------------|
| `/ws/ui/stack-status/:server_id` | Session Cookie |
| `/ws/api/stack-status/:server_id` | Bearer Token or API Key |

## Connection Examples

**Without auth (returns 401):**
```bash
websocat -k wss://berth.example.com/ws/api/stack-status/1
# WebSocketError: Received unexpected status code (401 Unauthorized)
```

**With JWT auth:**
```bash
websocat -k --header="Authorization: Bearer $TOKEN" \
  wss://berth.example.com/ws/api/stack-status/1
```

## Client Messages

### Subscribe to Resources

```bash
echo '{"type":"subscribe","resource":"stack_status","server_id":1,"stack_name":"my-stack"}' | \
  websocat -k --header="Authorization: Bearer $TOKEN" \
  wss://berth.example.com/ws/api/stack-status/1
```

**Response:**
```json
{"type":"success","timestamp":"2025-12-29T20:22:02Z","message":"Subscribed successfully"}
```

**Resource Types:**

| Resource | Description | Required Permission |
|----------|-------------|---------------------|
| `stack_status` | Stack and container status changes | `stacks.view` |
| `operations` | Operation progress updates | `stacks.manage` |
| `logs` | Log streaming | `stacks.view` |

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | Must be `subscribe` |
| resource | string | Yes | Resource type to subscribe to |
| server_id | integer | Yes | Server ID |
| stack_name | string | No | Stack name (omit to subscribe to all accessible stacks) |

### Unsubscribe from Resources

```bash
echo '{"type":"unsubscribe","resource":"stack_status","server_id":1,"stack_name":"my-stack"}' | \
  websocat -k --header="Authorization: Bearer $TOKEN" \
  wss://berth.example.com/ws/api/stack-status/1
```

**Response:**
```json
{"type":"success","timestamp":"2025-12-29T20:22:19Z","message":"Unsubscribed successfully"}
```

### Invalid Message Type

```bash
echo '{"type":"invalid_type","resource":"stack_status","server_id":1}' | \
  websocat -k --header="Authorization: Bearer $TOKEN" \
  wss://berth.example.com/ws/api/stack-status/1
```

**Response:**
```json
{"type":"error","timestamp":"2025-12-29T20:22:19Z","error":"Unknown message type"}
```

## Server Messages

### Success Response

```json
{"type":"success","timestamp":"2025-12-29T20:22:02Z","message":"Subscribed successfully"}
```

### Error Response

```json
{"type":"error","timestamp":"2025-12-29T20:22:19Z","error":"Access denied to server"}
```

### Container Status Event

Sent when a container's status changes.

```json
{
  "type": "container_status",
  "timestamp": "2025-12-29T20:22:00Z",
  "server_id": 1,
  "stack_name": "my-stack",
  "service_name": "web",
  "container_name": "my-stack-web-1",
  "container_id": "abc123def456",
  "status": "running",
  "health": "healthy",
  "image": "nginx:latest",
  "ports": [
    {
      "private": 80,
      "public": 8080,
      "type": "tcp"
    }
  ]
}
```

**Status Values:** `created`, `running`, `paused`, `restarting`, `removing`, `exited`, `dead`

**Health Values:** `healthy`, `unhealthy`, `starting`, `none`

### Stack Status Event

Sent when a stack's overall status changes.

```json
{
  "type": "stack_status",
  "timestamp": "2025-12-29T20:22:00Z",
  "server_id": 1,
  "stack_name": "my-stack",
  "status": "running",
  "services": 3,
  "running": 3,
  "stopped": 0
}
```

### Operation Progress Event

Sent when an operation has progress updates (when subscribed to `operations` resource).

```json
{
  "type": "operation_progress",
  "timestamp": "2025-12-29T20:22:00Z",
  "server_id": 1,
  "stack_name": "my-stack",
  "operation": "up",
  "raw_output": "Container my-stack-web-1  Started",
  "progress_step": "Starting services",
  "exit_code": 0,
  "completed": false
}
```

---

# Terminal WebSocket

Interactive terminal access to containers via WebSocket proxy to the agent.

## Endpoints

| Path | Authentication |
|------|----------------|
| `/ws/ui/servers/:serverid/terminal` | Session Cookie |
| `/ws/api/servers/:serverid/terminal` | Bearer Token or API Key |

**Required Permission:** `stacks.manage` for the target stack

## Connection Examples

**Connect and start terminal:**
```bash
echo '{"type":"terminal_start","stack_name":"test-stack","service_name":"web"}' | \
  websocat -k --header="Authorization: Bearer $TOKEN" \
  wss://berth.example.com/ws/api/servers/1/terminal
```

**Error response (container not found):**
```json
{"type":"error","timestamp":"2025-12-29T20:22:54Z","error":"Container not found","context":"no containers found for stack=test-stack, service=web, container="}
```

## Connection Flow

1. Connect to the WebSocket endpoint
2. Send `terminal_start` message to initiate session
3. Send `terminal_input` messages for user input
4. Send `terminal_resize` messages when terminal dimensions change
5. Receive output data from the terminal
6. Send `terminal_close` when done

## Client Messages

### Start Terminal Session

```json
{
  "type": "terminal_start",
  "stack_name": "my-stack",
  "service_name": "web",
  "container_name": "my-stack-web-1"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | Must be `terminal_start` |
| stack_name | string | Yes | Stack name (required for permission check) |
| service_name | string | Yes | Service name within the stack |
| container_name | string | No | Specific container name (optional) |

### Terminal Input

```json
{
  "type": "terminal_input",
  "session_id": "session-123",
  "data": "ls -la\n"
}
```

### Terminal Resize

```json
{
  "type": "terminal_resize",
  "session_id": "session-123",
  "cols": 120,
  "rows": 40
}
```

### Close Terminal

```json
{
  "type": "terminal_close",
  "session_id": "session-123"
}
```

## Server Messages

### Terminal Output

Binary or text data streamed from the container's terminal.

### Error Response

```json
{"type":"error","timestamp":"2025-12-29T20:22:54Z","error":"Insufficient permissions: stacks.manage required for stack 'my-stack'"}
```

With context:
```json
{"type":"error","timestamp":"2025-12-29T20:22:54Z","error":"Container not found","context":"no containers found for stack=test-stack, service=web, container="}
```

## Keepalive

The server sends WebSocket ping frames every 30 seconds. Clients must respond with pong frames to maintain the connection. Connection timeout is 60 seconds without activity.

---

# Operations WebSocket

Real-time operation execution and streaming output.

## Endpoints

| Path | Authentication | Description |
|------|----------------|-------------|
| `/ws/ui/servers/:serverid/stacks/:stackname/operations` | Session | Start new operations |
| `/ws/ui/servers/:serverid/stacks/:stackname/operations/:operationId` | Session | Stream existing operation |
| `/ws/api/servers/:serverid/stacks/:stackname/operations` | JWT/API Key | Start new operations |
| `/ws/api/servers/:serverid/stacks/:stackname/operations/:operationId` | JWT/API Key | Stream existing operation |

## Connection Modes

### Mode 1: Start New Operation

Connect without `operationId`, then send `operation_request` messages:

```bash
echo '{"type":"operation_request","data":{"command":"up","options":["-d"],"services":[]}}' | \
  websocat -k --header="Authorization: Bearer $TOKEN" \
  wss://berth.example.com/ws/api/servers/1/stacks/test-stack/operations
```

**Response:**
```json
{"type":"operation_started","data":{"operationId":"f8861320-41fe-43f7-8066-d0c15688171f"}}
```

### Mode 2: Stream Existing Operation

Connect with `operationId` to stream an already-running or completed operation:

```bash
websocat -k --header="Authorization: Bearer $TOKEN" \
  wss://berth.example.com/ws/api/servers/1/stacks/test-stack/operations/f8861320-41fe-43f7-8066-d0c15688171f
```

**Response (streaming output):**
```json
{"type":"stderr","data":"time=\"2025-12-29T20:23:20Z\" level=warning msg=\"No services to build\"","timestamp":"2025-12-29T20:23:20.055297626Z"}
{"type":"stderr","data":" Container test-stack-whoami-1 Running ","timestamp":"2025-12-29T20:23:20.070873063Z"}
{"type":"complete","success":true,"exitCode":0,"timestamp":"2025-12-29T20:23:20.076606157Z"}
```

## Client Messages

### Operation Request

```json
{
  "type": "operation_request",
  "data": {
    "command": "up",
    "options": ["-d", "--build"],
    "services": ["web", "api"],
    "registry_credentials": [
      {
        "registry": "docker.io",
        "username": "user",
        "password": "token"
      }
    ]
  }
}
```

**Supported Commands:**

| Command | Description | Example Options |
|---------|-------------|-----------------|
| `up` | Start/create containers | `["-d", "--build", "--force-recreate"]` |
| `down` | Stop and remove containers | `["--volumes", "--remove-orphans"]` |
| `start` | Start existing containers | `[]` |
| `stop` | Stop running containers | `[]` |
| `restart` | Restart containers | `[]` |
| `pull` | Pull latest images | `[]` |
| `logs` | Fetch container logs | `["--tail", "100", "-f"]` |
| `exec` | Execute command in container | `["bash", "-c", "echo hello"]` |

**Invalid command error:**
```bash
echo '{"type":"operation_request","data":{"command":"invalid","options":[],"services":[]}}' | \
  websocat -k --header="Authorization: Bearer $TOKEN" \
  wss://berth.example.com/ws/api/servers/1/stacks/test-stack/operations
```

**Response:**
```json
{"type":"error","error":"agent error: Invalid operation request: invalid command"}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | Must be `operation_request` |
| data.command | string | Yes | Docker Compose command |
| data.options | array | No | Command options/flags |
| data.services | array | No | Specific services (empty = all services) |
| data.registry_credentials | array | No | Registry auth for image pulls |

## Server Messages

### Operation Started

Sent immediately after an operation begins:

```json
{"type":"operation_started","data":{"operationId":"f8861320-41fe-43f7-8066-d0c15688171f"}}
```

### Stream Data (stdout)

```json
{"type":"stdout","data":"Container my-stack-web-1  Starting","timestamp":"2025-12-29T20:23:20.055Z"}
```

### Stream Data (stderr)

```json
{"type":"stderr","data":"time=\"2025-12-29T20:23:20Z\" level=warning msg=\"No services to build\"","timestamp":"2025-12-29T20:23:20.055297626Z"}
```

### Progress Update

```json
{"type":"progress","data":"Pulling image nginx:latest (50%)","timestamp":"2025-12-29T20:23:20.055Z"}
```

### Operation Complete

```json
{"type":"complete","success":true,"exitCode":0,"timestamp":"2025-12-29T20:23:20.076606157Z"}
```

### Error

```json
{"type":"error","error":"agent error: another operation (f8861320-41fe-43f7-8066-d0c15688171f) is already running on stack 'test-stack'"}
```

---

# Connection Management

## Ping/Pong Keepalive

All WebSocket connections use ping/pong frames for keepalive:

| Setting | Value |
|---------|-------|
| Ping Interval | 30 seconds |
| Pong Timeout | 60 seconds |
| Write Timeout | 10 seconds |

---

# Error Codes

| Error | Description |
|-------|-------------|
| `Not authenticated` | Missing or invalid session/token |
| `TOTP verification required` | User has TOTP enabled but not verified |
| `Invalid server ID` | Server ID parameter is malformed |
| `Access denied to server` | User lacks permission to access the server |
| `Insufficient permissions: stacks.manage required` | User lacks manage permission for the stack |
| `Permission denied for stack viewing` | User lacks view permission for the stack |
| `No active terminal session` | Terminal command sent before `terminal_start` |
| `Invalid message format` | Malformed JSON message |
| `Unknown message type` | Unrecognised message type field |
| `Server not found` | Server ID does not exist |
| `Failed to connect to agent terminal` | Agent unreachable or terminal connection failed |
| `Container not found` | No container matching the specified service/name |
| `agent error: Invalid operation request: invalid command` | Invalid operation command |
| `agent error: another operation (...) is already running` | Operation already in progress on stack |
