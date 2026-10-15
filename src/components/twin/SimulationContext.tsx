'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Item, RouteId } from '@/domain/types';
import {
  simulateBatch,
  type SimulationResult,
  type GatePolicy,
  createInitialQualityState,
  updateQualityState,
  type QualityState,
} from '@/engine';
import { SYNTHETIC_SCENARIO_ITEMS } from '@/data/scenario';
import { SAFETY_FLOOR } from '@/engine/gate';
import type { QualityTier } from '../world/qualityTier';

export type QualityMode = 'auto' | 'high' | 'medium' | 'low';

export interface SimulationContextValue {
  items: Item[];
  activeSource: 'simulated' | 'photo';
  photoItems: Item[] | null;
  loadPhotoScenario: (photoItems: Item[]) => void;
  restoreSimulatedScenario: () => void;
  strictnessPct: number;
  setStrictnessPct: (val: number) => void;
  tau: number;
  overrides: Record<string, RouteId>;
  setOverrides: React.Dispatch<React.SetStateAction<Record<string, RouteId>>>;
  setOverrideForItem: (itemId: string, route: RouteId) => void;
  clearOverrideForItem: (itemId: string) => void;
  policy: GatePolicy;
  simulationResult: SimulationResult;
  currentTime: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  playbackSpeed: 0.5 | 1.0 | 2.0;
  setPlaybackSpeed: (speed: 0.5 | 1.0 | 2.0) => void;
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;
  hoveredItemId: string | null;
  setHoveredItemId: (id: string | null) => void;
  maxDuration: number;
  activeChapter: number;
  setActiveChapter: (ch: number) => void;
  qualityTier: QualityTier;
  setQualityTier: (t: QualityTier) => void;
  qualityMode: QualityMode;
  setQualityMode: (m: QualityMode) => void;
  fps: number;
  setFps: (f: number) => void;
  cameraResetKey: number;
  triggerCameraReset: () => void;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function useSimulation(): SimulationContextValue {
  const ctx = useContext(SimulationContext);
  if (!ctx) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return ctx;
}

interface SimulationProviderProps {
  initialItems?: Item[];
  children: React.ReactNode;
}

export function SimulationProvider({
  initialItems = SYNTHETIC_SCENARIO_ITEMS,
  children,
}: SimulationProviderProps) {
  // Strictness & Tau mapping
  const [strictnessPct, setStrictnessPct] = useState(50);
  const tau = useMemo(() => {
    return +(0.48 - (strictnessPct / 100) * 0.40).toFixed(3);
  }, [strictnessPct]);

  // Manual overrides
  const [overrides, setOverrides] = useState<Record<string, RouteId>>({});

  const setOverrideForItem = useCallback((itemId: string, route: RouteId) => {
    setOverrides((prev) => ({ ...prev, [itemId]: route }));
  }, []);

  const clearOverrideForItem = useCallback((itemId: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }, []);

  const [items, setItems] = useState<Item[]>(initialItems);
  const [photoItems, setPhotoItems] = useState<Item[] | null>(null);
  const [activeSource, setActiveSource] = useState<'simulated' | 'photo'>('simulated');

  const loadPhotoScenario = useCallback((newItems: Item[]) => {
    setPhotoItems(newItems);
    setItems(newItems);
    setActiveSource('photo');
    setOverrides({});
    setCurrentTime(0);
    setIsPlaying(true);
  }, []);

  const restoreSimulatedScenario = useCallback(() => {
    setItems(initialItems);
    setActiveSource('simulated');
    setOverrides({});
    setCurrentTime(0);
    setIsPlaying(true);
  }, [initialItems]);

  // Policy & simulation result
  const policy: GatePolicy = useMemo(() => {
    return {
      safetyFloor: SAFETY_FLOOR,
      hazardConfidentCutoff: 0.85,
      inspectionThreshold: tau,
    };
  }, [tau]);

  const simulationResult = useMemo(() => {
    return simulateBatch(items, policy, overrides);
  }, [items, policy, overrides]);

  // Timeline & playback
  const [currentTime, setCurrentTime] = useState(0.0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1.0 | 2.0>(1.0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState(0);

  // Quality & FPS with continuous 3-second < 45 FPS auto-downgrade
  const [qualityMode, setQualityMode] = useState<QualityMode>('auto');
  const [qualityTier, setQualityTier] = useState<QualityTier>('HIGH');
  const [fps, setFps] = useState(60);
  const [cameraResetKey, setCameraResetKey] = useState(0);

  const qualityStateRef = useRef<QualityState>(createInitialQualityState(qualityTier, qualityMode));
  const lastFpsTimeRef = useRef<number>(performance.now());

  // Keep quality manager state in sync with manual mode / tier changes
  useEffect(() => {
    qualityStateRef.current.mode = qualityMode;
    if (qualityMode !== 'auto') {
      const t: QualityTier = qualityMode === 'high' ? 'HIGH' : qualityMode === 'medium' ? 'MEDIUM' : 'LOW';
      qualityStateRef.current.tier = t;
      qualityStateRef.current.consecutiveLowFpsMs = 0;
      setQualityTier(t);
    }
  }, [qualityMode]);

  const handleSetFps = useCallback((f: number) => {
    setFps(f);
    const now = performance.now();
    const elapsed = Math.min(2000, Math.max(16, now - lastFpsTimeRef.current));
    lastFpsTimeRef.current = now;

    const result = updateQualityState(qualityStateRef.current, f, elapsed);
    qualityStateRef.current = result.state;
    if (result.downgraded && result.newTier) {
      setQualityTier(result.newTier);
    }
  }, []);

  const triggerCameraReset = useCallback(() => {
    setCameraResetKey((k) => k + 1);
  }, []);

  const maxDuration = useMemo(() => {
    return items.length * 2.0 + 6.0;
  }, [items.length]);

  // Ticking loop for simulation time
  const lastTimeRef = useRef<number>(performance.now());
  const rafIdRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    const now = performance.now();
    const delta = (now - lastTimeRef.current) / 1000;
    lastTimeRef.current = now;

    if (isPlaying) {
      setCurrentTime((prev) => {
        const next = prev + delta * playbackSpeed;
        if (next >= maxDuration) {
          return 0.0;
        }
        return next;
      });
    }

    rafIdRef.current = requestAnimationFrame(tick);
  }, [isPlaying, playbackSpeed, maxDuration]);

  useEffect(() => {
    lastTimeRef.current = performance.now();
    rafIdRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [tick]);

  const value: SimulationContextValue = {
    items,
    activeSource,
    photoItems,
    loadPhotoScenario,
    restoreSimulatedScenario,
    strictnessPct,
    setStrictnessPct,
    tau,
    overrides,
    setOverrides,
    setOverrideForItem,
    clearOverrideForItem,
    policy,
    simulationResult,
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    selectedItemId,
    setSelectedItemId,
    hoveredItemId,
    setHoveredItemId,
    maxDuration,
    activeChapter,
    setActiveChapter,
    qualityTier,
    setQualityTier,
    qualityMode,
    setQualityMode,
    fps,
    setFps: handleSetFps,
    cameraResetKey,
    triggerCameraReset,
  };

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}
