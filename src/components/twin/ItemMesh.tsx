'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { MaterialClass } from '@/domain/types';

interface ItemMeshProps {
  itemId: string;
  name: string;
  primaryClass: MaterialClass;
  hazardProbability: number;
  isHovered?: boolean;
  isSelected?: boolean;
  isScanned?: boolean;
  isFloorTriggered?: boolean;
}

/**
 * Recognizable physical geometries per item class and type.
 * Matte materials, restrained industrial colors (slate, graphite, muted steel),
 * Amber accent used strictly for hazard and uncertainty.
 */
export function ItemGeometry({
  itemId,
  primaryClass,
  hazardProbability,
  isHovered,
  isSelected,
  isFloorTriggered,
}: ItemMeshProps) {
  const isHazardous = primaryClass === 'hazardous' || hazardProbability >= 0.30 || isFloorTriggered;
  
  // Materials
  const baseColor = useMemo(() => {
    if (isSelected) return '#f59e0b';
    if (isHovered) return '#fbbf24';
    if (isHazardous) return '#d97706';
    switch (primaryClass) {
      case 'recyclable':
        return '#38bdf8'; // Subtle cyan/steel blue
      case 'reusable':
        return '#94a3b8'; // Slate
      case 'biodegradable':
        return '#84cc16'; // Muted olive green
      default:
        return '#64748b';
    }
  }, [isSelected, isHovered, isHazardous, primaryClass]);

  // Specific physical shapes matching item descriptions
  switch (itemId) {
    case 'item-01': // Clear PET Bottle
      return (
        <group>
          {/* Main bottle cylinder */}
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.5, 16]} />
            <meshStandardMaterial color={baseColor} transparent opacity={0.65} roughness={0.2} metalness={0.1} />
          </mesh>
          {/* Bottle neck */}
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.06, 0.14, 0.15, 16]} />
            <meshStandardMaterial color={baseColor} transparent opacity={0.7} roughness={0.2} />
          </mesh>
          {/* Cap */}
          <mesh position={[0, 0.65, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.06, 16]} />
            <meshStandardMaterial color="#0284c7" roughness={0.4} />
          </mesh>
        </group>
      );

    case 'item-02': // Crushed Aluminum Can
      return (
        <group rotation={[0.2, 0.1, 0.4]}>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.42, 16]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.8} />
          </mesh>
          <mesh position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.04, 16]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.9} />
          </mesh>
        </group>
      );

    case 'item-03': // Flattened Corrugated Box
      return (
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.65, 0.08, 0.48]} />
          <meshStandardMaterial color="#b45309" roughness={0.9} metalness={0.0} />
        </mesh>
      );

    case 'item-04': // Optical Mouse
      return (
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[0.28, 0.14, 0.42]} />
          <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.2} />
        </mesh>
      );

    case 'item-05': // Denim Work Jacket (Folded Plane)
      return (
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[0.55, 0.12, 0.45]} />
          <meshStandardMaterial color="#1e3a8a" roughness={0.85} metalness={0.0} />
        </mesh>
      );

    case 'item-06': // Fruit Waste / Banana Peel
      return (
        <group rotation={[0, 0.3, 0.2]}>
          <mesh position={[0, 0.1, 0]}>
            <torusGeometry args={[0.22, 0.07, 8, 24, Math.PI * 0.8]} />
            <meshStandardMaterial color="#eab308" roughness={0.6} />
          </mesh>
        </group>
      );

    case 'item-07': // Coffee Grounds in Filter
      return (
        <group>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.22, 0.16, 0.18, 16]} />
            <meshStandardMaterial color="#78350f" roughness={0.9} />
          </mesh>
        </group>
      );

    case 'item-08': // Disposable Vape Pen (Hazardous - Slender Cylinder)
      return (
        <group rotation={[0, 0, Math.PI / 2]}>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.55, 16]} />
            <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.6} />
          </mesh>
          {/* Amber hazard tip indicator */}
          <mesh position={[0, 0.36, 0]}>
            <cylinderGeometry args={[0.065, 0.065, 0.04, 16]} />
            <meshStandardMaterial color="#f59e0b" emissive="#b45309" emissiveIntensity={0.6} />
          </mesh>
        </group>
      );

    case 'item-09': // Punctured Power Bank (Hazardous - Rounded Brick)
      return (
        <group>
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.38, 0.16, 0.55]} />
            <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.5} />
          </mesh>
          {/* Hazard port accent */}
          <mesh position={[0, 0.1, 0.28]}>
            <boxGeometry args={[0.16, 0.06, 0.02]} />
            <meshStandardMaterial color="#f59e0b" emissive="#d97706" emissiveIntensity={0.5} />
          </mesh>
        </group>
      );

    case 'item-10': // Cracked Smartphone Slab
      return (
        <group>
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.32, 0.05, 0.62]} />
            <meshStandardMaterial color="#020617" roughness={0.2} metalness={0.8} />
          </mesh>
          {/* Bulging backplate hint */}
          <mesh position={[0, 0.07, 0.05]} scale={[0.28, 0.03, 0.35]}>
            <sphereGeometry args={[0.5, 12, 12]} />
            <meshStandardMaterial color="#b45309" roughness={0.5} />
          </mesh>
        </group>
      );

    case 'item-11': // Aerosol Solvent Canister (Hazardous Cylinder)
      return (
        <group>
          <mesh position={[0, 0.32, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.60, 16]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.7} />
          </mesh>
          {/* Red/amber warning cap */}
          <mesh position={[0, 0.66, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.10, 16]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.4} />
          </mesh>
        </group>
      );

    case 'item-12': // Earbuds Charging Case
      return (
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.28, 0.18, 0.28]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.1} />
        </mesh>
      );

    case 'item-13': // Electric Toothbrush Handle
      return (
        <group rotation={[0, 0, Math.PI / 2]}>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.08, 0.09, 0.65, 16]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.4} metalness={0.2} />
          </mesh>
        </group>
      );

    case 'item-14': // Tetra Pak Carton
      return (
        <mesh position={[0, 0.26, 0]}>
          <boxGeometry args={[0.26, 0.50, 0.22]} />
          <meshStandardMaterial color="#0284c7" roughness={0.5} />
        </mesh>
      );

    case 'item-15': // Musical Greeting Card with Cell
      return (
        <group>
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[0.42, 0.04, 0.52]} />
            <meshStandardMaterial color="#f43f5e" roughness={0.8} />
          </mesh>
          <mesh position={[0.08, 0.055, 0.06]}>
            <cylinderGeometry args={[0.06, 0.06, 0.02, 12]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      );

    case 'item-16': // PLA Bioplastic Bowl
      return (
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.26, 0.16, 0.24, 16, 1, true]} />
          <meshStandardMaterial color="#a3e635" transparent opacity={0.7} roughness={0.3} side={THREE.DoubleSide} />
        </mesh>
      );

    case 'item-17': // Power Tool Battery Shell
      return (
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[0.32, 0.26, 0.38]} />
          <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.3} />
        </mesh>
      );

    case 'item-18': // Multimeter with 9V
      return (
        <group>
          <mesh position={[0, 0.09, 0]}>
            <boxGeometry args={[0.34, 0.14, 0.48]} />
            <meshStandardMaterial color="#d97706" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.17, -0.06]}>
            <cylinderGeometry args={[0.10, 0.10, 0.02, 16]} />
            <meshStandardMaterial color="#0f172a" roughness={0.3} />
          </mesh>
        </group>
      );

    case 'item-19': // Treated Timber Offcut
      return (
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[0.62, 0.20, 0.30]} />
          <meshStandardMaterial color="#713f12" roughness={0.9} />
        </mesh>
      );

    case 'item-20': // Smart Watch
      return (
        <group>
          <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[0.22, 0.08, 0.26]} />
            <meshStandardMaterial color="#09090b" roughness={0.2} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.16, 0.04, 0.58]} />
            <meshStandardMaterial color="#3f3f46" roughness={0.7} />
          </mesh>
        </group>
      );

    default:
      return (
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshStandardMaterial color={baseColor} roughness={0.5} />
        </mesh>
      );
  }
}
