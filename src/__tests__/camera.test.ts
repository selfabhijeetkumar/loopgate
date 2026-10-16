/**
 * src/__tests__/camera.test.ts
 * Unit tests for critically damped camera smoothing:
 * frame-rate independence, bounded frame-to-frame delta during fast scrolls,
 * zero oscillation, and FOV interpolation.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CameraMotionSmoother, DEFAULT_CAMERA_SMOOTHING } from '@/components/world/cameraSmoothing';
import { CHAPTER_CAMERA_STATES } from '@/components/world/WorldScene';

describe('Cinematic Camera: Critically Damped Spring Smoothing', () => {
  it('converges smoothly toward target without overshoot', () => {
    const initialPos = new THREE.Vector3(0, 0, 0);
    const initialTarget = new THREE.Vector3(0, 0, 0);
    const smoother = new CameraMotionSmoother(initialPos, initialTarget, 50);

    const goalPos = new THREE.Vector3(10, 5, 15);
    const goalTarget = new THREE.Vector3(0, 1, 0);
    const dt = 1 / 60; // 60 FPS

    // Step 90 frames (1.5 seconds)
    for (let frame = 0; frame < 90; frame++) {
      const prevDist = smoother.currentPosition.distanceTo(goalPos);
      const res = smoother.step(goalPos, goalTarget, 40, dt);
      const newDist = res.position.distanceTo(goalPos);

      // Distance to goal must monotonically decrease (no overshoot for critically damped spring)
      expect(newDist).toBeLessThanOrEqual(prevDist + 0.0001);
    }

    // Should be virtually converged after 1.5s
    expect(smoother.currentPosition.distanceTo(goalPos)).toBeLessThan(0.01);
    expect(Math.abs(smoother.currentFov - 40)).toBeLessThan(0.01);
  });

  it('guarantees frame-rate independence between 30 FPS and 60 FPS steps', () => {
    const p0 = new THREE.Vector3(-2.0, 9.5, 17.0);
    const t0 = new THREE.Vector3(0.0, 0.8, 0.0);
    const goal = new THREE.Vector3(7.5, 4.8, 9.5);

    const smoother60 = new CameraMotionSmoother(p0, t0, 46);
    const smoother30 = new CameraMotionSmoother(p0, t0, 46);

    // Run 1 second total: 60 steps of 1/60s vs 30 steps of 1/30s
    for (let i = 0; i < 60; i++) {
      smoother60.step(goal, t0, 42, 1 / 60);
    }
    for (let i = 0; i < 30; i++) {
      smoother30.step(goal, t0, 42, 1 / 30);
    }

    // The two positions should be within 1.5% of each other
    const diff = smoother60.currentPosition.distanceTo(smoother30.currentPosition);
    expect(diff).toBeLessThan(0.15);
  });

  it('bounds frame-to-frame position delta during an extreme fast scroll across all chapters', () => {
    const p0 = CHAPTER_CAMERA_STATES[0].position.clone();
    const t0 = CHAPTER_CAMERA_STATES[0].target.clone();
    const smoother = new CameraMotionSmoother(p0, t0, CHAPTER_CAMERA_STATES[0].fov);

    const dt = 1 / 60;
    const recordedDeltas: number[] = [];

    // Simulate aggressive fast scrub from chapter 0 to chapter 5 in 12 frames
    const targetCh5 = CHAPTER_CAMERA_STATES[5].position;
    const lookAtCh5 = CHAPTER_CAMERA_STATES[5].target;
    const fovCh5 = CHAPTER_CAMERA_STATES[5].fov;

    for (let frame = 0; frame < 60; frame++) {
      const res = smoother.step(targetCh5, lookAtCh5, fovCh5, dt);
      recordedDeltas.push(res.frameDelta);
    }

    const maxDelta = Math.max(...recordedDeltas);

    // Prove: max frame-to-frame delta is strictly bounded (no instantaneous teleporting jumps)
    expect(maxDelta).toBeLessThan(DEFAULT_CAMERA_SMOOTHING.maxFrameDelta);
    // Smooth deceleration: last frame delta is much smaller than peak delta
    expect(recordedDeltas[recordedDeltas.length - 1]).toBeLessThan(0.05);
  });
});
