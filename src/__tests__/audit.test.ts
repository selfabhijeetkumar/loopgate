/**
 * src/__tests__/audit.test.ts
 * Unit tests for the audit trail engine.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createAuditEvent,
  loadAuditLog,
  saveAuditLog,
  appendAuditEvent,
  clearAuditLog,
  exportAuditLogCSV,
  type AuditEvent,
} from '@/engine/audit';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return createAuditEvent({
    itemId: 'item-01',
    itemName: 'Bottle',
    action: 'Manual divert to inspection',
    reasonCode: 'MANUAL_DIVERT',
    fromRoute: 'compactor',
    toRoute: 'inspection_line',
    provenance: 'Human-verified',
    ...overrides,
  });
}

describe('AuditEvent creation', () => {
  it('generates unique IDs', () => {
    const a = makeEvent();
    const b = makeEvent();
    expect(a.id).not.toBe(b.id);
  });

  it('sets ISO timestamp', () => {
    const ev = makeEvent();
    expect(() => new Date(ev.timestamp)).not.toThrow();
    expect(new Date(ev.timestamp).toISOString()).toBe(ev.timestamp);
  });

  it('carries correct fields', () => {
    const ev = makeEvent();
    expect(ev.reasonCode).toBe('MANUAL_DIVERT');
    expect(ev.provenance).toBe('Human-verified');
    expect(ev.fromRoute).toBe('compactor');
    expect(ev.toRoute).toBe('inspection_line');
  });
});

describe('Audit localStorage persistence', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('loads empty array when nothing stored', () => {
    expect(loadAuditLog()).toEqual([]);
  });

  it('save and load round-trips correctly', () => {
    const events = [makeEvent(), makeEvent()];
    saveAuditLog(events);
    const loaded = loadAuditLog();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].reasonCode).toBe('MANUAL_DIVERT');
  });

  it('appendAuditEvent adds to log', () => {
    const ev1 = makeEvent();
    appendAuditEvent(ev1);
    const ev2 = makeEvent({ reasonCode: 'SOURCE_SWITCH', itemId: null, itemName: null });
    appendAuditEvent(ev2);
    const log = loadAuditLog();
    expect(log).toHaveLength(2);
    expect(log[1].reasonCode).toBe('SOURCE_SWITCH');
  });

  it('clearAuditLog empties storage', () => {
    appendAuditEvent(makeEvent());
    clearAuditLog();
    expect(loadAuditLog()).toEqual([]);
  });

  it('handles corrupted storage gracefully', () => {
    localStorageMock.setItem('loopgate_audit_log_v1', 'NOT_JSON{{{{');
    expect(() => loadAuditLog()).not.toThrow();
    expect(loadAuditLog()).toEqual([]);
  });
});

describe('CSV export', () => {
  it('includes header row', () => {
    const csv = exportAuditLogCSV([makeEvent()]);
    expect(csv.split('\n')[0]).toContain('reasonCode');
    expect(csv.split('\n')[0]).toContain('provenance');
  });

  it('escapes double quotes in action', () => {
    const ev = makeEvent({ action: 'Route "item-01" to inspection' });
    const csv = exportAuditLogCSV([ev]);
    expect(csv).toContain('""item-01""');
  });

  it('empty array produces header only', () => {
    const csv = exportAuditLogCSV([]);
    expect(csv.split('\n')).toHaveLength(1);
  });
});
