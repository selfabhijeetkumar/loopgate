'use client';

/**
 * src/components/world/Starfield.tsx
 * Deep-space backdrop behind the Loopgate facility line.
 *
 * SPECIFICATION (Phase 4D Step 1):
 * 1. ONE Points object with custom GLSL shader:
 *    - 3 depth layers with parallax.
 *    - Slow twinkle (per-star phase).
 *    - Brighter stars have subtle cross-flares drawn as thin lines (no glow sprites, no bloom).
 *    - Stars are white or cool grey only (#f8fafc, #e2e8f0, #94a3b8).
 *      AMBER IS STRICTLY RESERVED FOR HAZARD.
 *    - Faint horizon haze / space dust using plain gradients (no neon, no purple).
 *    - Seeded deterministic PRNG (no Math.random at render).
 * 2. Quality Tiers:
 *    - HIGH: 3200 stars, 20 thin cross-flare lines.
 *    - MEDIUM: 1200 stars, 0 cross-flares.
 *    - LOW: Static starfield drawn once on small canvas, no animation.
 *    - prefers-reduced-motion: frozen twinkle, no parallax.
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { QualityTier } from './qualityTier';

// ---------------------------------------------------------------------------
// Seeded Deterministic PRNG (Lehmer / MINSTD)
// ---------------------------------------------------------------------------

export function createSeededRandom(seed = 4201337) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export interface StarPoint {
  x: number;
  y: number;
  z: number;
  layer: number; // 1: far, 2: mid, 3: near
  size: number;
  phase: number;
  brightness: number;
  color: [number, number, number]; // RGB
  hasCrossFlare: boolean;
}

export function generateSeededStarfield(count: number, flareCount = 0): {
  stars: StarPoint[];
  crossFlareSegments: number[];
} {
  const prng = createSeededRandom(88192);
  const stars: StarPoint[] = [];
  const crossFlareSegments: number[] = [];

  // Star palette: strictly cool whites and slates (NEVER amber, NEVER purple)
  const coolWhite: [number, number, number] = [0.97, 0.98, 1.0];
  const coolSlate: [number, number, number] = [0.82, 0.86, 0.92];
  const dimGrey: [number, number, number] = [0.60, 0.65, 0.72];

  for (let i = 0; i < count; i++) {
    // Distribute across wide dome behind facility
    // X in [-60, 60], Y in [0, 48], Z in [-55, -25]
    const x = (prng() - 0.5) * 120;
    const y = prng() * 48;
    const z = -25 - prng() * 30;

    // 3 depth layers
    const layer = prng() < 0.5 ? 1 : prng() < 0.82 ? 2 : 3;
    const baseSize = layer === 3 ? 1.8 + prng() * 1.2 : layer === 2 ? 1.2 + prng() * 0.8 : 0.8 + prng() * 0.5;
    const phase = prng() * Math.PI * 2;
    const brightness = 0.55 + prng() * 0.45;

    const colRand = prng();
    const color = colRand < 0.6 ? coolWhite : colRand < 0.85 ? coolSlate : dimGrey;
    const hasCrossFlare = i < flareCount && layer >= 2;

    stars.push({
      x,
      y,
      z,
      layer,
      size: baseSize,
      phase,
      brightness,
      color,
      hasCrossFlare,
    });

    if (hasCrossFlare) {
      // Build thin horizontal and vertical cross-flare line segments (+ shape)
      const flareArm = 0.35 + prng() * 0.25;
      // Horizontal segment
      crossFlareSegments.push(x - flareArm, y, z, x + flareArm, y, z);
      // Vertical segment
      crossFlareSegments.push(x, y - flareArm, z, x, y + flareArm, z);
    }
  }

  return { stars, crossFlareSegments };
}

// ---------------------------------------------------------------------------
// 3D Starfield Component
// ---------------------------------------------------------------------------

interface StarfieldProps {
  tier: QualityTier;
  reducedMotion: boolean;
  parallaxOffset: React.MutableRefObject<THREE.Vector2>;
  scrollProgress?: number;
}

export function Starfield({ tier, reducedMotion, parallaxOffset, scrollProgress = 0 }: StarfieldProps) {
  const pointsMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const flaresMaterialRef = useRef<THREE.LineBasicMaterial>(null);

  const starCount = tier === 'HIGH' ? 3200 : tier === 'MEDIUM' ? 1200 : 0;
  const flareCount = tier === 'HIGH' ? 24 : 0;

  const { stars, crossFlareSegments } = useMemo(() => {
    return generateSeededStarfield(starCount, flareCount);
  }, [starCount, flareCount]);

  // Build Points geometry attributes
  const { geometry, flareGeometry } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(stars.length * 3);
    const layers = new Float32Array(stars.length);
    const sizes = new Float32Array(stars.length);
    const phases = new Float32Array(stars.length);
    const brightnesses = new Float32Array(stars.length);
    const colors = new Float32Array(stars.length * 3);

    stars.forEach((s, i) => {
      positions[i * 3] = s.x;
      positions[i * 3 + 1] = s.y;
      positions[i * 3 + 2] = s.z;

      layers[i] = s.layer;
      sizes[i] = s.size;
      phases[i] = s.phase;
      brightnesses[i] = s.brightness;

      colors[i * 3] = s.color[0];
      colors[i * 3 + 1] = s.color[1];
      colors[i * 3 + 2] = s.color[2];
    });

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aLayer', new THREE.BufferAttribute(layers, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aBrightness', new THREE.BufferAttribute(brightnesses, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    // Cross flare line geometry
    const fGeo = new THREE.BufferGeometry();
    if (crossFlareSegments.length > 0) {
      fGeo.setAttribute('position', new THREE.Float32BufferAttribute(crossFlareSegments, 3));
    }

    return { geometry: geo, flareGeometry: fGeo };
  }, [stars, crossFlareSegments]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uParallax: { value: new THREE.Vector2(0, 0) },
      uScrollDepth: { value: 0 },
      uReducedMotion: { value: reducedMotion ? 1.0 : 0.0 },
    }),
    [reducedMotion]
  );

  useFrame((state) => {
    if (pointsMaterialRef.current) {
      pointsMaterialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      pointsMaterialRef.current.uniforms.uParallax.value.set(
        parallaxOffset.current.x * (reducedMotion ? 0 : 1),
        parallaxOffset.current.y * (reducedMotion ? 0 : 1)
      );
      pointsMaterialRef.current.uniforms.uScrollDepth.value = scrollProgress;
      pointsMaterialRef.current.uniforms.uReducedMotion.value = reducedMotion ? 1.0 : 0.0;
    }

    if (flaresMaterialRef.current && !reducedMotion) {
      // Subtle pulse on cross-flares
      const t = state.clock.elapsedTime * 1.2;
      flaresMaterialRef.current.opacity = 0.55 + Math.sin(t) * 0.25;
    }
  });

  if (tier === 'LOW') {
    // In LOW tier, render static background plane only (zero animation points)
    return <StaticHorizonBackdrop />;
  }

  return (
    <group position={[0, 0, 0]}>
      {/* 1. Procedural Horizon Haze & Space Dust Backdrop */}
      <StaticHorizonBackdrop />

      {/* 2. Primary Instanced Star Points */}
      <points geometry={geometry}>
        <shaderMaterial
          ref={pointsMaterialRef}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          vertexShader={`
            attribute float aLayer;
            attribute float aSize;
            attribute float aPhase;
            attribute float aBrightness;
            attribute vec3 aColor;

            uniform float uTime;
            uniform vec2 uParallax;
            uniform float uScrollDepth;
            uniform float uReducedMotion;

            varying vec3 vColor;
            varying float vBrightness;

            void main() {
              vColor = aColor;
              vBrightness = aBrightness;

              vec3 pos = position;

              // 3-Layer Parallax to pointer and scroll depth
              float layerFactor = aLayer * 0.8;
              pos.x += uParallax.x * layerFactor * 8.0;
              pos.y += uParallax.y * layerFactor * 4.0 + uScrollDepth * layerFactor * 2.0;

              vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);

              // Twinkle effect (frozen if reduced motion)
              float twinkle = 1.0;
              if (uReducedMotion < 0.5) {
                twinkle = 0.72 + 0.28 * sin(uTime * 1.6 + aPhase);
              }

              // Distance size attenuation
              gl_PointSize = aSize * twinkle * (180.0 / -mvPos.z);
              gl_Position = projectionMatrix * mvPos;
            }
          `}
          fragmentShader={`
            varying vec3 vColor;
            varying float vBrightness;

            void main() {
              // Circular point discard with smooth edge
              float dist = length(gl_PointCoord - vec2(0.5));
              if (dist > 0.5) discard;

              float alpha = smoothstep(0.5, 0.12, dist) * vBrightness;
              gl_FragColor = vec4(vColor, alpha);
            }
          `}
        />
      </points>

      {/* 3. Subtle Cross-Flare Lines for Brightest Stars (no glow sprites, no bloom) */}
      {flareCount > 0 && crossFlareSegments.length > 0 && (
        <lineSegments geometry={flareGeometry}>
          <lineBasicMaterial
            ref={flaresMaterialRef}
            color="#f1f5f9"
            transparent
            opacity={0.65}
            depthWrite={false}
          />
        </lineSegments>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Static Horizon Haze Gradient Backdrop
// ---------------------------------------------------------------------------

function StaticHorizonBackdrop() {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uBottomColor: { value: new THREE.Color('#070a0d') }, // blends with facility floor
      uMidHaze: { value: new THREE.Color('#0b1017') },     // deep industrial slate
      uTopSpace: { value: new THREE.Color('#030508') },    // deep void black
    }),
    []
  );

  return (
    <mesh ref={meshRef} position={[0, 18, -50]}>
      <planeGeometry args={[160, 80]} />
      <shaderMaterial
        uniforms={uniforms}
        depthWrite={false}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uBottomColor;
          uniform vec3 uMidHaze;
          uniform vec3 uTopSpace;
          varying vec2 vUv;

          void main() {
            // Smooth gradient: floor horizon -> subtle dust haze -> deep cosmic void
            vec3 col = mix(uBottomColor, uMidHaze, smoothstep(0.0, 0.45, vUv.y));
            col = mix(col, uTopSpace, smoothstep(0.45, 0.95, vUv.y));
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}
