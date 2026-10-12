import { useVirtualizer } from '@tanstack/react-virtual';
import { useId, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { InfoIcon } from '@/components/ui/Icons';
import { FindingStatusText, SeverityBadge, SeverityIcon, SEVERITY_TEXT } from '@/components/ui/Severity';
import { FINDINGS } from '@/data/findings';
import { NOT_TESTED, OWASP, SEVERITY_LABEL, SEVERITY_ORDER } from '@/data/taxonomy';
import { cn, whenText } from '@/lib/format';
import { isOpenStatus, useApp } from '@/store/app';
import type { Finding, FindingStatus, OwaspId, Severity } from '@/types';
import { ScanConfirmDialog } from './workspace/ScanDialogs';

type StatusFilter = 'open' | 'all' | FindingStatus;

const STATUS_OPTIONS: [StatusFilter, string][] = [
  ['open', 'Open'],
  ['all', 'All statuses'],
  ['new', 'New since last scan'],
  ['came-back', 'Came back'],
  ['fixed', 'Fixed'],
  ['verified', 'Verified fixed'],
  ['false-positive', 'False positive'],
  ['accepted-risk', 'Accepted risk'],
];

const ROW_GRID = 'grid grid-cols-[120px_minmax(220px,1.6fr)_minmax(200px,1.2fr)_120px_110px] items-center gap-3';

export function FindingsPage() {
  const states = useApp((s) => s.findings);
  const lastFullScanAt = useApp((s) => s.lastFullScanAt);
  const requests = useApp((s) => s.requests);
  const [params, setParams] = useSearchParams();
  const [rescan, setRescan] = useState(false);
  const ids = { search: useId(), cat: useId(), status: useId(), group: useId() };

  const q = params.get('q') ?? '';
  const category = (params.get('category') ?? 'all') as OwaspId | 'all';
  const status = (params.get('status') ?? 'open') as StatusFilter;
  const severity = (params.get('severity') ?? 'all') as Severity | 'all';
  const groupBy = params.get('group') === 'category' ? 'category' : 'none';

  const set = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const statusMatch = (f: Finding) => {
    const st = states[f.id]?.status ?? 'open';
    return status === 'all' ? true : status === 'open' ? isOpenStatus(st) : st === status;
  };
  const base = FINDINGS.filter(statusMatch).filter((f) => {
    const term = q.trim().toLowerCase();
    return (
      (!term || f.title.toLowerCase().includes(term) || f.endpoint.toLowerCase().includes(term) || f.method.toLowerCase().includes(term)) &&
      (category === 'all' || f.owasp === category)
    );
  });
  const counts = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, base.filter((f) => f.severity === s).length])) as Record<Severity, number>;
  const rows = base
    .filter((f) => severity === 'all' || f.severity === severity)
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));

  const categories = [...new Set(FINDINGS.map((f) => f.owasp))].sort();
  const filtersActive = q || category !== 'all' || status !== 'open' || severity !== 'all' || groupBy !== 'none';
  const openFindings = FINDINGS.filter((f) => isOpenStatus(states[f.id]?.status ?? 'open'));
  const rescanRequests = [
    ...new Set(openFindings.flatMap((f) => (f.requestIds.includes('*') ? ['get-order'] : f.requestIds))),
  ].filter((id) => requests.some((r) => r.id === id));
  const rescanModules = [...new Set(openFindings.map((f) => f.module))];

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 md:px-10 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] text-ink-2">
          ShopLab collection · last full scan {whenText(lastFullScanAt)} · click a severity to filter
        </p>
        <Button size="sm" onClick={() => setRescan(true)} disabled={openFindings.length === 0}>
          Rescan only open findings
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="Filter by severity">
        <SevCard active={severity === 'all'} onClick={() => set('severity', 'all', 'all')} label={status === 'open' ? 'All open' : 'All'} count={base.length} />
        {SEVERITY_ORDER.map((s) => (
          <SevCard key={s} active={severity === s} onClick={() => set('severity', severity === s ? 'all' : s, 'all')} severity={s} label={SEVERITY_LABEL[s]} count={counts[s]} />
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-caution-soft px-4 py-3 text-[14px] text-brass-ink">
        <InfoIcon className="mt-0.5 h-[18px] w-[18px] shrink-0" />
        <p>
          <strong className="font-semibold">Not tested:</strong>{' '}
          {NOT_TESTED.map((n) => `${n.id} ${n.label}`).join(', ').replace(/, ([^,]*)$/, ' and $1')} (later phases); TLS checks
          (skipped on localhost).
        </p>
      </div>

      <div className="sticky top-0 z-10 -mx-4 mt-4 bg-canvas/95 px-4 py-3 backdrop-blur md:-mx-2 md:px-2">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_200px_170px_150px_auto] lg:items-end">
          <label htmlFor={ids.search} className="sm:col-span-2 lg:col-span-1">
            <span className="label">Search</span>
            <input id={ids.search} type="search" className="input py-2" placeholder="Endpoint or title" value={q} onChange={(e) => set('q', e.target.value, '')} />
          </label>
          <label htmlFor={ids.cat}>
            <span className="label">Category</span>
            <select id={ids.cat} className="select py-2" value={category} onChange={(e) => set('category', e.target.value, 'all')}>
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c} {OWASP[c]}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={ids.status}>
            <span className="label">Status</span>
            <select id={ids.status} className="select py-2" value={status} onChange={(e) => set('status', e.target.value, 'open')}>
              {STATUS_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={ids.group}>
            <span className="label">Group by</span>
            <select id={ids.group} className="select py-2" value={groupBy} onChange={(e) => set('group', e.target.value, 'none')}>
              <option value="none">Severity</option>
              <option value="category">Category</option>
            </select>
          </label>
          <Button className="h-[42px]" onClick={() => setParams({}, { replace: true })} disabled={!filtersActive}>
            Clear filters
          </Button>
        </div>
      </div>

      <section className="card mt-2 overflow-hidden" aria-labelledby="findings-caption">
        <h2 id="findings-caption" className="border-b border-line px-5 py-4 text-[16px] font-semibold" aria-live="polite">
          {rows.length} finding{rows.length === 1 ? '' : 's'} · {groupBy === 'category' ? 'by category, then severity' : 'most severe first'}
        </h2>
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-[16px] font-semibold">No findings match</p>
            <p className="mt-1 text-[14px] text-ink-2">Try a different search or status.</p>
            <Button className="mt-4" onClick={() => setParams({}, { replace: true })}>
              Clear filters
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <FindingsTable rows={rows} groupBy={groupBy} />
            </div>
            <ul className="divide-y divide-line md:hidden">
              {rows.map((f) => (
                <li key={f.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <SeverityBadge severity={f.severity} />
                    <span className="text-[13px]">
                      <FindingStatusText status={states[f.id]?.status ?? 'open'} />
                    </span>
                  </div>
                  <Link to={`/findings/${f.id}`} className="mt-2 block text-[15px] font-semibold underline decoration-line-strong underline-offset-4">
                    {f.title}
                  </Link>
                  <p className="mt-1 font-mono text-[12px] break-all text-ink-2">
                    {methodText(f)} {f.endpoint}
                  </p>
                  <p className="mt-0.5 font-mono text-[12px] text-ink-3">
                    {f.owasp} · {f.api}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <ScanConfirmDialog
        open={rescan}
        onOpenChange={setRescan}
        kind="rescan"
        requestIds={rescanRequests}
        modules={rescanModules}
        name="only open findings"
      />
    </div>
  );
}

function SevCard({ active, onClick, label, count, severity }: { active: boolean; onClick: () => void; label: string; count: number; severity?: Severity }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-2xl border bg-surface px-4 py-3 text-left transition-colors',
        active ? 'border-pine ring-1 ring-pine' : 'border-line hover:border-line-strong',
      )}
    >
      <span className={cn('flex items-center gap-1.5 text-[14px] font-semibold', severity ? SEVERITY_TEXT[severity] : 'text-ink')}>
        {severity && <SeverityIcon severity={severity} />}
        {label}
      </span>
      <span className="mt-1 block text-[28px] leading-none font-semibold">{count}</span>
    </button>
  );
}

type Item = { kind: 'group'; owasp: OwaspId; count: number } | { kind: 'row'; finding: Finding };

/** Virtualised so long lists (1,000+ findings) stay responsive. */
function FindingsTable({ rows, groupBy }: { rows: Finding[]; groupBy: 'none' | 'category' }) {
  const states = useApp((s) => s.findings);
  const scrollRef = useRef<HTMLDivElement>(null);

  const items = useMemo<Item[]>(() => {
    if (groupBy === 'none') return rows.map((finding) => ({ kind: 'row', finding }));
    const cats = [...new Set(rows.map((r) => r.owasp))].sort();
    return cats.flatMap((c) => {
      const inCat = rows.filter((r) => r.owasp === c);
      return [{ kind: 'group' as const, owasp: c, count: inCat.length }, ...inCat.map((finding) => ({ kind: 'row' as const, finding }))];
    });
  }, [rows, groupBy]);

  const virt = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (items[i].kind === 'group' ? 44 : 50),
    overscan: 12,
  });

  return (
    <div role="table" aria-label="Findings" aria-rowcount={rows.length + 1} className="overflow-x-auto">
      <div className="min-w-[860px]">
        <div role="rowgroup">
          <div role="row" className={cn(ROW_GRID, 'border-b border-line px-5 py-3 text-xs font-semibold tracking-wider text-ink-2 uppercase')}>
            <span role="columnheader">Severity</span>
            <span role="columnheader">Finding</span>
            <span role="columnheader">Endpoint</span>
            <span role="columnheader">2025 / API</span>
            <span role="columnheader">Status</span>
          </div>
        </div>
        <div ref={scrollRef} role="rowgroup" className="max-h-[68vh] overflow-auto">
          <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
            {virt.getVirtualItems().map((vi) => {
              const item = items[vi.index];
              const style = { position: 'absolute' as const, top: 0, left: 0, right: 0, transform: `translateY(${vi.start}px)` };
              if (item.kind === 'group')
                return (
                  <div key={`g-${item.owasp}`} role="row" style={style} data-index={vi.index} ref={virt.measureElement} className="border-b border-line bg-surface-2 px-5 py-2.5 text-[14px] font-semibold">
                    <span role="cell">
                      {item.owasp}:2025 {OWASP[item.owasp]} <span className="font-normal text-ink-2">({item.count})</span>
                    </span>
                  </div>
                );
              const f = item.finding;
              return (
                <div key={f.id} role="row" style={style} data-index={vi.index} ref={virt.measureElement} className={cn(ROW_GRID, 'border-b border-line px-5 py-3 text-[15px] hover:bg-white')}>
                  <span role="cell">
                    <SeverityBadge severity={f.severity} />
                  </span>
                  <span role="cell" className="min-w-0">
                    <Link to={`/findings/${f.id}`} className="underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                      {f.title}
                    </Link>
                  </span>
                  <span role="cell" className="truncate font-mono text-[13px]" title={`${methodText(f)} ${f.endpoint}`}>
                    {methodText(f)} {f.endpoint}
                  </span>
                  <span role="cell" className="font-mono text-[13px]">
                    {f.owasp} · {f.api}
                  </span>
                  <span role="cell" className="text-[14px]">
                    <FindingStatusText status={states[f.id]?.status ?? 'open'} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const methodText = (f: Finding) => (f.method === 'ALL' ? 'All' : f.method);
