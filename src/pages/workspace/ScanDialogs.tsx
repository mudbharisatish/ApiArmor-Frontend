import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { MODULE_BY_ID, MODULES, OWASP, TESTABLE_OWASP } from '@/data/taxonomy';
import { cn } from '@/lib/format';
import { planChecks } from '@/lib/scanPlan';
import { startScan } from '@/lib/scanRunner';
import { isLocalHost, parseUrl } from '@/lib/url';
import { accessFor, effectiveRequest, pairFor, useActiveEnv, useApp } from '@/store/app';
import type { ModuleId, OwaspId, ScanRecord } from '@/types';

/** Shown when an access-control test needs a second user and none is set. */
export function SecondIdentityDialog({
  open,
  onOpenChange,
  onSkip,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSkip: () => void;
}) {
  const navigate = useNavigate();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="To test access control, we need a second user"
      description={
        <>
          <p>
            Access tests send the same request as two different test users and compare what each can see. Pick or add a
            second user (identity B) first.
          </p>
          <p className="mt-3 rounded-lg bg-caution-soft px-3 py-2 text-[14px] text-caution">
            If you skip, these won&rsquo;t be tested and the results will say so: Object-level access (A01 · API1) and
            Function-level access (A01 · API5).
          </p>
        </>
      }
      footer={
        <>
          <Button
            onClick={() => {
              onOpenChange(false);
              onSkip();
            }}
          >
            Skip, run without them
          </Button>
          <Button variant="primary" onClick={() => navigate('/identities?add=1')}>
            Add identity
          </Button>
        </>
      }
    />
  );
}

interface ScanConfirmProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  requestIds: string[];
  modules?: ModuleId[];
  /** What is being scanned, e.g. "the Auth group". Used for the dialog title and the scan's name. */
  name?: string;
  kind?: ScanRecord['kind'];
}

/** Confirm step before every scan: exactly what will be sent, and which OWASP categories to cover. */
export function ScanConfirmDialog(props: ScanConfirmProps) {
  return props.open ? <ScanConfirmDialogOpen {...props} /> : null;
}

/** All ten OWASP Top 10:2025 categories; the ones without tests yet are shown but can't be ticked. */
export function OwaspPicker({ value, onChange }: { value: OwaspId[]; onChange: (v: OwaspId[]) => void }) {
  const allId = useId();
  const all = TESTABLE_OWASP.every((c) => value.includes(c));
  const some = !all && value.length > 0;
  const toggle = (c: OwaspId) => onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
  return (
    <fieldset className="rounded-xl border border-line bg-white p-4">
      <legend className="px-1 text-[15px] font-semibold">OWASP Top 10:2025 categories</legend>
      <label htmlFor={allId} className="flex items-center gap-2.5 border-b border-line pb-3 text-[15px] font-medium">
        <input
          id={allId}
          type="checkbox"
          className="h-4 w-4 accent-pine"
          checked={all}
          ref={(el) => {
            if (el) el.indeterminate = some;
          }}
          onChange={() => onChange(all ? [] : [...TESTABLE_OWASP])}
        />
        All available ({TESTABLE_OWASP.length})
        <span className="ml-auto text-[13px] font-normal text-ink-2">{value.length} selected</span>
      </label>
      <ul className="mt-2 grid gap-x-4 sm:grid-cols-2">
        {(Object.keys(OWASP) as OwaspId[]).map((c) => {
          const testable = TESTABLE_OWASP.includes(c);
          const modules = MODULES.filter((m) => m.owasp === c).map((m) => m.name);
          return (
            <li key={c}>
              <label
                className={cn('flex items-start gap-2.5 rounded-md py-1.5 text-[14px]', !testable && 'cursor-not-allowed text-ink-3')}
                title={testable ? `Checks: ${modules.join(', ')}` : 'No tests for this category yet'}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-pine"
                  disabled={!testable}
                  checked={testable && value.includes(c)}
                  onChange={() => toggle(c)}
                />
                <span>
                  <span className="font-mono text-[13px] font-medium">{c}</span> {OWASP[c]}
                  {!testable && <span className="block text-[12px]">Coming in a later phase</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

function ScanConfirmDialogOpen({ open, onOpenChange, requestIds, modules, name, kind = 'collection' }: ScanConfirmProps) {
  const env = useActiveEnv();
  const state = useApp();
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = useState(false);
  const [picks, setPicks] = useState<OwaspId[]>(() => state.owaspSelection.filter((c) => TESTABLE_OWASP.includes(c)));

  const plans = requestIds
    .map((id) => {
      const req = effectiveRequest(state, id);
      if (!req) return null;
      const pair = pairFor(state, id);
      const plan = planChecks({
        request: req,
        access: accessFor(state, id),
        identityA: state.identities.find((i) => i.id === pair.a),
        identityB: state.identities.find((i) => i.id === pair.b),
        env,
        profile: state.scanProfile,
        categories: picks,
      }).filter((p) => !modules || modules.includes(p.module));
      return { req, plan };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const hosts = [...new Set(plans.map(({ req }) => parseUrl(req.url).host).filter(Boolean))];
  const running = plans.reduce((n, { plan }) => n + plan.filter((p) => p.run).length, 0);
  const probes = plans.reduce(
    (n, { plan }) => n + plan.filter((p) => p.run).reduce((m, p) => m + MODULE_BY_ID[p.module].probes, 0),
    0,
  );
  const estSeconds = Math.max(5, Math.round(probes / state.scanSettings.rateLimit));
  const nonLocal = hosts.filter((h) => !isLocalHost(h.split(':')[0]));
  const single = plans.length === 1;

  const start = () => {
    state.setOwaspSelection(picks);
    onOpenChange(false);
    const scanName = name ? name.replace(/^the /, '').replace(/^./, (c) => c.toUpperCase()) : undefined;
    const id = startScan({ kind, requestIds, modules, title: single && kind === 'request' ? undefined : scanName, categories: picks });
    navigate(`/scans/${id}`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setConfirmed(false);
      }}
      width="max-w-2xl"
      title={name ? `Scan ${name}?` : single ? `Scan ${plans[0]?.req.name ?? 'request'}?` : `Scan ${plans.length} requests?`}
      description={
        <p>
          <strong className="text-ink">
            {plans.length} request{plans.length === 1 ? '' : 's'} to {hosts.join(', ') || 'no host'}
          </strong>
          , {running} check{running === 1 ? '' : 's'}, about {probes} probes, safe mode {env.safeMode ? 'on' : 'off'}, est. {estSeconds} s.
        </p>
      }
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={picks.length === 0 || plans.length === 0 || (nonLocal.length > 0 && !confirmed)} onClick={start}>
            Start scan
          </Button>
        </>
      }
    >
      <OwaspPicker value={picks} onChange={setPicks} />
      {picks.length === 0 && <p className="mt-2 text-[13px] font-medium text-crit">Pick at least one category to scan.</p>}

      <div className="mt-4 max-h-56 overflow-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-[14px]">
          <thead className="sticky top-0 bg-surface-2 text-xs tracking-wider text-ink-2 uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Request</th>
              <th className="px-3 py-2 font-semibold">Group</th>
              <th className="px-3 py-2 text-right font-semibold">Checks</th>
            </tr>
          </thead>
          <tbody>
            {plans.map(({ req, plan }) => (
              <tr key={req.id} className="border-t border-line">
                <td className="px-3 py-2">
                  <span className="font-mono text-[12px] text-ink-2">{req.method}</span> {req.name}
                </td>
                <td className="px-3 py-2 text-ink-2">{req.group}</td>
                <td className="px-3 py-2 text-right text-ink-2">
                  {plan.filter((p) => p.run).length} of {plan.length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[13px] text-ink-2">Checks that don&rsquo;t apply, or aren&rsquo;t selected, are listed with their reason on the scan page.</p>
      {env.kind === 'production' && (
        <p className="mt-3 rounded-lg bg-crit-soft px-3 py-2 text-[14px] text-crit">
          {env.name} is a Production environment: tests that change or delete data never run here.
        </p>
      )}
      {nonLocal.length > 0 && (
        <label className="mt-4 flex items-start gap-3 rounded-lg bg-caution-soft p-3 text-[14px] text-caution">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-pine" />
          <span>
            I own <strong>{nonLocal.join(', ')}</strong> or have written permission to test it.
          </span>
        </label>
      )}
    </Dialog>
  );
}

export function AdvancedScanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const settings = useApp((s) => s.scanSettings);
  const setSettings = useApp((s) => s.setScanSettings);
  const showToast = useApp((s) => s.showToast);
  const [draft, setDraft] = useState(settings);
  const num = (k: 'rateLimit' | 'burstSize' | 'timeoutMs', min: number, max: number) => ({
    value: draft[k],
    min,
    max,
    type: 'number' as const,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, [k]: Number(e.target.value) }),
  });
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v || a));
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) setDraft(settings);
      }}
      title="Advanced scan settings"
      description="Defaults suit most APIs. Lower the rate if your API is slow or shared."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              setSettings({
                rateLimit: clamp(draft.rateLimit, 1, 50),
                burstSize: clamp(draft.burstSize, 5, 60),
                timeoutMs: clamp(draft.timeoutMs, 1000, 60000),
                idPatterns: draft.idPatterns,
              });
              onOpenChange(false);
              showToast('success', 'Scan settings saved.');
            }}
          >
            Save settings
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="label">Rate limit (requests per second)</span>
          <input className="input" {...num('rateLimit', 1, 50)} />
        </label>
        <label>
          <span className="label">Burst size for rate-limit tests (max 60)</span>
          <input className="input" {...num('burstSize', 5, 60)} />
        </label>
        <label>
          <span className="label">Timeout per request (ms)</span>
          <input className="input" step={500} {...num('timeoutMs', 1000, 60000)} />
        </label>
        <label className="sm:col-span-2">
          <span className="label">Custom ID patterns (one regex per line)</span>
          <textarea
            className="input font-mono text-[13px]"
            rows={3}
            value={draft.idPatterns}
            placeholder={'^ord_[a-z0-9]{12}$'}
            onChange={(e) => setDraft({ ...draft, idPatterns: e.target.value })}
          />
        </label>
      </div>
    </Dialog>
  );
}
