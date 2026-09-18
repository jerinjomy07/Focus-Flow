// src/lib/audio.test.ts
// FocusFlow — Audio Chime Synthesizer Unit Tests (ADR-015)
// Verifies non-blocking failure isolation, soundEnabled settings guard, and Web Audio synthesis.

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  playFocusCompleteChime,
  playBreakCompleteChime,
  primeAudioContext,
} from './audio';

describe('Web Audio Chime Orchestration (ADR-015)', () => {
  const originalAudioContext = globalThis.AudioContext;

  afterEach(() => {
    // Restore
    if (originalAudioContext) {
      globalThis.AudioContext = originalAudioContext;
    } else {
      delete (globalThis as { AudioContext?: unknown }).AudioContext;
    }
  });

  describe('Non-Blocking Fallback in Headless/Test Environments', () => {
    it('resolves false without throwing when window.AudioContext is undefined', async () => {
      // In default Node environment, window.AudioContext is not present
      const focusResult = await playFocusCompleteChime(true);
      const breakResult = await playBreakCompleteChime(true);

      expect(focusResult).toBe(false);
      expect(breakResult).toBe(false);
    });

    it('immediately returns false without constructing nodes if soundEnabled is false', async () => {
      const mockResume = vi.fn().mockResolvedValue(undefined);
      const mockCreateGain = vi.fn();

      class MockAudioContext {
        state = 'running';
        resume = mockResume;
        createGain = mockCreateGain;
      }

      (globalThis as unknown as { AudioContext: typeof MockAudioContext }).AudioContext = MockAudioContext;

      const result = await playFocusCompleteChime(false);

      expect(result).toBe(false);
      expect(mockCreateGain).not.toHaveBeenCalled();
    });

    it('catches and suppresses any audio context error without throwing', async () => {
      class FailingAudioContext {
        get state() {
          throw new Error('NotAllowedError: AudioContext was not allowed to start');
        }
      }

      (globalThis as unknown as { AudioContext: typeof FailingAudioContext }).AudioContext = FailingAudioContext;

      // Must NOT reject or throw
      const promise = playFocusCompleteChime(true);
      await expect(promise).resolves.toBe(false);
    });
  });

  describe('User Gesture Audio Context Priming', () => {
    it('attempts to resume suspended context cleanly without throwing', async () => {
      const mockResume = vi.fn().mockResolvedValue(undefined);

      class SuspendedAudioContext {
        state = 'suspended';
        resume = mockResume;
      }

      (globalThis as unknown as { AudioContext: typeof SuspendedAudioContext }).AudioContext = SuspendedAudioContext;

      await expect(primeAudioContext()).resolves.toBeUndefined();
    });
  });
});
