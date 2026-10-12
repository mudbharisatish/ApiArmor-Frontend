import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { MethodTag } from '@/components/ui/Severity';
import { allGroups, useApp } from '@/store/app';

export function useGroupNameError(name: string, except?: string) {
  const requests = useApp((s) => s.requests);
  const groups = useApp((s) => s.groups);
  const trimmed = name.trim();
  if (!trimmed) return 'Enter a group name.';
  if (trimmed.length > 40) return 'Keep it under 40 characters.';
  const taken = allGroups({ groups, requests }).some((g) => g.toLowerCase() === trimmed.toLowerCase() && g !== except);
  return taken ? 'A group with this name already exists.' : null;
}

/** Create a group, name it, and tick which requests move into it. */
export function GroupDialog({
  open,
  onOpenChange,
  preselect,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  preselect: string[];
  onCreated?: (name: string) => void;
}) {
  const requests = useApp((s) => s.requests);
  const createGroup = useApp((s) => s.createGroup);
  const setSelected = useApp((s) => s.setSelected);
  const showToast = useApp((s) => s.showToast);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>(preselect);
  const [touched, setTouched] = useState(false);
  const error = useGroupNameError(name);
  const nameId = useId();
  const errId = useId();

  const submit = () => {
    setTouched(true);
    if (error) return;
    const n = name.trim();
    createGroup(n, picked);
    setSelected(picked);
    showToast('success', picked.length ? `Created ${n} with ${picked.length} request${picked.length === 1 ? '' : 's'}. They’re ticked, ready to scan.` : `Created ${n}.`);
    onOpenChange(false);
    onCreated?.(n);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width="max-w-xl"
      title="New group"
      description="Name the group, then tick the requests to move into it. Each request lives in one group."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={touched && Boolean(error)}>
            Create group{picked.length ? ` with ${picked.length}` : ''}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor={nameId} className="label font-medium text-ink">
          Group name
        </label>
        <input
          id={nameId}
          autoFocus
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="e.g. Checkout flow"
          aria-invalid={touched && Boolean(error)}
          aria-describedby={touched && error ? errId : undefined}
        />
        {touched && error && (
          <p id={errId} className="mt-1.5 text-[13px] font-medium text-crit">
            {error}
          </p>
        )}
      </form>
      <fieldset className="mt-5">
        <legend className="mb-2 flex w-full items-center justify-between text-[15px] font-medium">
          <span>Requests to move here ({picked.length})</span>
        </legend>
        <ul className="max-h-64 divide-y divide-line overflow-auto rounded-xl border border-line bg-white">
          {requests.map((r) => (
            <li key={r.id}>
              <label className="flex items-center gap-3 px-3 py-2 text-[14px] hover:bg-surface-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-pine"
                  checked={picked.includes(r.id)}
                  onChange={() => setPicked((p) => (p.includes(r.id) ? p.filter((x) => x !== r.id) : [...p, r.id]))}
                />
                <MethodTag method={r.method} className="w-14" />
                <span className="flex-1 truncate">{r.name}</span>
                <span className="text-[12px] text-ink-3">{r.group}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
    </Dialog>
  );
}

export function RenameGroupDialog({ group, onClose, onRenamed }: { group: string | null; onClose: () => void; onRenamed?: (name: string) => void }) {
  const renameGroup = useApp((s) => s.renameGroup);
  const showToast = useApp((s) => s.showToast);
  const [name, setName] = useState(group ?? '');
  const error = useGroupNameError(name, group ?? undefined);
  const id = useId();
  const submit = () => {
    if (error || !group) return;
    renameGroup(group, name.trim());
    showToast('success', `Renamed ${group} to ${name.trim()}.`);
    onClose();
    onRenamed?.(name.trim());
  };
  return (
    <Dialog
      open={Boolean(group)}
      onOpenChange={(o) => !o && onClose()}
      title={`Rename ${group ?? ''}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={Boolean(error) || name.trim() === group}>
            Rename
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor={id} className="label font-medium text-ink">
          Group name
        </label>
        <input id={id} autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(error)} />
        {error && <p className="mt-1.5 text-[13px] font-medium text-crit">{error}</p>}
      </form>
    </Dialog>
  );
}

export function DeleteGroupDialog({ group, onClose, onDeleted }: { group: string | null; onClose: () => void; onDeleted?: () => void }) {
  const deleteGroup = useApp((s) => s.deleteGroup);
  const showToast = useApp((s) => s.showToast);
  const count = useApp((s) => s.requests.filter((r) => r.group === group).length);
  return (
    <Dialog
      open={Boolean(group)}
      onOpenChange={(o) => !o && onClose()}
      title={`Delete the ${group ?? ''} group?`}
      description={
        count > 0
          ? `Its ${count} request${count === 1 ? '' : 's'} won’t be deleted. They move to Ungrouped.`
          : 'The group is empty, so nothing else changes.'
      }
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              if (group) deleteGroup(group);
              showToast('success', `Deleted the ${group} group.`);
              onClose();
              onDeleted?.();
            }}
          >
            Delete group
          </Button>
        </>
      }
    />
  );
}
