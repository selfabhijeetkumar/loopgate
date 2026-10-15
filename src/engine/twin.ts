/**
 * twin.ts -- Loopgate Digital Twin Timeline
 *
 * Produces a structured timeline of events for the 3D digital twin visualization.
 * The digital twin reflects the same deterministic sorting engine state as sort.ts.
 *
 * Key exports:
 *   buildTwinTimeline(result)  -- extract and enrich tick events from SimulationResult
 *   TwinEvent                  -- a single twin state transition event
 *
 * Pure TypeScript. Zero UI or network imports. No Math.random.
 */

import type { RouteId, SortingLineStage } from '../domain/types';
import type { SimulationResult, TickEvent } from './sort';

/** A processed event for the 3D digital twin to animate. */
export interface TwinEvent {
  /** Elapsed seconds from batch start. */
  t: number;
  itemId: string;
  itemName: string;
  stage: SortingLineStage;
  route: RouteId;
  /** Short label for belt position annotation. */
  label: string;
  /** Color category for visual encoding WITHOUT relying on color alone. */
  colorCategory: 'hazard' | 'inspection' | 'class' | 'neutral';
  /** Reason code from gate decision for tooltip display. */
  reasonCode: string;
}

/** Mapping from route to color category for twin rendering. */
function routeColorCategory(route: RouteId): TwinEvent['colorCategory'] {
  switch (route) {
    case 'hazard_hold':    return 'hazard';
    case 'inspection_line': return 'inspection';
    case 'compactor':      return 'neutral';
    default:               return 'class'; // recyclable, reusable, biodegradable bays
  }
}

/** Snapshot of the entire sorting line at a single point in time. */
export interface TwinSnapshot {
  t: number;
  /** Events occurring at exactly this time step. */
  events: TwinEvent[];
  /** Per-route cumulative item count at this time step. */
  routeCounts: Record<RouteId, number>;
}

/**
 * Build the full twin event timeline from a SimulationResult.
 * Returns events sorted by ascending t.
 */
export function buildTwinTimeline(result: SimulationResult): TwinEvent[] {
  const { decisions, ticks } = result;

  // Build a lookup from itemId to name and reasonCode
  const decisionMap = new Map(decisions.map((d) => [d.itemId, d]));

  const events: TwinEvent[] = ticks.map((tick: TickEvent) => {
    const decision = decisionMap.get(tick.itemId);
    return {
      t: tick.t,
      itemId: tick.itemId,
      itemName: decision?.itemName ?? tick.itemId,
      stage: tick.stage,
      route: tick.route,
      label: tick.label,
      colorCategory: routeColorCategory(tick.route),
      reasonCode: decision?.reasonCode ?? '',
    };
  });

  // Sort by t ascending for sequential playback
  return events.sort((a, b) => a.t - b.t);
}

/**
 * Build discrete snapshots at each unique time step.
 * Useful for scrubbing through the timeline.
 */
export function buildTwinSnapshots(events: TwinEvent[]): TwinSnapshot[] {
  const timeSet = Array.from(new Set(events.map((e) => e.t))).sort((a, b) => a - b);
  const cumulativeCounts: Record<RouteId, number> = {
    compactor: 0,
    inspection_line: 0,
    recyclable_bay: 0,
    reusable_bay: 0,
    biodegradable_bay: 0,
    hazard_hold: 0,
  };

  return timeSet.map((t) => {
    const stepEvents = events.filter((e) => e.t === t && e.stage === 'routed');
    for (const ev of stepEvents) {
      cumulativeCounts[ev.route] = (cumulativeCounts[ev.route] ?? 0) + 1;
    }
    return {
      t,
      events: events.filter((e) => e.t === t),
      routeCounts: { ...cumulativeCounts },
    };
  });
}
