# FocusFlow Mobile Development Guide

## 1. Prerequisites & Environment Setup

To develop and test the FocusFlow Android application locally, the following toolchains are required:

### Toolchains
- **Node.js**: `v20.x` or higher (`node -v`)
- **npm**: `v10.x` or higher
- **JDK (Java Development Kit)**: OpenJDK 17 LTS (e.g. Microsoft OpenJDK 17 or Eclipse Adoptium Temurin 17). Ensure `JAVA_HOME` is set or configured in `mobile/android/gradle.properties` (`org.gradle.java.home`).
- **Android SDK**:
  - `ANDROID_HOME` / `ANDROID_SDK_ROOT` set (typically `%LOCALAPPDATA%\Android\Sdk` on Windows).
  - SDK Platforms: Android 14 (API 34) and Android 15 (API 35).
  - Build-tools: `34.0.0` or `35.0.0`.
  - Android NDK: `26.1.10909125` (or React Native compatible NDK).
  - Android Emulator with system image (e.g., Pixel 10 Pro XL / Pixel 8 with Google Play API 34/35).

---

## 2. Directory Structure

```
Focus Flow/
├── focusflow-app/              # Next.js 15 Web Application & Serverless API
└── mobile/                     # React Native + Expo Standalone Mobile App
    ├── app.json                # Expo application configuration & permissions
    ├── App.tsx                 # Root React component with providers
    ├── package.json            # React Native dependencies & scripts
    ├── tsconfig.json           # Mobile TypeScript configuration
    ├── android/                # Generated Android native Gradle project (Expo prebuild)
    └── src/
        ├── api/                # Typed REST API client & services
        ├── cache/              # Offline AsyncStorage caching layer
        ├── context/            # Authentication context & state
        ├── navigation/         # React Navigation stacks & bottom tabs
        ├── screens/            # Mobile screen components
        ├── services/           # Platform services (Timer, Notifications, Audio/Haptics)
        └── theme/              # Design tokens (colors, typography, spacing)
```

---

## 3. Environment Variables

Create `.env` in the `mobile/` directory:

```env
# URL for the FocusFlow backend API
# For Android Emulator communicating with backend running on host localhost:3000:
EXPO_PUBLIC_API_URL=http://localhost:3000

# Alternative for physical devices on same LAN (replace with machine IP):
# EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

---

## 4. Local Development Workflows

### Step 1: Start Backend Server
From `focusflow-app`:
```bash
npm run dev
```
The server listens on `http://localhost:3000`.

### Step 2: Reverse Android Emulator TCP Port
When using an Android Virtual Device (AVD), reverse port 3000 so requests to `localhost:3000` on the Android device route directly to the host machine:
```bash
adb reverse tcp:3000 tcp:3000
```

### Step 3: Start Mobile Development Server
From `mobile`:
```bash
npx expo start
```
Press `a` in the terminal to launch the app on the connected Android emulator or physical device.

---

## 5. Testing & Quality Gates

The mobile codebase includes TypeScript type checking and unit test suites.

### Run TypeScript Verification
```bash
cd mobile
npx tsc --noEmit
```
Expected output: 0 errors.

### Run Unit Tests
```bash
cd mobile
npm test
```
Runs Vitest test suites verifying:
- `timerEngine.test.ts`: Timestamp math, elapsed calculations, remaining duration, completion states.
- `offlineCache.test.ts`: Offline cache TTL, serialization, namespaced keys, and eviction.
