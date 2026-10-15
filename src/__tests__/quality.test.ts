/**
 * src/__tests__/quality.test.ts
 * Unit tests for auto-quality step-down logic.
 *
 * Verifies continuous 3-second < 45 FPS downgrade rule (HIGH -> MEDIUM -> LOW).
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialQualityState,
  updateQualityState,
  AUTO_DOWNGRADE_FPS,
  AUTO_DOWNGRADE_WINDOW_MS,
  type QualityState,
} from '@/engine/quality';

describe('Auto Quality Step-Down Engine', () => {
  it('initializes at default tier HIGH and mode auto', () => {
    const state = createInitialQualityState();
    expect(state.tier).toBe('HIGH');
    expect(state.mode).toBe('auto');
    expect(state.consecutiveLowFpsMs).toBe(0);
  });

  it('maintains HIGH tier when FPS is >= 45', () => {
    let state = createInitialQualityState('HIGH', 'auto');

    // Run for 5 seconds at 60 FPS
    for (let i = 0; i < 10; i++) {
      const res = updateQualityState(state, 60, 500);
      state = res.state;
      expect(res.downgraded).toBe(false);
      expect(state.tier).toBe('HIGH');
      expect(state.consecutiveLowFpsMs).toBe(0);
    }
  });

  it('accumulates continuous low-FPS time without downgrading before 3 seconds', () => {
    let state = createInitialQualityState('HIGH', 'auto');

    // 2500ms at 30 FPS (< 45 FPS)
    const res = updateQualityState(state, 30, 2500);
    state = res.state;

    expect(res.downgraded).toBe(false);
    expect(state.tier).toBe('HIGH');
    expect(state.consecutiveLowFpsMs).toBe(2500);
  });

  it('downgrades from HIGH to MEDIUM when FPS is below 45 for 3 consecutive seconds', () => {
    let state = createInitialQualityState('HIGH', 'auto');

    // Step 1: 2000ms at 35 FPS
    const res1 = updateQualityState(state, 35, 2000);
    state = res1.state;
    expect(res1.downgraded).toBe(false);
    expect(state.tier).toBe('HIGH');
    expect(state.consecutiveLowFpsMs).toBe(2000);

    // Step 2: 1000ms more at 35 FPS (total 3000ms >= 3000ms threshold)
    const res2 = updateQualityState(state, 35, 1000);
    state = res2.state;
    expect(res2.downgraded).toBe(true);
    expect(res2.newTier).toBe('MEDIUM');
    expect(state.tier).toBe('MEDIUM');
    expect(state.consecutiveLowFpsMs).toBe(0); // reset counter after step-down
  });

  it('resets continuous low-FPS counter if FPS recovers to >= 45 before 3 seconds', () => {
    let state = createInitialQualityState('HIGH', 'auto');

    // 2500ms low FPS
    state = updateQualityState(state, 30, 2500).state;
    expect(state.consecutiveLowFpsMs).toBe(2500);

    // Recover: 1 frame of 50 FPS
    const recoverRes = updateQualityState(state, 50, 100);
    state = recoverRes.state;
    expect(recoverRes.downgraded).toBe(false);
    expect(state.tier).toBe('HIGH');
    expect(state.consecutiveLowFpsMs).toBe(0); // counter reset!

    // Another 2000ms low FPS: should not trigger downgrade because counter was reset
    const res3 = updateQualityState(state, 30, 2000);
    state = res3.state;
    expect(res3.downgraded).toBe(false);
    expect(state.tier).toBe('HIGH');
    expect(state.consecutiveLowFpsMs).toBe(2000);
  });

  it('downgrades from MEDIUM to LOW after another continuous 3 seconds < 45 FPS', () => {
    let state = createInitialQualityState('MEDIUM', 'auto');

    // 3000ms of 25 FPS
    const res = updateQualityState(state, 25, 3000);
    state = res.state;
    expect(res.downgraded).toBe(true);
    expect(res.newTier).toBe('LOW');
    expect(state.tier).toBe('LOW');
    expect(state.consecutiveLowFpsMs).toBe(0);
  });

  it('remains at LOW and does not downgrade further when already at LOW', () => {
    let state = createInitialQualityState('LOW', 'auto');

    const res = updateQualityState(state, 15, 5000);
    state = res.state;
    expect(res.downgraded).toBe(false);
    expect(state.tier).toBe('LOW');
    expect(state.consecutiveLowFpsMs).toBe(0);
  });

  it('does NOT downgrade when qualityMode is manual (high, medium, low)', () => {
    const manualModes = ['high', 'medium', 'low'] as const;

    for (const mode of manualModes) {
      let state = createInitialQualityState('HIGH', mode);
      const res = updateQualityState(state, 10, 10000);
      expect(res.downgraded).toBe(false);
      expect(res.state.tier).toBe('HIGH');
      expect(res.state.consecutiveLowFpsMs).toBe(0);
    }
  });
});
