'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Item, RouteId } from '@/domain/types';
import type { ItemDecision } from '@/engine';
import { FacilityLine } from './FacilityLine';
import { ItemGeometry } from './ItemMesh';

export interface SentinelSceneProps {
  items: Item[];
  decisions: ItemDecision[];
  currentTime: number; // seconds (0 to ~45s)
  isPlaying: boolean;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  lowPowerMode: boolean;
  onFpsUpdate?: (fps: number) => void;
  cameraResetKey?: number;
}

// ---------------------------------------------------------------------------
// Kinematic Position Calculation
// ---------------------------------------------------------------------------

interface ItemKinematics {
  position: [number, number, number];
  rotation: [number, number, number];
  visible: boolean;
  stage: 'hopper' | 'intake' | 'scanning' | 'diverting' | 'compacting' | 'routed';
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
  const itemStartTime = itemIndex * 2.0; // 2 seconds between intake items
  const elapsed = currentTime - itemStartTime;

  if (elapsed < 0) {
    // Waiting in hopper
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

  const isDiverted = route === 'inspection_line' || route === 'hazard_hold';

  // 0 to 1s: Hopper discharge onto conveyor bed
  if (elapsed < 1.0) {
    const p = elapsed / 1.0;
    const x = -9.0 + p * 2.5; // -9.0 to -6.5
    const y = 0.95;
    return {
      position: [x, y, 0],
      rotation: [0, p * 0.5, 0],
      visible: true,
      stage: 'intake',
      isAtScanner: false,
      isAtDiverter: false,
      isAtCompactor: false,
      settled: false,
    };
  }

  // 1.0 to 2.0s: Belt travel to scanner gate (X = -6.5 to -4.5)
  if (elapsed < 2.0) {
    const p = (elapsed - 1.0) / 1.0;
    const x = -6.5 + p * 2.0; // -6.5 to -4.5
    return {
      position: [x, 0.95, 0],
      rotation: [0, 0.5, 0],
      visible: true,
      stage: 'intake',
      isAtScanner: false,
      isAtDiverter: false,
      isAtCompactor: false,
      settled: false,
    };
  }

  // 2.0 to 3.0s: Moving through SCANNER GATE (X = -4.5 to 0.0)
  if (elapsed < 3.0) {
    const p = (elapsed - 2.0) / 1.0;
    const x = -4.5 + p * 4.5; // -4.5 to 0.0
    const isScanning = x >= -4.8 && x <= -4.0;
    return {
      position: [x, 0.95, 0],
      rotation: [0, 0.5 + p * 0.2, 0],
      visible: true,
      stage: isScanning ? 'scanning' : 'intake',
      isAtScanner: isScanning,
      isAtDiverter: false,
      isAtCompactor: false,
      settled: false,
    };
  }

  // 3.0 to 4.2s: DIVERTER STATION (X = 0.0) - Branching
  if (elapsed < 4.2) {
    const p = (elapsed - 3.0) / 1.2;
    if (isDiverted) {
      // Diverted to spur: pushes item toward +Z
      const x = p * 0.2; // slight shift
      const z = p * 2.4; // 0 to 2.4
      return {
        position: [x, 0.92, z],
        rotation: [0, 0.7 + p * 0.8, 0],
        visible: true,
        stage: 'diverting',
        isAtScanner: false,
        isAtDiverter: true,
        isAtCompactor: false,
        settled: false,
      };
    } else {
      // Straight to compactor: moves X = 0.0 to 4.5
      const x = p * 4.5; // 0 to 4.5
      return {
        position: [x, 0.95, 0],
        rotation: [0, 0.7, 0],
        visible: true,
        stage: 'intake',
        isAtScanner: false,
        isAtDiverter: false,
        isAtCompactor: x >= 4.0 && x <= 5.0,
        settled: false,
      };
    }
  }

  // 4.2 to 5.5s: Final transit into designated bay/station
  if (elapsed < 5.5) {
    const p = (elapsed - 4.2) / 1.3;
    if (isDiverted) {
      // Move from Z = 2.4 to Z = 4.8
      const z = 2.4 + p * 2.4;
      const targetX = route === 'hazard_hold' ? 0.85 : -0.6;
      const x = p * targetX;
      const y = 0.92 + p * 0.25; // onto raised desk/vault
      return {
        position: [x, y, z],
        rotation: [0, 1.5, 0],
        visible: true,
        stage: 'diverting',
        isAtScanner: false,
        isAtDiverter: false,
        isAtCompactor: false,
        settled: false,
      };
    } else {
      // Move from X = 4.5 through compactor to classification bin
      let targetX = 8.5;
      let targetZ = -1.5;
      if (route === 'reusable_bay') {
        targetX = 10.9;
        targetZ = -1.5;
      } else if (route === 'biodegradable_bay') {
        targetX = 8.5;
        targetZ = 0.5;
      } else if (route === 'compactor') {
        targetX = 10.9;
        targetZ = 0.5;
      }
      const x = 4.5 + p * (targetX - 4.5);
      const z = p * targetZ;
      return {
        position: [x, 0.95 - p * 0.35, z],
        rotation: [p * 0.4, 0.7, 0],
        visible: true,
        stage: 'compacting',
        isAtScanner: false,
        isAtDiverter: false,
        isAtCompactor: p < 0.3,
        settled: false,
      };
    }
  }

  // > 5.5s: Settled in destination bay
  if (isDiverted) {
    const targetX = route === 'hazard_hold' ? 0.85 : -0.6;
    const jitter = (itemIndex % 3) * 0.15;
    return {
      position: [targetX + (itemIndex % 2 ? jitter : -jitter), 1.18, 4.8 + jitter * 0.5],
      rotation: [0, 1.57, 0],
      visible: true,
      stage: 'routed',
      isAtScanner: false,
      isAtDiverter: false,
      isAtCompactor: false,
      settled: true,
    };
  } else {
    let targetX = 8.5;
    let targetZ = -1.5;
    if (route === 'reusable_bay') {
      targetX = 10.9;
      targetZ = -1.5;
    } else if (route === 'biodegradable_bay') {
      targetX = 8.5;
      targetZ = 0.5;
    } else if (route === 'compactor') {
      targetX = 10.9;
      targetZ = 0.5;
    }
    const stackOffsetX = ((itemIndex % 4) - 1.5) * 0.3;
    const stackOffsetZ = ((itemIndex % 2) - 0.5) * 0.3;
    return {
      position: [targetX + stackOffsetX, 0.62, targetZ + stackOffsetZ],
      rotation: [0.1, (itemIndex % 5) * 0.6, 0.05],
      visible: true,
      stage: 'routed',
      isAtScanner: false,
      isAtDiverter: false,
      isAtCompactor: false,
      settled: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Camera Drift & Controls Component
// ---------------------------------------------------------------------------

function CameraRig({ cameraResetKey = 0 }: { cameraResetKey?: number }) {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  useEffect(() => {
    // Composed hero isometric angle: elevated graphite industrial view
    camera.position.set(-8, 12, 16);
    camera.lookAt(1.5, 0.8, 1.0);
    if (controlsRef.current) {
      controlsRef.current.target.set(1.5, 0.8, 1.0);
      controlsRef.current.update();
    }
  }, [camera, cameraResetKey]);

  // Subtle, calm drift within tight limits when idle
  useFrame((state) => {
    if (!controlsRef.current) return;
    const t = state.clock.getElapsedTime();
    // Micro drift to give a cinematic, alive feel without interfering with interaction
    const subtleX = Math.sin(t * 0.15) * 0.3;
    const subtleZ = Math.cos(t * 0.15) * 0.3;
    if (!controlsRef.current.state || controlsRef.current.state === -1) {
      camera.position.x = -8 + subtleX;
      camera.position.z = 16 + subtleZ;
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minDistance={10}
      maxDistance={28}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI / 2.2}
      minAzimuthAngle={-Math.PI / 2.8}
      maxAzimuthAngle={Math.PI / 2.8}
      dampingFactor={0.05}
    />
  );
}

// ---------------------------------------------------------------------------
// FPS Measurement Component
// ---------------------------------------------------------------------------

function FpsTracker({ onFpsUpdate }: { onFpsUpdate?: (fps: number) => void }) {
  const frames = useRef(0);
  const prevTime = useRef(performance.now());

  useFrame(() => {
    frames.current++;
    const now = performance.now();
    if (now >= prevTime.current + 500) {
      const fps = Math.round((frames.current * 1000) / (now - prevTime.current));
      onFpsUpdate?.(fps);
      frames.current = 0;
      prevTime.current = now;
    }
  });

  return null;
}

// ---------------------------------------------------------------------------
// Scene Item Component with Hover HUD
// ---------------------------------------------------------------------------

interface AnimatedItemProps {
  item: Item;
  decision?: ItemDecision;
  kinematics: ItemKinematics;
  isSelected: boolean;
  onSelect: () => void;
  hoveredItemId: string | null;
  setHoveredItemId: (id: string | null) => void;
}

function AnimatedItem({
  item,
  decision,
  kinematics,
  isSelected,
  onSelect,
  hoveredItemId,
  setHoveredItemId,
}: AnimatedItemProps) {
  const isHovered = hoveredItemId === item.id;
  const isHazardous = item.hazardProbability >= 0.30 || decision?.safetyFloorTriggered;

  if (!kinematics.visible) return null;

  return (
    <group
      position={kinematics.position}
      rotation={kinematics.rotation}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHoveredItemId(item.id);
      }}
      onPointerOut={() => {
        setHoveredItemId(null);
      }}
    >
      <ItemGeometry
        itemId={item.id}
        name={item.name}
        primaryClass={item.primaryClass}
        hazardProbability={item.hazardProbability}
        isHovered={isHovered}
        isSelected={isSelected}
        isFloorTriggered={decision?.safetyFloorTriggered}
      />

      {/* Floating HUD Chip for Hovered or Selected Item */}
      {(isHovered || isSelected) && (
        <Html
          position={[0, 0.65, 0]}
          center
          distanceFactor={18}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className={`px-2 py-1 text-[11px] font-mono border backdrop-blur-md shadow-lg flex flex-col gap-0.5 whitespace-nowrap ${
              isHazardous
                ? 'bg-[#181308]/95 border-amber-500/80 text-amber-300'
                : 'bg-[#0f172a]/95 border-border-default text-text-primary'
            } rounded-[2px]`}
          >
            <div className="flex items-center gap-1.5 font-bold">
              <span>{item.id}</span>
              <span className="text-[9px] uppercase px-1 bg-white/10 rounded-[1px]">
                {item.primaryClass}
              </span>
              {decision?.safetyFloorTriggered && (
                <span className="text-[9px] px-1 bg-amber-500/30 text-amber-400 font-bold">
                  FLOOR
                </span>
              )}
            </div>
            <div className="text-[10px] text-text-secondary flex items-center gap-2">
              <span>p(haz): {(item.hazardProbability * 100).toFixed(1)}%</span>
              <span>score: {decision?.gateScore.toFixed(3) ?? '---'}</span>
            </div>
            <div className="text-[9px] font-mono text-text-muted">
              ROUTE: <span className="text-text-primary uppercase">{decision?.route ?? 'pending'}</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Main 3D Canvas Scene
// ---------------------------------------------------------------------------

export function SentinelScene({
  items,
  decisions,
  currentTime,
  isPlaying,
  selectedItemId,
  onSelectItem,
  lowPowerMode,
  onFpsUpdate,
  cameraResetKey = 0,
}: SentinelSceneProps) {
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  // Map decisions by item ID for instantaneous lookup
  const decisionMap = useMemo(() => {
    return new Map(decisions.map((d) => [d.itemId, d]));
  }, [decisions]);

  // Compute instantaneous kinematics for each item
  const itemKinematicsList = useMemo(() => {
    return items.map((item, index) => {
      const decision = decisionMap.get(item.id);
      const route = decision?.route ?? 'recyclable_bay';
      return {
        item,
        decision,
        kinematics: computeItemKinematics(index, currentTime, route),
      };
    });
  }, [items, decisionMap, currentTime]);

  // Detect if any item is currently under the scanner beam
  const isAnyScanning = useMemo(() => {
    return itemKinematicsList.some((ik) => ik.kinematics.isAtScanner);
  }, [itemKinematicsList]);

  // Calculate diverter arm angle (physically extends when diverted item passes)
  const diverterAngle = useMemo(() => {
    const activeDiverted = itemKinematicsList.find(
      (ik) => ik.kinematics.isAtDiverter && (ik.decision?.route === 'inspection_line' || ik.decision?.route === 'hazard_hold')
    );
    return activeDiverted ? 0.78 : 0.0; // ~45 degrees in radians
  }, [itemKinematicsList]);

  // Calculate compactor ram stroke (depresses when item is in chamber)
  const compactorOffset = useMemo(() => {
    const activeCompacting = itemKinematicsList.some((ik) => ik.kinematics.isAtCompactor);
    return activeCompacting ? 1.0 : 0.0;
  }, [itemKinematicsList]);

  return (
    <div
      className="relative w-full h-full min-h-[460px] bg-[#090b0e] select-none"
      aria-label="Loopgate Sentinel Facility 3D Digital Twin showing real-time sorting kinematics"
      role="img"
    >
      <Canvas
        shadows={!lowPowerMode}
        dpr={lowPowerMode ? 1 : [1, 1.5]}
        gl={{
          antialias: !lowPowerMode,
          powerPreference: 'high-performance',
          alpha: false,
        }}
        camera={{ fov: 42, near: 0.1, far: 80 }}
      >
        {/* Background color */}
        <color attach="background" args={['#080a0c']} />

        {/* Lighting: Restrained matte industrial lighting (Direction A: no bloom, no neon) */}
        <ambientLight intensity={lowPowerMode ? 0.6 : 0.45} />
        <directionalLight
          position={[-6, 16, 10]}
          intensity={lowPowerMode ? 0.8 : 1.1}
          castShadow={!lowPowerMode}
          shadow-mapSize={lowPowerMode ? 512 : 1024}
          shadow-bias={-0.0001}
        />
        {/* Soft fill from opposite side */}
        <directionalLight position={[10, 8, -6]} intensity={0.25} />

        {/* Industrial Facility Physical Line */}
        <FacilityLine
          isScanning={isAnyScanning}
          diverterAngle={diverterAngle}
          compactorOffset={compactorOffset}
          lowPowerMode={lowPowerMode}
        />

        {/* Active Animated Waste Items */}
        {itemKinematicsList.map(({ item, decision, kinematics }) => (
          <AnimatedItem
            key={item.id}
            item={item}
            decision={decision}
            kinematics={kinematics}
            isSelected={selectedItemId === item.id}
            onSelect={() => onSelectItem(item.id)}
            hoveredItemId={hoveredItemId}
            setHoveredItemId={setHoveredItemId}
          />
        ))}

        {/* Camera Rig & Orbit Controls */}
        <CameraRig cameraResetKey={cameraResetKey} />

        {/* Live FPS Monitoring */}
        <FpsTracker onFpsUpdate={onFpsUpdate} />
      </Canvas>
    </div>
  );
}
