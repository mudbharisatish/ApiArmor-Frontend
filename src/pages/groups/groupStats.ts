import { FINDINGS } from '@/data/findings';
import { SEVERITY_ORDER } from '@/data/taxonomy';
import { isOpenStatus } from '@/store/app';
import type { ApiRequest, FindingState, ScanRecord, Severity } from '@/types';

export interface GroupStats {
  requests: ApiRequest[];
  openFindings: number;
  worst?: Severity;
  lastScan?: ScanRecord;
}

/** Summary numbers for a group card: its APIs, open findings on them, and the latest scan that touched them. */
export function groupStats(group: string, requests: ApiRequest[], findings: Record<string, FindingState>, scans: ScanRecord[]): GroupStats {
  const inGroup = requests.filter((r) => r.group === group);
  const ids = new Set(inGroup.map((r) => r.id));
  // Host-wide findings (e.g. CORS on every /api route) aren't counted per group, to avoid double counting.
  const open = FINDINGS.filter((f) => f.requestIds.some((id) => ids.has(id)) && isOpenStatus(findings[f.id]?.status ?? 'open'));
  const worst = open.map((f) => f.severity).sort((a, b) => SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b))[0];
  const lastScan = scans.find((s) => s.requestIds.some((id) => ids.has(id)));
  return { requests: inGroup, openFindings: open.length, worst, lastScan };
}

export const groupPath = (name: string) => `/groups/${encodeURIComponent(name)}`;
