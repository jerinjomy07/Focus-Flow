# FocusFlow Mobile Architecture

## 1. Architectural Vision & Principles

FocusFlow for Android is a **genuine native standalone mobile application** engineered with React Native and Expo (SDK 57 / React Native 0.86). It is not a WebView container, an iframe shell, or a progressive web app wrapper. The app renders entirely through native Android views (using the modern React Native New Architecture with Hermes and Fabric/TurboModules).

### Core Architectural Invariants
1. **Server-Authoritative Domain Rules**: The backend is the single source of truth for timer states, session validation, active session locking, streak calculations, and analytical metrics. The mobile app never mutates timers or analytical records optimistically without server confirmation.
2. **Dual-Authentication Architecture**: The backend (`focusflow-app`) supports both session cookies (for web browsers) and `Authorization: Bearer <jwt>` tokens (for mobile native clients) signed by a shared cryptographic secret (`AUTH_SECRET`).
3. **Strict Offline Boundaries**: Read-only dashboard and backlog caching via `AsyncStorage` allows instant launches and offline viewing. Mutations (starting sessions, completing sessions, creating projects/tasks) require network connectivity to prevent out-of-sync conflicts.
4. **Platform-Conforming Native UX**: 100% native Android interaction patterns, including Android 13+ runtime notification permissions (`POST_NOTIFICATIONS`), hardware vibration (`VIBRATE`), high-importance notification channels with completion sound playback, tactile feedback via `expo-haptics`, and hardware back button handling.

---

## 2. High-Level Component Topology

```
+-----------------------------------------------------------------------------------+
|                            FocusFlow Mobile Client                                |
|  (React Native 0.86 + Expo SDK 57 | TypeScript | React Query | React Navigation)   |
+-----------------------------------------------------------------------------------+
       |                    |                    |                     |
       v                    v                    v                     v
+--------------+     +--------------+     +--------------+      +--------------+
| AuthContext  |     |  Navigation  |     | TimerEngine  |      | Platform     |
| SecureStore  |     | (Auth/Tabs/  |     | AppState     |      | Services     |
| Hardware Enc |     |  Screens)    |     | Sync Hook    |      | Notifications|
+--------------+     +--------------+     +--------------+      +--------------+
       \                    |                    /                     |
        \                   |                   /                      |
         +------------------v------------------+                       |
         |         Typed ApiClient             |<----------------------+
         | (Auth Header, Timeout, Errors)      |
         +-------------------------------------+
                            |
                     HTTPS REST JSON
                            |
                            v
+-----------------------------------------------------------------------------------+
|                            FocusFlow Web/API Server                               |
|                     (Next.js 15 App Router | Route Handlers)                      |
+-----------------------------------------------------------------------------------+
                            |
           Dual Auth: Cookie Session OR Bearer JWT
                            |
                            v
+-----------------------------------------------------------------------------------+
|                        Serverless Backend & PostgreSQL                            |
|             (Prisma ORM | Transactions | Domain State Engine)                     |
+-----------------------------------------------------------------------------------+
```

---

## 3. Dual-Authentication Layer

FocusFlow uses NextAuth v5 on the web. Web clients authenticate through HTTP-only signed session cookies. Because native mobile apps cannot rely on cookie jars reliably across network layers and background tasks, the system implements a **Dual-Authentication Adapter**:

### Mobile Login Flow (`POST /api/auth/mobile/login`)
1. Mobile app submits email and password over HTTPS.
2. The endpoint verifies credentials against the database using `bcryptjs`.
3. An access token is minted with a 30-day lifetime using `next-auth/jwt.encode` with `secret: process.env.AUTH_SECRET`.
4. Token payload includes:
   ```json
   {
     "sub": "<user_id>",
     "email": "<user_email>",
     "name": "<user_name>",
     "iat": 1726617600,
     "exp": 1729209600
   }
   ```
5. Mobile client saves the JWT securely in `expo-secure-store` (backed by Android Keystore and hardware-backed TEE/Keymaster).

### Request Authentication (`src/lib/auth/index.ts`)
The server's central `auth()` resolver checks:
1. Standard NextAuth session cookies (web path).
2. If absent, inspects the HTTP `Authorization` header for `Bearer <token>`.
3. Verifies and decodes the JWT using `next-auth/jwt.decode` with `AUTH_SECRET`.
4. Formats a standard `Session` object identical to the web session:
   ```ts
   {
     user: {
       id: decoded.sub,
       email: decoded.email,
       name: decoded.name,
     },
     expires: new Date(decoded.exp * 1000).toISOString()
   }
   ```
All downstream route handlers and domain logic execute identically regardless of whether the client is web or mobile.

---

## 4. Server-Authoritative Timer & AppState Reconciliation

Pomodoro timers on mobile devices cannot rely on JavaScript `setInterval` remaining active when the app is backgrounded or when the OS enters Doze mode.

FocusFlow enforces server-authoritative timer semantics:

1. **Session Creation**: When the user presses "Start", the client issues `POST /api/focus-sessions`. The server validates that no session is currently `IN_PROGRESS` for this user, writes the start record with server timestamp `startedAt`, and returns the canonical session record.
2. **Local Display Calculation**: The local timer does not increment ticks. Instead, it computes remaining time based on server timestamps:
   $$\text{elapsed} = \text{now} - \text{startedAt}$$
   $$\text{remaining} = \max(0, \text{durationSec} - \text{elapsed})$$
3. **Lifecycle Reconciliation (`AppState`)**:
   When the user returns to the app from the background, the `AppState` listener triggers an immediate recalculation:
   - If $\text{remaining} > 0$, UI updates to the correct second immediately.
   - If $\text{remaining} == 0$, UI updates to "Session Finished" state and prompts completion.
   - The app refreshes `GET /api/focus-sessions/active` to verify whether the session was terminated or completed elsewhere.
4. **Completion**:
   Completing a session issues `POST /api/focus-sessions/{id}/complete` with actual duration. Server verifies duration, awards streaks, unlocks achievements, updates daily aggregates, and returns the canonical result.

---

## 5. Offline Storage & Caching Strategy

The mobile client integrates a structured offline cache located at `mobile/src/cache/offlineCache.ts`:

- **Technology**: React Native `AsyncStorage` with namespaced keys (`@focusflow/cache/v1/...`).
- **Cached Datasets**:
  - `DASHBOARD`: Daily summary, active streak, completed session count.
  - `TASKS`: Project and task backlog lists.
  - `SETTINGS`: User durations (focus, short break, long break), notifications toggles, sound preferences.
- **Cache Eviction**: Configurable TTL (default: 1 hour). When offline, the app displays a subtle offline status indicator and serves cached data.
- **Strict Non-Optimistic Mutation Policy**: Modifying timers, completing sessions, or deleting records is prohibited while offline to ensure data consistency and prevent streak corruption.

---

## 6. Native Android System Integration

### High-Importance Notification Channel
On startup, `mobile/src/services/notificationService.ts` ensures an Android notification channel is registered:
- **Channel ID**: `focus-timer`
- **Channel Name**: `Focus Session Timer`
- **Importance**: `AndroidImportance.MAX` (heads-up notification, banner, vibration, sound).
- **Vibration Pattern**: `[0, 250, 250, 250]` ms.

### Audio & Tactile Feedback
- **Completion Sound**: `mobile/src/services/audioHapticsService.ts` plays completion sounds via `expo-av`.
- **Haptic Feedback**: Uses `expo-haptics`:
  - `impactAsync(ImpactFeedbackStyle.Medium)` on timer start and pause.
  - `notificationAsync(NotificationFeedbackType.Success)` on session completion.
  - `notificationAsync(NotificationFeedbackType.Warning)` on session cancellation.

### Android Runtime Permissions
Android 13+ (API 33) requires explicit user authorization for `POST_NOTIFICATIONS`. The app:
1. Checks permission status via `Notifications.getPermissionsAsync()`.
2. Requests permission on initial login/onboarding via `Notifications.requestPermissionsAsync()`.
3. Handles graceful degradation if permission is denied (in-app banner reminders without blocking timer usage).
