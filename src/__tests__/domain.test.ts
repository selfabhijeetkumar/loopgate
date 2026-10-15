import { describe, it, expect } from 'vitest';
import { ItemSchema, EngineConfigSchema } from '../domain/schemas';
import { SYNTHETIC_SCENARIO_ITEMS, DEFAULT_ENGINE_CONFIG } from '../data/scenario';

describe('Domain Contracts & Schema Validation', () => {
  it('should validate the default engine configuration', () => {
    const parsed = EngineConfigSchema.safeParse(DEFAULT_ENGINE_CONFIG);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.safetyFloor).toBe(0.30); // Updated from 0.25 in Phase 2
      expect(parsed.data.threshold).toBe(0.50);   // Updated from 0.40 in Phase 2
      expect(parsed.data.assumptions.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('should validate all 20 synthetic scenario items against ItemSchema', () => {
    expect(SYNTHETIC_SCENARIO_ITEMS).toHaveLength(20);

    for (const item of SYNTHETIC_SCENARIO_ITEMS) {
      const result = ItemSchema.safeParse(item);
      if (!result.success) {
        console.error(`Validation failed for item ${item.id}:`, result.error.format());
      }
      expect(result.success).toBe(true);
      expect(item.provenance).toBe('Simulated');
    }
  });

  it('should span all 4 material classes in synthetic scenario', () => {
    const classes = new Set(SYNTHETIC_SCENARIO_ITEMS.map((i) => i.primaryClass));
    expect(classes.has('recyclable')).toBe(true);
    expect(classes.has('reusable')).toBe(true);
    expect(classes.has('biodegradable')).toBe(true);
    expect(classes.has('hazardous')).toBe(true);
  });

  it('should enforce safety floor: high hazard items must not be routed to compactor', () => {
    const safetyFloor = DEFAULT_ENGINE_CONFIG.safetyFloor;
    const floorItems = SYNTHETIC_SCENARIO_ITEMS.filter((i) => i.hazardProbability >= safetyFloor);
    
    expect(floorItems.length).toBeGreaterThan(0);
    for (const item of floorItems) {
      // Under safety floor rule, it can NEVER be assigned to compactor
      expect(item.assignedRoute).not.toBe('compactor');
    }
  });
});
