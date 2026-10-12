import * as DM from '@radix-ui/react-dropdown-menu';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AddExistingDialog, NewApiDialog } from '@/components/groups/AddApiDialogs';
import { DeleteGroupDialog, RenameGroupDialog } from '@/components/groups/GroupDialogs';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, ChevronDown, PlusIcon } from '@/components/ui/Icons';
import { MethodTag, SeverityIcon, SEVERITY_TEXT } from '@/components/ui/Severity';
import { FINDINGS } from '@/data/findings';
import { SEVERITY_ORDER } from '@/data/taxonomy';
import { cn, whenText } from '@/lib/format';
import { parseUrl } from '@/lib/url';
import { accessFor, allGroups, isOpenStatus, UNGROUPED, useApp } from '@/store/app';
import type { Access } from '@/types';
import { ScanConfirmDialog } from '../workspace/ScanDialogs';
import { groupPath, groupStats } from './groupStats';

const menuItem =
  'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] text-ink outline-none data-[highlighted]:bg-surface-2';
const menuBox = 'z-50 min-w-56 rounded-xl border border-line bg-surface p-1.5 shadow-xl';

const ACCESS_LABEL: Record<Access, string> = {
  public: 'Public',
  authenticated: 'Signed-in',
  owner: 'Owner only',
  admin: 'Admin only',
};

export function GroupDetailPage() {
  const { groupName = '' } = useParams();
  const group = decodeURIComponent(groupName);
  const state = useApp();
  const { requests, findings, scans, moveRequests, showToast } = state;
  const navigate = useNavigate();
  const [ticked, setTicked] = useState<string[]>([]);
  const [adding, setAdding] = useState<'existing' | 'form' | 'curl' | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [scanIds, setScanIds] = useState<string[] | null>(null);

  const names = allGroups(state);
  if (!names.includes(group)) {
    return (
      <div className="mx-auto max-w-[1180px] px-4 py-10 md:px-10">
        <p className="text-[16px] font-semibold">This group doesn&rsquo;t exist</p>
        <Link to="/groups" className="link mt-2 inline-block">
          Back to all groups
        </Link>
      </div>
    );
  }

  const st = groupStats(group, requests, findings, scans);
  const apis = st.requests;
  const live = ticked.filter((id) => apis.some((r) => r.id === id));
  const allTicked = apis.length > 0 && live.length === apis.length;
  const toggle = (id: string) => setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  const otherGroups = names.filter((g) => g !== group);

  const openFor = (id: string) =>
    FINDINGS.filter((f) => f.requestIds.includes(id) && isOpenStatus(findings[f.id]?.status ?? 'open')).sort(
      (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
    );

  const move = (ids: string[], to: string) => {
    moveRequests(ids, to);
    setTicked((t) => t.filter((x) => !ids.includes(x)));
    showToast('success', `Moved ${ids.length} API${ids.length === 1 ? '' : 's'} to ${to}.`);
  };

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 md:px-10 md:py-8">
      <Link to="/groups" className="inline-flex items-center gap-1.5 text-[15px] font-medium text-pine-ink hover:underline">
        <ArrowLeft className="h-4 w-4" /> All groups
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[28px] font-semibold tracking-tight">{group}</h2>
          <p className="mt-1 text-[15px] text-ink-2">
            {apis.length} API{apis.length === 1 ? '' : 's'} · {st.openFindings} open finding{st.openFindings === 1 ? '' : 's'} ·{' '}
            {st.lastScan ? `last scanned ${whenText(st.lastScan.startedAt)}` : 'not scanned yet'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DM.Root>
            <DM.Trigger asChild>
              <Button>
                <PlusIcon className="h-4 w-4" /> Add API <ChevronDown className="h-4 w-4" />
              </Button>
            </DM.Trigger>
            <DM.Portal>
              <DM.Content align="end" sideOffset={6} className={menuBox}>
                <DM.Item className={menuItem} onSelect={() => setAdding('existing')}>
                  <span>
                    <span className="block font-medium">Add existing APIs</span>
                    <span className="block text-[13px] text-ink-2">Move APIs here from other groups</span>
                  </span>
                </DM.Item>
                <DM.Item className={menuItem} onSelect={() => setAdding('form')}>
                  <span>
                    <span className="block font-medium">Create a new API</span>
                    <span className="block text-[13px] text-ink-2">Name, method and URL</span>
                  </span>
                </DM.Item>
                <DM.Item className={menuItem} onSelect={() => setAdding('curl')}>
                  <span>
                    <span className="block font-medium">Paste a cURL command</span>
                    <span className="block text-[13px] text-ink-2">From dev tools or a terminal</span>
                  </span>
                </DM.Item>
              </DM.Content>
            </DM.Portal>
          </DM.Root>
          <DM.Root>
            <DM.Trigger asChild>
              <Button aria-label="Group options">
                ⋯
              </Button>
            </DM.Trigger>
            <DM.Portal>
              <DM.Content align="end" sideOffset={6} className={menuBox}>
                <DM.Item className={menuItem} onSelect={() => setRenaming(true)}>
                  Rename group…
                </DM.Item>
                <DM.Item className={cn(menuItem, 'text-crit')} onSelect={() => setDeleting(true)}>
                  Delete group…
                </DM.Item>
              </DM.Content>
            </DM.Portal>
          </DM.Root>
          <Button variant="primary" disabled={apis.length === 0} onClick={() => setScanIds(apis.map((r) => r.id))}>
            Scan group
          </Button>
        </div>
      </div>

      {apis.length === 0 ? (
        <div className="card mt-6 px-6 py-12 text-center">
          <p className="text-[17px] font-semibold">No APIs in this group yet</p>
          <p className="mx-auto mt-1 max-w-md text-[15px] text-ink-2">Add APIs you already have, or create new ones here.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={() => setAdding('existing')}>Add existing APIs</Button>
            <Button variant="primary" onClick={() => setAdding('form')}>
              Create a new API
            </Button>
          </div>
        </div>
      ) : (
        <section className="card mt-6 overflow-hidden" aria-label={`APIs in ${group}`}>
          {live.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-line bg-pine-soft/50 px-5 py-3 text-[14px]">
              <span className="font-semibold">{live.length} selected</span>
              <Button size="sm" variant="primary" onClick={() => setScanIds(live)}>
                Scan selected ({live.length})
              </Button>
              <DM.Root>
                <DM.Trigger asChild>
                  <Button size="sm" disabled={otherGroups.length === 0}>
                    Move to… <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DM.Trigger>
                <DM.Portal>
                  <DM.Content align="start" sideOffset={6} className={menuBox}>
                    {otherGroups.map((g) => (
                      <DM.Item key={g} className={menuItem} onSelect={() => move(live, g)}>
                        {g}
                      </DM.Item>
                    ))}
                  </DM.Content>
                </DM.Portal>
              </DM.Root>
              {group !== UNGROUPED && (
                <Button size="sm" variant="ghost" onClick={() => move(live, UNGROUPED)}>
                  Remove from group
                </Button>
              )}
              <button className="ml-auto text-ink-2 hover:text-ink" onClick={() => setTicked([])}>
                Clear
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[15px]">
              <thead>
                <tr className="border-b border-line text-xs tracking-wider text-ink-2 uppercase">
                  <th className="w-12 px-5 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all APIs in this group"
                      className="h-4 w-4 accent-pine"
                      checked={allTicked}
                      ref={(el) => {
                        if (el) el.indeterminate = live.length > 0 && !allTicked;
                      }}
                      onChange={() => setTicked(allTicked ? [] : apis.map((r) => r.id))}
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold">API</th>
                  <th className="px-3 py-3 font-semibold">Endpoint</th>
                  <th className="px-3 py-3 font-semibold">Who can use</th>
                  <th className="px-3 py-3 font-semibold">Open findings</th>
                  <th className="w-12 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {apis.map((r) => {
                  const open = openFor(r.id);
                  const worst = open[0]?.severity;
                  return (
                    <tr key={r.id} className={cn('border-b border-line last:border-0', live.includes(r.id) && 'bg-pine-soft/30')}>
                      <td className="px-5 py-3">
                        <input type="checkbox" aria-label={`Select ${r.name}`} className="h-4 w-4 accent-pine" checked={live.includes(r.id)} onChange={() => toggle(r.id)} />
                      </td>
                      <td className="px-3 py-3">
                        <Link to={`/collections/${r.id}`} className="font-medium hover:underline">
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-2">
                          <MethodTag method={r.method} className="w-14" />
                          <span className="truncate font-mono text-[13px] text-ink-2" title={r.url}>
                            {parseUrl(r.url).path || r.url}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[14px] text-ink-2">
                        {ACCESS_LABEL[accessFor(state, r.id)]}
                        {!state.access[r.id] && <span className="text-ink-3"> (suggested)</span>}
                      </td>
                      <td className="px-3 py-3 text-[14px]">
                        {worst ? (
                          <span className={cn('inline-flex items-center gap-1.5 font-semibold', SEVERITY_TEXT[worst])}>
                            <SeverityIcon severity={worst} />
                            {open.length}
                          </span>
                        ) : (
                          <span className="text-ink-3">None</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <DM.Root>
                          <DM.Trigger aria-label={`${r.name} options`} className="grid h-8 w-8 place-items-center rounded-md text-ink-2 hover:bg-ink/10">
                            ⋯
                          </DM.Trigger>
                          <DM.Portal>
                            <DM.Content align="end" sideOffset={4} className={menuBox}>
                              <DM.Item className={menuItem} onSelect={() => navigate(`/collections/${r.id}`)}>
                                Open in workspace
                              </DM.Item>
                              <DM.Item className={menuItem} onSelect={() => setScanIds([r.id])}>
                                Scan this API
                              </DM.Item>
                              <DM.Sub>
                                <DM.SubTrigger className={menuItem}>Move to group ▸</DM.SubTrigger>
                                <DM.Portal>
                                  <DM.SubContent sideOffset={4} className={menuBox}>
                                    {otherGroups.map((g) => (
                                      <DM.Item key={g} className={menuItem} onSelect={() => move([r.id], g)}>
                                        {g}
                                      </DM.Item>
                                    ))}
                                  </DM.SubContent>
                                </DM.Portal>
                              </DM.Sub>
                              {group !== UNGROUPED && (
                                <DM.Item className={menuItem} onSelect={() => move([r.id], UNGROUPED)}>
                                  Remove from group
                                </DM.Item>
                              )}
                            </DM.Content>
                          </DM.Portal>
                        </DM.Root>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <AddExistingDialog group={group} open={adding === 'existing'} onOpenChange={(o) => !o && setAdding(null)} />
      <NewApiDialog
        key={adding ?? 'none'}
        group={group}
        open={adding === 'form' || adding === 'curl'}
        initialMode={adding === 'curl' ? 'curl' : 'form'}
        onOpenChange={(o) => !o && setAdding(null)}
      />
      <RenameGroupDialog key={renaming ? 'r' : 'x'} group={renaming ? group : null} onClose={() => setRenaming(false)} onRenamed={(n) => navigate(groupPath(n), { replace: true })} />
      <DeleteGroupDialog group={deleting ? group : null} onClose={() => setDeleting(false)} onDeleted={() => navigate('/groups')} />
      <ScanConfirmDialog
        open={Boolean(scanIds)}
        onOpenChange={(o) => !o && setScanIds(null)}
        requestIds={scanIds ?? []}
        name={scanIds && scanIds.length === apis.length && apis.length > 1 ? `the ${group} group` : undefined}
        kind={scanIds?.length === 1 ? 'request' : 'collection'}
      />
    </div>
  );
}
