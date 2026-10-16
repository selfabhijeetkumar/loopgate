'use client';

/**
 * src/components/replay/ReplayClient.tsx
 * Client wrapper: reads items from SimulationContext, renders ReplayTheatre.
 * Must be inside SimulationProvider (provided by page.tsx).
 */

import React from 'react';
import { useSimulation } from '@/components/twin/SimulationContext';
import { SYNTHETIC_SCENARIO_ITEMS } from '@/data/scenario';
import { ReplayTheatre } from './ReplayTheatre';

export function ReplayClient() {
  const { items, photoItems, activeSource, tau, policy } = useSimulation();
  const activeThreshold = tau ?? policy?.inspectionThreshold ?? 0.28;
  return (
    <ReplayTheatre
      items={items}
      simulatedItems={SYNTHETIC_SCENARIO_ITEMS}
      photoItems={photoItems}
      activeSource={activeSource}
      threshold={activeThreshold}
    />
  );
}
