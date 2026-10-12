import * as DM from '@radix-ui/react-dropdown-menu';
import { useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { PlusIcon } from '@/components/ui/Icons';
import { DeleteGroupDialog, GroupDialog, RenameGroupDialog } from '@/components/groups/GroupDialogs';
import { MethodTag } from '@/components/ui/Severity';
import { cn } from '@/lib/format';
import { allGroups, effectiveRequest, useApp } from '@/store/app';
import type { ApiRequest } from '@/types';

const menuItem =
  'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[14px] text-ink outline-none data-[highlighted]:bg-surface-2 data-[disabled]:cursor-not-allowed data-[disabled]:text-ink-3';
const menuBox = 'z-50 min-w-48 rounded-xl border border-line bg-surface p-1.5 shadow-xl';

function MoreButton({ label }: { label: string }) {
  return (
    <DM.Trigger
      aria-label={label}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink-3 opacity-60 group-hover:opacity-100 hover:bg-ink/10 hover:text-ink focus-visible:opacity-100 data-[state=open]:opacity-100"
    >
      <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
        <circle cx="3" cy="8" r="1.4" />
        <circle cx="8" cy="8" r="1.4" />
        <circle cx="13" cy="8" r="1.4" />
      </svg>
    </DM.Trigger>
  );
}

/** Checkbox that shows a dash when only some of its items are ticked. */
function TriCheckbox({ checked, partial, onChange, label }: { checked: boolean; partial?: boolean; onChange: () => void; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="h-4 w-4 shrink-0 accent-pine"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = Boolean(partial);
      }}
      onChange={onChange}
    />
  );
}

export function RequestTree({
  activeId,
  onScanRequests,
}: {
  activeId: string | null;
  /** Opens the scan confirm step for these requests. */
  onScanRequests: (ids: string[], name?: string) => void;
}) {
  const requests = useApp((s) => s.requests);
  const drafts = useApp((s) => s.drafts);
  const groupsState = useApp((s) => s.groups);
  const selected = useApp((s) => s.selected);
  const setSelected = useApp((s) => s.setSelected);
  const moveRequest = useApp((s) => s.moveRequest);
  const showToast = useApp((s) => s.showToast);
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState<{ preselect: string[] } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const searchId = useId();

  const groupNames = allGroups({ groups: groupsState, requests });
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const match = (r: ApiRequest) =>
      !term || r.name.toLowerCase().includes(term) || r.group.toLowerCase().includes(term) || r.url.toLowerCase().includes(term);
    return groupNames
      .map((g) => ({ group: g, all: requests.filter((r) => r.group === g), items: requests.filter((r) => r.group === g && match(r)) }))
      .filter((g) => !term || g.items.length > 0);
  }, [requests, groupNames, q]);

  const sel = new Set(selected.filter((id) => requests.some((r) => r.id === id)));
  const toggle = (ids: string[], on: boolean) => {
    const next = new Set(sel);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    setSelected([...next]);
  };
  const allIds = requests.map((r) => r.id);
  const allTicked = allIds.length > 0 && allIds.every((id) => sel.has(id));

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-surface">
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between">
          <label htmlFor={searchId} className="eyebrow">
            Search requests
          </label>
          <Button size="sm" variant="ghost" className="-mr-2 h-7 px-2" onClick={() => setCreating({ preselect: [...sel] })}>
            <PlusIcon className="h-4 w-4" /> New group
          </Button>
        </div>
        <input id={searchId} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. orders" className="input mt-2 py-2" />
        <label className="mt-3 flex items-center gap-2 px-1 text-[13px] text-ink-2">
          <TriCheckbox
            label="Select all requests"
            checked={allTicked}
            partial={!allTicked && sel.size > 0}
            onChange={() => toggle(allIds, !allTicked)}
          />
          Select all
        </label>
      </div>

      <nav aria-label="Collection" className="min-h-0 flex-1 overflow-auto px-3 pt-1 pb-3">
        {groups.length === 0 && <p className="px-2 py-6 text-center text-[15px] text-ink-2">No requests match.</p>}
        {groups.map(({ group, all, items }) => {
          const ids = all.map((r) => r.id);
          const ticked = ids.filter((id) => sel.has(id)).length;
          return (
            <div key={group} className="mt-3">
              <div className="group flex items-center gap-2 px-1">
                <TriCheckbox
                  label={`Select all requests in ${group}`}
                  checked={ids.length > 0 && ticked === ids.length}
                  partial={ticked > 0 && ticked < ids.length}
                  onChange={() => toggle(ids, ticked < ids.length)}
                />
                <p className="flex-1 truncate text-[12px] font-semibold tracking-[0.08em] text-ink-2 uppercase">
                  {group} <span className="font-normal tracking-normal text-ink-3">({all.length})</span>
                </p>
                <DM.Root>
                  <MoreButton label={`${group} group options`} />
                  <DM.Portal>
                    <DM.Content align="end" sideOffset={4} className={menuBox}>
                      <DM.Item className={menuItem} disabled={all.length === 0} onSelect={() => onScanRequests(ids, `the ${group} group`)}>
                        Scan this group
                      </DM.Item>
                      <DM.Item className={menuItem} onSelect={() => setRenaming(group)}>
                        Rename group…
                      </DM.Item>
                      <DM.Separator className="my-1 h-px bg-line" />
                      <DM.Item className={cn(menuItem, 'text-crit')} onSelect={() => setDeleting(group)}>
                        Delete group…
                      </DM.Item>
                    </DM.Content>
                  </DM.Portal>
                </DM.Root>
              </div>
              {all.length === 0 && <p className="py-1.5 pl-7 text-[13px] text-ink-3">Empty. Use a request&rsquo;s ⋯ menu to move it here.</p>}
              <ul>
                {items.map((r) => {
                  const active = r.id === activeId;
                  return (
                    <li key={r.id} className={cn('group flex items-center gap-2 rounded-lg pl-1', active ? 'bg-pine-soft/80' : 'hover:bg-surface-2')}>
                      <TriCheckbox label={`Select ${r.name}`} checked={sel.has(r.id)} onChange={() => toggle([r.id], !sel.has(r.id))} />
                      <button
                        onClick={() => navigate(`/collections/${r.id}`)}
                        aria-current={active ? 'page' : undefined}
                        className={cn('grid min-w-0 flex-1 grid-cols-[52px_1fr_auto] items-center gap-1 py-2 text-left text-[15px]', active && 'font-medium')}
                      >
                        <MethodTag method={r.method} />
                        <span className="truncate">{r.name}</span>
                        {effectiveRequest({ requests, drafts }, r.id)?.dirty && (
                          <span className="h-2 w-2 rounded-full bg-brass-dark" aria-label="Unsaved changes" />
                        )}
                      </button>
                      <DM.Root>
                        <MoreButton label={`${r.name} options`} />
                        <DM.Portal>
                          <DM.Content align="end" sideOffset={4} className={menuBox}>
                            <DM.Item className={menuItem} onSelect={() => onScanRequests([r.id])}>
                              Scan this request
                            </DM.Item>
                            <DM.Sub>
                              <DM.SubTrigger className={menuItem}>Move to group ▸</DM.SubTrigger>
                              <DM.Portal>
                                <DM.SubContent sideOffset={4} className={menuBox}>
                                  {groupNames
                                    .filter((g) => g !== r.group)
                                    .map((g) => (
                                      <DM.Item
                                        key={g}
                                        className={menuItem}
                                        onSelect={() => {
                                          moveRequest(r.id, g);
                                          showToast('success', `Moved “${r.name}” to ${g}.`);
                                        }}
                                      >
                                        {g}
                                      </DM.Item>
                                    ))}
                                  <DM.Separator className="my-1 h-px bg-line" />
                                  <DM.Item className={menuItem} onSelect={() => setCreating({ preselect: [r.id] })}>
                                    New group…
                                  </DM.Item>
                                </DM.SubContent>
                              </DM.Portal>
                            </DM.Sub>
                          </DM.Content>
                        </DM.Portal>
                      </DM.Root>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-line p-3">
        {sel.size > 0 ? (
          <>
            <Button variant="primary" className="w-full" onClick={() => onScanRequests([...sel])}>
              Scan selected ({sel.size})
            </Button>
            <div className="flex justify-between text-[13px]">
              <button className="link" onClick={() => setCreating({ preselect: [...sel] })}>
                Group selected…
              </button>
              <button className="text-ink-2 hover:text-ink" onClick={() => setSelected([])}>
                Clear selection
              </button>
            </div>
          </>
        ) : (
          <button onClick={() => onScanRequests(allIds, 'the whole collection')} className="link w-full text-center text-[14px]">
            Scan whole collection…
          </button>
        )}
      </div>

      <GroupDialog
        key={creating ? 'c' + creating.preselect.join() : 'none'}
        open={Boolean(creating)}
        onOpenChange={(o) => !o && setCreating(null)}
        preselect={creating?.preselect ?? []}
      />
      <RenameGroupDialog key={renaming ?? 'r'} group={renaming} onClose={() => setRenaming(null)} />
      <DeleteGroupDialog group={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}
