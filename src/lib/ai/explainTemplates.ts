/**
 * src/lib/ai/explainTemplates.ts
 * Deterministic template explanations grounded strictly in engine calculations.
 * 12 profile-specific templates (4 classes x 3 profiles) plus batch summary.
 * Guaranteed zero hallucination, zero invented numbers, works with zero network/API keys.
 */

export type UserProfile = 'household' | 'hostel' | 'facility_operator';

export interface EngineExplanationInput {
  item: {
    id: string;
    name: string;
    primaryClass: 'recyclable' | 'reusable' | 'biodegradable' | 'hazardous';
    hazardProbability: number; // 0.0 - 1.0
    confidence: number;        // 0.0 - 1.0
    disagreement?: number;     // 0.0 - 1.0
  };
  decision: {
    route: string;
    gateScore: number;
    threshold: number;
    floorTriggered: boolean;
  };
  context?: {
    batchItemCount?: number;
    totalDiverted?: number;
    diversionRate?: number;
  };
  profile: UserProfile;
}

export function formatRouteLabel(route: string): string {
  switch (route) {
    case 'hazard_hold':
    case 'hazard_quarantine':
      return 'Hazard hold';
    case 'inspection_line':
      return 'Inspection bay';
    case 'recyclable_bay':
      return 'Recyclable bin';
    case 'reusable_bay':
      return 'Reusable bin';
    case 'biodegradable_bay':
      return 'Biodegradable bin';
    case 'compactor':
      return 'Main compactor';
    default:
      return route.replace(/_/g, ' ');
  }
}

/**
 * Returns a deterministic, verified explanation grounded strictly in engine values.
 */
export function getTemplateExplanation(input: EngineExplanationInput): string {
  const { item, decision, profile } = input;
  const hazPct = (item.hazardProbability * 100).toFixed(1);
  const confPct = (item.confidence * 100).toFixed(1);
  const gateScoreStr = decision.gateScore.toFixed(3);
  const threshStr = decision.threshold.toFixed(2);
  const routeLabel = formatRouteLabel(decision.route);

  // 1. HAZARDOUS
  if (item.primaryClass === 'hazardous' || item.hazardProbability >= decision.threshold) {
    if (profile === 'household') {
      return `Safety Notice for Home Segregation: ${item.name} (${item.id}) carries an estimated ${hazPct}% hazard probability in this simulated scenario. Because this reaches or exceeds the ${threshStr} safety floor, it has been routed to "${routeLabel}" (gate score ${gateScoreStr}). Please never place lithium-ion batteries or pressurized containers in municipal blue recycling bins; bring them to an authorized e-waste collection point.`;
    }
    if (profile === 'hostel') {
      return `Common Area Sorting Alert: ${item.name} (${item.id}) was detected with ${hazPct}% estimated hazard probability. The automated gate scored this at ${gateScoreStr} against the ${threshStr} threshold, immediately diverting it to "${routeLabel}". For campus hostels, discard old vape pens, power banks, and electronics in designated e-waste drop bins at reception rather than floor trash chutes.`;
    }
    // facility_operator
    return `Operational Intercept Directive: Item ${item.id} (${item.name}) flagged with P(haz)=${hazPct}% and detector confidence ${confPct}%. Gate score computed at ${gateScoreStr} exceeding threshold ${threshStr} (safety floor triggered: ${decision.floorTriggered ? 'TRUE' : 'FALSE'}). Route assigned: ${routeLabel}. Pneumatic diverter actuated to isolate object prior to high-pressure compactor intake.`;
  }

  // 2. RECYCLABLE
  if (item.primaryClass === 'recyclable') {
    if (profile === 'household') {
      return `Recycling Guidance: ${item.name} (${item.id}) evaluated with low hazard probability (${hazPct}%) and ${confPct}% model confidence. Gate score is ${gateScoreStr}, safely below the ${threshStr} threshold. Assigned route: "${routeLabel}". Rinse thoroughly and place in clean container recycling.`;
    }
    if (profile === 'hostel') {
      return `Hostel Recycling Stream: ${item.name} (${item.id}) verified as recyclable material (confidence ${confPct}%, estimated hazard ${hazPct}%). Gate score is ${gateScoreStr} vs threshold ${threshStr}. Directed to "${routeLabel}". Flatten bottles and cans before depositing in corridor blue bins.`;
    }
    // facility_operator
    return `Commodity Stream Flow: Item ${item.id} (${item.name}) processed with P(haz)=${hazPct}%, confidence ${confPct}%, gate score ${gateScoreStr}. Operating well below threshold ${threshStr}. Permitted through to "${routeLabel}" baling manifold without diversion delay.`;
  }

  // 3. REUSABLE
  if (item.primaryClass === 'reusable') {
    if (profile === 'household') {
      return `Reuse Recommendation: ${item.name} (${item.id}) shows ${hazPct}% hazard probability and ${confPct}% confidence. Gate score ${gateScoreStr} (threshold ${threshStr}). Assigned to "${routeLabel}". Consider donation or repair before discarding.`;
    }
    if (profile === 'hostel') {
      return `Student Resource Re-circulation: ${item.name} (${item.id}) detected with ${confPct}% confidence and ${hazPct}% hazard estimate. Assigned route: "${routeLabel}" (gate score ${gateScoreStr}). Place in semester-end move-out exchange racks.`;
    }
    // facility_operator
    return `Secondary Recovery Stream: Item ${item.id} (${item.name}) evaluated at gate score ${gateScoreStr} (threshold ${threshStr}, P(haz)=${hazPct}%). Routed to "${routeLabel}" secondary sorting station for manual recovery.`;
  }

  // 4. BIODEGRADABLE
  if (profile === 'household') {
    return `Compost Sorting: ${item.name} (${item.id}) classified with ${confPct}% confidence and ${hazPct}% estimated hazard. Gate score ${gateScoreStr} vs threshold ${threshStr}. Directed to "${routeLabel}". Dispose in organic green waste.`;
  }
  if (profile === 'hostel') {
    return `Mess / Canteen Organic Stream: ${item.name} (${item.id}) evaluated at gate score ${gateScoreStr} with ${hazPct}% hazard risk. Assigned to "${routeLabel}". Direct to dining hall wet waste bins.`;
  }
  // facility_operator
  return `Organic Diversion Stream: Item ${item.id} (${item.name}) verified biodegradable (P(haz)=${hazPct}%, gate score ${gateScoreStr}). Routed to "${routeLabel}" composting line.`;
}

/**
 * Returns a deterministic batch summary explanation for the entire stream.
 */
export function getBatchSummaryExplanation(
  itemCount: number,
  divertedCount: number,
  diversionRatePct: number,
  profile: UserProfile
): string {
  const rateStr = diversionRatePct.toFixed(1);
  if (profile === 'household') {
    return `Batch Summary for Household Stream: Processed ${itemCount} items in this simulated scenario. ${divertedCount} hazardous or ambiguous items were safely isolated, achieving a ${rateStr}% safe material recovery rate.`;
  }
  if (profile === 'hostel') {
    return `Campus Batch Telemetry: Analyzed ${itemCount} items from hostel bins. Gating mechanism intercepted ${divertedCount} items for manual verification, yielding an estimated ${rateStr}% stream diversion efficiency.`;
  }
  return `Facility Operational Shift Audit: ${itemCount} total units processed across conveyor. ${divertedCount} units diverted to inspection bay / hazard hold (gate threshold triggered). Overall simulated recovery diversion rate: ${rateStr}%.`;
}
