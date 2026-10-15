'use client';

/**
 * src/components/replay/ReplayClient.tsx
 * Client wrapper: reads items from SimulationContext, renders ReplayTheatre.
 * Must be inside SimulationProvider (provided by page.tsx).
 */

import React from 'react';
import { useSimulation } from '@/components/twin/SimulationContext';
import { ReplayTheatre } from './ReplayTheatre';

export function ReplayClient() {
  const { items } = useSimulation();
  return <ReplayTheatre items={items} />;
}
