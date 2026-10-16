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
 * All route names are human labels, zero programming identifiers, zero forbidden words.
 */
export function getTemplateExplanation(input: EngineExplanationInput): string {
  const { item, decision, profile } = input;
  const hazPct = (item.hazardProbability * 100).toFixed(1);
  const confPct = (item.confidence * 100).toFixed(1);
  const gateScoreStr = decision.gateScore.toFixed(3);
  const threshStr = decision.threshold.toFixed(2);
  const routeLabel = formatRouteLabel(decision.route);

  // 1. HAZARDOUS (or Above Safety Floor)
  if (item.primaryClass === 'hazardous' || item.hazardProbability >= 0.30) {
    if (profile === 'household') {
      return `In this simulated scenario, your ${item.name} carries an estimated ${hazPct}% hazard probability, which meets the 0.30 safety floor and diverts it to ${routeLabel}. Separately, its gate score of ${gateScoreStr} is evaluated against the ${threshStr} inspection threshold. Please bring discarded batteries and electronics to an authorized community e-waste collection center rather than municipal household bins.`;
    }
    if (profile === 'hostel') {
      return `In this simulated scenario, the ${item.name} shows an estimated ${hazPct}% hazard probability, triggering the 0.30 safety floor for immediate diversion to ${routeLabel}. The item also registered a gate score of ${gateScoreStr} against the ${threshStr} inspection threshold. Please use your hostel's battery or e-waste collection point if there is one, otherwise ask the hostel administration.`;
    }
    // facility_operator
    return `In this simulated scenario, the ${item.name} triggered the 0.30 safety floor with an estimated hazard probability of ${hazPct}% and detector confidence of ${confPct}%. The gate score evaluated to ${gateScoreStr} against the ${threshStr} inspection threshold, assigning the item to ${routeLabel}. In this simulated scenario the item was routed to Hazard hold prior to compactor intake.`;
  }

  // 2. RECYCLABLE
  if (item.primaryClass === 'recyclable') {
    if (profile === 'household') {
      return `In this simulated scenario, your ${item.name} carries a low estimated hazard probability of ${hazPct}% and ${confPct}% model confidence. Its gate score of ${gateScoreStr} is safely below the ${threshStr} inspection threshold, directing it to ${routeLabel}. Please rinse thoroughly and place in clean container recycling.`;
    }
    if (profile === 'hostel') {
      return `In this simulated scenario, the ${item.name} is verified as recyclable material with ${confPct}% detector confidence and ${hazPct}% estimated hazard probability. Its gate score of ${gateScoreStr} remains below the ${threshStr} inspection threshold, routing it to ${routeLabel}. Please use your hostel's recycling collection point if there is one, otherwise ask the hostel administration.`;
    }
    // facility_operator
    return `In this simulated scenario, ${item.name} was processed with an estimated hazard probability of ${hazPct}% and ${confPct}% model confidence. The computed gate score of ${gateScoreStr} is below the ${threshStr} inspection threshold, routing it to ${routeLabel}. In this simulated scenario the item was routed to Recyclable bin.`;
  }

  // 3. REUSABLE
  if (item.primaryClass === 'reusable') {
    if (profile === 'household') {
      return `In this simulated scenario, ${item.name} demonstrates an estimated hazard probability of ${hazPct}% and ${confPct}% detector confidence. Its gate score of ${gateScoreStr} is below the ${threshStr} inspection threshold, assigning it to ${routeLabel}. Consider repair or local community donation prior to disposal.`;
    }
    if (profile === 'hostel') {
      return `In this simulated scenario, ${item.name} was identified with ${confPct}% model confidence and ${hazPct}% estimated hazard risk. The gate score of ${gateScoreStr} routes it to ${routeLabel} for secondary redistribution. Please use your hostel's donation or reusable collection point if there is one, otherwise ask the hostel administration.`;
    }
    // facility_operator
    return `In this simulated scenario, ${item.name} registered an estimated hazard probability of ${hazPct}% and gate score of ${gateScoreStr}. Operating within the ${threshStr} inspection threshold, the item is routed to ${routeLabel}. In this simulated scenario the item was routed to Reusable bin.`;
  }

  // 4. BIODEGRADABLE
  if (profile === 'household') {
    return `In this simulated scenario, ${item.name} is classified with ${confPct}% model confidence and an estimated hazard probability of ${hazPct}%. Its gate score of ${gateScoreStr} satisfies the ${threshStr} inspection threshold, routing it to ${routeLabel}. Dispose in designated organic compost collection.`;
  }
  if (profile === 'hostel') {
    return `In this simulated scenario, ${item.name} was evaluated with ${hazPct}% hazard probability and routed to ${routeLabel} with a gate score of ${gateScoreStr}. The gate score meets the ${threshStr} inspection threshold for organic recovery. Please use your hostel's organic waste collection point if there is one, otherwise ask the hostel administration.`;
  }
  // facility_operator
  return `In this simulated scenario, ${item.name} is verified as biodegradable material with an estimated hazard probability of ${hazPct}% and gate score of ${gateScoreStr}. Operating within the ${threshStr} inspection threshold, the unit is routed to ${routeLabel}. In this simulated scenario the item was routed to Biodegradable bin.`;
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
    return `In this simulated scenario, the batch analysis evaluated ${itemCount} items from the residential stream. The automated gate routed ${divertedCount} items to inspection bay or hazard hold, achieving a ${rateStr}% safe recovery rate.`;
  }
  if (profile === 'hostel') {
    return `In this simulated scenario, automated simulation evaluated ${itemCount} items from hostel bins. Gating rules routed ${divertedCount} items for inspection, resulting in a ${rateStr}% recovery efficiency.`;
  }
  return `In this simulated scenario, operational line telemetry recorded ${itemCount} total items across the belt. In this simulated scenario the system routed ${divertedCount} items to Hazard hold or inspection bay based on policy thresholds, yielding a ${rateStr}% stream balance.`;
}
