/**
 * src/engine/audit.ts
 * Audit trail for Loopgate operator actions.
 * Zero UI. localStorage persistence with try/catch.
 */

import type { RouteId, Provenance } from '@/domain/types';

export type AuditReasonCode =
  | 'MANUAL_DIVERT'           // operator overrode route via UI
  | 'SEND_TO_STANDARD'        // operator sent item to main stream
  | 'SAFETY_FLOOR_REFUSAL'    // safety floor blocked compactor route
  | 'HUMAN_CLASS_CORRECTION'  // operator corrected material class
  | 'SOURCE_SWITCH'           // switched between simulated / photo scenario
  | 'BATCH_START'             // new batch loaded
  | 'POLICY_CHANGE';          // strictness slider changed

export interface AuditEvent {
  id: string;                    // monotonic uuid-lite
  timestamp: string;             // ISO-8601
  itemId: string | null;         // null for non-item events
  itemName: string | null;
  action: string;                // human-readable action description
  reasonCode: AuditReasonCode;
  fromRoute: RouteId | null;
  toRoute: RouteId | null;
  provenance: Provenance;
  notes?: string;
}

const STORAGE_KEY = 'loopgate_audit_log_v1';
const MAX_EVENTS = 500;

let _counter = 0;
function makeId(): string {
  _counter += 1;
  return `aud-${Date.now().toString(36)}-${_counter.toString(36)}`;
}

export function createAuditEvent(
  fields: Omit<AuditEvent, 'id' | 'timestamp'>
): AuditEvent {
  return {
    id: makeId(),
    timestamp: new Date().toISOString(),
    ...fields,
  };
}

export function loadAuditLog(): AuditEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as AuditEvent[];
  } catch {
    return [];
  }
}

export function saveAuditLog(events: AuditEvent[]): void {
  try {
    // Keep only the most recent MAX_EVENTS
    const trimmed = events.slice(-MAX_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage unavailable (SSR or quota exceeded) — silently ignore
  }
}

export function appendAuditEvent(event: AuditEvent): AuditEvent[] {
  const existing = loadAuditLog();
  const updated = [...existing, event];
  saveAuditLog(updated);
  return updated;
}

export function clearAuditLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function exportAuditLogCSV(events: AuditEvent[]): string {
  const headers = [
    'id', 'timestamp', 'itemId', 'itemName', 'action',
    'reasonCode', 'fromRoute', 'toRoute', 'provenance', 'notes',
  ];
  const rows = events.map((e) =>
    [
      e.id,
      e.timestamp,
      e.itemId ?? '',
      e.itemName ?? '',
      `"${e.action.replace(/"/g, '""')}"`,
      e.reasonCode,
      e.fromRoute ?? '',
      e.toRoute ?? '',
      e.provenance,
      `"${(e.notes ?? '').replace(/"/g, '""')}"`,
    ].join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}
