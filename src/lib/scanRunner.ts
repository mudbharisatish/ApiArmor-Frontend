import { FINDING_BY_ID, findingsFor } from '@/data/findings';
import { MODULE_BY_ID, MODULES, SEVERITY_ORDER } from '@/data/taxonomy';
import { accessFor, effectiveRequest, pairFor, useApp } from '@/store/app';
import type { ModuleId, OwaspId, ScanRecord, ScanUnit } from '@/types';
import { planChecks } from './scanPlan';
import { isLocalHost, parseUrl, templatePath } from './url';
import { resolveVariables } from './variables';

/**
 * Simulated scan engine. It plans checks exactly as the real engine would (see scanPlan.ts),
 * then "sends" probes on a timer and reports the planted ShopLab flaws.
 * It lives outside React, so leaving the Scans page doesn't stop a scan.
 */

const TICK_MS = 110;
let timer: ReturnType<typeof setInterval> | undefined;

function unreachableReason(rawUrl: string): string | undefined {
  const env = activeEnv();
  const url = parseUrl(resolveVariables(rawUrl, env));
  if (!url.ok) return 'Invalid URL';
  if (isLocalHost(url.hostname) && url.port === '4000') return undefined;
  if (isLocalHost(url.hostname)) return `Connection refused by ${url.host}`;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)) return `Timed out reaching ${url.host}`;
  return `DNS lookup failed for ${url.hostname}`;
}

function activeEnv() {
  const s = useApp.getState();
  return s.environments.find((e) => e.id === s.activeEnvId) ?? s.environments[0];
}

export function runningScan(): ScanRecord | undefined {
  return useApp.getState().scans.find((s) => s.state === 'running');
}

export interface StartOptions {
  kind: ScanRecord['kind'];
  requestIds: string[];
  title?: string;
  /** Only these modules (used by "Rescan only open findings"). */
  modules?: ModuleId[];
  /** Skip the second-user check (user chose "run without it"). */
  allowMissingSecondUser?: boolean;
  /** OWASP categories to cover. Defaults to the remembered selection. */
  categories?: OwaspId[];
}

/** Start a scan. Returns the scan id; if one is already running, returns that one instead. */
export function startScan(opts: StartOptions): string {
  const existing = runningScan();
  if (existing) {
    useApp.getState().showToast('info', 'A scan is already running. Cancel it to start another.');
    return existing.id;
  }
  const s = useApp.getState();
  const env = activeEnv();
  const categories = opts.categories ?? s.owaspSelection;
  const units: ScanUnit[] = [];

  for (const mod of MODULES) {
    if (opts.modules && !opts.modules.includes(mod.id)) continue;
    for (const rid of opts.requestIds) {
      const req = effectiveRequest(s, rid);
      if (!req) continue;
      const pair = pairFor(s, rid);
      const plan = planChecks({
        request: req,
        access: accessFor(s, rid),
        identityA: s.identities.find((i) => i.id === pair.a),
        identityB: s.identities.find((i) => i.id === pair.b),
        env,
        profile: s.scanProfile,
        categories,
      }).find((p) => p.module === mod.id)!;
      const probes = mod.id === 'a06.resource' ? Math.min(s.scanSettings.burstSize, 60) + 2 : mod.probes;
      units.push({
        requestId: rid,
        module: mod.id,
        status: plan.run ? 'waiting' : 'skipped',
        reason: plan.reason,
        probesDone: 0,
        probesTotal: plan.run ? probes : 0,
        findingIds: [],
      });
    }
  }

  const first = effectiveRequest(s, opts.requestIds[0]);
  const single = opts.requestIds.length === 1 && first;
  const scan: ScanRecord = {
    id: `scan_${Date.now().toString(36)}`,
    kind: opts.kind,
    title:
      opts.title ??
      (single ? `${first.method} ${templatePath(parseUrl(first.url).path)}` : `${opts.requestIds.length} requests`),
    method: single ? first.method : undefined,
    path: single ? templatePath(parseUrl(first.url).path) : undefined,
    requestIds: opts.requestIds,
    envId: env.id,
    safeMode: env.safeMode,
    profile: s.scanProfile,
    categories,
    startedAt: new Date().toISOString(),
    state: 'running',
    units,
    foundFindingIds: [],
  };
  s.upsertScan(scan);
  loop();
  return scan.id;
}

export function cancelScan(id: string) {
  const s = useApp.getState();
  const scan = s.scans.find((x) => x.id === id);
  if (!scan || scan.state !== 'running') return;
  s.upsertScan({
    ...scan,
    state: 'cancelled',
    finishedAt: new Date().toISOString(),
    units: scan.units.map((u) => (u.status === 'waiting' || u.status === 'running' ? { ...u, status: 'not-run' } : u)),
  });
  s.showToast('info', `Scan cancelled. ${scan.foundFindingIds.length} finding(s) found so far are kept.`);
  stop();
}

function stop() {
  clearInterval(timer);
  timer = undefined;
}

function loop() {
  stop();
  timer = setInterval(tick, TICK_MS);
}

/** Resume a scan loop after hot reload or if something stopped the timer. */
export function ensureRunnerAlive() {
  if (runningScan() && !timer) loop();
}

function tick() {
  const s = useApp.getState();
  const scan = runningScan();
  if (!scan) return stop();

  const totalProbes = scan.units.reduce((n, u) => n + u.probesTotal, 0);
  const baseStep = Math.max(1, Math.round(totalProbes / 140));
  const units = scan.units.map((u) => ({ ...u }));
  const idx = units.findIndex((u) => u.status === 'waiting' || u.status === 'running');

  if (idx === -1) return finish(scan);

  const u = units[idx];
  const req = effectiveRequest(s, u.requestId);
  if (u.status === 'waiting') {
    // A target that can't be reached, or an identity that can't sign in, makes the check inconclusive.
    const unreachable = req ? unreachableReason(req.url) : 'Request was deleted';
    const pair = pairFor(s, u.requestId);
    const ida = s.identities.find((i) => i.id === pair.a);
    const signInProblem = ida && ida.status === 'failed' ? `${ida.name} can't sign in` : undefined;
    if (unreachable || signInProblem) {
      units[idx] = { ...u, status: 'inconclusive', reason: unreachable ?? signInProblem, probesDone: 1 };
      s.upsertScan({ ...scan, units });
      return;
    }
    u.status = 'running';
  }

  const step = u.module === 'a06.resource' ? baseStep * 3 : baseStep;
  u.probesDone = Math.min(u.probesTotal, u.probesDone + step);

  let found = scan.foundFindingIds;
  if (u.probesDone >= u.probesTotal && req) {
    u.status = 'done';
    const path = parseUrl(resolveVariables(req.url, activeEnv())).path;
    const candidates = findingsFor(u.requestId, path, u.module);
    const hits = candidates.filter((f) => !s.findings[f.id]?.simulatedFixed);
    u.findingIds = hits.map((f) => f.id);

    if (u.module === 'a01.bfla' && /\/debug\//.test(path) && hits.length === 0)
      u.note = 'Reported under Misconfiguration (debug endpoint)';
    if (u.module === 'a01.bfla' && req.method === 'DELETE' && hits.length)
      u.note = 'Fixture user created and deleted; existing data untouched';

    const at = new Date().toISOString();
    for (const f of candidates) {
      const state = s.findings[f.id];
      if (!state) continue;
      const alreadyCounted = found.includes(f.id);
      if (hits.includes(f)) {
        if (alreadyCounted) continue;
        if (state.status === 'fixed' || state.status === 'verified') {
          s.patchFinding(f.id, {
            status: 'came-back',
            lastSeen: at,
            simulatedFixed: false,
            history: [...state.history, { at, text: 'Came back: found again by a scan after being marked Fixed' }],
          });
        } else {
          const note =
            state.status === 'false-positive' || state.status === 'accepted-risk'
              ? `Seen again in a scan (still marked ${state.status === 'false-positive' ? 'False positive' : 'Accepted risk'})`
              : 'Seen again in a scan';
          s.patchFinding(f.id, { lastSeen: at, history: [...state.history, { at, text: note }] });
        }
      } else if (state.status === 'fixed') {
        s.patchFinding(f.id, {
          status: 'verified',
          verifiedAt: at,
          history: [...state.history, { at, text: 'Verified fixed: the scan no longer finds it' }],
        });
      }
    }
    found = [...found, ...u.findingIds.filter((id) => !found.includes(id))];
  }
  units[idx] = u;
  s.upsertScan({ ...scan, units, foundFindingIds: sortBySeverity(found) });
}

function finish(scan: ScanRecord) {
  const s = useApp.getState();
  const partial = scan.units.some((u) => u.status === 'inconclusive');
  const done: ScanRecord = { ...scan, state: partial ? 'partial' : 'finished', finishedAt: new Date().toISOString() };
  s.upsertScan(done);
  stop();

  const shopLabCount = s.requests.filter((r) => !r.imported).length;
  if (scan.kind === 'collection' && scan.requestIds.length >= shopLabCount) s.setLastFullScanAt(done.finishedAt!);

  const n = done.foundFindingIds.length;
  const msg = partial
    ? `Scan partly finished: some checks were inconclusive. ${n} finding${n === 1 ? '' : 's'}.`
    : `Scan finished: ${n} finding${n === 1 ? '' : 's'}.`;
  s.showToast(partial ? 'caution' : 'success', msg);

  if (s.notifyOnFinish && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
    try {
      new Notification('ApiArmor', { body: `${scan.title}: ${msg}` });
    } catch {
      /* notifications unavailable */
    }
  }
}

export function sortBySeverity(ids: string[]): string[] {
  return [...ids].sort(
    (a, b) => SEVERITY_ORDER.indexOf(FINDING_BY_ID[a].severity) - SEVERITY_ORDER.indexOf(FINDING_BY_ID[b].severity),
  );
}

export interface ModuleRow {
  module: ModuleId;
  status: ScanUnit['status'];
  probesDone: number;
  probesTotal: number;
  reason?: string;
  findingIds: string[];
  note?: string;
  requests: number;
}

/** Aggregate units into one row per module for the Checks table. */
export function moduleRows(scan: ScanRecord): ModuleRow[] {
  return MODULES.filter((m) => scan.units.some((u) => u.module === m.id)).map((m) => {
    const us = scan.units.filter((u) => u.module === m.id);
    const ran = us.filter((u) => u.status !== 'skipped');
    const has = (st: ScanUnit['status']) => us.some((u) => u.status === st);
    let status: ScanUnit['status'];
    if (ran.length === 0) status = 'skipped';
    else if (has('running')) status = 'running';
    else if (ran.every((u) => u.status === 'waiting')) status = 'waiting';
    else if (has('waiting')) status = 'running';
    else if (has('not-run') && !ran.some((u) => u.status === 'done')) status = 'not-run';
    else if (has('inconclusive') && !ran.some((u) => u.status === 'done')) status = 'inconclusive';
    else status = 'done';
    const reasons = [...new Set(us.filter((u) => u.status === 'skipped').map((u) => u.reason))];
    const ids = [...new Set(us.flatMap((u) => u.findingIds))];
    const inconclusive = us.filter((u) => u.status === 'inconclusive');
    return {
      module: m.id,
      status,
      probesDone: ran.reduce((n, u) => n + u.probesDone, 0),
      probesTotal: ran.reduce((n, u) => n + u.probesTotal, 0),
      reason:
        status === 'skipped'
          ? reasons.length === 1
            ? reasons[0]
            : `${reasons[0]} (+${reasons.length - 1} other reason${reasons.length === 2 ? '' : 's'})`
          : inconclusive.length
            ? `${inconclusive[0].reason}${inconclusive.length > 1 ? ` (+${inconclusive.length - 1} more)` : ''}`
            : undefined,
      findingIds: sortBySeverity(ids),
      note: us.find((u) => u.note)?.note,
      requests: ran.length,
    };
  });
}

export const moduleName = (id: ModuleId) => MODULE_BY_ID[id].name;
