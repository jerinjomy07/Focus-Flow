# FocusFlow Mobile API & Endpoint Compatibility Matrix

## 1. Overview & Architectural Compatibility

FocusFlow's backend was developed in Phases 0–12 to serve Next.js web clients. In Phase 13, the API layer was extended with mobile-specific authentication while preserving 100% backward compatibility for all web consumers.

The backend supports dual-client authentication transparently:
- **Web App**: Authenticates via HTTP-only cookie sessions managed by NextAuth.
- **Mobile Native App**: Authenticates via standard `Authorization: Bearer <JWT>` headers using signed tokens issued by the mobile authentication endpoints.

Both mechanisms populate the exact same `Session` context returned by `auth()`. Consequently, all business logic, validation schemas, and database operations execute identically.

---

## 2. Dedicated Mobile Authentication Endpoints

### 2.1. Mobile Login
- **Endpoint**: `POST /api/auth/mobile/login`
- **Rate Limit**: Enforced via `authLimiter` (5 requests / 60 seconds per IP).
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "cly001...",
      "name": "Alex Mercer",
      "email": "user@example.com"
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Invalid payload or malformed email.
  - `401 Unauthorized`: Invalid email or password credentials.
  - `429 Too Many Requests`: Rate limit exceeded.

### 2.2. Mobile Session Verification
- **Endpoint**: `GET /api/auth/mobile/session`
- **Request Headers**: `Authorization: Bearer <token>`
- **Success Response (`200 OK`)**:
  ```json
  {
    "user": {
      "id": "cly001...",
      "name": "Alex Mercer",
      "email": "user@example.com"
    },
    "expires": "2026-10-18T00:00:00.000Z"
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Missing, expired, or invalid token.

### 2.3. Mobile Logout
- **Endpoint**: `POST /api/auth/mobile/logout`
- **Request Headers**: `Authorization: Bearer <token>`
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true
  }
  ```

---

## 3. Core REST API Matrix (Shared Between Web & Mobile)

All endpoints below require authentication (either web cookie session or mobile `Bearer` token).

| Route | Method | Description | Request Body / Parameters |
|---|---|---|---|
| `/api/focus-sessions` | `GET` | Fetch active session for user | None |
| `/api/focus-sessions` | `POST` | Start a new focus session | `{ "type": "FOCUS", "durationMinutes": 25, "projectId"?: string, "taskId"?: string }` |
| `/api/focus-sessions/[id]/complete` | `POST` | Complete an in-progress session | `{ "actualDurationMinutes": 25, "notes"?: string }` |
| `/api/focus-sessions/[id]/cancel` | `POST` | Cancel/abandon session | `{ "reason"?: string }` |
| `/api/projects` | `GET` | Fetch all user projects | None |
| `/api/projects` | `POST` | Create a new project | `{ "name": string, "color"?: string, "description"?: string }` |
| `/api/tasks` | `GET` | Fetch user tasks (backlog) | `?projectId=&status=&priority=` |
| `/api/tasks` | `POST` | Create a task | `{ "title": string, "projectId"?: string, "estimatedPomodoros"?: number }` |
| `/api/tasks/[id]` | `PATCH` | Update task status/fields | `{ "title"?: string, "status"?: string, "completedPomodoros"?: number }` |
| `/api/tasks/[id]` | `DELETE` | Delete a task | None |
| `/api/history` | `GET` | Paginated completed sessions | `?page=1&limit=20&startDate=&endDate=` |
| `/api/productivity` | `GET` | Daily summary & streak metrics | None |
| `/api/analytics` | `GET` | Aggregated analytics & distributions | `?period=7d` or `30d` |
| `/api/settings` | `GET` | User settings & timer durations | None |
| `/api/settings` | `PATCH` | Update user settings | `{ "focusDuration"?: number, "shortBreak"?: number, "notifications"?: boolean }` |
| `/api/notifications` | `GET` | Fetch in-app notifications | `?unreadOnly=true` |
| `/api/notifications/[id]/read`| `PATCH` | Mark notification as read | None |

---

## 4. Mobile Error Handling Contract

When an API error occurs, the server returns standard JSON payloads:
```json
{
  "error": "Human readable error description",
  "code": "SPECIFIC_ERROR_CODE",
  "details": []
}
```

The mobile client's `ApiClientError` catches these errors and classifies them into actionable states:
- `401 Unauthorized`: Triggers automatic token clearing in `expo-secure-store` and transitions to `AuthStack` (Login screen).
- `429 Too Many Requests`: Presents user-friendly cooldown warning.
- `409 Conflict`: (e.g. concurrent active timer already running) Prompts the user to sync with the active server session.
