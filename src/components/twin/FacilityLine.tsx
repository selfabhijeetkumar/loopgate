'use client';

import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface FacilityLineProps {
  conveyorSpeed?: number;
  isScanning?: boolean;
  diverterAngle?: number; // radians: 0 = retracted, ~0.8 = extended
  compactorOffset?: number; // 0 = open, 1 = pressed down
  activeStation?: string;
  lowPowerMode?: boolean;
  hideFloor?: boolean;
}

export function FacilityLine({
  conveyorSpeed = 1.0,
  isScanning = false,
  diverterAngle = 0,
  compactorOffset = 0,
  lowPowerMode = false,
  hideFloor = false,
}: FacilityLineProps) {
  const beltTextureRef = useRef<THREE.MeshStandardMaterial>(null);
  const scanPlaneRef = useRef<THREE.MeshBasicMaterial>(null);

  // Animate conveyor belt texture offset
  useFrame((_, delta) => {
    if (beltTextureRef.current) {
      // Subtle material color pulse / offset simulation
    }
    if (scanPlaneRef.current && isScanning) {
      scanPlaneRef.current.opacity = 0.35 + Math.sin(Date.now() * 0.015) * 0.2;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* ------------------------------------------------------------------ */}
      {/* 1. Industrial Floor & Markings                                      */}
      {/* ------------------------------------------------------------------ */}
      {!hideFloor && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow={!lowPowerMode}>
            <planeGeometry args={[40, 28]} />
            <meshStandardMaterial color="#181c22" roughness={0.75} metalness={0.15} />
          </mesh>

          {/* Grid line markings: visible high-contrast graphite */}
          <gridHelper args={[40, 40, '#475569', '#242d38']} position={[0, 0, 0]} />
        </>
      )}

      {/* Safety boundary line around inspection spur */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.5, 0.005, 3.2]}>
        <planeGeometry args={[4.4, 5.2]} />
        <meshBasicMaterial color="#f59e0b" wireframe transparent opacity={0.4} />
      </mesh>

      {/* Compactor hazard footprint boundary */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[4.5, 0.005, 0]}>
        <planeGeometry args={[2.8, 2.6]} />
        <meshBasicMaterial color="#eab308" wireframe transparent opacity={0.3} />
      </mesh>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Main Intake Conveyor Bed (Length: 15m, X: -9 to 6)               */}
      {/* ------------------------------------------------------------------ */}
      <group position={[-1.5, 0.8, 0]}>
        {/* Conveyor Bed Surface */}
        <mesh position={[0, 0, 0]} receiveShadow={!lowPowerMode}>
          <boxGeometry args={[15, 0.12, 1.2]} />
          <meshStandardMaterial
            ref={beltTextureRef}
            color="#14181c"
            roughness={0.7}
            metalness={0.2}
          />
        </mesh>

        {/* Side Guardrails */}
        <mesh position={[0, 0.15, 0.62]}>
          <boxGeometry args={[15, 0.22, 0.04]} />
          <meshStandardMaterial color="#2d3748" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[-3.5, 0.15, -0.62]}>
          <boxGeometry args={[8, 0.22, 0.04]} />
          <meshStandardMaterial color="#2d3748" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[4.0, 0.15, -0.62]}>
          <boxGeometry args={[5, 0.22, 0.04]} />
          <meshStandardMaterial color="#2d3748" metalness={0.6} roughness={0.4} />
        </mesh>

        {/* Conveyor Support Legs */}
        {[-6, -3, 0, 3, 6].map((x) => (
          <group key={x} position={[x, -0.45, 0]}>
            <mesh position={[0, 0, 0.55]}>
              <cylinderGeometry args={[0.04, 0.04, 0.8, 8]} />
              <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0, -0.55]}>
              <cylinderGeometry args={[0.04, 0.04, 0.8, 8]} />
              <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.5} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Intake Feed Hopper (X = -9)                                      */}
      {/* ------------------------------------------------------------------ */}
      <group position={[-9.2, 1.6, 0]}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[1.1, 0.7, 1.2, 4, 1, true]} />
          <meshStandardMaterial color="#334155" roughness={0.6} metalness={0.4} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -0.7, 0]}>
          <boxGeometry args={[0.8, 0.2, 0.8]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} />
        </mesh>
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Scanner Gate Station (X = -4.5)                                  */}
      {/* ------------------------------------------------------------------ */}
      <group position={[-4.5, 0, 0]}>
        {/* Steel Archway Uprights */}
        <mesh position={[0, 1.5, 0.85]}>
          <boxGeometry args={[0.3, 3.0, 0.2]} />
          <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.5, -0.85]}>
          <boxGeometry args={[0.3, 3.0, 0.2]} />
          <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.3} />
        </mesh>
        {/* Crossbar Housing */}
        <mesh position={[0, 3.0, 0]}>
          <boxGeometry args={[0.5, 0.4, 2.0]} />
          <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Camera Sensor Pods */}
        <mesh position={[0, 2.7, 0.4]}>
          <cylinderGeometry args={[0.1, 0.12, 0.25, 16]} />
          <meshStandardMaterial color="#020617" roughness={0.2} metalness={0.9} />
        </mesh>
        <mesh position={[0, 2.7, -0.4]}>
          <cylinderGeometry args={[0.1, 0.12, 0.25, 16]} />
          <meshStandardMaterial color="#020617" roughness={0.2} metalness={0.9} />
        </mesh>

        {/* Dynamic Amber Laser Scan Plane */}
        {isScanning && (
          <mesh position={[0, 1.4, 0]}>
            <planeGeometry args={[0.02, 1.8]} />
            <meshBasicMaterial
              ref={scanPlaneRef}
              color="#f59e0b"
              transparent
              opacity={0.45}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* 5. Mechanical Diverter Arm Station (X = 0)                          */}
      {/* ------------------------------------------------------------------ */}
      <group position={[0, 0.95, -0.6]}>
        {/* Pivot Base Post */}
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.12, 0.14, 0.35, 16]} />
          <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Arm that physically rotates across the belt */}
        <group rotation={[0, diverterAngle, 0]}>
          <mesh position={[0.65, 0.1, 0]}>
            <boxGeometry args={[1.3, 0.18, 0.08]} />
            <meshStandardMaterial
              color={diverterAngle > 0.1 ? '#f59e0b' : '#334155'}
              metalness={0.5}
              roughness={0.4}
            />
          </mesh>
        </group>
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* 6. Spur Conveyor to Inspection Bay (Z: 0 to 4.5 at X = 0)           */}
      {/* ------------------------------------------------------------------ */}
      <group position={[0, 0.78, 2.4]}>
        <mesh position={[0, 0, 0]} receiveShadow={!lowPowerMode}>
          <boxGeometry args={[1.1, 0.1, 3.6]} />
          <meshStandardMaterial color="#1a2026" roughness={0.7} metalness={0.2} />
        </mesh>
        {/* Spur Side Rails */}
        <mesh position={[-0.58, 0.14, 0]}>
          <boxGeometry args={[0.04, 0.2, 3.6]} />
          <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0.58, 0.14, 0]}>
          <boxGeometry args={[0.04, 0.2, 3.6]} />
          <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* 7. Raised Inspection Bay & Hazard Vault (Z = 4.8)                  */}
      {/* ------------------------------------------------------------------ */}
      <group position={[0, 0, 4.8]}>
        {/* Raised Platform Deck */}
        <mesh position={[0, 0.4, 0]} receiveShadow={!lowPowerMode}>
          <boxGeometry args={[3.2, 0.8, 2.4]} />
          <meshStandardMaterial color="#14181c" roughness={0.8} metalness={0.3} />
        </mesh>

        {/* Hazard Boundary Rim (Amber) */}
        <mesh position={[0, 0.81, 0]}>
          <boxGeometry args={[3.24, 0.02, 2.44]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.5} metalness={0.1} />
        </mesh>

        {/* Inspection Station Desk */}
        <mesh position={[-0.6, 1.1, 0]}>
          <boxGeometry args={[1.2, 0.6, 1.4]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.4} />
        </mesh>

        {/* Inspection Hood / Magnifier Arm */}
        <mesh position={[-0.6, 1.8, 0]}>
          <cylinderGeometry args={[0.3, 0.4, 0.25, 16]} />
          <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.6} />
        </mesh>

        {/* Hazard Hold Quarantine Vault */}
        <group position={[0.85, 1.05, 0]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.9, 0.7, 0.9]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Amber Hazard Chevrons */}
          <mesh position={[0, 0.1, 0.46]}>
            <boxGeometry args={[0.75, 0.15, 0.02]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.5} />
          </mesh>
        </group>
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* 8. Industrial Hydraulic Compactor Housing (X = 4.5)                 */}
      {/* ------------------------------------------------------------------ */}
      <group position={[4.5, 0, 0]}>
        {/* Outer Heavy Steel Housing */}
        <mesh position={[0, 1.8, 0]}>
          <boxGeometry args={[2.0, 2.8, 1.8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.4} />
        </mesh>
        {/* Cutout tunnel for conveyor passage */}
        <mesh position={[0, 0.95, 0]}>
          <boxGeometry args={[2.02, 1.0, 1.3]} />
          <meshStandardMaterial color="#090d12" roughness={0.9} />
        </mesh>

        {/* Moving Hydraulic Press Plate */}
        <mesh position={[0, 1.5 - compactorOffset * 0.45, 0]}>
          <boxGeometry args={[1.2, 0.25, 1.1]} />
          <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Hydraulic Ram Cylinder */}
        <mesh position={[0, 2.4 - compactorOffset * 0.25, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 1.0, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* 9. Four Material Classification Bins (X = 8.5 to 11.5)             */}
      {/* ------------------------------------------------------------------ */}
      <group position={[8.5, 0, 0]}>
        {/* Recyclable Bay [01-REC] */}
        <group position={[0, 0.5, -1.5]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.8, 1.0, 1.2]} />
            <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.52, 0]}>
            <boxGeometry args={[1.82, 0.04, 1.22]} />
            <meshStandardMaterial color="#0284c7" roughness={0.5} />
          </mesh>
        </group>

        {/* Reusable Bay [02-REU] */}
        <group position={[2.4, 0.5, -1.5]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.8, 1.0, 1.2]} />
            <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.52, 0]}>
            <boxGeometry args={[1.82, 0.04, 1.22]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.5} />
          </mesh>
        </group>

        {/* Biodegradable Bay [03-BIO] */}
        <group position={[0, 0.5, 0.5]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.8, 1.0, 1.2]} />
            <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.52, 0]}>
            <boxGeometry args={[1.82, 0.04, 1.22]} />
            <meshStandardMaterial color="#65a30d" roughness={0.5} />
          </mesh>
        </group>

        {/* Standard Discharge Chute [04-DISCHARGE] */}
        <group position={[2.4, 0.5, 0.5]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.8, 1.0, 1.2]} />
            <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.52, 0]}>
            <boxGeometry args={[1.82, 0.04, 1.22]} />
            <meshStandardMaterial color="#475569" roughness={0.5} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
