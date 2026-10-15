'use client';

/**
 * World.tsx
 * The single full-viewport react-three-fiber WebGL world for Loopgate.
 * Fixed at inset 0, z-index 0 behind all DOM content.
 * Driven by GSAP ScrollTrigger along the 6 chapter keyframes.
 * Only ONE WebGL context exists in the entire application.
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useSimulation } from '@/components/twin/SimulationContext';
import { WorldScene, CHAPTER_CAMERA_STATES, type WorldSceneHandle } from './WorldScene';
import { WorldCursor } from './WorldCursor';
import { TIER_CONFIGS } from './qualityTier';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export function World() {
  const {
    items,
    simulationResult,
    currentTime,
    isPlaying,
    selectedItemId,
    setSelectedItemId,
    qualityTier,
    setQualityTier,
    qualityMode,
    setFps,
    activeChapter,
    setActiveChapter,
  } = useSimulation();

  const sceneRef = useRef<WorldSceneHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);
  const [hasWebGL, setHasWebGL] = useState(true);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Pause rendering when tab is hidden
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisChange = () => setIsTabHidden(document.hidden);
    document.addEventListener('visibilitychange', handleVisChange);
    return () => document.removeEventListener('visibilitychange', handleVisChange);
  }, []);

  // WebGL availability probe
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) setHasWebGL(false);
    } catch {
      setHasWebGL(false);
    }
  }, []);

  // Catmull-Rom spline curves through the 6 chapter camera positions
  const { positionCurve, targetCurve } = useMemo(() => {
    const posPoints = CHAPTER_CAMERA_STATES.map((s) => s.position.clone());
    const tarPoints = CHAPTER_CAMERA_STATES.map((s) => s.target.clone());
    return {
      positionCurve: new THREE.CatmullRomCurve3(posPoints, false, 'catmullrom', 0.4),
      targetCurve: new THREE.CatmullRomCurve3(tarPoints, false, 'catmullrom', 0.4),
    };
  }, []);

  // ScrollTrigger integration
  useEffect(() => {
    if (typeof window === 'undefined' || !hasWebGL) return;

    // Refresh ScrollTrigger after DOM settle
    const timeout = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 200);

    // Watch data-chapter sections for chapter identification
    const chapterEls = document.querySelectorAll<HTMLElement>('[data-chapter]');
    const triggers: ScrollTrigger[] = [];

    chapterEls.forEach((el) => {
      const chAttr = el.getAttribute('data-chapter');
      if (chAttr === null) return;
      const chNum = parseInt(chAttr, 10);

      const st = ScrollTrigger.create({
        trigger: el,
        start: 'top 60%',
        end: 'bottom 40%',
        onEnter: () => setActiveChapter(chNum),
        onEnterBack: () => setActiveChapter(chNum),
      });
      triggers.push(st);
    });

    // Master scrub across entire scroll height
    const masterTrigger = ScrollTrigger.create({
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      scrub: reducedMotion ? false : 0.5,
      onUpdate: (self) => {
        const p = Math.max(0, Math.min(1, self.progress));
        const pos = positionCurve.getPoint(p);
        const tar = targetCurve.getPoint(p);

        // Interpolate FOV smoothly between adjacent chapters
        const segmentFloat = p * (CHAPTER_CAMERA_STATES.length - 1);
        const idx = Math.min(CHAPTER_CAMERA_STATES.length - 2, Math.floor(segmentFloat));
        const frac = segmentFloat - idx;
        const fov =
          CHAPTER_CAMERA_STATES[idx].fov +
          (CHAPTER_CAMERA_STATES[idx + 1].fov - CHAPTER_CAMERA_STATES[idx].fov) * frac;

        sceneRef.current?.setCameraState({
          position: pos,
          target: tar,
          fov,
        });
      },
    });

    return () => {
      clearTimeout(timeout);
      triggers.forEach((t) => t.kill());
      masterTrigger.kill();
    };
  }, [hasWebGL, positionCurve, targetCurve, reducedMotion, setActiveChapter]);

  // Auto-downgrade handler
  const handleAutoDowngrade = useCallback(() => {
    if (qualityMode !== 'auto') return;
    if (qualityTier === 'HIGH') setQualityTier('MEDIUM');
    else if (qualityTier === 'MEDIUM') setQualityTier('LOW');
  }, [qualityMode, qualityTier, setQualityTier]);

  const tierConfig = TIER_CONFIGS[qualityTier];

  // In chapter 4 (RUN IT YOURSELF), enable pointer events on canvas so items can be clicked/hovered
  const isInteractiveChapter = activeChapter === 4;

  const selectedItem = useMemo(() => {
    return items.find((it) => it.id === selectedItemId);
  }, [items, selectedItemId]);

  const selectedDecision = useMemo(() => {
    return simulationResult.decisions.find((d) => d.itemId === selectedItemId);
  }, [simulationResult.decisions, selectedItemId]);

  return (
    <div
      ref={containerRef}
      id="loopgate-world-viewport"
      data-testid="world-canvas-container"
      className="fixed inset-0 z-0 overflow-hidden"
      style={{
        pointerEvents: isInteractiveChapter ? 'auto' : 'none',
      }}
      aria-hidden="true"
    >
      {hasWebGL ? (
        <Canvas
          frameloop={isTabHidden ? 'never' : 'always'}
          dpr={tierConfig.dpr}
          shadows={tierConfig.shadows}
          gl={{
            antialias: tierConfig.antialias,
            powerPreference: 'high-performance',
            alpha: false,
          }}
          camera={{
            position: CHAPTER_CAMERA_STATES[0].position.toArray(),
            fov: CHAPTER_CAMERA_STATES[0].fov,
            near: 0.2,
            far: 100,
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        >
          <WorldScene
            ref={sceneRef}
            items={items}
            decisions={simulationResult.decisions}
            currentTime={currentTime}
            isPlaying={isPlaying}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            tier={qualityTier}
            onFpsUpdate={setFps}
            chapter={activeChapter}
            interactionEnabled={isInteractiveChapter}
            reducedMotion={reducedMotion}
          />
        </Canvas>
      ) : (
        <div className="absolute inset-0 bg-[#070a0d] flex items-center justify-center">
          <div className="font-mono text-xs text-text-muted p-4 border border-border-subtle bg-bg-surface max-w-sm text-center">
            [WEBGL HARDWARE ACCELERATION UNAVAILABLE]
            <br />
            DISPLAYING 2D TELEMETRY TWIN
          </div>
        </div>
      )}

      {/* 3D Cursor Probe overlay fallback / reticle */}
      <WorldCursor
        enabled={!reducedMotion && qualityTier !== 'LOW' && typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches}
        lockedItemId={selectedItemId}
        lockedItemLabel={selectedItem ? `${selectedItem.id} // ${selectedItem.name}` : undefined}
        lockedItemHazardPct={selectedItem ? selectedItem.hazardProbability * 100 : undefined}
        isHazard={selectedItem ? selectedItem.hazardProbability >= 0.30 : false}
      />
    </div>
  );
}

export default World;
