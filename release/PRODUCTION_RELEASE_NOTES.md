# FocusFlow — Production Release Notes

**Version**: 1.0.0 (Build 1)  
**Target Platform**: Android 7.0+ (API Level 24 to 36)  
**Architecture**: Pure Standalone React Native + Expo Native Binary (Hermes V12 Bytecode Engine)  
**Backend Infrastructure**: Vercel Serverless Platform (Next.js 16.3.5)  
**Database**: Managed Neon Serverless PostgreSQL  
**Release Date**: September 18, 2026  

---

## 1. Release Artifacts
- **Production APK**: FocusFlow-1.0.0-production.apk (68,356,427 bytes)
  - SHA-256: EA624D2D85ACD348B5CDE53FE74C6DD21E17D74D87D14899B3898499842BFB9B
- **Production AAB**: FocusFlow-1.0.0-production.aab (47,269,006 bytes)
  - SHA-256: 3FAFB6988D0E4EB1385DE41985EE29939F0EB976724D74F7D5F981C9009BE42D

---

## 2. Key Architecture & Features
- **Pure Standalone Native Client**: Compiled directly to Android bytecode with zero WebView, iframe, or web wrapper.
- **Dedicated Dual-Token Mobile Authentication**:
  - Rotating refresh tokens backed by Android Keystore (expo-secure-store).
  - Strict session-family replay detection and automatic token rotation.
- **Deterministic Timestamp Timer**:
  - Zero-drift target-end-time wall-clock reconciliation across background and foreground states.
- **Cross-Platform Synchronization**:
  - Real-time data persistence with Neon PostgreSQL for unified task, session, and analytics management across Web and Mobile.
- **Security & Privacy**:
  - Zero backend secrets bundled in the client application.
  - End-to-end TLS/HTTPS communication with the production API.
