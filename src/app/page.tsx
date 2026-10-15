import React from 'react';
import { ProvenanceChip } from '../components/ProvenanceChip';
import { SYNTHETIC_SCENARIO_ITEMS, DEFAULT_ENGINE_CONFIG } from '../data/scenario';

export default function HomePage() {
  const scenarioItems = SYNTHETIC_SCENARIO_ITEMS;
  const hazardousCount = scenarioItems.filter((i) => i.primaryClass === 'hazardous').length;
  const divertedCount = scenarioItems.filter((i) => i.status === 'diverted').length;

  return (
    <div className="flex-1 flex flex-col">
      {/* Hero Section Above the Fold */}
      <section className="border-b border-border-subtle bg-bg-surface py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[11px] font-mono uppercase tracking-widest text-text-secondary">
                Industrial HUD // Autonomous Recycling Gate // PS-06
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-bold text-text-primary tracking-tight max-w-4xl leading-[1.1]">
              Every item passes the gate. Risky ones never reach the compactor.
            </h1>

            <p className="text-base sm:text-lg text-text-secondary max-w-2xl font-sans leading-relaxed pt-2">
              Municipal recycling facilities face catastrophic fires and millions in equipment downtime when discarded lithium-ion batteries, vapes, and damaged electronics enter high-pressure compactors. Loopgate introduces multi-stage computer vision with an uncertainty gate and connected 3D digital twin to isolate hazards before mechanical baling.
            </p>
          </div>

          {/* Action CTAs Above the Fold */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <a
              href="#capabilities"
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-mono text-xs uppercase tracking-wider font-bold rounded-[2px] transition-colors focus-visible:outline-2 focus-visible:outline-amber-500"
            >
              Examine System Architecture
            </a>
            <a
              href="#scenario"
              className="px-5 py-2.5 bg-bg-primary hover:bg-bg-elevated border border-border-strong text-text-primary font-mono text-xs uppercase tracking-wider font-semibold rounded-[2px] transition-colors"
            >
              Inspect Synthetic Batch ({scenarioItems.length} Items)
            </a>
          </div>

          {/* Hero Telemetry HUD Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-border-subtle">
            <div className="p-3 border border-border-subtle bg-bg-primary rounded-[2px]">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                Active Policy
              </div>
              <div className="text-sm sm:text-base font-mono font-bold text-text-primary mt-1">
                Zero-Compaction Floor
              </div>
              <div className="text-[10px] font-mono text-text-secondary mt-0.5">
                Safety Floor: {DEFAULT_ENGINE_CONFIG.safetyFloor * 100}%
              </div>
            </div>

            <div className="p-3 border border-border-subtle bg-bg-primary rounded-[2px]">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                Operator Threshold
              </div>
              <div className="text-sm sm:text-base font-mono font-bold text-amber-500 mt-1">
                &tau; = {DEFAULT_ENGINE_CONFIG.threshold.toFixed(2)}
              </div>
              <div className="text-[10px] font-mono text-text-secondary mt-0.5">
                Adjustable sensitivity
              </div>
            </div>

            <div className="p-3 border border-border-subtle bg-bg-primary rounded-[2px]">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                Hazardous In Batch
              </div>
              <div className="text-sm sm:text-base font-mono font-bold text-amber-400 mt-1">
                {hazardousCount} Devices
              </div>
              <div className="text-[10px] font-mono text-text-secondary mt-0.5">
                Lithium cells / aerosols
              </div>
            </div>

            <div className="p-3 border border-border-subtle bg-bg-primary rounded-[2px]">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                Quarantined Flow
              </div>
              <div className="text-sm sm:text-base font-mono font-bold text-emerald-400 mt-1">
                {divertedCount} Items Diverted
              </div>
              <div className="text-[10px] font-mono text-text-secondary mt-0.5">
                Zero fire escapes
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities & Architecture Section */}
      <section id="capabilities" className="py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full space-y-10">
        <div className="space-y-2">
          <div className="text-xs font-mono uppercase tracking-widest text-amber-500">
            System Specification // Multi-Stage Pipeline
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-text-primary">
            Computer Vision Architecture & Uncertainty Gate
          </h2>
          <p className="text-sm text-text-secondary max-w-3xl font-sans">
            Optical whole-image models cannot detect device boundaries or prove battery chemistry. Loopgate separates localization, material scoring, and safety thresholding into distinct deterministic stages.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Stage 1 */}
          <div className="border border-border-subtle bg-bg-surface p-6 rounded-[2px] space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <span className="text-xs font-mono font-bold text-text-primary">STAGE 01</span>
              <ProvenanceChip provenance="Model-inferred" />
            </div>
            <h3 className="text-lg font-display font-bold text-text-primary">
              Per-Item Bounding Localization
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed font-sans">
              Transformers.js DETR (ResNet-50) and OWL-ViT zero-shot detectors isolate multi-item bounding boxes directly in the browser using WASM. If visual occlusions occur, operators use the Human-verified interactive canvas fallback.
            </p>
            <div className="pt-2 text-[11px] font-mono text-text-muted space-y-1">
              <div>&bull; Candidates: DETR / OWLv2</div>
              <div>&bull; Licence: Apache 2.0 (Zero AGPL)</div>
              <div>&bull; Fallback: Human-verified box</div>
            </div>
          </div>

          {/* Stage 2 */}
          <div className="border border-border-subtle bg-bg-surface p-6 rounded-[2px] space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <span className="text-xs font-mono font-bold text-amber-500">STAGE 02</span>
              <ProvenanceChip provenance="Calculated" />
            </div>
            <h3 className="text-lg font-display font-bold text-text-primary">
              Crop Scoring & Uncertainty Gate
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed font-sans">
              CLIP crop classification computes probabilities across the 4 material classes and battery device prompts. The Uncertainty Gate synthesizes hazard probability, classification confidence, and model disagreement into an item Gate Score.
            </p>
            <div className="pt-2 text-[11px] font-mono text-text-muted space-y-1">
              <div>&bull; Safety Floor: P_hazard &ge; 0.25</div>
              <div>&bull; Compaction Block: Guaranteed</div>
              <div>&bull; Trade-off: Hazard vs Load curve</div>
            </div>
          </div>

          {/* Stage 3 */}
          <div className="border border-border-subtle bg-bg-surface p-6 rounded-[2px] space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <span className="text-xs font-mono font-bold text-text-primary">STAGE 03</span>
              <ProvenanceChip provenance="AI-generated" />
            </div>
            <h3 className="text-lg font-display font-bold text-text-primary">
              Optional GenAI Second Opinion
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed font-sans">
              Server-side Gemini endpoint configured via GEMINI_MODEL env var. Strictly optional, outside the critical sorting path, SHA-256 deduplicated, and backed by 12 deterministic offline scenario templates for zero-failure judging.
            </p>
            <div className="pt-2 text-[11px] font-mono text-text-muted space-y-1">
              <div>&bull; Rate Design: ~5 RPM / 100 RPD</div>
              <div>&bull; Grounded strictly in math</div>
              <div>&bull; Deduplication: Client SHA-256</div>
            </div>
          </div>
        </div>
      </section>

      {/* Domain Contracts Section */}
      <section id="contracts" className="border-t border-border-subtle bg-bg-surface py-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="space-y-2">
            <div className="text-xs font-mono uppercase tracking-widest text-amber-500">
              Contract Integrity // Pure TypeScript + Zod
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-text-primary">
              The Four Material Classes & Provenance Registry
            </h2>
            <p className="text-sm text-text-secondary max-w-2xl font-sans">
              All engine calculations, 3D twin animations, and audit events strictly adhere to pure TypeScript contracts in <code className="text-amber-400 font-mono">src/domain</code>. No UI imports leak into domain logic.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 border border-border-subtle bg-bg-primary rounded-[2px] space-y-2">
              <div className="text-xs font-mono font-bold text-slate-300 uppercase">Recyclable</div>
              <p className="text-xs text-text-secondary font-sans">
                Cardboard, PET beverage containers, clean aluminum alloys, and glass bottles. Routed to recovery balers.
              </p>
              <div className="text-[10px] font-mono text-text-muted">Target: Municipal Baler</div>
            </div>

            <div className="p-4 border border-border-subtle bg-bg-primary rounded-[2px] space-y-2">
              <div className="text-xs font-mono font-bold text-slate-300 uppercase">Reusable</div>
              <p className="text-xs text-text-secondary font-sans">
                Functional textiles, unbroken tools, and intact electronic housings suitable for secondary distribution.
              </p>
              <div className="text-[10px] font-mono text-text-muted">Target: Refurbishment Bay</div>
            </div>

            <div className="p-4 border border-border-subtle bg-bg-primary rounded-[2px] space-y-2">
              <div className="text-xs font-mono font-bold text-slate-300 uppercase">Biodegradable</div>
              <p className="text-xs text-text-secondary font-sans">
                Organic residues, food scraps, and compostable cellulose packaging. Diverted away from landfill waste.
              </p>
              <div className="text-[10px] font-mono text-text-muted">Target: Compost Manifold</div>
            </div>

            <div className="p-4 border border-amber-600/40 bg-amber-950/20 rounded-[2px] space-y-2">
              <div className="text-xs font-mono font-bold text-amber-400 uppercase">Hazardous (Hero Class)</div>
              <p className="text-xs text-text-secondary font-sans">
                Lithium pouch cells, power banks, vape pens, and pressurized solvent aerosols. Compactor fire triggers.
              </p>
              <div className="text-[10px] font-mono text-amber-500 font-semibold">Target: Hazard Quarantine Hold</div>
            </div>
          </div>
        </div>
      </section>

      {/* Synthetic Scenario Data Section */}
      <section id="scenario" className="py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full space-y-8">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono uppercase tracking-widest text-amber-500">
              Deterministic Batch Validation // src/data/scenario.ts
            </div>
            <ProvenanceChip provenance="Simulated" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-text-primary">
            Active Sorting Line Items (12 Samples)
          </h2>
          <p className="text-sm text-text-secondary max-w-2xl font-sans">
            Deterministic synthetic items spanning all material classes, including borderline ambiguous e-waste and swollen lithium cells.
          </p>
        </div>

        {/* Responsive Table / Card Grid */}
        <div className="border border-border-subtle bg-bg-surface rounded-[2px] overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-primary text-text-muted text-[10px] uppercase tracking-wider">
                <th className="py-3 px-4">Item ID</th>
                <th className="py-3 px-4">Item Name</th>
                <th className="py-3 px-4">Primary Class</th>
                <th className="py-3 px-4">Hazard Risk</th>
                <th className="py-3 px-4">Gate Score</th>
                <th className="py-3 px-4">Assigned Route</th>
                <th className="py-3 px-4">Provenance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-text-secondary">
              {scenarioItems.map((item) => {
                const isHazard = item.primaryClass === 'hazardous';
                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-bg-elevated/50 transition-colors ${
                      isHazard ? 'bg-amber-950/10' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-text-primary">{item.id}</td>
                    <td className="py-3 px-4 text-text-primary font-sans text-xs">
                      {item.name}
                      <span className="block text-[10px] text-text-muted font-mono">{item.notes}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded-[2px] text-[10px] uppercase font-bold ${
                          isHazard
                            ? 'text-amber-400 bg-amber-950/40 border border-amber-600/50'
                            : 'text-slate-300 bg-slate-800/40 border border-slate-700'
                        }`}
                      >
                        {item.primaryClass}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={item.hazardProbability > 0.5 ? 'text-amber-400 font-bold' : ''}>
                        {(item.hazardProbability * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={item.gateScore >= DEFAULT_ENGINE_CONFIG.threshold ? 'text-amber-400 font-bold' : ''}>
                        {item.gateScore.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-text-primary">
                      {item.assignedRoute}
                    </td>
                    <td className="py-3 px-4">
                      <ProvenanceChip provenance={item.provenance} showPrefix={false} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
