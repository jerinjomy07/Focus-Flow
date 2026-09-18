// src/lib/audio.ts
// FocusFlow — Zero-Asset Web Audio API Chime Orchestrator (ADR-015)
// Pure in-memory sound synthesis with non-blocking error isolation.
// Ensures that audio policy restrictions or device failures never interrupt the timer.

let sharedAudioContext: AudioContext | null = null;

/**
 * Lazily retrieves or instantiates a singleton AudioContext.
 * Returns null if in a non-browser environment or if Web Audio is unsupported.
 */
function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!sharedAudioContext) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (AudioCtx) {
      try {
        sharedAudioContext = new AudioCtx();
      } catch {
        sharedAudioContext = null;
      }
    }
  }

  return sharedAudioContext;
}

/**
 * Explicitly primes/resumes the AudioContext inside a user-gesture handler (e.g., clicking "Start").
 * Pre-authorizes audio playback so future timer-expired background chimes will not be blocked.
 */
export async function primeAudioContext(): Promise<void> {
  try {
    const ctx = getSharedAudioContext();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
  } catch {
    // Non-blocking
  }
}

/**
 * Synthesizes a bell chime using dual sine oscillators and an exponential decay gain envelope.
 */
function synthesizeChime(
  ctx: AudioContext,
  freq1: number,
  freq2: number,
  durationSeconds: number = 1.2
): void {
  const now = ctx.currentTime;

  // Master gain node with exponential decay
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);
  masterGain.gain.setValueAtTime(0.3, now);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

  // Oscillator 1 (Primary harmonic)
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(freq1, now);
  osc1.connect(masterGain);

  // Oscillator 2 (Harmonic overtone)
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq2, now);
  osc2.connect(masterGain);

  // Start & stop
  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + durationSeconds);
  osc2.stop(now + durationSeconds);
}

/**
 * Plays the focus completion chime (587.33 Hz [D5] and 880 Hz [A5]).
 * Fire-and-forget; never throws. Returns true if audio played, false otherwise.
 */
export async function playFocusCompleteChime(soundEnabled: boolean = true): Promise<boolean> {
  if (!soundEnabled) return false;

  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    if (ctx.state !== 'running') return false;

    synthesizeChime(ctx, 587.33, 880, 1.4);
    return true;
  } catch (err) {
    console.warn('[AudioEngine] Playback prevented:', err);
    return false;
  }
}

/**
 * Plays the break completion chime (440 Hz [A4] and 659.25 Hz [E5]).
 * Fire-and-forget; never throws. Returns true if audio played, false otherwise.
 */
export async function playBreakCompleteChime(soundEnabled: boolean = true): Promise<boolean> {
  if (!soundEnabled) return false;

  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    if (ctx.state !== 'running') return false;

    synthesizeChime(ctx, 440, 659.25, 1.2);
    return true;
  } catch (err) {
    console.warn('[AudioEngine] Playback prevented:', err);
    return false;
  }
}
