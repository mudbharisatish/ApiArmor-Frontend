import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ArrowRight } from '@/components/ui/Icons';
import { SeverityBadge, SeverityText } from '@/components/ui/Severity';
import { FINDING_BY_ID } from '@/data/findings';
import { MODULE_BY_ID, NOT_TESTED, SEVERITY_ORDER, TESTABLE_OWASP } from '@/data/taxonomy';
import { cn, elapsed, whenText } from '@/lib/format';
import { cancelScan, moduleRows, startScan, type ModuleRow } from '@/lib/scanRunner';
import { useApp } from '@/store/app';
import type { ScanRecord, Severity } from '@/types';

const STATE_LINE: Record<ScanRecord['state'], string> = {
  running: 'Running',
  finished: 'Finished · every probe logged',
  cancelled: 'Cancelled · findings so far are kept',
  partial: 'Partial · some checks were inconclusive',
  interrupted: 'Interrupted · the page was reloaded mid-scan',
};

export function ScansPage() {
  const { scanId } = useParams();
  const scans = useApp((s) => s.scans);
  const navigate = useNavigate();
  const scan = scanId ? scans.find((s) => s.id === scanId) : scans[0];

  if (scans.length === 0) {
    return (
      <div className="mx-auto max-w-[1180px] px-4 py-10 md:px-10">
        <div className="card px-6 py-12 text-center">
          <h2 className="text-[20px] font-semibold">No scan yet</h2>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-2">
            Open a request and press <strong className="text-ink">Scan</strong>. Progress and findings appear here as each
            check runs.
          </p>
          <Button variant="primary" className="mt-6" onClick={() => navigate('/collections/get-order')}>
            Open collection
          </Button>
        </div>
      </div>
    );
  }
  if (!scan) {
    return (
      <div className="px-4 py-10 md:px-10">
        <p className="text-ink-2">
          That scan isn&rsquo;t in your history any more. <Link className="link" to="/scans">See the latest scan</Link>
        </p>
      </div>
    );
  }
  return <ScanView scan={scan} others={scans.filter((s) => s.id !== scan.id)} />;
}

function useTicker(active: boolean) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => set((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
}

function ScanView({ scan, others }: { scan: ScanRecord; others: ScanRecord[] }) {
  const navigate = useNavigate();
  const env = useApp((s) => s.environments.find((e) => e.id === scan.envId));
  const running = scan.state === 'running';
  useTicker(running);
  const rows = moduleRows(scan);
  const finished = rows.filter((r) => r.status !== 'waiting' && r.status !== 'running').length;
  const pct = rows.length ? Math.round((finished / rows.length) * 100) : 0;
  const found = scan.foundFindingIds.map((id) => FINDING_BY_ID[id]).filter(Boolean);
  const testedCategories = new Set(rows.filter((r) => r.status === 'done').map((r) => MODULE_BY_ID[r.module].owasp));
  const untestedRows = rows.filter((r) => r.status === 'skipped' || r.status === 'inconclusive' || r.status === 'not-run');

  const again = () => {
    const id = startScan({ kind: scan.kind, requestIds: scan.requestIds, title: scan.kind === 'request' ? undefined : scan.title });
    navigate(`/scans/${id}`);
  };

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 md:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14px] text-ink-2">
            {running ? (
              <>
                <span className="animate-pulse-dot mr-1.5 inline-block h-2 w-2 rounded-full bg-pine align-middle" />
                Running · {elapsed(scan.startedAt)} elapsed
              </>
            ) : (
              <>
                {STATE_LINE[scan.state]} · {whenText(scan.startedAt)} · took {elapsed(scan.startedAt, scan.finishedAt)}
              </>
            )}
          </p>
          <h2 className="mt-1 text-[26px] font-semibold tracking-tight md:text-[30px]">
            {running ? 'Scanning' : 'Scanned'}{' '}
            {scan.method ? (
              <span className="font-mono text-[22px] font-medium md:text-[26px]">
                {scan.method} {scan.path}
              </span>
            ) : (
              <span>{scan.title}</span>
            )}
          </h2>
          <p className="mt-1 text-[13px] text-ink-3">
            {env?.name ?? 'Unknown environment'} · safe mode {scan.safeMode ? 'on' : 'off'}
            {scan.profile === 'passive' && ' · passive only'}
            {scan.categories && ` · OWASP: ${scan.categories.length === TESTABLE_OWASP.length ? 'all available' : [...scan.categories].sort().join(', ')}`}
          </p>
        </div>
        <div className="flex gap-2">
          {running ? (
            <Button onClick={() => cancelScan(scan.id)}>Cancel scan</Button>
          ) : (
            <>
              <Button onClick={again}>Scan again</Button>
              <Button variant="primary" onClick={() => navigate('/findings')}>
                View all findings
              </Button>
            </>
          )}
        </div>
      </div>

      <p className="mt-6 text-[15px] font-semibold" id="progress-label">
        {finished} of {rows.length} checks finished
      </p>
      <div
        role="progressbar"
        aria-labelledby="progress-label"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-2 h-2 overflow-hidden rounded-full bg-line"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-300', scan.state === 'partial' || scan.state === 'cancelled' ? 'bg-caution' : 'bg-pine')}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="card overflow-hidden" aria-labelledby="checks-title">
          <h3 id="checks-title" className="border-b border-line px-5 py-4 text-[17px] font-semibold">
            Checks
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-[15px]">
              <thead>
                <tr className="border-b border-line text-xs tracking-wider text-ink-2 uppercase">
                  <th className="px-5 py-3 font-semibold">Check</th>
                  <th className="px-3 py-3 font-semibold">2025</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <CheckRow key={r.module} row={r} multi={scan.requestIds.length > 1} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="found-title">
          <h3 id="found-title" className="text-[17px] font-semibold">
            {running ? 'Found so far' : 'Found'} ({found.length})
          </h3>
          <ul aria-live="polite" className="mt-3 space-y-3">
            {found.map((f) => (
              <li key={f.id} className="card p-4">
                <SeverityBadge severity={f.severity} suffix={f.owasp} />
                <p className="mt-2 text-[15px] font-semibold">{f.title}</p>
                <Link to={`/findings/${f.id}`} className="mt-1 inline-flex items-center gap-1 text-[14px] font-medium text-pine-ink hover:underline">
                  View evidence <ArrowRight className="h-4 w-4" />
                </Link>
              </li>
            ))}
            {found.length === 0 && (
              <li className="rounded-2xl border border-dashed border-line-strong p-5 text-[14px] leading-relaxed text-ink-2">
                {running ? (
                  'Nothing yet. Findings appear here as each check confirms them.'
                ) : (
                  <>
                    <strong className="text-ink">
                      {testedCategories.size} {testedCategories.size === 1 ? 'category' : 'categories'} tested, 0 findings.
                    </strong>{' '}
                    That&rsquo;s only part of the picture; see what wasn&rsquo;t tested below.
                  </>
                )}
              </li>
            )}
          </ul>
          {!running && (
            <div className="mt-4 rounded-xl bg-caution-soft p-4 text-[14px] leading-relaxed text-caution">
              <p className="font-semibold">Not tested in this scan</p>
              <ul className="mt-1 list-disc pl-5">
                {untestedRows.map((r) => (
                  <li key={r.module}>
                    {MODULE_BY_ID[r.module].name} ({MODULE_BY_ID[r.module].owasp}):{' '}
                    {r.status === 'not-run' ? 'scan stopped first' : r.status === 'inconclusive' ? `inconclusive, ${r.reason}` : r.reason}
                  </li>
                ))}
                <li>{NOT_TESTED.map((n) => `${n.id} ${n.label}`).join(', ')}: later phases</li>
              </ul>
            </div>
          )}
        </section>
      </div>

      {others.length > 0 && (
        <section className="mt-10" aria-labelledby="history-title">
          <h3 id="history-title" className="text-[17px] font-semibold">
            Earlier scans
          </h3>
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <tbody>
                {others.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <Link to={`/scans/${s.id}`} className="font-medium hover:underline">
                        {s.method ? <span className="font-mono text-[13px]">{s.method} {s.path}</span> : s.title}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-2">{whenText(s.startedAt)}</td>
                    <td className="px-3 py-3 text-ink-2">{STATE_LINE[s.state].split(' · ')[0]}</td>
                    <td className="px-5 py-3 text-right text-ink-2">
                      {s.foundFindingIds.length} finding{s.foundFindingIds.length === 1 ? '' : 's'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function CheckRow({ row, multi }: { row: ModuleRow; multi: boolean }) {
  const mod = MODULE_BY_ID[row.module];
  const sevs = [...new Set(row.findingIds.map((id) => FINDING_BY_ID[id].severity))].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b),
  ) as Severity[];
  return (
    <tr className={cn('border-b border-line last:border-0', row.status === 'running' && 'bg-pine-soft/50')}>
      <td className="px-5 py-3.5 font-medium">
        {mod.name}
        {multi && row.requests > 0 && <span className="ml-1.5 text-[12px] font-normal text-ink-3">{row.requests} req</span>}
      </td>
      <td className="px-3 py-3.5 font-mono text-[14px]">{mod.owasp}</td>
      <td className="px-3 py-3.5 whitespace-nowrap">
        <StatusCell row={row} />
      </td>
      <td className="px-3 py-3.5 text-ink-2">
        {row.status === 'done' ? (
          sevs.length ? (
            <span className="inline-flex flex-wrap gap-x-1">
              {sevs.map((s, i) => (
                <span key={s}>
                  <SeverityText severity={s} />
                  {i < sevs.length - 1 && ','}
                </span>
              ))}
            </span>
          ) : (
            (row.note ?? 'No issues found')
          )
        ) : row.status === 'running' ? (
          `${row.probesDone}/${row.probesTotal} probes`
        ) : row.status === 'waiting' ? (
          '—'
        ) : row.status === 'not-run' ? (
          'Scan stopped before this check'
        ) : (
          row.reason
        )}
      </td>
    </tr>
  );
}

function StatusCell({ row }: { row: ModuleRow }) {
  switch (row.status) {
    case 'done':
      return <span className="font-medium text-pine-ink">✓ Done</span>;
    case 'skipped':
      return <span className="text-ink-2">— Skipped</span>;
    case 'running':
      return (
        <span className="font-medium text-pine-ink">
          <span className="animate-pulse-dot mr-1.5 inline-block h-2 w-2 rounded-full bg-pine" />
          Running
        </span>
      );
    case 'waiting':
      return <span className="text-ink-3">Waiting</span>;
    case 'not-run':
      return <span className="text-ink-3">Not run</span>;
    case 'inconclusive':
      return <span className="font-medium text-caution">? Inconclusive</span>;
  }
}
