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
import { Html } from '@react-three/drei';
import * as THREE from 'three';
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
    position: new THREE.Vector3(-0.5, 13.0, 26.0),
    target: new THREE.Vector3(0.0, 0.5, 0.0),
    fov: 54,
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

      {/* Chapter 1: Scan bracket box overlay */}
      {kinematics.isAtScanner && (
        <Html distanceFactor={6} position={[0, 0.55, 0]} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              border: '1px solid #f59e0b',
              padding: '2px 4px',
              fontSize: 8,
              fontFamily: 'monospace',
              color: '#fbbf24',
              background: 'rgba(8,10,14,0.85)',
              whiteSpace: 'nowrap',
            }}
          >
            [{item.id}] SCAN [SIMULATED]
          </div>
        </Html>
      )}

      {/* Chapter 4: Hover / Selection Telemetry Tooltip */}
      {decision && showLabel && (isSelected || isHovered) && (
        <Html distanceFactor={7} position={[0, 0.75, 0]} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: 'rgba(8,10,14,0.94)',
              border: `1px solid ${isHazard ? '#f59e0b' : '#475569'}`,
              padding: '5px 8px',
              fontSize: 9,
              fontFamily: 'monospace',
              color: '#e2e8f0',
              whiteSpace: 'nowrap',
              minWidth: 150,
            }}
          >
            <div style={{ color: '#fbbf24', fontWeight: 'bold', marginBottom: 2 }}>{item.id}</div>
            <div>
              p(haz):{' '}
              <span style={{ color: isHazard ? '#f87171' : '#34d399', fontWeight: 'bold' }}>
                {(item.hazardProbability * 100).toFixed(1)}%
              </span>
            </div>
            <div>gate: {decision.gateScore.toFixed(3)}</div>
            <div>
              route: <span style={{ color: '#fbbf24' }}>{decision.route}</span>
            </div>
            <div style={{ color: '#94a3b8', fontSize: 8 }}>[SIMULATED]</div>
          </div>
        </Html>
      )}
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

function Chapter0HeroReadout({ items }: { items: Item[] }) {
  return (
    <group position={[-3.5, 2.2, 1.2]}>
      {/* 3D leader line from HUD card down to belt surface */}
      <line>
        <bufferGeometry
          attach="geometry"
          onUpdate={(geo) => {
            geo.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1.3, -1.2)]);
          }}
        />
        <lineBasicMaterial attach="material" color="#f59e0b" opacity={0.4} transparent />
      </line>
      <Html distanceFactor={7.5} position={[0, 0, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: 'rgba(8,10,14,0.96)',
            border: '1px solid #334155',
            borderLeft: '3px solid #f59e0b',
            padding: '8px 12px',
            fontFamily: 'monospace',
            fontSize: 9,
            color: '#e2e8f0',
            width: 230,
            maxWidth: 'calc(100vw - 32px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.65)',
          }}
        >
          <div
            style={{
              color: '#fbbf24',
              fontWeight: 'bold',
              borderBottom: '1px solid #334155',
              paddingBottom: 4,
              marginBottom: 6,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>INGEST // BELT ACTIVE</span>
            <span
              style={{
                background: '#0284c7',
                color: '#f0f9ff',
                fontSize: 8,
                padding: '1px 5px',
                borderRadius: 2,
                fontWeight: 700,
              }}
            >
              [CALCULATED]
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 3, fontSize: 8.5 }}>
            <div>
              MANIFEST ITEMS:{' '}
              <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{items.length} TRACKED</span>
            </div>
            <div>
              EA-01 SAFETY FLOOR:{' '}
              <span style={{ color: '#ef4444', fontWeight: 'bold' }}>&ge; 0.30 P(HAZ) DIVERT</span>
            </div>
            <div>
              LINE VELOCITY: <span style={{ color: '#10b981' }}>1.2 m/s CONSTANT</span>
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}

function Chapter1ScanReadout({ items, isScanning }: { items: Item[]; isScanning: boolean }) {
  const avgConfidence =
    items.reduce((acc, it) => acc + (it.overallConfidence ?? 0.85), 0) / Math.max(1, items.length);
  const meanConfidence = Math.round(avgConfidence * 100);

  return (
    <group position={[-4.2, 2.7, 0.4]}>
      {/* 3D leader line down to scanner arch */}
      <line>
        <bufferGeometry
          attach="geometry"
          onUpdate={(geo) => {
            geo.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1.5, -0.4)]);
          }}
        />
        <lineBasicMaterial attach="material" color="#f59e0b" opacity={0.4} transparent />
      </line>
      <Html distanceFactor={7.0} position={[0, 0, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: 'rgba(8,10,14,0.96)',
            border: '1px solid #334155',
            borderLeft: '3px solid #f59e0b',
            padding: '8px 12px',
            fontFamily: 'monospace',
            fontSize: 9,
            color: '#e2e8f0',
            width: 230,
            maxWidth: 'calc(100vw - 32px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.65)',
          }}
        >
          <div
            style={{
              color: '#fbbf24',
              fontWeight: 'bold',
              borderBottom: '1px solid #334155',
              paddingBottom: 4,
              marginBottom: 6,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>STAGE 01 // SCAN PROPOSALS</span>
            <span
              style={{
                background: '#475569',
                color: '#f8fafc',
                fontSize: 8,
                padding: '1px 5px',
                borderRadius: 2,
                fontWeight: 700,
              }}
            >
              [SIMULATED]
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 3, fontSize: 8.5 }}>
            <div>
              SURFACE SCANNER:{' '}
              <span style={{ color: isScanning ? '#f59e0b' : '#10b981', fontWeight: 'bold' }}>
                {isScanning ? 'SWEEPING (AMBER)' : 'STANDBY READY'}
              </span>
            </div>
            <div>
              ANALYZED PROPOSALS:{' '}
              <span style={{ color: '#38bdf8' }}>{items.length} STREAM OBJECTS</span>
            </div>
            <div>
              MEAN CONFIDENCE:{' '}
              <span style={{ color: '#10b981', fontWeight: 'bold' }}>{meanConfidence}%</span>
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}

function Chapter2GateReadout({
  items,
  decisions,
  diverterAngle,
}: {
  items: Item[];
  decisions: ItemDecision[];
  diverterAngle: number;
}) {
  const item08 = items.find((i) => i.id === 'item-08');
  const item08Dec = decisions.find((d) => d.itemId === 'item-08');

  // Ambiguous item: item-04 (Coated Hot Beverage Paper Cup)
  const itemAmbiguous = items.find((i) => i.id === 'item-04');
  const itemAmbiguousDec = decisions.find((d) => d.itemId === 'item-04');

  return (
    <group position={[0.2, 2.2, 0.4]}>
      {/* 3D leader line down to diverter pivot */}
      <line>
        <bufferGeometry
          attach="geometry"
          onUpdate={(geo) => {
            geo.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.2, -1.2, -0.4)]);
          }}
        />
        <lineBasicMaterial attach="material" color="#f59e0b" opacity={0.4} transparent />
      </line>
      <Html distanceFactor={6.5} position={[0, 0, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: 'rgba(8,10,14,0.96)',
            border: '1px solid #f59e0b',
            borderLeft: '3px solid #f59e0b',
            padding: '8px 12px',
            fontFamily: 'monospace',
            fontSize: 9,
            color: '#e2e8f0',
            width: 250,
            maxWidth: 'calc(100vw - 32px)',
            transform: 'translateX(clamp(-90px, 0px, 0px))',
            boxShadow: '0 8px 24px rgba(0,0,0,0.65)',
          }}
        >
          <div
            style={{
              color: '#fbbf24',
              fontWeight: 'bold',
              borderBottom: '1px solid #334155',
              paddingBottom: 4,
              marginBottom: 6,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>STAGE 02 // GATE DECISION</span>
            <span
              style={{
                background: '#0284c7',
                color: '#f0f9ff',
                fontSize: 8,
                padding: '1px 5px',
                borderRadius: 2,
                fontWeight: 700,
              }}
            >
              [CALCULATED]
            </span>
          </div>

          <div style={{ marginBottom: 4, fontSize: 8, color: '#94a3b8' }}>
            DIVERTER ARM:{' '}
            <span
              style={{
                color: diverterAngle > 0.3 ? '#ef4444' : '#10b981',
                fontWeight: 'bold',
              }}
            >
              {diverterAngle > 0.3 ? 'EXTENDED (DIVERT)' : 'RETRACTED'}
            </span>
          </div>

          {/* Item 08 readout */}
          {item08 && item08Dec && (
            <div style={{ marginBottom: 6, borderBottom: '1px solid #1e293b', paddingBottom: 4 }}>
              <div style={{ color: '#ef4444', fontWeight: 'bold' }}>
                ITEM-08: {item08.name.slice(0, 22)}...
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, fontSize: 8 }}>
                <div>
                  p(haz):{' '}
                  <span style={{ color: '#ef4444', fontWeight: 'bold' }}>
                    {(item08.hazardProbability * 100).toFixed(1)}%
                  </span>
                </div>
                <div>gateScore: {item08Dec.gateScore.toFixed(3)}</div>
                <div>
                  route: <span style={{ color: '#fbbf24' }}>{item08Dec.route}</span>
                </div>
                <div>
                  floorTrigger: <span style={{ color: '#ef4444' }}>TRUE (EA-01)</span>
                </div>
              </div>
            </div>
          )}

          {/* Ambiguous item readout */}
          {itemAmbiguous && itemAmbiguousDec && (
            <div>
              <div style={{ color: '#93c5fd', fontWeight: 'bold' }}>
                ITEM-04: {itemAmbiguous.name.slice(0, 22)}...
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, fontSize: 8 }}>
                <div>p(haz): {(itemAmbiguous.hazardProbability * 100).toFixed(1)}%</div>
                <div>gateScore: {itemAmbiguousDec.gateScore.toFixed(3)}</div>
                <div>
                  route: <span style={{ color: '#fbbf24' }}>{itemAmbiguousDec.route}</span>
                </div>
                <div>
                  uncertainty: <span style={{ color: '#38bdf8' }}>HIGH (DISPUTED)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

function Chapter3RouteReadout({ decisions }: { decisions: ItemDecision[] }) {
  const hazardHoldCount = decisions.filter((d) => d.route === 'hazard_hold').length;
  const inspectionCount = decisions.filter((d) => d.route === 'inspection_line').length;
  const recyclableBayCount = decisions.filter((d) => d.route === 'recyclable_bay').length;
  const compactorCount = decisions.filter(
    (d) => d.route === 'recyclable_bay' || d.route === 'biodegradable_bay'
  ).length;

  return (
    <group position={[4.0, 2.6, 0.6]}>
      {/* 3D leader line down to compactor chute */}
      <line>
        <bufferGeometry
          attach="geometry"
          onUpdate={(geo) => {
            geo.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.2, -1.6, -0.6)]);
          }}
        />
        <lineBasicMaterial attach="material" color="#f59e0b" opacity={0.4} transparent />
      </line>
      <Html distanceFactor={7.0} position={[0, 0, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: 'rgba(8,10,14,0.96)',
            border: '1px solid #334155',
            borderLeft: '3px solid #f59e0b',
            padding: '8px 12px',
            fontFamily: 'monospace',
            fontSize: 9,
            color: '#e2e8f0',
            width: 240,
            maxWidth: 'calc(100vw - 32px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.65)',
          }}
        >
          <div
            style={{
              color: '#fbbf24',
              fontWeight: 'bold',
              borderBottom: '1px solid #334155',
              paddingBottom: 4,
              marginBottom: 6,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>STAGE 03 // ROUTE AUDIT</span>
            <span
              style={{
                background: '#0284c7',
                color: '#f0f9ff',
                fontSize: 8,
                padding: '1px 5px',
                borderRadius: 2,
                fontWeight: 700,
              }}
            >
              [CALCULATED]
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, fontSize: 8 }}>
            <div>
              HAZARD HOLD:{' '}
              <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{hazardHoldCount}</span>
            </div>
            <div>
              INSPECTION:{' '}
              <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{inspectionCount}</span>
            </div>
            <div>
              RECYCLABLE:{' '}
              <span style={{ color: '#10b981', fontWeight: 'bold' }}>{recyclableBayCount}</span>
            </div>
            <div>
              COMPACTOR:{' '}
              <span style={{ color: '#cbd5e1', fontWeight: 'bold' }}>{compactorCount}</span>
            </div>
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 7.5,
              color: '#94a3b8',
              borderTop: '1px solid #1e293b',
              paddingTop: 4,
            }}
          >
            In this simulated scenario: zero battery thermal events reach the compactor stream.
          </div>
        </div>
      </Html>
    </group>
  );
}

function Chapter5StreamsReadout({
  items,
  decisions,
}: {
  items: Item[];
  decisions: ItemDecision[];
}) {
  const recyclableCount = items.filter((i) => i.primaryClass === 'recyclable').length;
  const reusableCount = items.filter((i) => i.primaryClass === 'reusable').length;
  const compostCount = items.filter((i) => i.primaryClass === 'biodegradable').length;
  const hazardCount = decisions.filter((d) => d.route === 'hazard_hold').length;
  const total = Math.max(1, items.length);
  const diversionPct = (((items.length - hazardCount) / total) * 100).toFixed(1);

  return (
    <group position={[0.0, 3.8, 1.0]}>
      {/* 3D leader line down to facility center line */}
      <line>
        <bufferGeometry
          attach="geometry"
          onUpdate={(geo) => {
            geo.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -2.5, -1.0)]);
          }}
        />
        <lineBasicMaterial attach="material" color="#f59e0b" opacity={0.4} transparent />
      </line>
      <Html distanceFactor={8.0} position={[0, 0, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: 'rgba(8,10,14,0.96)',
            border: '1px solid #334155',
            borderLeft: '3px solid #f59e0b',
            padding: '8px 12px',
            fontFamily: 'monospace',
            fontSize: 9,
            color: '#e2e8f0',
            width: 250,
            maxWidth: 'calc(100vw - 32px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.65)',
          }}
        >
          <div
            style={{
              color: '#fbbf24',
              fontWeight: 'bold',
              borderBottom: '1px solid #334155',
              paddingBottom: 4,
              marginBottom: 6,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>STAGE 05 // STREAM TOTALS</span>
            <span
              style={{
                background: '#0284c7',
                color: '#f0f9ff',
                fontSize: 8,
                padding: '1px 5px',
                borderRadius: 2,
                fontWeight: 700,
              }}
            >
              [CALCULATED]
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, fontSize: 8 }}>
            <div>
              RECYCLABLE:{' '}
              <span style={{ color: '#10b981', fontWeight: 'bold' }}>{recyclableCount}</span>
            </div>
            <div>
              REUSABLE:{' '}
              <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{reusableCount}</span>
            </div>
            <div>
              COMPOST:{' '}
              <span style={{ color: '#a3e635', fontWeight: 'bold' }}>{compostCount}</span>
            </div>
            <div>
              HAZARD ISOLATED:{' '}
              <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{hazardCount}</span>
            </div>
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 8,
              color: '#f59e0b',
              borderTop: '1px solid #1e293b',
              paddingTop: 4,
            }}
          >
            TOTAL STREAM RETENTION: {diversionPct}%
          </div>
        </div>
      </Html>
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

        {/* Scroll-revealed floating HUD data tags with leader lines & provenance chips */}
        {chapter === 0 && <Chapter0HeroReadout items={items} />}
        {chapter === 1 && <Chapter1ScanReadout items={items} isScanning={isAnyScanning} />}
        {chapter === 2 && (
          <Chapter2GateReadout
            items={items}
            decisions={decisions}
            diverterAngle={diverterAngle}
          />
        )}
        {chapter === 3 && <Chapter3RouteReadout decisions={decisions} />}
        {chapter === 5 && <Chapter5StreamsReadout items={items} decisions={decisions} />}

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
