# FocusFlow v2.1.0 Production Release Notes
**Release Date**: September 20, 2026  
**Target Platforms**: Android 7.0+ (API 24 to 36), Web (Next.js 16)  
**Build Engine**: Hermes Bytecode AOT / React Native 0.86.3  

---

## 🚀 Highlights & New Features in v2.1.0

### 1. Special Timer Completion Ringtone & Alarm Audio Pipeline
- **Custom Resonant Tibetan Zen Bell Chime**: Synthesized 16-bit 44.1kHz stereo PCM audio asset (`focusflow_alarm.wav`) tuned to the 528Hz Solfeggio focus frequency with natural acoustic harmonic decay (C5, G5, C6, E6).
- **Dedicated Android Alarm Notification Channel (`focusflow_timer_alarm_v2`)**: Configured with `USAGE_ALARM` and `CONTENT_TYPE_SONIFICATION` at `IMPORTANCE_MAX` with custom vibration pulse patterns (`[0, 500, 250, 500]`).
- **Foreground & Background Parity**: The custom alarm tone rings reliably whether the application is active in the foreground, backgrounded, or when the device screen is locked.
- **Preference-Aware**: Fully honors user sound toggles (`soundEnabled`) configured in Settings.

### 2. Server-Authoritative Timer & Background Reconciliation
- Wall-clock monotonic timestamp reconciliation upon application foregrounding without network latency dependency.
- Scheduled and canceled background notifications maintain complete idempotency across pause, resume, reset, and skip cycles.

### 3. Custom Duration Intervals
- Added `CUSTOM` calibration dialogs for Focus (1–120m), Short Break (1–60m), and Long Break (1–120m).
- Preserves all standard presets (`25m`, `45m`, `50m` Focus; `5m`, `10m` Short; `15m`, `20m`, `30m` Long).

### 4. Hardened Security & Password Reset Error Propagation
- HTTP 502 error propagation on Resend email provider delivery failure with structured diagnostics.
- Account enumeration protection with constant-time simulation and safe email masking in audit logs.

---

## 📦 Checksums & Verification (v2.1.0)
- **APK**: `FocusFlow-2.1.0-production.apk`
- **SHA-256**: `70E31FDE8FFBEA4D5964CDFD7085E53B66E5F375974D9E550D842929FC196DF8`
- **AAB**: `FocusFlow-2.1.0-production.aab`
- **SHA-256**: `29F5A579A02819851B224EAB36220E6FE3C64FC3806E954D9B5A4701884C1300`

---

## 📦 Historical Release Checksums (v2.0.0)
- **APK**: `FocusFlow-2.0.0-production.apk` (`9B920F1DAE475902D7D3ED5B8535DDDE62B52CDFDD381C291A59FE6672B23209`)
- **AAB**: `FocusFlow-2.0.0-production.aab` (`69AC9CAEC0787DABE06FFFA8CA3D8F464BA148375AA0CE1A6AAC4FD8DC8D8EE8`)
