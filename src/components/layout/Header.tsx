import * as DM from '@radix-ui/react-dropdown-menu';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/format';
import { useActiveEnv, useApp } from '@/store/app';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { CheckIcon, ChevronDown } from '../ui/Icons';

const menuItem =
  'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-[15px] text-ink outline-none data-[highlighted]:bg-surface-2';

export function useSafeModeToggle() {
  const env = useActiveEnv();
  const setSafeMode = useApp((s) => s.setSafeMode);
  const showToast = useApp((s) => s.showToast);
  return () => {
    const on = !env.safeMode;
    setSafeMode(env.id, on);
    if (on) showToast('success', `Safe mode on for ${env.name}: only read-only tests run.`);
    else
      showToast(
        'caution',
        env.kind === 'production'
          ? `Safe mode off for ${env.name}. Tests that change or delete data still never run on Production.`
          : `Safe mode off for ${env.name}: scans may create and delete test fixtures. Existing data is never touched.`,
      );
  };
}

export function Header({ title }: { title: string }) {
  const env = useActiveEnv();
  const environments = useApp((s) => s.environments);
  const setActiveEnv = useApp((s) => s.setActiveEnv);
  const toggleSafeMode = useSafeModeToggle();
  const navigate = useNavigate();

  return (
    <header className="flex min-h-[68px] flex-wrap items-center gap-2.5 border-b border-line bg-surface px-4 py-2.5 md:px-7">
      <h1 className="mr-auto text-[19px] font-semibold tracking-tight md:text-[22px]">{title}</h1>

      <DM.Root>
        <DM.Trigger asChild>
          <button
            className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-[13px] text-ink-2 hover:border-ink-3"
            aria-label={`Environment: ${env.name}, ${env.kind}. Change environment`}
          >
            <span className="truncate">
              {env.name} · <span className="capitalize">{env.kind}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0" />
          </button>
        </DM.Trigger>
        <DM.Portal>
          <DM.Content align="end" sideOffset={6} className="z-50 min-w-64 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
            <DM.Label className="px-3 pt-1.5 pb-1 text-xs font-semibold tracking-wider text-ink-3 uppercase">Environment</DM.Label>
            {environments.map((e) => (
              <DM.Item key={e.id} className={menuItem} onSelect={() => setActiveEnv(e.id)}>
                <span className="w-4">{e.id === env.id && <CheckIcon className="h-4 w-4 text-pine" />}</span>
                <span className="flex-1">{e.name}</span>
                <span className={cn('text-xs font-semibold', e.kind === 'production' ? 'text-crit' : 'text-pine-ink')}>
                  {e.kind === 'production' ? 'Production' : 'Development'}
                </span>
              </DM.Item>
            ))}
            <DM.Separator className="my-1 h-px bg-line" />
            <DM.Item className={menuItem} onSelect={() => navigate('/identities#environments')}>
              Manage environments…
            </DM.Item>
          </DM.Content>
        </DM.Portal>
      </DM.Root>

      <button
        onClick={toggleSafeMode}
        aria-pressed={env.safeMode}
        className={cn(
          'inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-semibold transition-colors',
          env.safeMode ? 'bg-pine-soft text-pine-ink hover:bg-pine-soft/70' : 'bg-caution-soft text-caution ring-1 ring-caution/30',
        )}
      >
        {env.safeMode ? 'Safe mode on' : 'Safe mode off'}
      </button>

      <AccountMenu />
    </header>
  );
}

function AccountMenu() {
  const notifyOnFinish = useApp((s) => s.notifyOnFinish);
  const setNotify = useApp((s) => s.setNotifyOnFinish);
  const setShortcutsOpen = useApp((s) => s.setShortcutsOpen);
  const resetDemo = useApp((s) => s.resetDemo);
  const showToast = useApp((s) => s.showToast);
  const [confirm, setConfirm] = useState(false);

  const toggleNotify = async () => {
    if (notifyOnFinish) return setNotify(false);
    if (typeof Notification === 'undefined') return showToast('error', 'This browser doesn’t support notifications.');
    const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (perm === 'granted') {
      setNotify(true);
      showToast('success', 'You’ll get a browser notification when a scan finishes in the background.');
    } else showToast('caution', 'Notifications are blocked in this browser’s settings.');
  };

  const exportData = () => {
    const s = useApp.getState();
    // Secret values are never stored in the frontend, so the export can't contain them.
    const data = {
      exportedAt: new Date().toISOString(),
      collections: s.requests,
      accessExpectations: s.access,
      environments: s.environments,
      identities: s.identities.map(({ hasSecret, ...i }) => ({ ...i, secret: hasSecret ? '(saved, not exported)' : null })),
      findings: s.findings,
      scans: s.scans,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'apiarmor-export.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('success', 'Exported apiarmor-export.json (secret values excluded).');
  };

  return (
    <>
      <DM.Root>
        <DM.Trigger asChild>
          <button
            aria-label="Account menu"
            className="grid h-10 w-10 place-items-center rounded-full border border-line-strong bg-brass-soft text-[14px] font-semibold text-ink hover:border-ink-3"
          >
            R
          </button>
        </DM.Trigger>
        <DM.Portal>
          <DM.Content align="end" sideOffset={6} className="z-50 min-w-64 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
            <DM.Item className={menuItem} onSelect={() => useApp.getState().setPaletteOpen(true)}>
              <span className="flex-1">Command palette</span>
              <kbd className="font-mono text-xs text-ink-3">⌘K</kbd>
            </DM.Item>
            <DM.Item className={menuItem} onSelect={() => setShortcutsOpen(true)}>
              Keyboard shortcuts
            </DM.Item>
            <DM.CheckboxItem className={menuItem} checked={notifyOnFinish} onSelect={(e) => (e.preventDefault(), void toggleNotify())}>
              <span className="w-4">{notifyOnFinish && <CheckIcon className="h-4 w-4 text-pine" />}</span>
              Notify me when scans finish
            </DM.CheckboxItem>
            <DM.Separator className="my-1 h-px bg-line" />
            <DM.Item className={menuItem} onSelect={exportData}>
              Export my data (JSON)
            </DM.Item>
            <DM.Item className={cn(menuItem, 'text-crit')} onSelect={() => setConfirm(true)}>
              Reset all local data…
            </DM.Item>
          </DM.Content>
        </DM.Portal>
      </DM.Root>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Reset all local data?"
        description="This deletes your requests, drafts, identities, environments, scans and finding history from this browser, and restores the ShopLab demo. It can’t be undone."
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                resetDemo();
                setConfirm(false);
                showToast('success', 'Local data reset. ShopLab demo restored.');
              }}
            >
              Reset everything
            </Button>
          </>
        }
      />
    </>
  );
}
