import { simulateBatch } from '../src/engine/sort';
import { sweepThreshold } from '../src/engine/compare';
import { SYNTHETIC_SCENARIO_ITEMS } from '../src/data/scenario';
import { HAZARD_WEIGHT } from '../src/engine/gate';

const basePolicy = { safetyFloor: 0.30, hazardConfidentCutoff: 0.85, assumptions: [] };

// TwinContainer slider: 0%-100% maps to tau 0.48-0.08
const steps: number[] = [];
for (let pct = 0; pct <= 100; pct += 5) {
  steps.push(+(0.48 - (pct / 100) * 0.40).toFixed(3));
}

console.log('HAZARD_WEIGHT from gate.ts:', HAZARD_WEIGHT);
console.log('');
console.log('=== REAL SWEEP TABLE ===');
console.log('strictness% | tau   | inspection_line | hazard_hold | total_diverted | exposure');
// Strictness 0% (tau 0.48) to 100% (tau 0.08)
for (let pct = 0; pct <= 100; pct += 10) {
  const tau = +(0.48 - (pct / 100) * 0.40).toFixed(3);
  const pt = sweepThreshold(SYNTHETIC_SCENARIO_ITEMS, basePolicy, [tau])[0];
  const total = pt.inspectionLineCount + pt.hazardHoldCount;
  console.log(`${String(pct).padStart(10)}% | ${pt.threshold.toFixed(3)} | ${String(pt.inspectionLineCount).padStart(15)} | ${String(pt.hazardHoldCount).padStart(11)} | ${String(total).padStart(14)} | ${pt.expectedHazardExposure.toFixed(3)}`);
}

console.log('');
console.log('=== ALL GATE SCORES (tau=0.30) ===');
const r = simulateBatch(SYNTHETIC_SCENARIO_ITEMS, { ...basePolicy, inspectionThreshold: 0.30 });
r.decisions.sort((a, b) => a.gateScore - b.gateScore).forEach(d => {
  console.log(`${d.itemId}  p=${d.hazardProbability.toFixed(3)}  gateScore=${d.gateScore.toFixed(3)}  route=${d.route}  floor=${d.safetyFloorTriggered}`);
});
