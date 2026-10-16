'use client';

/**
 * WorldScene.tsx
 * The R3F inner scene for the full-viewport 3D world.
 * Driven by GSAP ScrollTrigger from parent World.tsx.
 * Chapters:
 *   0 = HERO: wide establishing shot, floating hazard objects (power bank, vape pen, phone)
 *   1 = SCAN: dolly to scanner gate, sweeping amber scan plane, item corner brackets
 *   2 = GATE: close-up at diverter with real engine readouts for item-08 & ambiguous item
 *   3 = ROUTE: side view of compactor & 3 terminal classification bins
 *   4 = RUN IT YOURSELF: orbit-limited interactive twin view, item hover & select
 *   5 = STREAMS & ASSUMPTIONS: elevated oblique view, world fades darker
 */

import React, { useRef, useMemo, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { WorldOverlayHandle } from './WorldOverlay';
import type { Item, RouteId } from '@/domain/types';
import type { ItemDecision } from '@/engine';
import { FacilityLine } from '../twin/FacilityLine';
import { ItemGeometry } from '../twin/ItemMesh';
import type { QualityTier } from './qualityTier';
import { TIER_CONFIGS } from './qualityTier';
import { Starfield } from './Starfield';
import { CameraMotionSmoother } from './cameraSmoothing';

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export interface SceneCameraState {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

export interface WorldSceneProps {
  items: Item[];
  decisions: ItemDecision[];
  currentTime: number;
  isPlaying: boolean;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  tier: QualityTier;
  onFpsUpdate?: (fps: number) => void;
  chapter: number; // 0-5
  interactionEnabled: boolean;
  reducedMotion: boolean;
  overlayRef?: React.RefObject<WorldOverlayHandle | null>;
}

export interface WorldSceneHandle {
  setCameraState: (state: SceneCameraState) => void;
  getCameraPosition: () => THREE.Vector3;
}

// ---------------------------------------------------------------------------
// 6 Visibly Distinct Chapter Camera States along the facility line
// ---------------------------------------------------------------------------

export const CHAPTER_CAMERA_STATES: SceneCameraState[] = [
  // 0: HERO — wide establishing shot looking down facility hall
  {
    position: new THREE.Vector3(-2.0, 9.5, 17.0),
    target: new THREE.Vector3(0.0, 0.8, 0.0),
    fov: 46,
  },
  // 1: SCAN — dolly into intake & scanner gate with sweeping plane
  {
    position: new THREE.Vector3(-5.8, 3.8, 7.5),
    target: new THREE.Vector3(-4.2, 1.1, 0.0),
    fov: 40,
  },
  // 2: GATE — close-up at diverter arm with engine telemetry readouts
  {
    position: new THREE.Vector3(1.4, 3.2, 5.8),
    target: new THREE.Vector3(0.4, 1.0, 0.0),
    fov: 38,
  },
  // 3: ROUTE — side profile showing compactor & classification bins
  {
    position: new THREE.Vector3(7.5, 4.8, 9.5),
    target: new THREE.Vector3(3.8, 0.7, 0.0),
    fov: 42,
  },
  // 4: RUN IT YOURSELF — interactive orbit view of complete line (all stations visible)
  {
    position: new THREE.Vector3(-0.5, 14.5, 32.0),
    target: new THREE.Vector3(0.0, 0.5, 0.0),
    fov: 52,
  },
  // 5: STREAMS & ASSUMPTIONS — pulled-back elevated oblique, darker world
  {
    position: new THREE.Vector3(0.0, 13.5, 21.0),
    target: new THREE.Vector3(0.0, 0.2, 0.0),
    fov: 50,
  },
];

// ---------------------------------------------------------------------------
// Item Kinematics
// ---------------------------------------------------------------------------

interface ItemKinematics {
  position: [number, number, number];
  rotation: [number, number, number];
  visible: boolean;
  stage: string;
  isAtScanner: boolean;
  isAtDiverter: boolean;
  isAtCompactor: boolean;
  settled: boolean;
}

function computeItemKinematics(
  itemIndex: number,
  currentTime: number,
  route: RouteId
): ItemKinematics {
  const itemStartTime = itemIndex * 2.0;
  const elapsed = currentTime - itemStartTime;
  const isDiverted = route === 'inspection_line' || route === 'hazard_hold';

  if (elapsed < 0) {
    return {
      position: [-9.2, 2.2 + itemIndex * 0.15, 0],
      rotation: [0, 0, 0],
      visible: false,
      stage: 'hopper',
      isAtScanner: false,
      isAtDiverter: false,
      isAtCompactor: false,
      settled: false,
    };
  }
  if (elapsed < 1.0) {
    const p = elapsed;
    return {
      position: [-9.0 + p * 2.5, 0.95, 0],
      rotation: [0, p * 0.5, 0],
      visible: true,
      stage: 'intake',
      isAtScanner: false,
      isAtDiverter: false,
      isAtCompactor: false,
      settled: false,
    };
  }
  if (elapsed < 2.0) {
    const p = elapsed - 1.0;
    return {
      position: [-6.5 + p * 2.0, 0.95, 0],
      rotation: [0, 0.5, 0],
      visible: true,
      stage: 'intake',
      isAtScanner: false,
      isAtDiverter: false,
      isAtCompactor: false,
      settled: false,
    };
  }
  if (elapsed < 3.0) {
    const p = elapsed - 2.0;
    const x = -4.5 + p * 4.5;
    return {
      position: [x, 0.95, 0],
      rotation: [0, 0.5 + p * 0.3, 0],
      visible: true,
      stage: 'scanning',
      isAtScanner: x >= -4.8 && x <= -1.0,
      isAtDiverter: false,
      isAtCompactor: false,
      settled: false,
    };
  }
  if (elapsed < 4.0) {
    const p = elapsed - 3.0;
    if (isDiverted) {
      return {
        position: [0.0, 0.95, p * 2.5],
        rotation: [0, p * Math.PI * 0.4, 0],
        visible: true,
        stage: 'diverting',
        isAtScanner: false,
        isAtDiverter: true,
        isAtCompactor: false,
        settled: false,
      };
    }
    return {
      position: [0.0 + p * 3.5, 0.95, 0],
      rotation: [0, 0.8, 0],
      visible: true,
      stage: 'diverting',
      isAtScanner: false,
      isAtDiverter: false,
      isAtCompactor: false,
      settled: false,
    };
  }
  if (elapsed < 5.5) {
    const p = (elapsed - 4.0) / 1.5;
    if (isDiverted) {
      return {
        position: [0.0, 0.95 - p * 0.1, 2.5 + p * 1.5],
        rotation: [0, Math.PI * 0.4, 0],
        visible: true,
        stage: 'routed',
        isAtScanner: false,
        isAtDiverter: false,
        isAtCompactor: false,
        settled: p > 0.9,
      };
    }
    return {
      position: [3.5 + p * 2.5, 0.95, 0],
      rotation: [0, 0.8, 0],
      visible: true,
      stage: 'compacting',
      isAtScanner: false,
      isAtDiverter: false,
      isAtCompactor: p > 0.3,
      settled: false,
    };
  }
  return {
    position: isDiverted
      ? [0.0, 0.8, 4.0]
      : [6.0 + (itemIndex % 3) * 0.4, 0.5, (itemIndex % 3) * 0.3 - 0.3],
    rotation: [0, itemIndex * 0.7, 0],
    visible: elapsed < 12,
    stage: 'routed',
    isAtScanner: false,
    isAtDiverter: false,
    isAtCompactor: false,
    settled: true,
  };
}

// ---------------------------------------------------------------------------
// Animated Item Component with smooth hover lift
// ---------------------------------------------------------------------------

interface AnimatedItemProps {
  item: Item;
  decision?: ItemDecision;
  kinematics: ItemKinematics;
  isSelected: boolean;
  onSelect: () => void;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  showLabel: boolean;
  interactionEnabled: boolean;
}

function AnimatedItem({
  item,
  decision,
  kinematics,
  isSelected,
  onSelect,
  isHovered,
  onHover,
  showLabel,
  interactionEnabled,
}: AnimatedItemProps) {
  const meshRef = useRef<THREE.Group>(null);
  const liftTarget = useRef(0);
  const liftCurrent = useRef(0);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    liftTarget.current = isHovered || isSelected ? 0.35 : 0;
    liftCurrent.current += (liftTarget.current - liftCurrent.current) * Math.min(1, delta * 9);
    meshRef.current.position.set(
      kinematics.position[0],
      kinematics.position[1] + liftCurrent.current,
      kinematics.position[2]
    );
    meshRef.current.rotation.set(
      kinematics.rotation[0],
      kinematics.rotation[1],
      kinematics.rotation[2]
    );
  });

  if (!kinematics.visible) return null;

  const isHazard =
    (item.hazardProbability !== undefined && item.hazardProbability >= 0.30) ||
    item.primaryClass === 'hazardous';

  return (
    <group ref={meshRef}>
      <group
        onClick={interactionEnabled ? onSelect : undefined}
        onPointerOver={interactionEnabled ? () => onHover(item.id) : undefined}
        onPointerOut={interactionEnabled ? () => onHover(null) : undefined}
      >
        <ItemGeometry
          itemId={item.id}
          name={item.name}
          primaryClass={item.primaryClass}
          hazardProbability={item.hazardProbability}
          cropTextureUrl={item.notes?.startsWith('data:image') ? item.notes : undefined}
          isSelected={isSelected}
          isHovered={isHovered}
          isFloorTriggered={isHazard}
        />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Hero Floating Objects (power bank, vape pen, phone)
// ---------------------------------------------------------------------------

function HeroFloatingHazards({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (reducedMotion || !groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      child.position.y = 3.6 + Math.sin(t * 0.45 + i * 1.3) * 0.35;
      child.rotation.y = t * 0.25 + i * ((Math.PI * 2) / 3);
      child.rotation.x = Math.sin(t * 0.35 + i) * 0.18;
    });
  });

  return (
    <group ref={groupRef} position={[0, 3.6, 0]}>
      {/* Power bank */}
      <mesh position={[-3.2, 0, 1.2]} castShadow>
        <boxGeometry args={[0.7, 0.28, 1.1]} />
        <meshStandardMaterial
          color="#243042"
          roughness={0.25}
          metalness={0.7}
          emissive="#d97706"
          emissiveIntensity={0.25}
        />
      </mesh>
      {/* Vape pen */}
      <mesh position={[0.2, 0, -1.2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.95, 12]} />
        <meshStandardMaterial
          color="#1e293b"
          roughness={0.2}
          metalness={0.8}
          emissive="#f59e0b"
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* Phone */}
      <mesh position={[3.2, 0, 0.6]} castShadow>
        <boxGeometry args={[0.42, 0.07, 0.85]} />
        <meshStandardMaterial
          color="#1e293b"
          roughness={0.15}
          metalness={0.9}
          emissive="#b45309"
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* Dedicated accent lights (amber only) */}
      <pointLight position={[-3.2, 1.2, 1.2]} intensity={0.7} color="#f59e0b" distance={4} />
      <pointLight position={[0.2, 1.2, -1.2]} intensity={0.6} color="#f59e0b" distance={3.5} />
      <pointLight position={[3.2, 1.2, 0.6]} intensity={0.7} color="#f59e0b" distance={4} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Floor With Custom Ripple Shader
// ---------------------------------------------------------------------------

function FloorWithRipple({
  pointerWorld,
  rippleDensity,
  reducedMotion,
  receiveShadow,
}: {
  pointerWorld: React.MutableRefObject<THREE.Vector3>;
  rippleDensity: number;
  reducedMotion: boolean;
  receiveShadow: boolean;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.uPointer.value.copy(pointerWorld.current);
      materialRef.current.uniforms.uRippleStrength.value = reducedMotion ? 0.0 : 0.08;
    }
  });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector3(0, 0, 0) },
      uRippleStrength: { value: 0.08 },
      uColor: { value: new THREE.Color('#222936') },
      uGridColor: { value: new THREE.Color('#475569') },
      uHighlightColor: { value: new THREE.Color('#f59e0b') },
    }),
    []
  );

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
      receiveShadow={receiveShadow}
    >
      <planeGeometry args={[44, 32, rippleDensity, rippleDensity]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={`
          uniform vec3 uPointer;
          uniform float uTime;
          uniform float uRippleStrength;
          varying vec2 vUv;
          varying vec2 vWorldPos;
          varying float vDist;
          varying float vWave;

          void main() {
            vUv = uv;
            vec3 pos = position;
            // Plane rotated -PI/2 on X: pos.x = world X, pos.y = -world Z
            float dx = pos.x - uPointer.x;
            float dz = -pos.y - uPointer.z;
            float dist = sqrt(dx * dx + dz * dz);
            vDist = dist;
            vWorldPos = pos.xy;

            float wave = 0.0;
            if (dist < 12.0 && uRippleStrength > 0.001) {
              wave = sin(dist * 2.8 - uTime * 5.0) * exp(-dist * 0.35) * uRippleStrength;
              pos.z += wave;
            }
            vWave = wave;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          uniform vec3 uGridColor;
          uniform vec3 uHighlightColor;
          varying vec2 vUv;
          varying vec2 vWorldPos;
          varying float vDist;
          varying float vWave;

          void main() {
            vec2 grid = abs(fract(vUv * vec2(44.0, 32.0) - 0.5) - 0.5) / fwidth(vUv * vec2(44.0, 32.0));
            float line = min(grid.x, grid.y);
            float c = 1.0 - min(line, 1.0);

            vec3 base = mix(uColor, uGridColor, c * 0.7);
            if (vDist < 10.0 && abs(vWave) > 0.004) {
              base = mix(base, uHighlightColor, smoothstep(0.004, 0.05, abs(vWave)) * 0.3);
            }

            // Horizon fade into deep background #070a0d (0.02745, 0.0392, 0.05098)
            float distFromCenter = length(vWorldPos);
            float horizonFade = smoothstep(22.0, 11.0, distFromCenter);
            vec3 bgCol = vec3(0.02745, 0.0392, 0.05098);
            vec3 finalColor = mix(bgCol, base, horizonFade);

            gl_FragColor = vec4(finalColor, 1.0);
          }
        `}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Pointer Spotlight (follows mouse on floor plane)
// ---------------------------------------------------------------------------

function PointerSpotlight({
  pointerWorld,
}: {
  pointerWorld: React.MutableRefObject<THREE.Vector3>;
}) {
  const lightRef = useRef<THREE.PointLight>(null);
  const currentPos = useRef(new THREE.Vector3(0, 0, 0));

  useFrame((_, delta) => {
    if (!lightRef.current) return;
    currentPos.current.lerp(
      new THREE.Vector3(pointerWorld.current.x, 2.5, pointerWorld.current.z),
      Math.min(1, delta * 6)
    );
    lightRef.current.position.copy(currentPos.current);
  });

  return <pointLight ref={lightRef} intensity={0.9} color="#f0e8c0" distance={8} decay={2} />;
}

// ---------------------------------------------------------------------------
// Light Sweep
// ---------------------------------------------------------------------------

function LightSweep({ reducedMotion }: { reducedMotion: boolean }) {
  const lightRef = useRef<THREE.SpotLight>(null);

  useFrame((state) => {
    if (reducedMotion || !lightRef.current) return;
    const t = state.clock.elapsedTime * 0.12;
    lightRef.current.position.x = Math.sin(t) * 12;
    lightRef.current.position.z = Math.cos(t * 0.7) * 6;
  });

  if (reducedMotion) return null;

  return (
    <spotLight
      ref={lightRef}
      position={[0, 16, 0]}
      intensity={0.35}
      color="#d8e4fc"
      angle={0.28}
      penumbra={0.7}
      distance={32}
      castShadow={false}
    />
  );
}

// ---------------------------------------------------------------------------
// Scroll-Revealed Floating HUD Readouts with Leader Lines & Provenance Chips
// ---------------------------------------------------------------------------

function Chapter0HeroReadout() {
  return (
    <group position={[-3.5, 2.2, 1.2]}>
      <line>
        <bufferGeometry
          attach="geometry"
          onUpdate={(geo) => {
            geo.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1.3, -1.2)]);
          }}
        />
        <lineBasicMaterial attach="material" color="#f59e0b" opacity={0.4} transparent />
      </line>
    </group>
  );
}

function Chapter1ScanReadout() {
  return (
    <group position={[-4.2, 2.7, 0.4]}>
      <line>
        <bufferGeometry
          attach="geometry"
          onUpdate={(geo) => {
            geo.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1.5, -0.4)]);
          }}
        />
        <lineBasicMaterial attach="material" color="#f59e0b" opacity={0.4} transparent />
      </line>
    </group>
  );
}

function Chapter2GateReadout() {
  return (
    <group position={[0.2, 2.2, 0.4]}>
      <line>
        <bufferGeometry
          attach="geometry"
          onUpdate={(geo) => {
            geo.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.2, -1.2, -0.4)]);
          }}
        />
        <lineBasicMaterial attach="material" color="#f59e0b" opacity={0.4} transparent />
      </line>
    </group>
  );
}

function Chapter3RouteReadout() {
  return (
    <group position={[4.0, 2.6, 0.6]}>
      <line>
        <bufferGeometry
          attach="geometry"
          onUpdate={(geo) => {
            geo.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.2, -1.6, -0.6)]);
          }}
        />
        <lineBasicMaterial attach="material" color="#f59e0b" opacity={0.4} transparent />
      </line>
    </group>
  );
}

function Chapter5StreamsReadout() {
  return (
    <group position={[0.0, 3.8, 1.0]}>
      <line>
        <bufferGeometry
          attach="geometry"
          onUpdate={(geo) => {
            geo.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -2.5, -1.0)]);
          }}
        />
        <lineBasicMaterial attach="material" color="#f59e0b" opacity={0.4} transparent />
      </line>
    </group>
  );
}

// ---------------------------------------------------------------------------
// 3D Faceted Cursor Probe rendered directly in WebGL (scaled down 25%)
// ---------------------------------------------------------------------------

function CursorProbe3D({
  pointerNDC,
  reducedMotion,
  isInteractive,
}: {
  pointerNDC: React.MutableRefObject<THREE.Vector2>;
  reducedMotion: boolean;
  isInteractive: boolean;
}) {
  const { camera } = useThree();
  const probeRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Mesh>(null);
  const targetPos = useRef(new THREE.Vector3());
  const currentPos = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    if (reducedMotion || !probeRef.current) return;

    // Unproject pointer to a plane 2.8 units in front of camera
    const ndc = pointerNDC.current;
    const v = new THREE.Vector3(ndc.x, ndc.y, 0.5);
    v.unproject(camera);
    const dir = v.sub(camera.position).normalize();
    targetPos.current.copy(camera.position).add(dir.multiplyScalar(2.8));

    currentPos.current.lerp(targetPos.current, Math.min(1, delta * 12));
    probeRef.current.position.copy(currentPos.current);
    probeRef.current.quaternion.copy(camera.quaternion);

    // Spin faster when over interactive chapter
    if (spinRef.current) {
      const speed = isInteractive ? 4.5 : 1.5;
      spinRef.current.rotation.z += delta * speed;
    }
  });

  if (reducedMotion) return null;

  return (
    <group ref={probeRef}>
      {/* Outer faceted hexagonal ring (scaled down 25%) */}
      <mesh ref={spinRef}>
        <torusGeometry args={[0.06, 0.00675, 6, 6]} />
        <meshBasicMaterial
          color={isInteractive ? '#f59e0b' : '#94a3b8'}
          wireframe
          transparent
          opacity={0.8}
        />
      </mesh>
      {/* Core sphere (scaled down 25%) */}
      <mesh>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshBasicMaterial color={isInteractive ? '#f59e0b' : '#cbd5e1'} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ambient Belt Scanner Beam Sweeping
// ---------------------------------------------------------------------------

function AmbientBeltAnimation({ reducedMotion }: { reducedMotion: boolean }) {
  const scanRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    if (reducedMotion || !scanRef.current) return;
    scanRef.current.opacity = 0.25 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
  });

  if (reducedMotion) return null;

  return (
    <mesh rotation={[0, 0, 0]} position={[-4.5, 1.2, 0]}>
      <planeGeometry args={[0.06, 2.5]} />
      <meshBasicMaterial
        ref={scanRef}
        color="#f59e0b"
        transparent
        opacity={0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// FPS Tracker
// ---------------------------------------------------------------------------

interface FpsTrackerProps {
  onFpsUpdate?: (fps: number) => void;
  tier: QualityTier;
}

function FpsTracker({ onFpsUpdate }: FpsTrackerProps) {
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useFrame(() => {
    frameCount.current++;
    const now = performance.now();
    const elapsed = now - lastTime.current;
    if (elapsed >= 500) {
      const fps = Math.round((frameCount.current * 1000) / elapsed);
      frameCount.current = 0;
      lastTime.current = now;
      onFpsUpdate?.(fps);
    }
  });

  return null;
}

// ---------------------------------------------------------------------------
// Camera Rig (lerps to target position & lookAt driven by ScrollTrigger)
// ---------------------------------------------------------------------------

interface CameraRigProps {
  targetPosition: React.MutableRefObject<THREE.Vector3>;
  targetLookAt: React.MutableRefObject<THREE.Vector3>;
  targetFov: React.MutableRefObject<number>;
  parallaxOffset: React.MutableRefObject<THREE.Vector2>;
  reducedMotion: boolean;
}

function CameraRig({
  targetPosition,
  targetLookAt,
  targetFov,
  parallaxOffset,
  reducedMotion,
}: CameraRigProps) {
  const { camera, size } = useThree();
  const smootherRef = useRef<CameraMotionSmoother | null>(null);
  if (!smootherRef.current) {
    smootherRef.current = new CameraMotionSmoother(
      CHAPTER_CAMERA_STATES[0].position,
      CHAPTER_CAMERA_STATES[0].target,
      CHAPTER_CAMERA_STATES[0].fov
    );
  }

  useFrame((_, delta) => {
    // Dynamic FOV scaling for narrow viewports (< 1.1 aspect ratio) so entire line is visible
    const aspect = size.width / Math.max(1, size.height);
    const aspectScale = aspect < 1.1 ? Math.min(1.5, 1.1 / Math.max(0.4, aspect)) : 1.0;
    const effectiveFov = targetFov.current * aspectScale;

    const px = parallaxOffset.current.x * 1.4;
    const py = parallaxOffset.current.y * 0.8;
    const posWithParallax = targetPosition.current.clone().add(new THREE.Vector3(px, py, 0));

    const state = smootherRef.current!.step(
      posWithParallax,
      targetLookAt.current,
      effectiveFov,
      delta,
      reducedMotion
    );

    camera.position.copy(state.position);
    camera.lookAt(state.target);

    (camera as THREE.PerspectiveCamera).fov = state.fov;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  });

  return null;
}

// ---------------------------------------------------------------------------
// Main WorldScene
// ---------------------------------------------------------------------------

export const WorldScene = forwardRef<WorldSceneHandle, WorldSceneProps>(function WorldScene(
  {
    items,
    decisions,
    currentTime,
    isPlaying,
    selectedItemId,
    onSelectItem,
    tier,
    onFpsUpdate,
    chapter,
    interactionEnabled,
    reducedMotion,
    overlayRef,
  },
  ref
) {
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  const targetPosition = useRef(new THREE.Vector3().copy(CHAPTER_CAMERA_STATES[0].position));
  const targetLookAt = useRef(new THREE.Vector3().copy(CHAPTER_CAMERA_STATES[0].target));
  const targetFov = useRef<number>(CHAPTER_CAMERA_STATES[0].fov);
  const parallaxOffset = useRef(new THREE.Vector2(0, 0));
  const pointerNDC = useRef(new THREE.Vector2(0, 0));
  const pointerWorld = useRef(new THREE.Vector3(0, 0, 0));
  const projVec = useMemo(() => new THREE.Vector3(), []);

  useImperativeHandle(ref, () => ({
    setCameraState(state: SceneCameraState) {
      targetPosition.current.copy(state.position);
      targetLookAt.current.copy(state.target);
      targetFov.current = state.fov;
    },
    getCameraPosition() {
      return targetPosition.current.clone();
    },
  }));

  const { camera } = useThree();

  // Window-level mousemove tracking for parallax and floor spotlight
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -((e.clientY / window.innerHeight) * 2 - 1);
      pointerNDC.current.set(nx, ny);
      parallaxOffset.current.set(nx * 0.05, ny * 0.035);

      // Raycast to floor plane
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersection = new THREE.Vector3();
      raycaster.ray.intersectPlane(floorPlane, intersection);
      if (intersection) pointerWorld.current.copy(intersection);
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMove);
  }, [camera]);

  // Item kinematics calculations
  const decisionMap = useMemo(() => new Map(decisions.map((d) => [d.itemId, d])), [decisions]);

  const itemKinematicsList = useMemo(() => {
    return items.map((item, index) => {
      const decision = decisionMap.get(item.id);
      const route = decision?.route ?? 'recyclable_bay';
      return { item, decision, kinematics: computeItemKinematics(index, currentTime, route) };
    });
  }, [items, decisionMap, currentTime]);

  const isAnyScanning = useMemo(
    () => itemKinematicsList.some((ik) => ik.kinematics.isAtScanner),
    [itemKinematicsList]
  );

  const diverterAngle = useMemo(() => {
    const active = itemKinematicsList.find(
      (ik) =>
        ik.kinematics.isAtDiverter &&
        (ik.decision?.route === 'inspection_line' || ik.decision?.route === 'hazard_hold')
    );
    return active ? 0.78 : 0;
  }, [itemKinematicsList]);

  const compactorOffset = useMemo(() => {
    return itemKinematicsList.some((ik) => ik.kinematics.isAtCompactor) ? 1.0 : 0;
  }, [itemKinematicsList]);

  const { shadows, shadowMapSize, rippleDensity } = TIER_CONFIGS[tier];

  // Fade world down in final chapter
  const worldOpacity = chapter >= 5 ? 0.45 : 1.0;

  // Project 3D station tags and active item HUDs into DOM overlay
  useFrame(({ camera, size }) => {
    if (!overlayRef?.current) return;

    // Station badges
    const stationPositions = [
      { idx: 0, pos: [-3.5, 2.2, 1.2], ch: 0 },
      { idx: 1, pos: [-4.2, 2.7, 0.4], ch: 1 },
      { idx: 2, pos: [0.2, 2.2, 0.4], ch: 2 },
      { idx: 3, pos: [4.0, 2.6, 0.6], ch: 3 },
      { idx: 4, pos: [0.0, 3.8, 1.0], ch: 5 },
    ];

    stationPositions.forEach(({ idx, pos, ch }) => {
      projVec.set(pos[0], pos[1], pos[2]).project(camera);
      const isBehind = projVec.z > 1.0;
      const x = (projVec.x * 0.5 + 0.5) * size.width;
      const y = (-(projVec.y * 0.5) + 0.5) * size.height;
      const opacity = chapter === ch ? 1.0 : 0.0;
      overlayRef.current?.updateStation(idx, x, y, opacity, isBehind);
    });

    // Scanner item bracket
    const scanningItem = itemKinematicsList.find((ik) => ik.kinematics.isAtScanner);
    if (scanningItem && (chapter === 1 || chapter === 4)) {
      const [kx, ky, kz] = scanningItem.kinematics.position;
      projVec.set(kx, ky + 0.55, kz).project(camera);
      const isBehind = projVec.z > 1.0;
      const x = (projVec.x * 0.5 + 0.5) * size.width;
      const y = (-(projVec.y * 0.5) + 0.5) * size.height;
      overlayRef.current.updateScanBracket(x, y, 1.0, isBehind, scanningItem.item.id);
    } else {
      overlayRef.current.updateScanBracket(0, 0, 0, true);
    }

    // Hovered or selected item telemetry
    const targetItemId = hoveredItemId || selectedItemId;
    const activeItem = targetItemId
      ? itemKinematicsList.find((ik) => ik.item.id === targetItemId)
      : null;

    if (activeItem && chapter === 4 && interactionEnabled) {
      const [ax, ay, az] = activeItem.kinematics.position;
      projVec.set(ax, ay + 0.75, az).project(camera);
      const isBehind = projVec.z > 1.0;
      const x = (projVec.x * 0.5 + 0.5) * size.width;
      const y = (-(projVec.y * 0.5) + 0.5) * size.height;
      overlayRef.current.updateItemTelemetry(x, y, 1.0, isBehind, {
        id: activeItem.item.id,
        name: activeItem.item.name,
        hazardProbability: activeItem.item.hazardProbability,
        gateScore: activeItem.decision?.gateScore ?? 0,
        route: activeItem.decision?.route ?? 'unknown',
        isHazard: activeItem.item.hazardProbability >= 0.30,
      });
    } else {
      overlayRef.current.updateItemTelemetry(0, 0, 0, true);
    }
  });

  return (
    <>
      <color attach="background" args={['#070a0d']} />
      <fog attach="fog" args={['#070a0d', 26, 54]} />

      {/* Night-sky Starfield Backdrop with 3 depth layers & twinkling cool stars */}
      <Starfield
        tier={tier}
        reducedMotion={reducedMotion}
        parallaxOffset={parallaxOffset}
        scrollProgress={chapter / 5}
      />

      {/* Lighting: boosted ambient, hemisphere, warm key, and facility rim lights */}
      <hemisphereLight args={['#dbeafe', '#1e293b', chapter >= 5 ? 0.45 : 0.85]} />
      <ambientLight intensity={chapter >= 5 ? 0.35 : 0.75} />
      <directionalLight
        position={[-6, 18, 12]}
        intensity={chapter >= 5 ? 0.9 : 1.8}
        color="#fff5e6"
        castShadow={shadows}
        shadow-mapSize={shadowMapSize}
        shadow-bias={-0.0001}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      {/* Cool rim from right */}
      <directionalLight position={[12, 10, -8]} intensity={chapter >= 5 ? 0.35 : 0.7} color="#bfdbfe" />
      {/* Front-fill from below */}
      <directionalLight position={[0, -2, 12]} intensity={0.25} color="#94a3b8" />
      {/* Direct facility rim targeting belt, compactor, and bins */}
      <directionalLight position={[6, 8, 8]} intensity={0.65} color="#e0f2fe" />

      {/* Dynamic floor ripple with pointer vertex displacement */}
      <FloorWithRipple
        pointerWorld={pointerWorld}
        rippleDensity={rippleDensity}
        reducedMotion={reducedMotion}
        receiveShadow={shadows}
      />

      {/* Pointer floor spotlight */}
      {!reducedMotion && <PointerSpotlight pointerWorld={pointerWorld} />}

      {/* Roving light sweep */}
      <LightSweep reducedMotion={reducedMotion} />

      {/* Facility Group */}
      <group>
        <FacilityLine
          isScanning={isAnyScanning}
          diverterAngle={diverterAngle}
          compactorOffset={compactorOffset}
          lowPowerMode={tier === 'LOW'}
          hideFloor={true}
        />

        {/* Animated items along the line */}
        {itemKinematicsList.map(({ item, decision, kinematics }) => (
          <AnimatedItem
            key={item.id}
            item={item}
            decision={decision}
            kinematics={kinematics}
            isSelected={selectedItemId === item.id}
            onSelect={() => onSelectItem(item.id)}
            isHovered={hoveredItemId === item.id}
            onHover={setHoveredItemId}
            showLabel={chapter === 4}
            interactionEnabled={interactionEnabled}
          />
        ))}

        {/* Hero floating hazards in Chapter 0 */}
        {chapter === 0 && <HeroFloatingHazards reducedMotion={reducedMotion} />}

        {/* Scroll-revealed 3D leader lines */}
        {chapter === 0 && <Chapter0HeroReadout />}
        {chapter === 1 && <Chapter1ScanReadout />}
        {chapter === 2 && <Chapter2GateReadout />}
        {chapter === 3 && <Chapter3RouteReadout />}
        {chapter === 5 && <Chapter5StreamsReadout />}

        {/* Ambient belt animation */}
        <AmbientBeltAnimation reducedMotion={reducedMotion} />
      </group>

      {/* 3D Faceted Cursor Probe */}
      <CursorProbe3D
        pointerNDC={pointerNDC}
        reducedMotion={reducedMotion}
        isInteractive={interactionEnabled}
      />

      {/* Scroll-driven Camera Rig */}
      <CameraRig
        targetPosition={targetPosition}
        targetLookAt={targetLookAt}
        targetFov={targetFov}
        parallaxOffset={parallaxOffset}
        reducedMotion={reducedMotion}
      />

      {/* FPS tracking */}
      <FpsTracker onFpsUpdate={onFpsUpdate} tier={tier} />
    </>
  );
});

export default WorldScene;
