/**
 * src/__tests__/starfield.test.ts
 * Unit tests for seeded deterministic starfield generation, color constraints,
 * and cross-flare line geometry.
 */

import { describe, it, expect } from 'vitest';
import { generateSeededStarfield, createSeededRandom } from '@/components/world/Starfield';

describe('Night-Sky Starfield: Seeded PRNG & Invariants', () => {
  it('generates 100% deterministic positions across multiple calls with same seed', () => {
    const run1 = generateSeededStarfield(50, 5);
    const run2 = generateSeededStarfield(50, 5);

    expect(run1.stars).toHaveLength(50);
    expect(run2.stars).toHaveLength(50);

    for (let i = 0; i < 50; i++) {
      expect(run1.stars[i].x).toBe(run2.stars[i].x);
      expect(run1.stars[i].y).toBe(run2.stars[i].y);
      expect(run1.stars[i].z).toBe(run2.stars[i].z);
      expect(run1.stars[i].layer).toBe(run2.stars[i].layer);
      expect(run1.stars[i].phase).toBe(run2.stars[i].phase);
      expect(run1.stars[i].size).toBe(run2.stars[i].size);
    }
  });

  it('strictly restricts star palette to cool white / cool grey and completely forbids amber/purple', () => {
    const { stars } = generateSeededStarfield(500, 10);

    stars.forEach((s) => {
      const [r, g, b] = s.color;
      // Invariant: Cool white/grey has balanced blue/green >= red or high blue
      // Amber would have r >> b (e.g. #f59e0b has r=0.96, b=0.04)
      const isAmber = r > 0.8 && b < 0.4;
      const isPurple = r > 0.7 && g < 0.4 && b > 0.7;

      expect(isAmber).toBe(false);
      expect(isPurple).toBe(false);
      // All stars must have blue >= 0.60
      expect(b).toBeGreaterThanOrEqual(0.60);
    });
  });

  it('partitions stars across 3 distinct depth layers for parallax', () => {
    const { stars } = generateSeededStarfield(300, 0);

    const layer1 = stars.filter((s) => s.layer === 1);
    const layer2 = stars.filter((s) => s.layer === 2);
    const layer3 = stars.filter((s) => s.layer === 3);

    expect(layer1.length).toBeGreaterThan(0);
    expect(layer2.length).toBeGreaterThan(0);
    expect(layer3.length).toBeGreaterThan(0);
    expect(layer1.length + layer2.length + layer3.length).toBe(300);
  });

  it('generates cross-flare line segments for bright stars only when requested', () => {
    const withFlares = generateSeededStarfield(100, 10);
    const withoutFlares = generateSeededStarfield(100, 0);

    expect(withoutFlares.crossFlareSegments).toHaveLength(0);
    // Each cross-flare is 2 segments (4 vertices, 12 floats)
    expect(withFlares.crossFlareSegments.length).toBeGreaterThan(0);
    expect(withFlares.crossFlareSegments.length % 12).toBe(0);
  });
});
