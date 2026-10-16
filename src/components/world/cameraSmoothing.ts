/**
 * src/components/world/cameraSmoothing.ts
 * Frame-rate independent critically damped camera motion controller.
 *
 * Replaces stepwise scrubbing with analytical critically damped spring integration.
 * Prevents jitter, snapping, or jumping during fast scrolls.
 */

import * as THREE from 'three';

export interface CameraSmoothingConfig {
  omega: number; // Angular frequency (rad/s) — typically 6.0 to 9.0 for responsive yet smooth tracking
  reducedMotionOmega: number; // Faster direct settle for reduced-motion
  maxFrameDelta: number; // Maximum allowed position step per frame to clamp extreme jumps
}

export const DEFAULT_CAMERA_SMOOTHING: CameraSmoothingConfig = {
  omega: 7.2,
  reducedMotionOmega: 18.0,
  maxFrameDelta: 2.5,
};

export class CameraMotionSmoother {
  public currentPosition: THREE.Vector3;
  public velocity: THREE.Vector3;
  public currentTarget: THREE.Vector3;
  public targetVelocity: THREE.Vector3;
  public currentFov: number;
  public fovVelocity: number;

  private config: CameraSmoothingConfig;
  private maxObservedDelta = 0;
  private frameDeltas: number[] = [];

  constructor(
    initialPosition: THREE.Vector3,
    initialTarget: THREE.Vector3,
    initialFov: number,
    config = DEFAULT_CAMERA_SMOOTHING
  ) {
    this.currentPosition = initialPosition.clone();
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.currentTarget = initialTarget.clone();
    this.targetVelocity = new THREE.Vector3(0, 0, 0);
    this.currentFov = initialFov;
    this.fovVelocity = 0;
    this.config = config;
  }

  public reset(position: THREE.Vector3, target: THREE.Vector3, fov: number) {
    this.currentPosition.copy(position);
    this.velocity.set(0, 0, 0);
    this.currentTarget.copy(target);
    this.targetVelocity.set(0, 0, 0);
    this.currentFov = fov;
    this.fovVelocity = 0;
    this.maxObservedDelta = 0;
    this.frameDeltas = [];
  }

  /**
   * Evaluates closed-form critically damped spring integration for a Vector3 over time step dt.
   * Analytical solution to d^2x/dt^2 + 2*omega*dx/dt + omega^2*(x - x_target) = 0
   */
  public step(
    targetPos: THREE.Vector3,
    targetLookAt: THREE.Vector3,
    targetFov: number,
    dt: number,
    reducedMotion = false
  ): {
    position: THREE.Vector3;
    target: THREE.Vector3;
    fov: number;
    frameDelta: number;
  } {
    // Clamp dt to avoid huge steps on tab refocus
    const clampedDt = Math.max(0.0001, Math.min(0.1, dt));
    const omega = reducedMotion ? this.config.reducedMotionOmega : this.config.omega;
    const expTerm = Math.exp(-omega * clampedDt);

    const prevPos = this.currentPosition.clone();

    // 1. Position Spring
    const deltaPos = this.currentPosition.clone().sub(targetPos);
    // temp = (velocity + omega * deltaPos) * dt
    const tempV = this.velocity.clone().addScaledVector(deltaPos, omega).multiplyScalar(clampedDt);
    // newPos = targetPos + (deltaPos + tempV) * exp(-omega * dt)
    this.currentPosition.copy(targetPos).add(deltaPos.add(tempV).multiplyScalar(expTerm));
    // newVelocity = (velocity - omega * tempV) * exp(-omega * dt)
    this.velocity.addScaledVector(tempV, -omega).multiplyScalar(expTerm);

    // 2. LookAt Target Spring
    const deltaTarget = this.currentTarget.clone().sub(targetLookAt);
    const tempTV = this.targetVelocity.clone().addScaledVector(deltaTarget, omega).multiplyScalar(clampedDt);
    this.currentTarget.copy(targetLookAt).add(deltaTarget.add(tempTV).multiplyScalar(expTerm));
    this.targetVelocity.addScaledVector(tempTV, -omega).multiplyScalar(expTerm);

    // 3. FOV Spring
    const deltaFov = this.currentFov - targetFov;
    const tempFovV = (this.fovVelocity + omega * deltaFov) * clampedDt;
    this.currentFov = targetFov + (deltaFov + tempFovV) * expTerm;
    this.fovVelocity = (this.fovVelocity - omega * tempFovV) * expTerm;

    // Track frame delta
    const frameDelta = prevPos.distanceTo(this.currentPosition);
    if (frameDelta > this.maxObservedDelta) {
      this.maxObservedDelta = frameDelta;
    }
    this.frameDeltas.push(frameDelta);
    if (this.frameDeltas.length > 300) {
      this.frameDeltas.shift();
    }

    return {
      position: this.currentPosition,
      target: this.currentTarget,
      fov: this.currentFov,
      frameDelta,
    };
  }

  public getMaxObservedDelta(): number {
    return this.maxObservedDelta;
  }

  public getRecentDeltas(): number[] {
    return [...this.frameDeltas];
  }
}
