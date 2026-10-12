import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GroupDialog } from '@/components/groups/GroupDialogs';
import { Button } from '@/components/ui/Button';
import { PlusIcon } from '@/components/ui/Icons';
import { MethodTag, SeverityIcon, SEVERITY_TEXT } from '@/components/ui/Severity';
import { cn, whenText } from '@/lib/format';
import { allGroups, useApp } from '@/store/app';
import { ScanConfirmDialog } from '../workspace/ScanDialogs';
import { groupPath, groupStats } from './groupStats';

export function GroupsPage() {
  const requests = useApp((s) => s.requests);
  const groupsState = useApp((s) => s.groups);
  const findings = useApp((s) => s.findings);
  const scans = useApp((s) => s.scans);
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [scanGroup, setScanGroup] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const searchId = useId();

  const names = allGroups({ groups: groupsState, requests });
  const term = q.trim().toLowerCase();
  const shown = names.filter((g) => !term || g.toLowerCase().includes(term));

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 md:px-10 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[16px] text-ink-2">
            Groups organise your APIs, like folders. Open a group to add APIs to it or scan them together.
          </p>
          <p className="mt-1 text-[14px] text-ink-3">
            {names.length} group{names.length === 1 ? '' : 's'} · {requests.length} API{requests.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex gap-2">
          <label htmlFor={searchId} className="sr-only">
            Search groups
          </label>
          <input id={searchId} type="search" className="input w-52 py-2" placeholder="Search groups" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button variant="primary" onClick={() => setCreating(true)}>
            <PlusIcon className="h-4 w-4" /> New group
          </Button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="card mt-6 px-6 py-12 text-center">
          <p className="text-[16px] font-semibold">{term ? 'No groups match' : 'No groups yet'}</p>
          <p className="mt-1 text-[14px] text-ink-2">{term ? 'Try another name.' : 'Create one to start organising your APIs.'}</p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((g) => {
            const st = groupStats(g, requests, findings, scans);
            const methods = [...new Set(st.requests.map((r) => r.method))];
            return (
              <li key={g} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <Link to={groupPath(g)} className="min-w-0 text-[18px] font-semibold hover:underline">
                    <span className="block truncate">{g}</span>
                  </Link>
                  {st.openFindings > 0 && st.worst ? (
                    <span className={cn('flex shrink-0 items-center gap-1.5 text-[13px] font-semibold', SEVERITY_TEXT[st.worst])}>
                      <SeverityIcon severity={st.worst} />
                      {st.openFindings} open
                    </span>
                  ) : (
                    <span className="shrink-0 text-[13px] text-ink-3">No open findings</span>
                  )}
                </div>
                <p className="mt-1 text-[14px] text-ink-2">
                  {st.requests.length} API{st.requests.length === 1 ? '' : 's'}
                  {methods.length > 0 && (
                    <span className="ml-2 inline-flex gap-1.5">
                      {methods.map((m) => (
                        <MethodTag key={m} method={m} className="text-[11px]" />
                      ))}
                    </span>
                  )}
                </p>
                <ul className="mt-3 space-y-1 text-[14px]">
                  {st.requests.slice(0, 3).map((r) => (
                    <li key={r.id} className="truncate text-ink-2">
                      {r.name}
                    </li>
                  ))}
                  {st.requests.length > 3 && <li className="text-ink-3">+{st.requests.length - 3} more</li>}
                  {st.requests.length === 0 && <li className="text-ink-3">Empty. Open it to add APIs.</li>}
                </ul>
                <p className="mt-3 text-[13px] text-ink-3">{st.lastScan ? `Last scanned ${whenText(st.lastScan.startedAt)}` : 'Not scanned yet'}</p>
                <div className="mt-auto flex gap-2 pt-4">
                  <Button size="sm" onClick={() => navigate(groupPath(g))}>
                    Open
                  </Button>
                  <Button size="sm" variant="primary" disabled={st.requests.length === 0} onClick={() => setScanGroup(g)}>
                    Scan group
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <GroupDialog
        key={creating ? 'open' : 'closed'}
        open={creating}
        onOpenChange={setCreating}
        preselect={[]}
        onCreated={(name) => navigate(groupPath(name))}
      />
      <ScanConfirmDialog
        open={Boolean(scanGroup)}
        onOpenChange={(o) => !o && setScanGroup(null)}
        requestIds={requests.filter((r) => r.group === scanGroup).map((r) => r.id)}
        name={`the ${scanGroup} group`}
        kind="collection"
      />
    </div>
  );
}
