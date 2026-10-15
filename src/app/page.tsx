import React from 'react';
import Link from 'next/link';
import { ProvenanceChip } from '@/components/ProvenanceChip';
import { TwinContainer } from '@/components/twin/TwinContainer';
import { SYNTHETIC_SCENARIO_ITEMS } from '@/data/scenario';

export const metadata = {
  title: 'Loopgate // Autonomous Uncertainty Gating for High-Speed Materials Recovery',
  description:
    'Routes risky waste before it reaches the compactor. Simulated estimates for municipal materials recovery facilities.',
};

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-bg-primary text-text-primary">
      {/* ------------------------------------------------------------------- */}
      {/* 1. Main Stage Hero: Confident Industrial HUD Composition            */}
      {/* ------------------------------------------------------------------- */}
      <section className="border-b border-border-subtle bg-bg-primary py-8 sm:py-10 px-4 sm:px-6">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Tagline, Value Statement & Technical Hierarchy */}
          <div className="xl:col-span-4 flex flex-col gap-5 xl:sticky xl:top-20">
            {/* HUD Status Header */}
            <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
              <span className="w-2 h-2 bg-amber-500 rounded-none animate-pulse" />
              <span className="text-[11px] font-mono uppercase tracking-widest text-text-secondary">
                FACILITY-01 // PS-06 SENTINEL
              </span>
            </div>

            {/* Display Headline */}
            <h1 className="text-3xl sm:text-4xl xl:text-5xl font-display font-bold text-text-primary tracking-tight leading-[1.08]">
              Every item passes the gate. Risky ones never reach the compactor.
            </h1>

            {/* Core Value Statement */}
            <p className="text-sm sm:text-base text-text-secondary font-sans leading-relaxed">
              Routes risky waste before it reaches the compactor. Simulated estimates.
            </p>

            {/* Concise Mission Brief */}
            <p className="text-xs sm:text-sm text-text-muted font-sans leading-relaxed">
              High-pressure compactors face severe thermal runaway events when lithium cells or pressurized canisters enter municipal baling lines. Loopgate isolates ambiguous materials before mechanical compaction through conformal uncertainty estimation and real-time pneumatic diversion.
            </p>

            {/* Invariant Highlights */}
            <div className="border border-border-subtle bg-bg-surface p-3 rounded-[2px] flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-border-subtle pb-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-secondary font-bold">
                  Core Invariant EA-01
                </span>
                <ProvenanceChip provenance="Configured" showPrefix={false} />
              </div>
              <div className="text-xs font-mono text-amber-400 font-bold">
                Safety Floor: p(hazard) &ge; 0.30
              </div>
              <div className="text-[11px] font-mono text-text-secondary leading-normal">
                Items with hazard probability at or above 30% are categorically forbidden from reaching the compactor stream under any policy setting.
              </div>
            </div>

            {/* Navigation / Action Links */}
            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
              <Link
                href="/dev/engine"
                className="px-3.5 py-2 bg-bg-surface hover:bg-bg-elevated border border-border-default text-text-primary uppercase tracking-wider rounded-[2px] transition-colors"
              >
                Dev Engine Sandbox &rarr;
              </Link>
              <a
                href="#how-it-decides"
                className="px-3.5 py-2 text-text-secondary hover:text-text-primary border border-transparent hover:border-border-subtle uppercase tracking-wider rounded-[2px] transition-colors"
              >
                Decision Logic &darr;
              </a>
            </div>
          </div>

          {/* Right Column: 3D Sentinel Facility Twin & Live Telemetry Controls */}
          <div className="xl:col-span-8 flex flex-col gap-4">
            <TwinContainer initialItems={SYNTHETIC_SCENARIO_ITEMS} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------- */}
      {/* 2. "How Loopgate Decides": Scan, Gate, Route Architecture          */}
      {/* ------------------------------------------------------------------- */}
      <section id="how-it-decides" className="py-14 px-4 sm:px-6 max-w-[1440px] mx-auto w-full space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border-subtle pb-4">
          <div className="space-y-1">
            <div className="text-xs font-mono uppercase tracking-widest text-amber-500">
              System Architecture // Decision Sequence
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-text-primary">
              How Loopgate Decides
            </h2>
          </div>
          <div className="text-xs font-mono text-text-muted">
            Deterministic Pipeline Execution
          </div>
        </div>

        {/* Hairline 3-Stage Process Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Stage 01: Scan */}
          <div className="border border-border-subtle bg-bg-surface p-5 rounded-[2px] flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <span className="text-xs font-mono font-bold text-text-primary">01 // SCAN</span>
                <ProvenanceChip provenance="Model-inferred" />
              </div>
              <h3 className="text-base font-display font-bold text-text-primary">
                Multi-Sensor Localization
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed font-sans">
                High-speed overhead optical and multi-spectral sensors isolate per-item bounding crops along the intake conveyor. Multi-model detector ensembles infer primary material classes, detection confidence, and hazard probabilities.
              </p>
            </div>
            <div className="pt-3 border-t border-border-subtle text-[11px] font-mono text-text-muted space-y-1">
              <div>&gt; Pipeline: WASM DETR &amp; Zero-Shot ViT</div>
              <div>&gt; Crop Resolution: Isolated per-item</div>
              <div>&gt; Uncertainty: Detection variance logged</div>
            </div>
          </div>

          {/* Stage 02: Gate */}
          <div className="border border-border-subtle bg-bg-surface p-5 rounded-[2px] flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <span className="text-xs font-mono font-bold text-amber-400">02 // GATE</span>
                <ProvenanceChip provenance="Calculated" />
              </div>
              <h3 className="text-base font-display font-bold text-text-primary">
                Conformal Uncertainty Gate
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed font-sans">
                The gate formula balances hazard likelihood against epistemic uncertainty: gateScore = 0.70 &times; p(haz) + 0.30 &times; uncertainty. Items exceeding the strictness threshold are diverted for human verification before mechanical compaction.
              </p>
            </div>
            <div className="pt-3 border-t border-border-subtle text-[11px] font-mono text-text-muted space-y-1">
              <div>&gt; Safety Floor: p &ge; 0.300 (Guaranteed)</div>
              <div>&gt; Strictness: Dynamic operator threshold</div>
              <div>&gt; State Engine: Zero random seeds</div>
            </div>
          </div>

          {/* Stage 03: Route */}
          <div className="border border-border-subtle bg-bg-surface p-5 rounded-[2px] flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <span className="text-xs font-mono font-bold text-text-primary">03 // ROUTE</span>
                <ProvenanceChip provenance="Calculated" />
              </div>
              <h3 className="text-base font-display font-bold text-text-primary">
                Physical Line Actuation
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed font-sans">
                A high-speed mechanical diverter arm sweeps flagged items onto the inspection spur platform or into the quarantine vault. Clear, low-hazard items continue through the hydraulic compaction stream into standard classification bays.
              </p>
            </div>
            <div className="pt-3 border-t border-border-subtle text-[11px] font-mono text-text-muted space-y-1">
              <div>&gt; Hazard Hold: Quarantined lithium cells</div>
              <div>&gt; Spur Bay: Human-assisted verification</div>
              <div>&gt; Recovery Stream: Recyclable, Reusable, Bio</div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------- */}
      {/* 3. Material Classification Registry (The 4 Canonical Classes)       */}
      {/* ------------------------------------------------------------------- */}
      <section className="border-t border-border-subtle bg-bg-surface py-12 px-4 sm:px-6">
        <div className="max-w-[1440px] mx-auto space-y-6">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="space-y-1">
              <span className="text-xs font-mono uppercase tracking-widest text-amber-500">
                Classification Schema // Domain Contracts
              </span>
              <h3 className="text-xl font-display font-bold text-text-primary">
                Four Canonical Material Streams
              </h3>
            </div>
            <ProvenanceChip provenance="Configured" showPrefix={false} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Recyclable */}
            <div className="p-4 border border-border-subtle bg-bg-primary rounded-[2px] space-y-2">
              <div className="text-xs font-mono font-bold text-slate-300 uppercase">
                01 // Recyclable
              </div>
              <p className="text-xs text-text-secondary font-sans leading-relaxed">
                Clean cardboard, corrugated boxes, PET bottles, glass, and aluminum containers. Processed through high-speed municipal baling lines.
              </p>
              <div className="text-[10px] font-mono text-text-muted">Target: Municipal Baler</div>
            </div>

            {/* Reusable */}
            <div className="p-4 border border-border-subtle bg-bg-primary rounded-[2px] space-y-2">
              <div className="text-xs font-mono font-bold text-slate-300 uppercase">
                02 // Reusable
              </div>
              <p className="text-xs text-text-secondary font-sans leading-relaxed">
                Functional apparel, durable plastics, and intact hand tools. Preserved from compaction for secondary refurbishment or charity distribution.
              </p>
              <div className="text-[10px] font-mono text-text-muted">Target: Refurbishment Bay</div>
            </div>

            {/* Biodegradable */}
            <div className="p-4 border border-border-subtle bg-bg-primary rounded-[2px] space-y-2">
              <div className="text-xs font-mono font-bold text-slate-300 uppercase">
                03 // Biodegradable
              </div>
              <p className="text-xs text-text-secondary font-sans leading-relaxed">
                Organic food scraps, untreated yard waste, and certified compostable PLA tableware. Diverted to commercial composting digestors.
              </p>
              <div className="text-[10px] font-mono text-text-muted">Target: Compost Manifold</div>
            </div>

            {/* Hazardous */}
            <div className="p-4 border border-amber-600/40 bg-amber-950/20 rounded-[2px] space-y-2">
              <div className="text-xs font-mono font-bold text-amber-400 uppercase">
                04 // Hazardous (Hero Class)
              </div>
              <p className="text-xs text-text-secondary font-sans leading-relaxed">
                Lithium pouch cells, vape batteries, power banks, damaged electronics, and pressurized cylinders. Primary compactor fire hazards.
              </p>
              <div className="text-[10px] font-mono text-amber-500 font-semibold">
                Target: Quarantine Vault / Spur Bay
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
