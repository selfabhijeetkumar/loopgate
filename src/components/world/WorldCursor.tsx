'use client';

/**
 * WorldCursor.tsx
 * DOM overlay 3D cursor probe — a small faceted scanner ring following the pointer.
 * Rendered as an SVG overlay (not in WebGL) so it never blocks clicks or focus.
 * Disabled on touch and for LOW quality tier.
 */

import React, { useEffect, useRef, useState } from 'react';

interface CursorState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tilt: number;
  spin: number;
  locked: boolean;
  overInteractive: boolean;
}

export interface WorldCursorProps {
  enabled: boolean; // false on touch, LOW tier, reduced-motion
  lockedItemId: string | null; // when hovering item in chapter 4
  lockedItemLabel?: string;
  lockedItemHazardPct?: number; // 0-100
  isHazard?: boolean;
}

export function WorldCursor({
  enabled,
  lockedItemId,
  lockedItemLabel,
  lockedItemHazardPct,
  isHazard,
}: WorldCursorProps) {
  const stateRef = useRef<CursorState>({
    x: -100, y: -100,
    vx: 0, vy: 0,
    tilt: 0,
    spin: 0,
    locked: false,
    overInteractive: false,
  });
  const rafRef = useRef<number>(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const s = stateRef.current;
    let targetX = s.x, targetY = s.y;
    let prevX = s.x, prevY = s.y;

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      // Check if target is an interactive element
      const el = e.target as Element;
      s.overInteractive = !!(el.closest('button, a, input, select, textarea, [role="button"]'));
    };

    const animate = () => {
      // Smooth damped follow
      s.vx = (targetX - s.x) * 0.18;
      s.vy = (targetY - s.y) * 0.18;
      s.x += s.vx;
      s.y += s.vy;

      // Tilt toward movement direction
      const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
      const targetTilt = Math.atan2(s.vy, s.vx);
      s.tilt += (targetTilt - s.tilt) * 0.1;

      // Spin faster over interactive
      const spinRate = s.overInteractive ? 0.06 : 0.018;
      s.spin = (s.spin + spinRate + speed * 0.003) % (Math.PI * 2);

      prevX = s.x;
      prevY = s.y;

      setTick((t) => t + 1); // trigger re-render
      rafRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [enabled]);

  if (!enabled) return null;

  const s = stateRef.current;
  const locked = !!lockedItemId;
  const size = locked ? 28 : 18;
  const color = isHazard ? '#f59e0b' : '#94a3b8';
  const ringColor = locked ? '#f59e0b' : color;
  const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);

  // Don't show cursor over interactive elements
  if (s.overInteractive) return null;

  return (
    <>
      {/* Hide the native cursor globally via CSS injection on mount */}
      <style>{`body { cursor: none !important; }
        button, a, input, select, textarea, [role="button"] { cursor: pointer !important; }`}
      </style>

      {/* The probe ring */}
      <svg
        ref={svgRef}
        style={{
          position: 'fixed',
          left: s.x - size,
          top: s.y - size,
          width: size * 2,
          height: size * 2,
          pointerEvents: 'none',
          zIndex: 9999,
          transform: `rotate(${s.spin}rad)`,
          transition: locked ? 'none' : undefined,
          willChange: 'transform',
        }}
        viewBox={`${-size} ${-size} ${size * 2} ${size * 2}`}
        fill="none"
      >
        {/* Outer faceted ring (hexagonal approximation) */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a0 = (i / 6) * Math.PI * 2;
          const a1 = ((i + 1) / 6) * Math.PI * 2;
          const r = size - 3;
          const x0 = Math.cos(a0) * r;
          const y0 = Math.sin(a0) * r;
          const x1 = Math.cos(a1) * r;
          const y1 = Math.sin(a1) * r;
          return (
            <line
              key={i}
              x1={x0} y1={y0} x2={x1} y2={y1}
              stroke={ringColor}
              strokeWidth={locked ? 1.5 : 1}
              opacity={0.7 + (i % 2) * 0.3}
            />
          );
        })}
        {/* Core dot */}
        <circle cx={0} cy={0} r={locked ? 3.5 : 2} fill={ringColor} opacity={0.9} />
        {/* Tilt axis line */}
        <line
          x1={0} y1={0}
          x2={Math.cos(s.tilt) * (size - 5)} y2={Math.sin(s.tilt) * (size - 5)}
          stroke={ringColor} strokeWidth={0.6} opacity={0.4}
        />
        {/* Corner brackets when locked */}
        {locked && (
          <>
            {/* Top-left bracket */}
            <path d={`M ${-size+4} ${-size+8} L ${-size+4} ${-size+4} L ${-size+8} ${-size+4}`} stroke="#f59e0b" strokeWidth={1.5} />
            {/* Top-right bracket */}
            <path d={`M ${size-8} ${-size+4} L ${size-4} ${-size+4} L ${size-4} ${-size+8}`} stroke="#f59e0b" strokeWidth={1.5} />
            {/* Bottom-left bracket */}
            <path d={`M ${-size+4} ${size-8} L ${-size+4} ${size-4} L ${-size+8} ${size-4}`} stroke="#f59e0b" strokeWidth={1.5} />
            {/* Bottom-right bracket */}
            <path d={`M ${size-8} ${size-4} L ${size-4} ${size-4} L ${size-4} ${size-8}`} stroke="#f59e0b" strokeWidth={1.5} />
          </>
        )}
      </svg>

      {/* Locked item label clamped inside viewport */}
      {locked && lockedItemLabel && (
        <div
          style={{
            position: 'fixed',
            left: Math.max(
              16,
              Math.min(
                (typeof window !== 'undefined' ? window.innerWidth : 1280) - 220,
                s.x > (typeof window !== 'undefined' ? window.innerWidth : 1280) - 240
                  ? s.x - 220 - size
                  : s.x + size + 8
              )
            ),
            top: Math.max(
              16,
              Math.min((typeof window !== 'undefined' ? window.innerHeight : 800) - 60, s.y - 18)
            ),
            pointerEvents: 'none',
            zIndex: 9999,
            background: 'rgba(8,10,14,0.95)',
            border: `1px solid ${isHazard ? '#f59e0b' : '#475569'}`,
            padding: '3px 6px',
            fontFamily: 'monospace',
            fontSize: 9,
            color: '#e2e8f0',
            whiteSpace: 'nowrap',
            lineHeight: 1.5,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{lockedItemLabel}</span>
          {lockedItemHazardPct !== undefined && (
            <>
              <br />
              <span style={{ color: isHazard ? '#f87171' : '#34d399' }}>
                p(haz): {lockedItemHazardPct.toFixed(1)}%
              </span>
              <span style={{ color: '#94a3b8', marginLeft: 4 }}>[SYNTHETIC]</span>
            </>
          )}
        </div>
      )}
    </>
  );
}
