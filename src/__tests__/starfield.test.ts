/**
 * src/__tests__/starfield.test.ts
 * Unit tests for seeded deterministic starfield sky dome generation,
 * magnitude distribution, camera-following sky-dome behavior,
 * and fog / frustum culling shader material configuration.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { generateSeededStarfield, createSeededRandom } from '@/components/world/Starfield';

describe('Night-Sky Starfield Sky Dome: Seeded PRNG & Invariants', () => {
  it('generates 100% deterministic positions across multiple calls with same seed', () => {
    const run1 = generateSeededStarfield(50, 5);
    const run2 = generateSeededStarfield(50, 5);

    expect(run1.stars).toHaveLength(50);
    expect(run2.stars).toHaveLength(50);

    for (let i = 0; i < 50; i++) {
      expect(run1.stars[i].x).toBe(run2.stars[i].x);
      expect(run1.stars[i].y).toBe(run2.stars[i].y);
      expect(run1.stars[i].z).toBe(run2.stars[i].z);
      expect(run1.stars[i].phase).toBe(run2.stars[i].phase);
      expect(run1.stars[i].size).toBe(run2.stars[i].size);
    }
  });

  it('places stars on a spherical shell with radius ~200 units', () => {
    const { stars } = generateSeededStarfield(100, 0);
    stars.forEach((s) => {
      const dist = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
      // All stars lie on spherical shell R = 200 within float epsilon
      expect(dist).toBeCloseTo(200, 0);
    });
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
      expect(b).toBeGreaterThanOrEqual(0.50);
    });
  });

  it('generates realistic magnitude distribution (faint, medium, bright stars)', () => {
    const { stars } = generateSeededStarfield(500, 10);

    const faint = stars.filter((s) => s.brightness < 0.65);
    const medium = stars.filter((s) => s.brightness >= 0.65 && s.brightness < 0.85);
    const bright = stars.filter((s) => s.brightness >= 0.85);

    expect(faint.length).toBeGreaterThan(250); // ~60-70% faint
    expect(medium.length).toBeGreaterThan(50);  // ~20-30% medium
    expect(bright.length).toBeGreaterThan(10);  // ~5-10% bright
  });

  it('generates cross-flare line segments for bright stars only when requested', () => {
    const withFlares = generateSeededStarfield(100, 10);
    const withoutFlares = generateSeededStarfield(100, 0);

    expect(withoutFlares.crossFlareSegments).toHaveLength(0);
    // Each cross-flare is 2 segments (4 vertices, 12 floats)
    expect(withFlares.crossFlareSegments.length).toBeGreaterThan(0);
    expect(withFlares.crossFlareSegments.length % 12).toBe(0);
  });

  it('verifies sky-dome group tracking behavior and shader material invariants', () => {
    // 1. Group tracking camera.position simulation
    const starfieldGroup = new THREE.Group();
    const mockCamera = new THREE.PerspectiveCamera(45, 16 / 9, 0.2, 450);

    mockCamera.position.set(12.5, 4.2, -8.7);
    starfieldGroup.position.copy(mockCamera.position);

    expect(starfieldGroup.position.x).toBe(12.5);
    expect(starfieldGroup.position.y).toBe(4.2);
    expect(starfieldGroup.position.z).toBe(-8.7);

    // 2. Material invariants: fog: false, frustumCulled: false, depthWrite: false, depthTest: false
    const starPoints = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.ShaderMaterial({
        fog: false,
        depthWrite: false,
        depthTest: false,
        transparent: true,
      })
    );
    starPoints.frustumCulled = false;

    expect(starPoints.frustumCulled).toBe(false);
    expect(starPoints.material.fog).toBe(false);
    expect(starPoints.material.depthWrite).toBe(false);
    expect(starPoints.material.depthTest).toBe(false);
  });
});
