# FocusFlow Android Release Guide

## 1. Overview & Build Artifacts

FocusFlow Android produces two production-grade build artifacts:
1. **Universal Release APK (`.apk`)**: Standalone, installable package for direct testing on emulators and real hardware devices (`adb install`).
2. **Production Android App Bundle (`.aab`)**: The modern distribution format required by Google Play Store that enables dynamic feature delivery and size-optimized device splits.

Package identifier: `com.focusflow.app`  
Version Name: `1.0.0`  
Version Code: `1`

---

## 2. Android Permissions Policy

FocusFlow respects Android user privacy and follows the principle of least privilege. Unnecessary permissions (such as `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `RECORD_AUDIO`) are strictly prohibited and removed from the manifest.

### Declared Permissions
| Permission | Target Android | Purpose |
|------------|----------------|---------|
| `android.permission.INTERNET` | All | Network requests to FocusFlow REST API backend |
| `android.permission.POST_NOTIFICATIONS` | Android 13+ (API 33+) | Display session completion notifications when app is in background |
| `android.permission.VIBRATE` | All | Native tactile feedback during timer actions and session completion |

---

## 3. Signing Keystore Configuration

### Development & Internal Builds
For internal release testing, the build system uses the standard Android debug keystore configured in `mobile/android/app/build.gradle`:
- Keystore: `mobile/android/app/debug.keystore`
- Alias: `androiddebugkey`
- Store Password / Key Password: `android`

### Production Play Store Release Keystore
To generate a production signing key for Play Store publishing:

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore focusflow-release.keystore -alias focusflow -keyalg RSA -keysize 2048 -validity 10000
```

Store this key securely (never commit `.keystore` files to version control). Configure production credentials via environment variables or `gradle.properties`:
```properties
FOCUSFLOW_UPLOAD_STORE_FILE=focusflow-release.keystore
FOCUSFLOW_UPLOAD_KEY_ALIAS=focusflow
FOCUSFLOW_UPLOAD_STORE_PASSWORD=*****
FOCUSFLOW_UPLOAD_KEY_PASSWORD=*****
```

---

## 4. Compiling Release Artifacts

### Compilation Prerequisites on Windows
React Native New Architecture utilizes CMake and C++ Ninja builds. On Windows, deeply nested node_modules paths can exceed the Win32 `MAX_PATH` (260 character limit). To compile cleanly:

1. Map the `mobile` project directory to a short drive letter:
   ```powershell
   subst X: "c:\path\to\Focus Flow\mobile"
   ```
2. Navigate to the mapped drive:
   ```powershell
   cd X:\android
   ```

### Compile Universal Release APK
```powershell
.\gradlew.bat assembleRelease
```
Artifact location:  
`mobile/android/app/build/outputs/apk/release/app-release.apk`

### Compile Google Play App Bundle (AAB)
```powershell
.\gradlew.bat bundleRelease
```
Artifact location:  
`mobile/android/app/build/outputs/bundle/release/app-release.aab`

---

## 5. Verifying Release Artifacts

### Inspect APK Contents & Permissions
Using Android SDK `aapt` tool:
```bash
aapt dump badging mobile/android/app/build/outputs/apk/release/app-release.apk
```
Confirm:
- `package: name='com.focusflow.app'`
- `uses-permission: name='android.permission.INTERNET'`
- `uses-permission: name='android.permission.POST_NOTIFICATIONS'`
- `uses-permission: name='android.permission.VIBRATE'`
- No unexpected dangerous permissions.

### Installing and Running on Device
```bash
adb install -r mobile/android/app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.focusflow.app/.MainActivity
```
