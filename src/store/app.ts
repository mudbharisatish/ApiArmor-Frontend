import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { seedFindingStates } from '@/data/findings';
import { GROUP_ORDER, SEED_ENVIRONMENTS, SEED_IDENTITIES, SHOPLAB_ACCESS, SHOPLAB_REQUESTS } from '@/data/shoplab';
import { TESTABLE_OWASP } from '@/data/taxonomy';
import { suggestAccess } from '@/lib/scanPlan';
import type {
  Access,
  ApiRequest,
  Environment,
  FindingState,
  FindingStatus,
  Identity,
  OwaspId,
  RequestDraft,
  ScanProfile,
  ScanRecord,
  ScanSettings,
  SendResult,
} from '@/types';
import { idbStorage } from './idbStorage';

export interface Toast {
  id: number;
  kind: 'success' | 'info' | 'caution' | 'error';
  text: string;
}

export interface IdentityPair {
  a: string;
  b: string;
}

interface Data {
  requests: ApiRequest[];
  access: Record<string, Access>;
  pairs: Record<string, IdentityPair>;
  openTabs: string[];
  activeRequestId: string | null;
  drafts: Record<string, RequestDraft>;
  environments: Environment[];
  activeEnvId: string;
  identities: Identity[];
  findings: Record<string, FindingState>;
  lastFullScanAt: string;
  scans: ScanRecord[];
  scanSettings: ScanSettings;
  scanProfile: ScanProfile;
  responseLayout: 'right' | 'bottom';
  notifyOnFinish: boolean;
  /** Group (folder) names in display order. A request belongs to exactly one group. */
  groups: string[];
  /** OWASP categories the next scan covers. Remembered between scans. */
  owaspSelection: OwaspId[];
}

interface Ephemeral {
  hydrated: boolean;
  responses: Record<string, SendResult>;
  sending: Record<string, boolean>;
  toast: Toast | null;
  paletteOpen: boolean;
  shortcutsOpen: boolean;
  /** Requests ticked in the collection tree for "Scan selected". */
  selected: string[];
}

interface Actions {
  showToast: (kind: Toast['kind'], text: string) => void;
  dismissToast: () => void;
  setPaletteOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;

  openRequest: (id: string) => void;
  closeTab: (id: string) => void;
  updateDraft: (id: string, patch: Partial<RequestDraft>) => void;
  saveRequest: (id: string) => void;
  discardDraft: (id: string) => void;
  addRequest: (req: ApiRequest) => void;
  setAccess: (id: string, access: Access) => void;
  setPair: (id: string, pair: Partial<IdentityPair>) => void;
  setResponse: (id: string, res: SendResult | null) => void;
  setSending: (id: string, sending: boolean) => void;
  setResponseLayout: (layout: 'right' | 'bottom') => void;

  setActiveEnv: (id: string) => void;
  setSafeMode: (envId: string, on: boolean) => void;
  updateEnvironment: (id: string, patch: Partial<Environment>) => void;
  addEnvironment: (env: Environment) => void;

  updateIdentity: (id: string, patch: Partial<Identity>) => void;
  addIdentity: (identity: Identity) => void;
  removeIdentity: (id: string) => void;

  setFindingStatus: (id: string, status: FindingStatus, reason?: string) => void;
  addFindingHistory: (id: string, text: string) => void;
  patchFinding: (id: string, patch: Partial<FindingState>) => void;

  upsertScan: (scan: ScanRecord) => void;
  setScanSettings: (s: Partial<ScanSettings>) => void;
  setScanProfile: (p: ScanProfile) => void;
  setLastFullScanAt: (at: string) => void;
  setNotifyOnFinish: (on: boolean) => void;

  createGroup: (name: string, requestIds: string[]) => void;
  renameGroup: (from: string, to: string) => void;
  deleteGroup: (name: string) => void;
  moveRequest: (id: string, group: string) => void;
  moveRequests: (ids: string[], group: string) => void;
  /** Add a request to the collection without opening it in the editor. */
  createRequest: (req: ApiRequest) => void;
  setSelected: (ids: string[]) => void;
  setOwaspSelection: (ids: OwaspId[]) => void;

  resetDemo: () => void;
}

export type AppState = Data & Ephemeral & Actions;

const STATUS_TEXT: Record<FindingStatus, string> = {
  new: 'New',
  open: 'Open',
  'came-back': 'Came back',
  fixed: 'Fixed',
  verified: 'Verified fixed',
  'false-positive': 'False positive',
  'accepted-risk': 'Accepted risk',
};
export const statusLabel = (s: FindingStatus) => STATUS_TEXT[s];
export const isOpenStatus = (s: FindingStatus) => s === 'new' || s === 'open' || s === 'came-back';

function seed(): Data {
  return {
    requests: structuredClone(SHOPLAB_REQUESTS),
    access: { ...SHOPLAB_ACCESS },
    pairs: {},
    openTabs: [],
    activeRequestId: null,
    drafts: {},
    environments: structuredClone(SEED_ENVIRONMENTS),
    activeEnvId: 'shoplab',
    identities: structuredClone(SEED_IDENTITIES),
    findings: seedFindingStates(),
    lastFullScanAt: new Date(Date.now() - 45 * 60_000).toISOString(),
    scans: [],
    scanSettings: { rateLimit: 10, burstSize: 30, timeoutMs: 10_000, idPatterns: '' },
    scanProfile: 'default',
    responseLayout: 'right',
    notifyOnFinish: false,
    groups: GROUP_ORDER.filter((g) => SHOPLAB_REQUESTS.some((r) => r.group === g)),
    owaspSelection: [...TESTABLE_OWASP],
  };
}

/** Everything in Data is persisted to IndexedDB; responses, toasts and dialogs are not. */
const DATA_KEYS = Object.keys(seed()) as (keyof Data)[];

let toastSeq = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      ...seed(),
      hydrated: false,
      responses: {},
      sending: {},
      toast: null,
      paletteOpen: false,
      shortcutsOpen: false,
      selected: [],

      // One toast at a time; it replaces any current one and hides itself after ~4.5 s.
      showToast: (kind, text) => {
        clearTimeout(toastTimer);
        const id = ++toastSeq;
        set({ toast: { id, kind, text } });
        toastTimer = setTimeout(() => {
          if (get().toast?.id === id) set({ toast: null });
        }, 4500);
      },
      dismissToast: () => {
        clearTimeout(toastTimer);
        set({ toast: null });
      },
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),

      openRequest: (id) =>
        set((s) => ({
          activeRequestId: id,
          openTabs: s.openTabs.includes(id) ? s.openTabs : [...s.openTabs, id],
        })),
      closeTab: (id) =>
        set((s) => {
          const idx = s.openTabs.indexOf(id);
          const openTabs = s.openTabs.filter((t) => t !== id);
          const drafts = { ...s.drafts };
          delete drafts[id];
          const activeRequestId =
            s.activeRequestId === id ? (openTabs[Math.min(idx, openTabs.length - 1)] ?? null) : s.activeRequestId;
          return { openTabs, drafts, activeRequestId };
        }),
      updateDraft: (id, patch) =>
        set((s) => {
          const req = s.requests.find((r) => r.id === id);
          if (!req) return {};
          const base: RequestDraft = s.drafts[id] ?? {
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: req.body,
          };
          return { drafts: { ...s.drafts, [id]: { ...base, ...patch } } };
        }),
      saveRequest: (id) =>
        set((s) => {
          const draft = s.drafts[id];
          if (!draft) return {};
          const drafts = { ...s.drafts };
          delete drafts[id];
          return { requests: s.requests.map((r) => (r.id === id ? { ...r, ...draft } : r)), drafts };
        }),
      discardDraft: (id) =>
        set((s) => {
          const drafts = { ...s.drafts };
          delete drafts[id];
          return { drafts };
        }),
      addRequest: (req) =>
        set((s) => ({
          requests: [...s.requests, req],
          groups: s.groups.includes(req.group) ? s.groups : [...s.groups, req.group],
          access: { ...s.access },
          openTabs: [...s.openTabs, req.id],
          activeRequestId: req.id,
        })),
      setAccess: (id, access) => set((s) => ({ access: { ...s.access, [id]: access } })),
      setPair: (id, pair) =>
        set((s) => ({ pairs: { ...s.pairs, [id]: { ...defaultPair(s, id), ...s.pairs[id], ...pair } } })),
      setResponse: (id, res) =>
        set((s) => {
          const responses = { ...s.responses };
          if (res) responses[id] = res;
          else delete responses[id];
          return { responses };
        }),
      setSending: (id, sending) => set((s) => ({ sending: { ...s.sending, [id]: sending } })),
      setResponseLayout: (responseLayout) => set({ responseLayout }),

      setActiveEnv: (activeEnvId) => set({ activeEnvId }),
      setSafeMode: (envId, on) =>
        set((s) => ({ environments: s.environments.map((e) => (e.id === envId ? { ...e, safeMode: on } : e)) })),
      updateEnvironment: (id, patch) =>
        set((s) => ({ environments: s.environments.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      addEnvironment: (env) => set((s) => ({ environments: [...s.environments, env] })),

      updateIdentity: (id, patch) =>
        set((s) => ({ identities: s.identities.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      addIdentity: (identity) => set((s) => ({ identities: [...s.identities, identity] })),
      removeIdentity: (id) =>
        set((s) => ({
          identities: s.identities.filter((i) => i.id !== id),
          pairs: Object.fromEntries(
            Object.entries(s.pairs).map(([k, p]) => [k, { a: p.a === id ? '' : p.a, b: p.b === id ? '' : p.b }]),
          ),
        })),

      setFindingStatus: (id, status, reason) =>
        set((s) => {
          const f = s.findings[id];
          if (!f) return {};
          const at = new Date().toISOString();
          return {
            findings: {
              ...s.findings,
              [id]: {
                ...f,
                status,
                // Marking Fixed makes the static ShopLab behave as if the flaw were fixed; reopening undoes it.
                simulatedFixed: status === 'fixed' || status === 'verified',
                verifiedAt: status === 'verified' ? at : undefined,
                history: [...f.history, { at, text: `Marked ${STATUS_TEXT[status]}`, reason }],
              },
            },
          };
        }),
      addFindingHistory: (id, text) =>
        set((s) => {
          const f = s.findings[id];
          if (!f) return {};
          return {
            findings: { ...s.findings, [id]: { ...f, history: [...f.history, { at: new Date().toISOString(), text }] } },
          };
        }),
      patchFinding: (id, patch) =>
        set((s) => ({ findings: { ...s.findings, [id]: { ...s.findings[id], ...patch } } })),

      upsertScan: (scan) =>
        set((s) => {
          const exists = s.scans.some((x) => x.id === scan.id);
          const scans = exists ? s.scans.map((x) => (x.id === scan.id ? scan : x)) : [scan, ...s.scans].slice(0, 25);
          return { scans };
        }),
      setScanSettings: (patch) => set((s) => ({ scanSettings: { ...s.scanSettings, ...patch } })),
      setScanProfile: (scanProfile) => set({ scanProfile }),
      setLastFullScanAt: (lastFullScanAt) => set({ lastFullScanAt }),
      setNotifyOnFinish: (notifyOnFinish) => set({ notifyOnFinish }),

      createGroup: (name, requestIds) =>
        set((s) => ({
          groups: s.groups.includes(name) ? s.groups : [...s.groups, name],
          requests: s.requests.map((r) => (requestIds.includes(r.id) ? { ...r, group: name } : r)),
        })),
      renameGroup: (from, to) =>
        set((s) => ({
          groups: allGroups(s).map((g) => (g === from ? to : g)),
          requests: s.requests.map((r) => (r.group === from ? { ...r, group: to } : r)),
        })),
      // A non-empty group's requests move to "Ungrouped" rather than being deleted.
      deleteGroup: (name) =>
        set((s) => {
          const orphans = s.requests.some((r) => r.group === name);
          const groups = allGroups(s).filter((g) => g !== name);
          return {
            groups: orphans && !groups.includes(UNGROUPED) ? [...groups, UNGROUPED] : groups,
            requests: s.requests.map((r) => (r.group === name ? { ...r, group: UNGROUPED } : r)),
          };
        }),
      moveRequest: (id, group) =>
        set((s) => ({
          groups: s.groups.includes(group) ? s.groups : [...s.groups, group],
          requests: s.requests.map((r) => (r.id === id ? { ...r, group } : r)),
        })),
      moveRequests: (ids, group) =>
        set((s) => ({
          groups: s.groups.includes(group) ? s.groups : [...s.groups, group],
          requests: s.requests.map((r) => (ids.includes(r.id) ? { ...r, group } : r)),
        })),
      createRequest: (req) =>
        set((s) => ({
          requests: [...s.requests, req],
          groups: s.groups.includes(req.group) ? s.groups : [...s.groups, req.group],
        })),
      setSelected: (selected) => set({ selected }),
      setOwaspSelection: (owaspSelection) => set({ owaspSelection }),

      resetDemo: () => set({ ...seed(), responses: {}, sending: {}, selected: [] }),
    }),
    {
      name: 'apiarmor-state',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => Object.fromEntries(DATA_KEYS.map((k) => [k, s[k]])) as Partial<AppState>,
      onRehydrateStorage: () => (state) => {
        // A scan can't survive a reload: label it so it's never mistaken for a complete result.
        if (state) {
          for (const scan of state.scans.filter((x) => x.state === 'running')) {
            state.upsertScan({
              ...scan,
              state: 'interrupted',
              finishedAt: new Date().toISOString(),
              units: scan.units.map((u) =>
                u.status === 'waiting' || u.status === 'running' ? { ...u, status: 'not-run' } : u,
              ),
            });
          }
        }
        useApp.setState({ hydrated: true });
      },
    },
  ),
);

export const UNGROUPED = 'Ungrouped';

/** Groups in display order, including any a request uses that isn't listed yet (e.g. from older saved data). */
export function allGroups(s: Pick<Data, 'groups' | 'requests'>): string[] {
  const extra = s.requests.map((r) => r.group).filter((g) => !s.groups.includes(g));
  return [...s.groups, ...new Set(extra)];
}

export function defaultPair(s: Pick<Data, 'identities' | 'access' | 'requests'>, requestId: string): IdentityPair {
  const access = accessFor(s, requestId);
  const a =
    (access === 'admin' ? s.identities.find((i) => i.isAdmin) : s.identities.find((i) => i.slot === 'A'))?.id ??
    s.identities[0]?.id ??
    '';
  const b = s.identities.find((i) => i.slot === 'B' && i.id !== a)?.id ?? '';
  return { a, b };
}

export function accessFor(s: Pick<Data, 'access' | 'requests'>, requestId: string): Access {
  const explicit = s.access[requestId];
  if (explicit) return explicit;
  const r = s.requests.find((x) => x.id === requestId);
  return r ? suggestAccess(r.method, r.url) : 'authenticated';
}

export function pairFor(s: AppState, requestId: string): IdentityPair {
  return { ...defaultPair(s, requestId), ...s.pairs[requestId] };
}

/** The request as the editor sees it: the unsaved draft if there is one, else the saved request. */
export function effectiveRequest(s: Pick<Data, 'requests' | 'drafts'>, id: string): (ApiRequest & { dirty: boolean }) | undefined {
  const r = s.requests.find((x) => x.id === id);
  if (!r) return undefined;
  const d = s.drafts[id];
  if (!d) return { ...r, dirty: false };
  const dirty =
    d.method !== r.method || d.url !== r.url || d.body !== r.body || JSON.stringify(d.headers) !== JSON.stringify(r.headers);
  return { ...r, ...d, dirty };
}

export const useActiveEnv = () => useApp((s) => s.environments.find((e) => e.id === s.activeEnvId) ?? s.environments[0]);
export const useOpenFindingCount = () =>
  useApp((s) => Object.values(s.findings).filter((f) => isOpenStatus(f.status)).length);
