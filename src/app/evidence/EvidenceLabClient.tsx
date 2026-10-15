'use client';

/**
 * src/app/evidence/EvidenceLabClient.tsx
 * Client-side wrapper that provides SimulationProvider context to EvidenceLab.
 * This lives in app/evidence/ so the server page stays a Server Component.
 */

import React from 'react';
import { SimulationProvider } from '@/components/twin/SimulationContext';
import { EvidenceLab } from '@/components/evidence/EvidenceLab';

export default function EvidenceLabClient() {
  return (
    <SimulationProvider>
      <EvidenceLab />
    </SimulationProvider>
  );
}
