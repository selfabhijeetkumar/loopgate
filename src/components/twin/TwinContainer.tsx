'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { Item, RouteId } from '@/domain/types';
import { ProvenanceChip } from '@/components/ProvenanceChip';
import { Diagram2DFallback } from './Diagram2DFallback';
import { SAFETY_FLOOR } from '@/engine/gate';
import { useSimulation } from './SimulationContext';
import { QualityControl } from '../world/QualityControl';

interface TwinContainerProps {
  className?: string;
}

export function TwinContainer({ className = '' }: TwinContainerProps) {
  const {
    items,
    strictnessPct,
    setStrictnessPct,
    tau,
    overrides,
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
    maxDuration,
    triggerCameraReset,
    activeSource,
    restoreSimulatedScenario,
  } = useSimulation();

  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [overrideModalItem, setOverrideModalItem] = useState<Item | null>(null);
  const [pendingOverrideRoute, setPendingOverrideRoute] = useState<RouteId | null>(null);
  const [overrideErrorMessage, setOverrideErrorMessage] = useState<string | null>(null);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches) {
        setViewMode('2d');
      }
    }
  }, []);

  // Keyboard navigation shortcuts
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
  }, [setIsPlaying, setCurrentTime, setPlaybackSpeed]);

  // Handlers: Judge Override
  const handleOpenOverride = (item: Item, targetRoute: RouteId) => {
    setOverrideModalItem(item);
    setPendingOverrideRoute(targetRoute);
    setOverrideErrorMessage(null);

    if (
      item.hazardProbability >= policy.safetyFloor &&
      targetRoute !== 'inspection_line' &&
      targetRoute !== 'hazard_hold'
    ) {
      setOverrideErrorMessage(
        `REFUSED [OVERRIDE_REFUSED_SAFETY_FLOOR]: Item ${item.id} has hazard probability ${item.hazardProbability.toFixed(
          3
        )} >= safety floor ${SAFETY_FLOOR}. Invariant EA-01 strictly prohibits routing hazard-floor items to compactor stream.`
      );
    }
  };

  const handleConfirmOverride = () => {
    if (!overrideModalItem || !pendingOverrideRoute) return;

    if (
      overrideModalItem.hazardProbability >= policy.safetyFloor &&
      pendingOverrideRoute !== 'inspection_line' &&
      pendingOverrideRoute !== 'hazard_hold'
    ) {
      return;
    }

    setOverrideForItem(overrideModalItem.id, pendingOverrideRoute);
    setOverrideModalItem(null);
    setPendingOverrideRoute(null);
  };

  const selectedDecision = useMemo(() => {
    if (!selectedItemId) return null;
    return simulationResult.decisions.find((d) => d.itemId === selectedItemId);
  }, [selectedItemId, simulationResult.decisions]);

  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return items.find((item) => item.id === selectedItemId);
  }, [selectedItemId, items]);

  return (
    <section
      aria-label="Loopgate Sentinel Facility Digital Twin Controls"
      className={`relative flex flex-col gap-3 font-sans ${className}`}
    >
      {/* ------------------------------------------------------------------- */}
      {/* 1. HUD Header Bar (Direction A Industrial Telemetry)                */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-bg-surface/95 border border-border-subtle p-3 rounded-[2px]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-amber-500 rounded-none animate-pulse" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-text-primary">
              FACILITY-01 // SENTINEL DIGITAL TWIN
            </h2>
          </div>
          <span className="text-[11px] font-mono text-text-secondary hidden sm:inline">
            ACTIVE BATCH: {items.length} ITEMS [{activeSource === 'photo' ? 'PHOTO LIVE LINK' : 'SIMULATED'}]
          </span>
          {activeSource === 'photo' && (
            <button
              onClick={restoreSimulatedScenario}
              className="px-2 py-0.5 text-[10px] font-mono bg-bg-elevated hover:bg-bg-surface border border-border-default text-amber-400 hover:text-amber-300 rounded-[2px] transition-colors"
              title="Reset twin to default simulated scenario"
            >
              [Reset to Simulated]
            </button>
          )}
        </div>

        {/* Viewport Control Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
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

          {/* Quality Controls */}
          <QualityControl />

          {/* Camera Reset */}
          {viewMode === '3d' && (
            <button
              onClick={triggerCameraReset}
              title="Reset camera framing"
              className="px-2 py-1 text-[10px] font-mono border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-elevated rounded-[2px] transition-colors"
            >
              RESET CAM
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 2. Main Viewport Stage (Transparent Portal in 3D, SVG in 2D)        */}
      {/* ------------------------------------------------------------------- */}
      <div
        className={`relative border border-border-subtle overflow-hidden rounded-[2px] transition-colors ${
          viewMode === '3d' ? 'bg-transparent' : 'bg-bg-surface/90'
        }`}
      >
        {/* Reticle HUD Corners */}
        <div className="absolute top-2 left-2 z-10 text-[9px] font-mono text-text-muted select-none pointer-events-none">
          + SENTINEL-01 SYNTHETIC STREAM
        </div>
        <div className="absolute top-2 right-2 z-10 text-[9px] font-mono text-text-muted select-none pointer-events-none">
          STATION: SCAN-GATE-01 +
        </div>
        <div className="absolute bottom-2 left-2 z-10 text-[9px] font-mono text-text-muted select-none pointer-events-none">
          + REAL-TIME SIMULATION MATRIX
        </div>
        <div className="absolute bottom-2 right-2 z-10 text-[9px] font-mono text-text-muted select-none pointer-events-none">
          SAFETY FLOOR: {SAFETY_FLOOR.toFixed(3)} +
        </div>

        {/* Viewport Frame */}
        <div className="w-full h-[440px] md:h-[500px] relative">
          {viewMode === '3d' ? (
            <div className="w-full h-full flex flex-col items-center justify-between p-4 pointer-events-none select-none">
              <div className="text-[10px] font-mono text-text-secondary bg-[#090c10]/75 backdrop-blur-sm border border-border-subtle/80 px-3 py-1 rounded-[2px]">
                3D SENTINEL FACILITY TWIN // INTERACTIVE ORBIT CAMERA ACTIVE
              </div>
              <div className="text-[10px] font-mono text-amber-400 bg-[#090c10]/75 backdrop-blur-sm border border-border-subtle/80 px-3 py-1 rounded-[2px]">
                Hover or click any 3D item along the belt to inspect telemetry or trigger manual divert
              </div>
            </div>
          ) : (
            <div className="p-3 h-full">
              <Diagram2DFallback
                items={items}
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

          {/* Floating Item Inspector Badge (when an item is selected) */}
          {selectedItem && selectedDecision && (
            <aside
              aria-label="Selected item inspection telemetry"
              className="absolute top-10 left-4 z-20 w-72 bg-bg-surface/95 border border-border-default p-3 shadow-2xl rounded-[2px] font-mono text-xs pointer-events-auto"
            >
              <div className="flex items-center justify-between border-b border-border-subtle pb-2 mb-2">
                <span className="font-bold text-text-primary uppercase tracking-wide truncate max-w-[200px]">
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
                <div
                  className={
                    selectedItem.hazardProbability >= SAFETY_FLOOR
                      ? 'text-amber-400 font-bold'
                      : 'text-text-primary'
                  }
                >
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
                    onClick={() => clearOverrideForItem(selectedItem.id)}
                    className="mt-1 px-2 py-1 text-[10px] text-text-muted hover:text-amber-400 border border-border-subtle rounded-[2px] transition-colors"
                  >
                    Clear Custom Override
                  </button>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 3. Playback Controls & Live Strictness Slider Strip                */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 bg-bg-surface border border-border-subtle p-3 rounded-[2px]">
        {/* Playback Controls (Cols 1-5) */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-2 border-b lg:border-b-0 lg:border-r border-border-subtle pb-3 lg:pb-0 lg:pr-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-text-secondary uppercase tracking-widest">
              Timeline Telemetry &amp; Playback
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

        {/* Live Strictness Slider (Cols 6-12) */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-text-secondary uppercase tracking-widest">
                Gating Strictness Setting
              </span>
              <ProvenanceChip provenance="Configured" showPrefix={false} />
            </div>
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="text-text-muted">
                Threshold (&tau;):{' '}
                <span className="text-amber-400 font-bold">{tau.toFixed(3)}</span>
              </span>
              <span className="text-text-secondary">[{strictnessPct}%]</span>
            </div>
          </div>

          <input
            id="strictness-slider"
            type="range"
            min={0}
            max={100}
            step={1}
            value={strictnessPct}
            onChange={(e) => setStrictnessPct(parseInt(e.target.value, 10))}
            aria-label="Gating strictness slider from 0% to 100%"
            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-bg-primary rounded-none"
          />

          <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
            <span>0% (tau = {(0.48).toFixed(3)}: Max Throughput)</span>
            <span>50% (tau = {(0.48 - 0.5 * 0.40).toFixed(3)}: Balanced)</span>
            <span>100% (tau = {(0.48 - 0.40).toFixed(3)}: Max Inspection)</span>
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
            Estimated residual hazard (simulated)
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
            {simulationResult.metrics.inspectionLineCount} of {items.length} items diverted
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
            {simulationResult.metrics.throughputPerMinute.toFixed(1)}{' '}
            <span className="text-xs text-text-muted">items/min</span>
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
              {items.map((item) => {
                const dec = simulationResult.decisions.find((d) => d.itemId === item.id);
                const isSelected = selectedItemId === item.id;
                const isFloor = item.hazardProbability >= SAFETY_FLOOR;
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
                    <td className="py-1.5 px-3 font-bold text-text-primary">{item.id}</td>
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

export default TwinContainer;
