'use client';

/**
 * src/components/world/Starfield.tsx
 * Deep-space celestial backdrop behind the Loopgate facility line.
 *
 * SPECIFICATION (Phase 6+7 Step 0.6):
 * 1. Sky-dome behaviour: Starfield group follows camera.position every frame
 *    (inside useFrame, no React state), keeping stars at infinity across all 6 chapters.
 * 2. Stars lie on a large spherical shell (radius 200, well inside camera far plane).
 * 3. Material: fog: false, depthWrite: false, depthTest: false, renderOrder: -100,
 *    frustumCulled: false, no multiplication by chapter fade.
 * 4. Realistic magnitude distribution:
 *    - HIGH: 8000 stars, 32 thin cross-flare lines
 *    - MEDIUM: 4000 stars, 0 cross-flares
 *    - LOW: 1500 stars (static backdrop)
 *    - ~70% faint, ~25% medium, ~5% bright.
 * 5. Soft galactic diagonal density band (cool whites/blues, NEVER purple, NEVER amber).
 * 6. Pixel-scale crisp rendering with dpr scaling (1.0px min, 3.0px max).
 * 7. Rotation-based parallax (pointer + scroll) on group, twinkle with per-star phase.
 * 8. prefers-reduced-motion: frozen twinkle, no parallax.
 */

import React, { useMemo, useRef } from 'react';
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
  const prng = createSeededRandom(918273);
  const stars: StarPoint[] = [];
  const crossFlareSegments: number[] = [];

  // Star palette: strictly cool whites and slates (NEVER amber, NEVER purple)
  const coolWhite: [number, number, number] = [0.96, 0.98, 1.0];
  const paleBlue: [number, number, number] = [0.82, 0.88, 0.98];
  const coolGrey: [number, number, number] = [0.65, 0.70, 0.78];
  const faintSlate: [number, number, number] = [0.45, 0.50, 0.58];

  const R = 200.0; // Spherical dome shell radius

  let i = 0;
  while (stars.length < count && i < count * 4) {
    i++;
    // Azimuth phi in [0, 2pi), Elevation theta in [-0.05, pi * 0.52] (from slightly below horizon to zenith)
    const phi = prng() * Math.PI * 2;
    const u = prng();
    // Elevation biased towards upper dome and horizon band
    const theta = Math.asin(u * 0.95);

    // Diagonal galactic band rejection sampling for soft density boost along diagonal plane
    // Band normal approximately: (0.6, 0.3, 0.7)
    const testX = Math.cos(theta) * Math.sin(phi);
    const testY = Math.sin(theta);
    const testZ = Math.cos(theta) * Math.cos(phi);
    const bandDist = Math.abs(testX * 0.6 + testY * 0.3 - testZ * 0.7);

    // If inside galactic band, higher density
    const isBand = bandDist < 0.28;
    if (!isBand && prng() > 0.65) {
      continue; // Filter out to create natural celestial clustering
    }

    const x = R * testX;
    const y = R * testY;
    const z = R * testZ;

    // Realistic magnitude distribution
    // 70% faint, 25% medium, 5% bright
    const magRand = prng();
    let size: number;
    let brightness: number;
    let color: [number, number, number];

    if (magRand < 0.70) {
      // Faint background star
      size = 1.0 + prng() * 0.3;
      brightness = 0.35 + prng() * 0.30;
      color = prng() < 0.6 ? coolGrey : faintSlate;
    } else if (magRand < 0.95) {
      // Medium star
      size = 1.4 + prng() * 0.6;
      brightness = 0.65 + prng() * 0.25;
      color = prng() < 0.7 ? paleBlue : coolWhite;
    } else {
      // Bright anchor star
      size = 2.2 + prng() * 0.8;
      brightness = 0.88 + prng() * 0.12;
      color = coolWhite;
    }

    const phase = prng() * Math.PI * 2;
    const hasCrossFlare = stars.length < flareCount && magRand >= 0.95;

    stars.push({
      x,
      y,
      z,
      size,
      phase,
      brightness,
      color,
      hasCrossFlare,
    });

    if (hasCrossFlare) {
      // Construct cross-flare lines along tangent plane to dome
      const armLength = 0.65 + prng() * 0.35;
      crossFlareSegments.push(
        x - armLength, y, z, x + armLength, y, z,
        x, y - armLength, z, x, y + armLength, z
      );
    }
  }

  return { stars, crossFlareSegments };
}

// ---------------------------------------------------------------------------
// 3D Starfield Sky Dome Component
// ---------------------------------------------------------------------------

interface StarfieldProps {
  tier: QualityTier;
  reducedMotion: boolean;
  parallaxOffset: React.MutableRefObject<THREE.Vector2>;
  scrollProgress?: number;
}

export function Starfield({
  tier,
  reducedMotion,
  parallaxOffset,
  scrollProgress = 0,
}: StarfieldProps) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const flaresMaterialRef = useRef<THREE.LineBasicMaterial>(null);

  // Target counts per tier specification
  const starCount = tier === 'HIGH' ? 8000 : tier === 'MEDIUM' ? 4000 : 1500;
  const flareCount = tier === 'HIGH' ? 32 : 0;

  const { stars, crossFlareSegments } = useMemo(() => {
    return generateSeededStarfield(starCount, flareCount);
  }, [starCount, flareCount]);

  const { geometry, flareGeometry } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(stars.length * 3);
    const sizes = new Float32Array(stars.length);
    const phases = new Float32Array(stars.length);
    const brightnesses = new Float32Array(stars.length);
    const colors = new Float32Array(stars.length * 3);

    stars.forEach((s, i) => {
      positions[i * 3] = s.x;
      positions[i * 3 + 1] = s.y;
      positions[i * 3 + 2] = s.z;

      sizes[i] = s.size;
      phases[i] = s.phase;
      brightnesses[i] = s.brightness;

      colors[i * 3] = s.color[0];
      colors[i * 3 + 1] = s.color[1];
      colors[i * 3 + 2] = s.color[2];
    });

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aBrightness', new THREE.BufferAttribute(brightnesses, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    const fGeo = new THREE.BufferGeometry();
    if (crossFlareSegments.length > 0) {
      fGeo.setAttribute('position', new THREE.Float32BufferAttribute(crossFlareSegments, 3));
    }

    return { geometry: geo, flareGeometry: fGeo };
  }, [stars, crossFlareSegments]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uReducedMotion: { value: reducedMotion ? 1.0 : 0.0 },
      uPixelRatio: { value: typeof window !== 'undefined' ? Math.min(2.0, window.devicePixelRatio || 1.0) : 1.0 },
    }),
    [reducedMotion]
  );

  useFrame((state) => {
    // 1. Sky-Dome behavior: group follows camera position directly every frame
    if (groupRef.current) {
      groupRef.current.position.copy(state.camera.position);

      // Subtle celestial rotation parallax (group rotation, not modifying individual points)
      if (!reducedMotion) {
        groupRef.current.rotation.y = parallaxOffset.current.x * 0.04 + scrollProgress * 0.08;
        groupRef.current.rotation.x = -parallaxOffset.current.y * 0.02;
      }
    }

    // 2. Twinkle animation
    if (pointsMaterialRef.current) {
      pointsMaterialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      pointsMaterialRef.current.uniforms.uReducedMotion.value = reducedMotion ? 1.0 : 0.0;
    }

    // 3. Flare pulse
    if (flaresMaterialRef.current && !reducedMotion) {
      const t = state.clock.elapsedTime * 1.5;
      flaresMaterialRef.current.opacity = 0.55 + Math.sin(t) * 0.25;
    }
  });

  return (
    <group ref={groupRef} renderOrder={-100}>
      {/* Primary Instanced Celestial Points */}
      <points geometry={geometry} frustumCulled={false} renderOrder={-100}>
        <shaderMaterial
          ref={pointsMaterialRef}
          uniforms={uniforms}
          transparent
          fog={false}
          depthTest={false}
          depthWrite={false}
          vertexShader={`
            attribute float aSize;
            attribute float aPhase;
            attribute float aBrightness;
            attribute vec3 aColor;

            uniform float uTime;
            uniform float uReducedMotion;
            uniform float uPixelRatio;

            varying vec3 vColor;
            varying float vBrightness;

            void main() {
              vColor = aColor;
              vBrightness = aBrightness;

              // Twinkle effect (frozen if reduced motion)
              float twinkle = 1.0;
              if (uReducedMotion < 0.5) {
                twinkle = 0.72 + 0.28 * sin(uTime * 1.8 + aPhase);
              }

              // Fixed pixel size scaled by devicePixelRatio
              gl_PointSize = max(1.0, aSize * uPixelRatio * twinkle);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec3 vColor;
            varying float vBrightness;

            void main() {
              // Crisp circular star point with soft anti-aliased edge
              float dist = length(gl_PointCoord - vec2(0.5));
              if (dist > 0.5) discard;

              float alpha = smoothstep(0.5, 0.15, dist) * vBrightness;
              gl_FragColor = vec4(vColor, alpha);
            }
          `}
        />
      </points>

      {/* Subtle Cross-Flare Lines for Brightest Stars */}
      {flareCount > 0 && crossFlareSegments.length > 0 && (
        <lineSegments geometry={flareGeometry} frustumCulled={false} renderOrder={-99}>
          <lineBasicMaterial
            ref={flaresMaterialRef}
            color="#f8fafc"
            transparent
            fog={false}
            depthTest={false}
            depthWrite={false}
            opacity={0.6}
          />
        </lineSegments>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Static Insurance Layer Component (Canvas / CSS Backdrop)
// ---------------------------------------------------------------------------

export function StaticStarfieldInsurance() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: -1,
        background: `
          radial-gradient(circle at 50% 20%, rgba(15, 23, 42, 0.8) 0%, rgba(7, 10, 13, 0.98) 75%),
          radial-gradient(1.5px 1.5px at 15% 25%, #cbd5e1 50%, transparent 100%),
          radial-gradient(1px 1px at 35% 15%, #94a3b8 50%, transparent 100%),
          radial-gradient(2px 2px at 65% 18%, #f8fafc 50%, transparent 100%),
          radial-gradient(1px 1px at 85% 30%, #94a3b8 50%, transparent 100%),
          radial-gradient(1.5px 1.5px at 45% 45%, #cbd5e1 50%, transparent 100%),
          radial-gradient(1px 1px at 75% 65%, #64748b 50%, transparent 100%),
          radial-gradient(2px 2px at 25% 75%, #f8fafc 50%, transparent 100%),
          radial-gradient(1px 1px at 90% 80%, #94a3b8 50%, transparent 100%)
        `,
        backgroundColor: '#06090d',
      }}
      aria-hidden="true"
    />
  );
}
