'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { Item, RouteId } from '@/domain/types';
import { simulateBatch, type SimulationResult } from '@/engine';
import { SYNTHETIC_SCENARIO_ITEMS } from '@/data/scenario';
import { ProvenanceChip } from '@/components/ProvenanceChip';
import { Diagram2DFallback } from './Diagram2DFallback';

// Dynamic import of 3D Canvas chunk (no SSR)
const SentinelScene = dynamic(
  () => import('./SentinelScene').then((mod) => mod.SentinelScene),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[520px] bg-[#080a0c] flex flex-col items-center justify-center gap-3 border border-border-subtle text-text-secondary font-mono text-xs">
        <div className="w-6 h-6 border-2 border-border-default border-t-amber-500 animate-spin rounded-none" />
        <span>INITIALIZING SENTINEL 3D KINEMATICS ENGINE...</span>
      </div>
    ),
  }
);

interface TwinContainerProps {
  initialItems?: Item[];
  className?: string;
}

export function TwinContainer({
  initialItems = SYNTHETIC_SCENARIO_ITEMS,
  className = '',
}: TwinContainerProps) {
  // -------------------------------------------------------------------------
  // State: Engine Policy & Overrides
  // -------------------------------------------------------------------------
  const [strictnessPct, setStrictnessPct] = useState(50); // 0 to 100%
  // Map strictness (0% to 100%) inversely onto active gate threshold [0.50, 0.10]
  const tau = useMemo(() => {
    return +(0.50 - (strictnessPct / 100) * 0.40).toFixed(3);
  }, [strictnessPct]);

  const [overrides, setOverrides] = useState<Record<string, RouteId>>({});
  const [overrideModalItem, setOverrideModalItem] = useState<Item | null>(null);
  const [pendingOverrideRoute, setPendingOverrideRoute] = useState<RouteId | null>(null);
  const [overrideErrorMessage, setOverrideErrorMessage] = useState<string | null>(null);

  // Policy configuration
  const policy = useMemo(() => {
    return {
      safetyFloor: 0.30,
      hazardConfidentCutoff: 0.85,
      inspectionThreshold: tau,
      assumptions: [],
    };
  }, [tau]);

  // Run deterministic simulation
  const simulationResult: SimulationResult = useMemo(() => {
    return simulateBatch(initialItems, policy, overrides);
  }, [initialItems, policy, overrides]);

  // -------------------------------------------------------------------------
  // State: Playback & Timeline
  // -------------------------------------------------------------------------
  const [currentTime, setCurrentTime] = useState(0.0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1.0 | 2.0>(1.0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [fps, setFps] = useState(60);
  const [lowPowerMode, setLowPowerMode] = useState(false);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [cameraResetKey, setCameraResetKey] = useState(0);

  const maxDuration = useMemo(() => {
    return initialItems.length * 2.0 + 6.0; // ~46 seconds for 20 items
  }, [initialItems.length]);

  // Animation frame loop for smooth playback
  const lastTimeRef = useRef<number>(performance.now());
  const animationFrameIdRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    const now = performance.now();
    const delta = (now - lastTimeRef.current) / 1000;
    lastTimeRef.current = now;

    if (isPlaying) {
      setCurrentTime((prev) => {
        const next = prev + delta * playbackSpeed;
        if (next >= maxDuration) {
          return 0.0; // Loop seamlessly
        }
        return next;
      });
    }

    animationFrameIdRef.current = requestAnimationFrame(tick);
  }, [isPlaying, playbackSpeed, maxDuration]);

  useEffect(() => {
    lastTimeRef.current = performance.now();
    animationFrameIdRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [tick]);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches) {
        setViewMode('2d');
      }
    }
  }, []);

  // Keyboard navigation shortcuts (Space: toggle play, R: restart, 1/2/3: speed)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        setCurrentTime(0);
      } else if (e.key === '1') {
        setPlaybackSpeed(0.5);
      } else if (e.key === '2') {
        setPlaybackSpeed(1.0);
      } else if (e.key === '3') {
        setPlaybackSpeed(2.0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // -------------------------------------------------------------------------
  // Handlers: Judge Override
  // -------------------------------------------------------------------------
  const handleOpenOverride = (item: Item, targetRoute: RouteId) => {
    setOverrideModalItem(item);
    setPendingOverrideRoute(targetRoute);
    setOverrideErrorMessage(null);

    // Immediate safety-floor invariant validation check
    if (item.hazardProbability >= policy.safetyFloor && targetRoute !== 'inspection_line' && targetRoute !== 'hazard_hold') {
      setOverrideErrorMessage(
        `REFUSED [OVERRIDE_REFUSED_SAFETY_FLOOR]: Item ${item.id} has hazard probability ${item.hazardProbability.toFixed(
          3
        )} >= safety floor 0.30. Invariant EA-01 strictly prohibits routing hazard-floor items to compactor stream.`
      );
    }
  };

  const handleConfirmOverride = () => {
    if (!overrideModalItem || !pendingOverrideRoute) return;

    if (overrideModalItem.hazardProbability >= policy.safetyFloor && pendingOverrideRoute !== 'inspection_line' && pendingOverrideRoute !== 'hazard_hold') {
      // Invariant protects floor
      return;
    }

    setOverrides((prev) => ({
      ...prev,
      [overrideModalItem.id]: pendingOverrideRoute,
    }));
    setOverrideModalItem(null);
    setPendingOverrideRoute(null);
  };

  const handleClearOverride = (itemId: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const selectedDecision = useMemo(() => {
    if (!selectedItemId) return null;
    return simulationResult.decisions.find((d) => d.itemId === selectedItemId);
  }, [selectedItemId, simulationResult.decisions]);

  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return initialItems.find((item) => item.id === selectedItemId);
  }, [selectedItemId, initialItems]);

  return (
    <section
      aria-label="Loopgate Sentinel Facility 3D Digital Twin and Telemetry Stage"
      className={`relative flex flex-col gap-3 font-sans ${className}`}
    >
      {/* ------------------------------------------------------------------- */}
      {/* 1. HUD Header Bar (Direction A Industrial Telemetry)                */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-bg-surface border border-border-subtle p-3 rounded-[2px]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-amber-500 rounded-none animate-pulse" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-text-primary">
              FACILITY-01 // SENTINEL DIGITAL TWIN
            </h2>
          </div>
          <span className="text-[11px] font-mono text-text-muted hidden sm:inline">
            |
          </span>
          <span className="text-[11px] font-mono text-text-secondary hidden sm:inline">
            ACTIVE BATCH: {initialItems.length} ITEMS [SIM]
          </span>
        </div>

        {/* Viewport Control Toggles */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher (3D WebGL vs 2D Schematic) */}
          <div className="flex border border-border-subtle rounded-[2px] p-0.5 bg-bg-primary">
            <button
              onClick={() => setViewMode('3d')}
              className={`px-2.5 py-1 text-[10px] font-mono tracking-wider transition-colors rounded-[2px] ${
                viewMode === '3d'
                  ? 'bg-text-primary text-bg-primary font-bold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              3D TWIN
            </button>
            <button
              onClick={() => setViewMode('2d')}
              className={`px-2.5 py-1 text-[10px] font-mono tracking-wider transition-colors rounded-[2px] ${
                viewMode === '2d'
                  ? 'bg-text-primary text-bg-primary font-bold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              2D SCHEMATIC
            </button>
          </div>

          {/* Low-Power Mode Toggle */}
          <button
            onClick={() => setLowPowerMode((lp) => !lp)}
            title="Toggle simplified shaders and 1x pixel ratio for integrated GPUs"
            className={`px-2 py-1 text-[10px] font-mono border rounded-[2px] transition-colors ${
              lowPowerMode
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                : 'border-border-subtle text-text-secondary hover:text-text-primary'
            }`}
          >
            LOW-POWER: {lowPowerMode ? 'ON' : 'OFF'}
          </button>

          {/* Camera Reset (in 3D mode) */}
          {viewMode === '3d' && (
            <button
              onClick={() => setCameraResetKey((k) => k + 1)}
              title="Reset camera to hero isometric framing"
              className="px-2 py-1 text-[10px] font-mono border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-elevated rounded-[2px] transition-colors"
            >
              RESET CAM
            </button>
          )}

          {/* Real-time FPS readout */}
          {viewMode === '3d' && (
            <div className="px-2 py-1 text-[10px] font-mono border border-border-subtle text-text-muted bg-bg-primary rounded-[2px]">
              FPS: <span className={fps >= 45 ? 'text-green-400' : 'text-amber-400'}>{fps}</span>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 2. Main Viewport Stage with Industrial Reticle Marks               */}
      {/* ------------------------------------------------------------------- */}
      <div className="relative border border-border-subtle bg-[#080a0c] overflow-hidden rounded-[2px]">
        {/* Reticle HUD Corners */}
        <div className="absolute top-2 left-2 z-10 text-[9px] font-mono text-border-default select-none pointer-events-none">
          + LAT: 01.442 / LON: 08.192
        </div>
        <div className="absolute top-2 right-2 z-10 text-[9px] font-mono text-border-default select-none pointer-events-none">
          STATION: SCAN-GATE-01 +
        </div>
        <div className="absolute bottom-2 left-2 z-10 text-[9px] font-mono text-border-default select-none pointer-events-none">
          + REAL-TIME SIMULATION MATRIX
        </div>
        <div className="absolute bottom-2 right-2 z-10 text-[9px] font-mono text-border-default select-none pointer-events-none">
          SAFETY FLOOR: 0.300 +
        </div>

        {/* Viewport Render (3D or 2D) */}
        <div className="w-full h-[480px] md:h-[540px]">
          {viewMode === '3d' ? (
            <SentinelScene
              items={initialItems}
              decisions={simulationResult.decisions}
              currentTime={currentTime}
              isPlaying={isPlaying}
              selectedItemId={selectedItemId}
              onSelectItem={(id) => setSelectedItemId(id)}
              lowPowerMode={lowPowerMode}
              onFpsUpdate={setFps}
              cameraResetKey={cameraResetKey}
            />
          ) : (
            <div className="p-4 h-full overflow-y-auto">
              <Diagram2DFallback
                items={initialItems}
                decisions={simulationResult.decisions}
                currentTime={currentTime}
                isPlaying={isPlaying}
                onTogglePlay={() => setIsPlaying((p) => !p)}
                onRestart={() => setCurrentTime(0)}
                onStepForward={() => setCurrentTime((t) => Math.min(maxDuration, t + 1))}
                onStepBackward={() => setCurrentTime((t) => Math.max(0, t - 1))}
                selectedItemId={selectedItemId}
                onSelectItem={(id) => setSelectedItemId(id)}
              />
            </div>
          )}
        </div>

        {/* Floating Item Inspector Badge (when an item is selected in viewport) */}
        {selectedItem && selectedDecision && (
          <aside
            aria-label="Selected item inspection telemetry"
            className="absolute top-10 left-4 z-20 w-72 bg-bg-surface/95 border border-border-default p-3 backdrop-blur-md shadow-2xl rounded-[2px] font-mono text-xs"
          >
            <div className="flex items-center justify-between border-b border-border-subtle pb-2 mb-2">
              <span className="font-bold text-text-primary uppercase tracking-wide">
                {selectedItem.id} // {selectedItem.name}
              </span>
              <button
                onClick={() => setSelectedItemId(null)}
                aria-label="Close inspector"
                className="text-text-muted hover:text-text-primary px-1"
              >
                [X]
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[11px] mb-3">
              <div className="text-text-muted">Primary Class:</div>
              <div className="text-text-primary font-bold uppercase">{selectedItem.primaryClass}</div>

              <div className="text-text-muted">Hazard Prob:</div>
              <div className={selectedItem.hazardProbability >= 0.30 ? 'text-amber-400 font-bold' : 'text-text-primary'}>
                {(selectedItem.hazardProbability * 100).toFixed(1)}%
              </div>

              <div className="text-text-muted">Gate Score:</div>
              <div className="text-text-primary">{selectedDecision.gateScore.toFixed(3)}</div>

              <div className="text-text-muted">Assigned Route:</div>
              <div className="text-amber-400 font-bold uppercase">{selectedDecision.route}</div>

              <div className="text-text-muted">Decision Code:</div>
              <div className="text-text-secondary text-[10px] truncate" title={selectedDecision.reasonCode}>
                {selectedDecision.reasonCode}
              </div>
            </div>

            {/* Overrides control buttons */}
            <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-2">
              <span className="text-[10px] text-text-secondary tracking-widest uppercase">
                Judge Manual Override:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  id="inspector-divert-btn"
                  onClick={() => handleOpenOverride(selectedItem, 'inspection_line')}
                  className="px-2 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[10px] font-bold rounded-[2px] transition-colors"
                >
                  Divert Inspection
                </button>
                <button
                  id="inspector-standard-line-btn"
                  onClick={() => handleOpenOverride(selectedItem, 'recyclable_bay')}
                  className="px-2 py-1.5 bg-bg-elevated hover:bg-bg-primary border border-border-default text-text-secondary hover:text-text-primary text-[10px] rounded-[2px] transition-colors"
                >
                  Standard Line
                </button>
              </div>
              {overrides[selectedItem.id] && (
                <button
                  id="inspector-clear-override-btn"
                  onClick={() => handleClearOverride(selectedItem.id)}
                  className="mt-1 px-2 py-1 text-[10px] text-text-muted hover:text-amber-400 border border-border-subtle rounded-[2px] transition-colors"
                >
                  Clear Custom Override
                </button>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 3. Playback Controls & Live Strictness Slider Strip                */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 bg-bg-surface border border-border-subtle p-3 rounded-[2px]">
        {/* Playback Controls (Cols 1-5) */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-2 border-b lg:border-b-0 lg:border-r border-border-subtle pb-3 lg:pb-0 lg:pr-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-text-secondary uppercase tracking-widest">
              Timeline Telemetry & Playback
            </span>
            <span className="text-[11px] font-mono text-amber-400 font-bold">
              T+{currentTime.toFixed(1).padStart(4, '0')}s / T+{maxDuration.toFixed(1)}s
            </span>
          </div>

          {/* Scrubber slider */}
          <input
            type="range"
            min={0}
            max={maxDuration}
            step={0.1}
            value={currentTime}
            onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
            aria-label="Timeline scrubber position"
            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-bg-primary rounded-none"
          />

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsPlaying((p) => !p)}
                aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
                className="px-3 py-1 bg-text-primary text-bg-primary hover:bg-text-secondary text-xs font-mono font-bold tracking-wider rounded-[2px] transition-colors"
              >
                {isPlaying ? 'PAUSE' : 'PLAY'}
              </button>
              <button
                onClick={() => setCurrentTime(0)}
                aria-label="Restart simulation from intake"
                className="px-2.5 py-1 border border-border-subtle text-text-secondary hover:text-text-primary text-xs font-mono rounded-[2px] transition-colors"
              >
                RESTART
              </button>
            </div>

            {/* Playback Speed Selectors */}
            <div className="flex items-center border border-border-subtle rounded-[2px] p-0.5 bg-bg-primary">
              {([0.5, 1.0, 2.0] as const).map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded-[2px] transition-colors ${
                    playbackSpeed === spd
                      ? 'bg-border-default text-text-primary font-bold'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Strictness Control (Cols 6-12) */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label
                htmlFor="strictness-slider"
                className="text-xs font-mono font-bold text-text-primary uppercase tracking-wider"
              >
                Inspection Strictness: {strictnessPct}%
              </label>
              <ProvenanceChip provenance="Calculated" />
            </div>
            <span className="text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-[2px]">
              tau = {tau.toFixed(3)}
            </span>
          </div>

          <input
            id="strictness-slider"
            type="range"
            min={0}
            max={100}
            value={strictnessPct}
            onChange={(e) => setStrictnessPct(parseInt(e.target.value, 10))}
            className="w-full accent-amber-500 cursor-pointer h-2 bg-bg-primary rounded-none"
            aria-label="Inspection strictness slider (maps to uncertainty gate threshold)"
          />

          <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
            <span>0% (tau = 0.500: Max Throughput)</span>
            <span>50% (tau = 0.300: Balanced)</span>
            <span>100% (tau = 0.100: Max Inspection)</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 4. Real-time Calculated Telemetry Bar                              */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric 1: Expected Hazard Exposure */}
        <div className="bg-bg-surface border border-border-subtle p-3 rounded-[2px] flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">
              Expected Hazard Exposure
            </span>
            <ProvenanceChip provenance="Calculated" />
          </div>
          <div className="text-xl font-mono font-bold text-text-primary">
            {simulationResult.metrics.expectedHazardExposure.toFixed(3)}
          </div>
          <span className="text-[10px] font-mono text-text-muted">
            Residual compactor fire risk
          </span>
        </div>

        {/* Metric 2: Inspection Load */}
        <div className="bg-bg-surface border border-border-subtle p-3 rounded-[2px] flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">
              Inspection Load
            </span>
            <ProvenanceChip provenance="Calculated" />
          </div>
          <div className="text-xl font-mono font-bold text-amber-400">
            {simulationResult.metrics.inspectionLoad.toFixed(1)} / min
          </div>
          <span className="text-[10px] font-mono text-text-muted">
            {simulationResult.metrics.inspectionLineCount} of {initialItems.length} items diverted
          </span>
        </div>

        {/* Metric 3: Effective Throughput */}
        <div className="bg-bg-surface border border-border-subtle p-3 rounded-[2px] flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">
              Line Throughput
            </span>
            <ProvenanceChip provenance="Calculated" />
          </div>
          <div className="text-xl font-mono font-bold text-text-primary">
            {simulationResult.metrics.throughputPerMinute.toFixed(1)} <span className="text-xs text-text-muted">items/min</span>
          </div>
          <span className="text-[10px] font-mono text-text-muted">
            {simulationResult.metrics.backlogActive ? 'Backlog penalty applied' : 'Nominal sorting flow'}
          </span>
        </div>

        {/* Metric 4: Safety Invariants */}
        <div className="bg-bg-surface border border-border-subtle p-3 rounded-[2px] flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">
              Compactor Escapes
            </span>
            <ProvenanceChip provenance="Calculated" />
          </div>
          <div className="text-xl font-mono font-bold text-green-400">
            {simulationResult.metrics.safetyFloorEscapeCount}
          </div>
          <span className="text-[10px] font-mono text-text-muted">
            Floor triggers: {simulationResult.metrics.safetyFloorTriggerCount} items
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 5. Accessible Mirrored Item Telemetry Table                         */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-bg-surface border border-border-subtle rounded-[2px] overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-bg-elevated border-b border-border-subtle">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-text-primary">
            Accessible Facility Manifest // Synchronized Item Stream
          </h3>
          <span className="text-[10px] font-mono text-text-muted">
            Tab or click row to inspect / divert
          </span>
        </div>
        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-left text-xs font-mono" role="table">
            <thead className="bg-bg-primary text-text-muted uppercase text-[10px] border-b border-border-subtle sticky top-0">
              <tr>
                <th className="py-2 px-3">Item ID</th>
                <th className="py-2 px-3">Material</th>
                <th className="py-2 px-3">Class</th>
                <th className="py-2 px-3">Hazard P</th>
                <th className="py-2 px-3">Gate Score</th>
                <th className="py-2 px-3">Assigned Route</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {initialItems.map((item) => {
                const dec = simulationResult.decisions.find((d) => d.itemId === item.id);
                const isSelected = selectedItemId === item.id;
                const isFloor = item.hazardProbability >= 0.30;
                return (
                  <tr
                    key={item.id}
                    id={`row-${item.id}`}
                    onClick={() => setSelectedItemId(item.id)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setSelectedItemId(item.id);
                    }}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-amber-500/10 text-text-primary'
                        : 'hover:bg-bg-elevated text-text-secondary'
                    }`}
                  >
                    <td className="py-1.5 px-3 font-bold text-text-primary">
                      {item.id}
                    </td>
                    <td className="py-1.5 px-3 truncate max-w-[140px]">{item.name}</td>
                    <td className="py-1.5 px-3 uppercase text-[10px]">{item.primaryClass}</td>
                    <td className={`py-1.5 px-3 font-mono ${isFloor ? 'text-amber-400 font-bold' : ''}`}>
                      {(item.hazardProbability * 100).toFixed(1)}%
                    </td>
                    <td className="py-1.5 px-3 font-mono">{dec?.gateScore.toFixed(3) ?? '---'}</td>
                    <td className="py-1.5 px-3">
                      <span
                        className={`px-1.5 py-0.5 text-[9px] uppercase font-bold rounded-[1px] ${
                          dec?.route === 'inspection_line' || dec?.route === 'hazard_hold'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-border-default/50 text-text-secondary'
                        }`}
                      >
                        {dec?.route}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-right">
                      <button
                        id={`divert-btn-${item.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenOverride(item, 'inspection_line');
                        }}
                        className="px-2 py-0.5 text-[10px] bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-[2px]"
                      >
                        Divert
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 6. Judge Manual Override Confirmation Dialog Modal                  */}
      {/* ------------------------------------------------------------------- */}
      {overrideModalItem && pendingOverrideRoute && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="override-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <div className="bg-bg-surface border border-border-default max-w-md w-full p-5 rounded-[2px] shadow-2xl flex flex-col gap-4 font-mono">
            <div className="flex items-center justify-between border-b border-border-subtle pb-2">
              <h3 id="override-dialog-title" className="text-xs font-bold text-text-primary uppercase tracking-wider">
                CONFIRM OPERATOR OVERRIDE // JUDGE ACTION
              </h3>
              <button
                id="modal-close-btn"
                onClick={() => setOverrideModalItem(null)}
                className="text-text-muted hover:text-text-primary text-xs"
              >
                [ESC]
              </button>
            </div>

            <div className="text-xs flex flex-col gap-2">
              <div className="text-text-secondary">
                Requested route override for item{' '}
                <span className="text-text-primary font-bold">{overrideModalItem.id}</span> (
                {overrideModalItem.name}):
              </div>

              <div className="bg-bg-primary border border-border-subtle p-2.5 rounded-[2px] flex flex-col gap-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-text-muted">Target Route:</span>
                  <span className="text-amber-400 font-bold uppercase">{pendingOverrideRoute}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Hazard Probability:</span>
                  <span className="text-text-primary">
                    {(overrideModalItem.hazardProbability * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Safety Floor Cutoff:</span>
                  <span className="text-text-primary">{(policy.safetyFloor * 100).toFixed(1)}%</span>
                </div>
              </div>

              {/* Refusal warning if safety floor violated */}
              {overrideErrorMessage ? (
                <div
                  id="override-refusal-alert"
                  role="alert"
                  className="bg-red-950/40 border border-red-500/60 p-2.5 text-[11px] text-red-300 rounded-[2px]"
                >
                  {overrideErrorMessage}
                </div>
              ) : (
                <div className="text-[11px] text-text-muted">
                  Applying this override will re-simulate the batch deterministically and update the 3D twin line routing.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-3">
              <button
                id="modal-cancel-btn"
                onClick={() => setOverrideModalItem(null)}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary border border-border-subtle rounded-[2px] transition-colors"
              >
                CANCEL
              </button>
              <button
                id="modal-confirm-btn"
                onClick={handleConfirmOverride}
                disabled={Boolean(overrideErrorMessage)}
                className={`px-4 py-1.5 text-xs font-bold rounded-[2px] transition-colors ${
                  overrideErrorMessage
                    ? 'bg-border-default text-text-muted cursor-not-allowed'
                    : 'bg-amber-500 text-black hover:bg-amber-400'
                }`}
              >
                CONFIRM OVERRIDE
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
