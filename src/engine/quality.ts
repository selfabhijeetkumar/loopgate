/**
 * src/engine/quality.ts
 * Render quality manager for continuous FPS monitoring and auto-downgrade.
 *
 * Rule: When qualityMode is 'auto', if FPS is continuously below 45 FPS
 * for 3.0 consecutive seconds without interruption:
 *   HIGH -> MEDIUM -> LOW
 * If FPS recovers to >= 45, the continuous counter resets to 0.
 * In manual modes ('high', 'medium', 'low'), auto-downgrade is disabled.
 */

import type { QualityTier } from '@/components/world/qualityTier';

export type QualityMode = 'auto' | 'high' | 'medium' | 'low';

export const AUTO_DOWNGRADE_FPS = 45;
export const AUTO_DOWNGRADE_WINDOW_MS = 3000;

export interface QualityState {
  tier: QualityTier;
  mode: QualityMode;
  consecutiveLowFpsMs: number;
}

export function createInitialQualityState(
  tier: QualityTier = 'HIGH',
  mode: QualityMode = 'auto'
): QualityState {
  return {
    tier,
    mode,
    consecutiveLowFpsMs: 0,
  };
}

export interface QualityStepResult {
  state: QualityState;
  downgraded: boolean;
  newTier?: QualityTier;
}

/**
 * Pure evaluation step for continuous FPS monitoring.
 *
 * @param state Current QualityState
 * @param currentFps Latest measured FPS
 * @param elapsedMs Milliseconds elapsed since last check
 * @param fpsThreshold Threshold below which FPS is considered low (default: 45)
 * @param windowMs Continuous duration in ms required to trigger downgrade (default: 3000)
 */
export function updateQualityState(
  state: QualityState,
  currentFps: number,
  elapsedMs: number,
  fpsThreshold: number = AUTO_DOWNGRADE_FPS,
  windowMs: number = AUTO_DOWNGRADE_WINDOW_MS
): QualityStepResult {
  // If not in auto mode, or already at lowest tier, reset counter and return unchanged
  if (state.mode !== 'auto' || state.tier === 'LOW') {
    return {
      state: { ...state, consecutiveLowFpsMs: 0 },
      downgraded: false,
    };
  }

  if (currentFps < fpsThreshold) {
    const nextLowMs = state.consecutiveLowFpsMs + elapsedMs;
    if (nextLowMs >= windowMs) {
      // Downgrade one tier and reset counter
      const nextTier: QualityTier = state.tier === 'HIGH' ? 'MEDIUM' : 'LOW';
      return {
        state: {
          ...state,
          tier: nextTier,
          consecutiveLowFpsMs: 0,
        },
        downgraded: true,
        newTier: nextTier,
      };
    }

    return {
      state: {
        ...state,
        consecutiveLowFpsMs: nextLowMs,
      },
      downgraded: false,
    };
  }

  // FPS is >= threshold: continuous low-FPS run is broken; reset counter to 0
  return {
    state: {
      ...state,
      consecutiveLowFpsMs: 0,
    },
    downgraded: false,
  };
}
