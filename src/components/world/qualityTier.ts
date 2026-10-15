/**
 * qualityTier.ts
 * Single source of truth for render quality tiers.
 * HIGH (default) → MEDIUM → LOW auto-downgrade when avg FPS < 45 for 3s.
 */

export type QualityTier = 'HIGH' | 'MEDIUM' | 'LOW';

export interface TierConfig {
  dpr: number | [number, number];
  shadows: boolean;
  antialias: boolean;
  shadowMapSize: number;
  rippleDensity: number; // floor ripple vertex segments per side
}

export const TIER_CONFIGS: Record<QualityTier, TierConfig> = {
  HIGH: {
    dpr: [1, 2],
    shadows: true,
    antialias: true,
    shadowMapSize: 1024,
    rippleDensity: 64,
  },
  MEDIUM: {
    dpr: 1.5,
    shadows: false,
    antialias: true,
    shadowMapSize: 512,
    rippleDensity: 32,
  },
  LOW: {
    dpr: 1,
    shadows: false,
    antialias: false,
    shadowMapSize: 256,
    rippleDensity: 16,
  },
};

/** FPS threshold and observation window for auto-downgrade */
export const AUTO_DOWNGRADE_FPS = 45;
export const AUTO_DOWNGRADE_WINDOW_MS = 3000;
