import React from 'react';
import dynamic from 'next/dynamic';
import { ProvenanceChip } from '@/components/ProvenanceChip';
import { TwinContainer } from '@/components/twin/TwinContainer';
import { SimulationProvider } from '@/components/twin/SimulationContext';
import { DEFAULT_ASSUMPTIONS } from '@/data/scenario';
import { ScrollReveal } from '@/components/ScrollReveal';
import { HAZARD_WEIGHT, SAFETY_FLOOR } from '@/engine/gate';
import { HeroCTAs } from '@/components/HeroCTAs';
import { ReplayClient } from '@/components/replay/ReplayClient';

import { WorldClient } from '@/components/world/WorldClient';
import { EvidenceLab } from '@/components/evidence/EvidenceLab';

export const metadata = {
  title: 'Loopgate // Autonomous Uncertainty Gating for High-Speed Materials Recovery',
  description:
    'Routes risky waste before it reaches the compactor. Simulated estimates for municipal materials recovery facilities.',
};

const uncertaintyWeight = +(1 - HAZARD_WEIGHT).toFixed(2);

export default function HomePage() {
  return (
    <SimulationProvider>
      {/* ------------------------------------------------------------------- */}
      {/* Background 3D World Canvas (Single WebGL context, inset 0)          */}
      {/* ------------------------------------------------------------------- */}
      <WorldClient />

      {/* ------------------------------------------------------------------- */}
      {/* Main Page DOM Content (Layered above canvas with dark scrims)       */}
      {/* ------------------------------------------------------------------- */}
      <main className="relative z-10 flex-1 flex flex-col min-h-screen text-text-primary">

        {/* ----------------------------------------------------------------- */}
        {/* CHAPTER 0: HERO (Wide establishing view, floating hazard objects) */}
        {/* ----------------------------------------------------------------- */}
        <section
          data-chapter="0"
          id="hero"
          className="min-h-[85vh] flex items-center py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
          aria-labelledby="hero-heading"
        >
          {/* Narrow left column with light scrim so 3D scene is the star */}
          <div className="max-w-lg lg:max-w-md bg-[#090c10]/75 border border-border-subtle p-5 sm:p-6 rounded-[2px] shadow-2xl flex flex-col gap-4">
            {/* HUD Status Header */}
            <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
              <span className="w-2 h-2 bg-amber-500 rounded-none animate-pulse" />
              <span className="text-[11px] font-mono uppercase tracking-widest text-text-secondary">
                FACILITY-01 // PS-06 SENTINEL // CHAPTER 00
              </span>
            </div>

            {/* Display Headline */}
            <h1
              id="hero-heading"
              className="text-2xl sm:text-3xl xl:text-4xl font-display font-bold text-text-primary tracking-tight leading-[1.12]"
            >
              Every item passes the gate. Risky ones{' '}
              <span className="font-serif-italic font-normal text-amber-400">never</span> reach the
              compactor.
            </h1>

            {/* Core Value Statement */}
            <p className="text-xs sm:text-sm text-text-secondary font-sans leading-relaxed">
              Routes risky waste before it reaches the compactor. Simulated estimates.
            </p>

            {/* Mission Brief — honesty-compliant */}
            <p className="text-xs text-text-muted font-sans leading-relaxed">
              High-pressure compactors face severe thermal-runaway events when lithium cells or
              pressurized canisters enter municipal baling lines. Loopgate uses model-inferred
              hazard estimation and deterministic uncertainty gating to route ambiguous items for
              human verification before simulated compaction.
            </p>

            {/* Invariant Highlight */}
            <div className="border border-border-subtle bg-bg-surface/80 p-3 rounded-[2px] flex flex-col gap-1.5">
              <div className="flex items-center justify-between border-b border-border-subtle pb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-secondary font-bold">
                  Core Invariant EA-01
                </span>
                <ProvenanceChip provenance="Configured" showPrefix={false} />
              </div>
              <div className="text-xs font-mono text-amber-400 font-bold">
                Safety Floor: p(hazard) &ge; {SAFETY_FLOOR.toFixed(2)}
              </div>
              <div className="text-[10px] font-mono text-text-secondary leading-normal">
                Items with model-inferred hazard probability at or above{' '}
                {(SAFETY_FLOOR * 100).toFixed(0)}% are categorically forbidden from reaching the
                compactor stream under any policy setting.
              </div>
            </div>

            {/* Hero CTAs */}
            <HeroCTAs />
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* DECISION SEQUENCE (Chapters 1, 2, 3)                              */}
        {/* ----------------------------------------------------------------- */}
        <div id="decision" className="space-y-16 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">

          {/* Section Header */}
          <ScrollReveal>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border-subtle pb-4 bg-[#090c10]/85 p-4 rounded-[2px] border">
              <div className="space-y-1">
                <div className="text-xs font-mono uppercase tracking-widest text-amber-500">
                  System Architecture // Decision Sequence
                </div>
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-text-primary">
                  How Loopgate <span className="font-serif-italic font-normal text-amber-400">Decides</span>
                </h2>
              </div>
              <div className="text-xs font-mono text-text-muted">
                Deterministic Pipeline Execution
              </div>
            </div>
          </ScrollReveal>

          {/* CHAPTER 1: SCAN */}
          <section
            data-chapter="1"
            id="scan"
            className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center"
            aria-labelledby="scan-heading"
          >
            <div className="md:col-span-6 bg-[#090c10]/92 border border-border-subtle p-6 rounded-[2px] shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <span className="text-xs font-mono font-bold text-text-primary">
                  CHAPTER 01 // PER-ITEM VISION SCAN
                </span>
                <ProvenanceChip provenance="Model-inferred" />
              </div>
              <h3 id="scan-heading" className="text-xl font-display font-bold text-text-primary">
                Per-Item Vision Scan
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed font-sans">
                Vision models isolate per-item bounding crops along the intake conveyor in software.
                Multi-pass inference estimates primary material classes, detection confidence, and
                hazard probabilities. All estimates are model-inferred, not physical measurements.
              </p>
              <div className="pt-3 border-t border-border-subtle text-[11px] font-mono text-text-muted space-y-1">
                <div>&gt; Pipeline: Open-vocabulary detection &amp; zero-shot classification (simulated default)</div>
                <div>&gt; Intake Resolution: Isolated per-item bounding crops in software</div>
                <div>&gt; Software Telemetry: Sweeping amber planar scan frustum</div>
              </div>
            </div>
          </section>

          {/* CHAPTER 2: GATE */}
          <section
            data-chapter="2"
            id="gate"
            className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center"
            aria-labelledby="gate-heading"
          >
            <div className="md:col-start-7 md:col-span-6 bg-[#090c10]/92 border border-border-subtle p-6 rounded-[2px] shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <span className="text-xs font-mono font-bold text-amber-400">
                  CHAPTER 02 // UNCERTAINTY GATE
                </span>
                <ProvenanceChip provenance="Calculated" />
              </div>
              <h3 id="gate-heading" className="text-xl font-display font-bold text-text-primary">
                Uncertainty Gate
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed font-sans">
                The gate formula balances hazard likelihood against epistemic uncertainty:
                <br />
                <span className="font-mono text-amber-300 text-xs mt-1 block">
                  gateScore = {HAZARD_WEIGHT} &times; p(haz) + {uncertaintyWeight} &times; uncertainty
                </span>
                Items exceeding the active strictness threshold are diverted for human verification
                before simulated compaction.
              </p>
              <div className="pt-3 border-t border-border-subtle text-[11px] font-mono text-text-muted space-y-1">
                <div>&gt; Safety Floor: p &ge; {SAFETY_FLOOR.toFixed(3)} (Invariant EA-01 Guaranteed)</div>
                <div>&gt; Strictness: Dynamic operator threshold &tau; [0.480 to 0.080]</div>
                <div>&gt; Software Telemetry: Real engine calculations for item-08 and ambiguous items</div>
              </div>
            </div>
          </section>

          {/* CHAPTER 3: ROUTE */}
          <section
            data-chapter="3"
            id="route"
            className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center"
            aria-labelledby="route-heading"
          >
            <div className="md:col-span-6 bg-[#090c10]/92 border border-border-subtle p-6 rounded-[2px] shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <span className="text-xs font-mono font-bold text-text-primary">
                  CHAPTER 03 // SIMULATED DIVERTER AND ROUTING
                </span>
                <ProvenanceChip provenance="Calculated" />
              </div>
              <h3 id="route-heading" className="text-xl font-display font-bold text-text-primary">
                Simulated Diverter and Routing
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed font-sans">
                A simulated diverter vane channels flagged items into the quarantine spur or
                inspection bay in software. Low-hazard items continue through to simulated
                compaction and terminal classification bays.
              </p>
              <div className="pt-3 border-t border-border-subtle text-[11px] font-mono text-text-muted space-y-1">
                <div>&gt; Hazard Hold: Quarantined lithium pouch cells (simulated)</div>
                <div>&gt; Spur Bay: Human-in-the-loop verification desk (simulated)</div>
                <div>&gt; Recovery Stream: Recyclable, Reusable, Biodegradable (simulated)</div>
              </div>
            </div>
          </section>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* CHAPTER 4: RUN IT YOURSELF (Interactive Digital Twin)             */}
        {/* ----------------------------------------------------------------- */}
        <section
          data-chapter="4"
          id="twin"
          className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6"
          aria-labelledby="twin-heading"
        >
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-border-subtle pb-4 bg-[#090c10]/80 p-4 rounded-[2px] border">
              <div className="space-y-1">
                <div className="text-xs font-mono uppercase tracking-widest text-amber-500">
                  Interactive Digital Twin // Chapter 04
                </div>
                <h2 id="twin-heading" className="text-2xl sm:text-3xl font-display font-bold text-text-primary">
                  Run It <span className="font-serif-italic font-normal text-amber-400">Yourself</span>
                </h2>
              </div>
              <div className="text-xs font-mono text-text-muted">
                Direct Kinematic Twin &amp; Policy Control
              </div>
            </div>

            {/* Twin Interactive Container (Transparent Stage + Scrim Controls) */}
            <TwinContainer />
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* CHAPTER 5: REPLAY THEATRE — Branch A vs Branch B                  */}
        {/* ----------------------------------------------------------------- */}
        <section
          id="replay"
          className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6"
          aria-labelledby="replay-heading"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-border-subtle pb-4 bg-[#090c10]/80 p-4 rounded-[2px] border">
            <div className="space-y-1">
              <div className="text-xs font-mono uppercase tracking-widest text-amber-500">
                Branch Comparison // Phase 5
              </div>
              <h2 id="replay-heading" className="text-2xl sm:text-3xl font-display font-bold text-text-primary">
                Replay{' '}
                <span className="font-serif-italic font-normal text-amber-400">Theatre</span>
              </h2>
            </div>
            <div className="text-xs font-mono text-text-muted">
              Standard Line vs Loopgate // Simulated Scenario
            </div>
          </div>
          <ReplayClient />
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* EVIDENCE LAB SECTION: REAL IN-BROWSER CV & LIVE TWIN LINK        */}
        {/* ----------------------------------------------------------------- */}
        <section
          id="evidence"
          className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6"
          aria-labelledby="evidence-heading"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-border-subtle pb-4 bg-[#090c10]/80 p-4 rounded-[2px] border">
            <div className="space-y-1">
              <div className="text-xs font-mono uppercase tracking-widest text-amber-500">
                Live Vision Pipeline // Real In-Browser Inference
              </div>
              <h2 id="evidence-heading" className="text-2xl sm:text-3xl font-display font-bold text-text-primary">
                Evidence <span className="font-serif-italic font-normal text-amber-400">Lab</span>
              </h2>
            </div>
            <div className="text-xs font-mono text-text-muted">
              Client-Side OWL-ViT &amp; CLIP // Live Twin Link
            </div>
          </div>

          <EvidenceLab />
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* CHAPTER 5: STREAMS & ASSUMPTIONS (Pulled back, darker world)      */}
        {/* ----------------------------------------------------------------- */}
        <div data-chapter="5" className="space-y-12">
          {/* Material Streams */}
          <section
            id="streams"
            className="border-t border-border-subtle bg-[#090c10]/92 py-12 px-4 sm:px-6 lg:px-8"
            aria-labelledby="streams-heading"
          >
            <div className="max-w-7xl mx-auto space-y-6">
              <ScrollReveal>
                <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                  <div className="space-y-1">
                    <span className="text-xs font-mono uppercase tracking-widest text-amber-500">
                      Classification Schema // Domain Contracts
                    </span>
                    <h2
                      id="streams-heading"
                      className="text-xl font-display font-bold text-text-primary"
                    >
                      Four Canonical Material <span className="font-serif-italic font-normal text-amber-400">Streams</span>
                    </h2>
                  </div>
                  <ProvenanceChip provenance="Configured" showPrefix={false} />
                </div>
              </ScrollReveal>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 border border-border-subtle bg-bg-surface/90 rounded-[2px] space-y-2">
                  <div className="text-xs font-mono font-bold text-slate-300 uppercase">
                    01 // Recyclable
                  </div>
                  <p className="text-xs text-text-secondary font-sans leading-relaxed">
                    Clean cardboard, corrugated boxes, PET bottles, glass, and aluminum containers.
                    Processed through municipal baling lines.
                  </p>
                  <div className="text-[10px] font-mono text-text-muted">Target: Municipal Baler</div>
                </div>

                <div className="p-4 border border-border-subtle bg-bg-surface/90 rounded-[2px] space-y-2">
                  <div className="text-xs font-mono font-bold text-slate-300 uppercase">
                    02 // Reusable
                  </div>
                  <p className="text-xs text-text-secondary font-sans leading-relaxed">
                    Functional apparel, durable plastics, and intact hand tools. Preserved from
                    compaction for secondary refurbishment or charity distribution.
                  </p>
                  <div className="text-[10px] font-mono text-text-muted">Target: Refurbishment Bay</div>
                </div>

                <div className="p-4 border border-border-subtle bg-bg-surface/90 rounded-[2px] space-y-2">
                  <div className="text-xs font-mono font-bold text-slate-300 uppercase">
                    03 // Biodegradable
                  </div>
                  <p className="text-xs text-text-secondary font-sans leading-relaxed">
                    Organic food scraps, untreated yard waste, and certified compostable PLA
                    tableware. Diverted to commercial composting.
                  </p>
                  <div className="text-[10px] font-mono text-text-muted">Target: Compost Manifold</div>
                </div>

                <div className="p-4 border border-amber-600/40 bg-amber-950/30 rounded-[2px] space-y-2">
                  <div className="text-xs font-mono font-bold text-amber-400 uppercase">
                    04 // Hazardous (Hero Class)
                  </div>
                  <p className="text-xs text-text-secondary font-sans leading-relaxed">
                    Lithium pouch cells, vape batteries, power banks, damaged electronics, and
                    pressurized cylinders. Primary compactor fire hazards.
                  </p>
                  <div className="text-[10px] font-mono text-amber-500 font-semibold">
                    Target: Quarantine Vault / Spur Bay
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Assumptions Registry */}
          <section
            id="assumptions"
            className="border-t border-border-subtle bg-[#090c10]/95 py-12 px-4 sm:px-6 lg:px-8"
            aria-labelledby="assumptions-heading"
          >
            <div className="max-w-7xl mx-auto space-y-6">
              <ScrollReveal>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-border-subtle pb-4">
                  <div className="space-y-1">
                    <span className="text-xs font-mono uppercase tracking-widest text-amber-500">
                      Transparency // Engine Assumptions
                    </span>
                    <h2
                      id="assumptions-heading"
                      className="text-xl sm:text-2xl font-display font-bold text-text-primary"
                    >
                      Model <span className="font-serif-italic font-normal text-amber-400">Assumptions</span> &amp; Parameters
                    </h2>
                  </div>
                  <p className="text-xs font-mono text-text-muted max-w-xs">
                    All values below are simulation-only estimates used to drive interactive metrics.
                    None are measured from physical hardware.
                  </p>
                </div>
              </ScrollReveal>

              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono" aria-label="Engine assumptions">
                  <thead>
                    <tr className="border-b border-border-subtle text-text-muted text-left">
                      <th className="pb-2 pr-4 font-normal uppercase tracking-wider">ID</th>
                      <th className="pb-2 pr-4 font-normal uppercase tracking-wider">Parameter</th>
                      <th className="pb-2 pr-4 font-normal uppercase tracking-wider">Value</th>
                      <th className="pb-2 pr-4 font-normal uppercase tracking-wider">Unit</th>
                      <th className="pb-2 pr-4 font-normal uppercase tracking-wider">Provenance</th>
                      <th className="pb-2 font-normal uppercase tracking-wider">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEFAULT_ASSUMPTIONS.map((asm, i) => (
                      <tr
                        key={asm.id}
                        className={`border-b border-border-subtle/50 ${i % 2 === 0 ? 'bg-bg-surface/30' : ''}`}
                      >
                        <td className="py-2 pr-4 text-text-muted">{asm.id}</td>
                        <td className="py-2 pr-4 text-text-primary font-bold">{asm.label}</td>
                        <td className="py-2 pr-4 text-amber-400">
                          {typeof asm.value === 'number'
                            ? asm.value.toLocaleString()
                            : String(asm.value)}
                        </td>
                        <td className="py-2 pr-4 text-text-secondary">{asm.unit}</td>
                        <td className="py-2 pr-4">
                          <ProvenanceChip
                            provenance={asm.provenance as 'Simulated' | 'Configured' | 'Calculated' | 'Model-inferred'}
                            showPrefix={false}
                          />
                        </td>
                        <td className="py-2 text-text-secondary leading-relaxed">{asm.description}</td>
                      </tr>
                    ))}
                    {/* Engine constants row */}
                    <tr>
                      <td className="py-2 pr-4 text-text-muted">eng-01</td>
                      <td className="py-2 pr-4 text-text-primary font-bold">Hazard Weight</td>
                      <td className="py-2 pr-4 text-amber-400">{HAZARD_WEIGHT}</td>
                      <td className="py-2 pr-4 text-text-secondary">ratio</td>
                      <td className="py-2 pr-4">
                        <ProvenanceChip provenance="Configured" showPrefix={false} />
                      </td>
                      <td className="py-2 text-text-secondary leading-relaxed">
                        Weight given to p(hazard) vs epistemic uncertainty in gate score computation.
                        Uncertainty weight = {uncertaintyWeight}.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

      </main>
    </SimulationProvider>
  );
}
