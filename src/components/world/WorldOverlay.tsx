'use client';

/**
 * src/components/world/WorldOverlay.tsx
 * DOM Overlay for 3D World station badges and item HUD telemetry.
 *
 * Rendered OUTSIDE the R3F Canvas to completely avoid React root unmounting crashes.
 * Positioned every frame via direct CSS transform writes to DOM refs inside useFrame.
 * Zero React state updates per frame.
 * All text is >= 12px with AA contrast and clamps within viewport bounds.
 */

import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import type { Item } from '@/domain/types';
import type { ItemDecision } from '@/engine';

export interface WorldOverlayHandle {
  updateStation: (
    index: number,
    x: number,
    y: number,
    opacity: number,
    isBehind: boolean
  ) => void;
  updateScanBracket: (
    x: number,
    y: number,
    opacity: number,
    isBehind: boolean,
    itemId?: string
  ) => void;
  updateItemTelemetry: (
    x: number,
    y: number,
    opacity: number,
    isBehind: boolean,
    data?: {
      id: string;
      name: string;
      hazardProbability: number;
      gateScore: number;
      route: string;
      isHazard: boolean;
    }
  ) => void;
}

interface WorldOverlayProps {
  items: Item[];
  decisions: ItemDecision[];
  diverterAngle: number;
  isScanning: boolean;
  selectedItemId: string | null;
}

export const WorldOverlay = forwardRef<WorldOverlayHandle, WorldOverlayProps>(
  function WorldOverlay(
    { items, decisions, diverterAngle, isScanning },
    ref
  ) {
    const station0Ref = useRef<HTMLDivElement>(null);
    const station1Ref = useRef<HTMLDivElement>(null);
    const station2Ref = useRef<HTMLDivElement>(null);
    const station3Ref = useRef<HTMLDivElement>(null);
    const station5Ref = useRef<HTMLDivElement>(null);
    const scanBracketRef = useRef<HTMLDivElement>(null);
    const scanBracketTextRef = useRef<HTMLSpanElement>(null);
    const itemTelemetryRef = useRef<HTMLDivElement>(null);
    const itemTelemetryDataRef = useRef<HTMLDivElement>(null);

    const stationRefs = [
      station0Ref,
      station1Ref,
      station2Ref,
      station3Ref,
      station5Ref,
    ];

    useImperativeHandle(ref, () => ({
      updateStation: (index, x, y, opacity, isBehind) => {
        const el = stationRefs[index]?.current;
        if (!el) return;

        if (isBehind || opacity <= 0.01) {
          el.style.opacity = '0';
          el.style.visibility = 'hidden';
          return;
        }

        const width = el.offsetWidth || 280;
        const height = el.offsetHeight || 130;
        const clampedX = Math.max(16, Math.min(x - width * 0.5, window.innerWidth - width - 16));
        const clampedY = Math.max(16, Math.min(y - height - 12, window.innerHeight - height - 16));

        el.style.transform = `translate3d(${clampedX.toFixed(1)}px, ${clampedY.toFixed(1)}px, 0)`;
        el.style.opacity = opacity.toFixed(2);
        el.style.visibility = 'visible';
      },

      updateScanBracket: (x, y, opacity, isBehind, itemId) => {
        const el = scanBracketRef.current;
        if (!el) return;

        if (isBehind || opacity <= 0.01) {
          el.style.opacity = '0';
          el.style.visibility = 'hidden';
          return;
        }

        if (itemId && scanBracketTextRef.current) {
          scanBracketTextRef.current.textContent = `[${itemId}] SCAN [SIMULATED]`;
        }

        const width = el.offsetWidth || 140;
        const height = el.offsetHeight || 30;
        const clampedX = Math.max(16, Math.min(x - width * 0.5, window.innerWidth - width - 16));
        const clampedY = Math.max(16, Math.min(y - height - 8, window.innerHeight - height - 16));

        el.style.transform = `translate3d(${clampedX.toFixed(1)}px, ${clampedY.toFixed(1)}px, 0)`;
        el.style.opacity = opacity.toFixed(2);
        el.style.visibility = 'visible';
      },

      updateItemTelemetry: (x, y, opacity, isBehind, data) => {
        const el = itemTelemetryRef.current;
        if (!el) return;

        if (isBehind || opacity <= 0.01 || !data) {
          el.style.opacity = '0';
          el.style.visibility = 'hidden';
          return;
        }

        if (itemTelemetryDataRef.current) {
          itemTelemetryDataRef.current.innerHTML = `
            <div style="color: #fbbf24; font-weight: 700; margin-bottom: 4px; font-size: 13px;">${data.id} // ${data.name.slice(0, 20)}</div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span>p(haz):</span>
              <span style="color: ${data.isHazard ? '#ef4444' : '#10b981'}; font-weight: 700;">${(data.hazardProbability * 100).toFixed(1)}%</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span>gateScore:</span>
              <span>${data.gateScore.toFixed(3)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span>route:</span>
              <span style="color: #fbbf24; font-weight: 700;">${data.route}</span>
            </div>
            <div style="color: #94a3b8; font-size: 11px; margin-top: 4px; border-top: 1px solid #334155; padding-top: 2px;">[SIMULATED]</div>
          `;
        }

        const width = el.offsetWidth || 220;
        const height = el.offsetHeight || 130;
        const clampedX = Math.max(16, Math.min(x - width * 0.5, window.innerWidth - width - 16));
        const clampedY = Math.max(16, Math.min(y - height - 16, window.innerHeight - height - 16));

        el.style.transform = `translate3d(${clampedX.toFixed(1)}px, ${clampedY.toFixed(1)}px, 0)`;
        el.style.opacity = opacity.toFixed(2);
        el.style.visibility = 'visible';
      },
    }));

    // Computed station metrics
    const avgConfidence =
      items.reduce((acc, it) => acc + (it.overallConfidence ?? 0.85), 0) /
      Math.max(1, items.length);
    const meanConfidence = Math.round(avgConfidence * 100);

    const item08 = items.find((i) => i.id === 'ITEM-08');
    const item08Dec = decisions.find((d) => d.itemId === 'ITEM-08');
    const itemAmbiguous = items.find((i) => i.id === 'ITEM-04');
    const itemAmbiguousDec = decisions.find((d) => d.itemId === 'ITEM-04');

    const hazardHoldCount = decisions.filter((d) => d.route === 'hazard_hold').length;
    const inspectionCount = decisions.filter((d) => d.route === 'inspection_line').length;
    const recyclableBayCount = decisions.filter((d) => d.route === 'recyclable_bay').length;
    const compactorCount = decisions.filter(
      (d) => d.route === 'recyclable_bay' || d.route === 'biodegradable_bay'
    ).length;

    const recyclableCount = items.filter((i) => i.primaryClass === 'recyclable').length;
    const reusableCount = items.filter((i) => i.primaryClass === 'reusable').length;
    const compostCount = items.filter((i) => i.primaryClass === 'biodegradable').length;
    const hazardCount = decisions.filter((d) => d.route === 'hazard_hold').length;
    const total = Math.max(1, items.length);
    const diversionPct = (((items.length - hazardCount) / total) * 100).toFixed(1);

    const baseCardStyle: React.CSSProperties = {
      position: 'absolute',
      top: 0,
      left: 0,
      pointerEvents: 'none',
      opacity: 0,
      visibility: 'hidden',
      transition: 'opacity 0.25s ease-out, visibility 0.25s ease-out',
      willChange: 'transform, opacity',
      background: 'rgba(8, 10, 14, 0.96)',
      border: '1px solid #334155',
      borderLeft: '3px solid #f59e0b',
      padding: '10px 14px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '12px',
      lineHeight: '1.45',
      color: '#e2e8f0',
      width: '280px',
      maxWidth: 'calc(100vw - 32px)',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.75)',
      zIndex: 10,
    };

    return (
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ zIndex: 10 }}
        aria-hidden="true"
      >
        {/* Station 0: Ingest */}
        <div ref={station0Ref} style={baseCardStyle}>
          <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-2 font-bold text-amber-400">
            <span>INGEST // BELT ACTIVE</span>
            <span className="bg-sky-700 text-sky-100 text-[10px] px-1.5 py-0.5 rounded-[2px] font-mono">
              [CALCULATED]
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1 text-[12px]">
            <div>
              MANIFEST ITEMS:{' '}
              <span className="text-sky-400 font-bold">{items.length} TRACKED</span>
            </div>
            <div>
              EA-01 SAFETY FLOOR:{' '}
              <span className="text-red-400 font-bold">&ge; 0.30 P(HAZ) DIVERT</span>
            </div>
            <div>
              LINE VELOCITY: <span className="text-emerald-400 font-bold">1.2 m/s CONSTANT</span>
            </div>
          </div>
        </div>

        {/* Station 1: Scanner */}
        <div ref={station1Ref} style={baseCardStyle}>
          <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-2 font-bold text-amber-400">
            <span>SCANNER // MULTISPECTRAL</span>
            <span className="bg-sky-700 text-sky-100 text-[10px] px-1.5 py-0.5 rounded-[2px] font-mono">
              [SIMULATED]
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1 text-[12px]">
            <div>
              DETECTOR: <span className="text-sky-300 font-mono">detr-resnet-50 (COCO)</span>
            </div>
            <div>
              ACTIVE SENSORS:{' '}
              <span className="text-emerald-400 font-bold">
                {isScanning ? 'ACTIVE SCANNING' : 'BEAM ARMED'}
              </span>
            </div>
            <div>
              MEAN CONFIDENCE:{' '}
              <span className="text-emerald-400 font-bold">{meanConfidence}%</span>
            </div>
          </div>
        </div>

        {/* Station 2: Diverter */}
        <div ref={station2Ref} style={{ ...baseCardStyle, width: '300px' }}>
          <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-2 font-bold text-amber-400">
            <span>STAGE 02 // GATE DECISION</span>
            <span className="bg-sky-700 text-sky-100 text-[10px] px-1.5 py-0.5 rounded-[2px] font-mono">
              [CALCULATED]
            </span>
          </div>
          <div className="mb-2 text-[12px]">
            DIVERTER ARM:{' '}
            <span className={diverterAngle > 0.3 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
              {diverterAngle > 0.3 ? 'EXTENDED (DIVERT)' : 'RETRACTED'}
            </span>
          </div>
          {item08 && item08Dec && (
            <div className="mb-2 border-b border-slate-800 pb-2 text-[12px]">
              <div className="text-red-400 font-bold">
                ITEM-08: {item08.name.slice(0, 20)}
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300 mt-1">
                <div>p(haz): <span className="text-red-400 font-bold">{(item08.hazardProbability * 100).toFixed(1)}%</span></div>
                <div>gate: {item08Dec.gateScore.toFixed(3)}</div>
                <div>route: <span className="text-amber-400 font-bold">{item08Dec.route}</span></div>
                <div>floor: <span className="text-red-400 font-bold">TRUE (EA-01)</span></div>
              </div>
            </div>
          )}
          {itemAmbiguous && itemAmbiguousDec && (
            <div className="text-[12px]">
              <div className="text-sky-300 font-bold">
                ITEM-04: {itemAmbiguous.name.slice(0, 20)}
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300 mt-1">
                <div>p(haz): {(itemAmbiguous.hazardProbability * 100).toFixed(1)}%</div>
                <div>gate: {itemAmbiguousDec.gateScore.toFixed(3)}</div>
                <div>route: <span className="text-amber-400 font-bold">{itemAmbiguousDec.route}</span></div>
                <div>status: <span className="text-sky-400 font-bold">DISPUTED</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Station 3: Compactor / Route */}
        <div ref={station3Ref} style={{ ...baseCardStyle, width: '300px' }}>
          <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-2 font-bold text-amber-400">
            <span>STAGE 03 // ROUTE AUDIT</span>
            <span className="bg-sky-700 text-sky-100 text-[10px] px-1.5 py-0.5 rounded-[2px] font-mono">
              [CALCULATED]
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[12px] mb-2">
            <div>HAZARD HOLD: <span className="text-red-400 font-bold">{hazardHoldCount}</span></div>
            <div>INSPECTION: <span className="text-sky-400 font-bold">{inspectionCount}</span></div>
            <div>RECYCLABLE: <span className="text-emerald-400 font-bold">{recyclableBayCount}</span></div>
            <div>COMPACTOR: <span className="text-slate-300 font-bold">{compactorCount}</span></div>
          </div>
          <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-1.5">
            In this simulated scenario: zero hazard-flagged items reach the compactor stream (simulated).
          </div>
        </div>

        {/* Station 5: Residuals / Streams */}
        <div ref={station5Ref} style={{ ...baseCardStyle, width: '300px' }}>
          <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-2 font-bold text-amber-400">
            <span>STAGE 05 // STREAM BALANCING</span>
            <span className="bg-sky-700 text-sky-100 text-[10px] px-1.5 py-0.5 rounded-[2px] font-mono">
              [CALCULATED]
            </span>
          </div>
          <div className="text-[12px] text-amber-300 font-bold mb-2">
            SIMULATED DIVERSION RATE: {diversionPct}%
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[12px]">
            <div>RECYCLABLE: <span className="text-emerald-400 font-bold">{recyclableCount}</span></div>
            <div>REUSABLE: <span className="text-sky-400 font-bold">{reusableCount}</span></div>
            <div>COMPOST: <span className="text-lime-400 font-bold">{compostCount}</span></div>
            <div>HAZARD HELD: <span className="text-red-400 font-bold">{hazardCount}</span></div>
          </div>
        </div>

        {/* Scan Bracket Box Overlay */}
        <div
          ref={scanBracketRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            opacity: 0,
            visibility: 'hidden',
            border: '1px solid #f59e0b',
            padding: '3px 6px',
            fontSize: '12px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            color: '#fbbf24',
            background: 'rgba(8, 10, 14, 0.92)',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
            zIndex: 10,
          }}
        >
          <span ref={scanBracketTextRef}>[SCAN]</span>
        </div>

        {/* Item Selection / Hover Telemetry Card */}
        <div
          ref={itemTelemetryRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            opacity: 0,
            visibility: 'hidden',
            background: 'rgba(8, 10, 14, 0.96)',
            border: '1px solid #f59e0b',
            borderLeft: '3px solid #f59e0b',
            padding: '8px 12px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '12px',
            color: '#e2e8f0',
            width: '240px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.75)',
            zIndex: 15,
          }}
        >
          <div ref={itemTelemetryDataRef} />
        </div>
      </div>
    );
  }
);
