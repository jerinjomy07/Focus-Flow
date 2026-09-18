# ADR-015: Web Audio API Chime Orchestration & Autoplay Failure Isolation

**Date:** 2026-09-17  
**Status:** Accepted  
**Author:** Architecture Team

---

## 1. Context

FocusFlow signals the end of focus sessions and break sessions with distinct audio chimes when audio is enabled in user settings (`soundEnabled: true`).

In modern browser environments, audio playback faces significant challenges:
1. **Autoplay Policy Restrictions:** Modern browsers (Chrome, Firefox, Safari, Edge) block audio playback that is not triggered directly by an explicit user gesture (e.g., clicking a button). When a 25-minute Pomodoro timer finishes countdown in the background, or when breaks auto-start without direct user interaction, browsers may suspend the `AudioContext` or reject `.play()` calls with `NotAllowedError: The play() request was interrupted` or `The AudioContext was not allowed to start`.
2. **Network & Asset Dependency Failures:** Storing MP3/WAV files in `/public/sounds` introduces network latency, HTTP caching issues, CORS failures, 404 missing asset bugs, and codec decoding overhead.
3. **Timer Runtime Coupling Risk:** If an unhandled Promise rejection occurs from audio playback during session completion or cycle transition, a fragile implementation could crash the timer loop, abort the server completion request, or leave the UI in an indeterminate state.

---

## 2. Evaluated Options

| Option | Implementation | Network Dependency | Autoplay Resilience | Risk of Timer Failure |
|---|---|---|---|---|
| **Option A: HTML5 `<audio>` Elements (`new Audio('/bell.mp3')`)** | Standard DOM elements | High (HTTP fetch) | Low (often blocked in background) | High (unhandled promise rejections) |
| **Option B: External Audio Library (Howler.js, SoundJS)** | NPM package dependency | Medium (extra bundle size ~30KB) | Medium | Medium |
| **Option C: Native Web Audio API Zero-Dependency Synthesis** | Web Audio API (`AudioContext`, `OscillatorNode`, `GainNode`) | Zero (100% synthesized in-memory) | High (graceful non-blocking degradation) | Zero (strictly isolated) |

---

## 3. Decision

We adopt **Option C: Native Web Audio API Zero-Dependency Synthesis with Non-Blocking Failure Isolation**.

1. **Zero External Assets:**
   - Sounds are synthesized purely mathematically via HTML5 `AudioContext`, dual sine oscillators, and exponential gain decay envelopes.
   - **Focus Complete Sound:** Dual bell harmonic chime (587.33 Hz [D5] followed by 880 Hz [A5] with a smooth 1.2-second exponential gain envelope).
   - **Break Complete Sound:** Ascending bright chime (440 Hz [A4] transitioning to 659.25 Hz [E5]).
2. **Audio Autoplay & Context Suspension Handling:**
   - A single shared `AudioContext` singleton is lazily initialized on the first user interaction (such as clicking "Start Focus").
   - When the user starts a session, the system calls `audioContext.resume()` within the user gesture context to unlock audio output for future background completions.
3. **Strict Isolation Policy (Non-Blocking Promise):**
   - Audio synthesis and playback is strictly wrapped in `try...catch` and executed as an asynchronous fire-and-forget side effect.
   - Audio failure (`NotAllowedError`, suspended state, missing audio hardware) **MUST NEVER** reject, throw, or interrupt:
     - The timer state machine transition (`RUNNING -> COMPLETED`).
     - The network request to complete the session (`POST /api/focus-sessions/:id/complete`).
     - The auto-start countdown or cycle progression.
   - In automated test environments (Vitest/Node.js/JSDOM where `window.AudioContext` is undefined), the audio engine automatically no-ops silently without throwing.

---

## 4. Architectural Implementation Pattern

```typescript
// src/lib/audio.ts (conceptual architecture)
export async function playFocusCompleteChime(): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;

    const ctx = getSharedAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
    if (ctx.state !== 'running') return false;

    // Dual oscillator synthesis with exponential decay
    synthesizeBellChime(ctx, 587.33, 880, 1.2);
    return true;
  } catch (err) {
    // Non-blocking catch: Audio failure must never disrupt timer execution
    console.warn('[AudioEngine] Autoplay or Web Audio playback prevented:', err);
    return false;
  }
}
```

---

## 5. Verification & Testing Strategy

1. **Mock Environment Unit Tests:**
   - Verify `playFocusCompleteChime()` resolves cleanly when `AudioContext` throws `NotAllowedError`.
   - Verify that timer completion flow succeeds identically whether audio returns `true` or `false`.
2. **User Gesture Tests:**
   - Verify that clicking "Start Focus" initiates context resumption.
3. **Settings Guard Tests:**
   - Verify that when user settings have `soundEnabled: false`, no audio nodes are constructed or triggered.
