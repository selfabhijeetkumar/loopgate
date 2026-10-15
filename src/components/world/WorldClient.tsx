'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const World = dynamic(
  () => import('./World').then((m) => m.World),
  { ssr: false }
);

export function WorldClient() {
  return <World />;
}
