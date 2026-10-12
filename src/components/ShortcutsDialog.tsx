import { useApp } from '@/store/app';
import { Dialog } from './ui/Dialog';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD = isMac ? '⌘' : 'Ctrl';

const SHORTCUTS: [string, string][] = [
  [`${MOD} K`, 'Command palette: jump to a request, environment or finding'],
  [`${MOD} Enter`, 'Send the current request'],
  [`${MOD} Shift Enter`, 'Scan the current request'],
  [`${MOD} S`, 'Save the current request'],
  ['Esc, then Tab', 'Leave the body editor'],
];

export function ShortcutsDialog() {
  const open = useApp((s) => s.shortcutsOpen);
  const setOpen = useApp((s) => s.setShortcutsOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen} title="Keyboard shortcuts">
      <dl className="divide-y divide-line">
        {SHORTCUTS.map(([keys, what]) => (
          <div key={keys} className="flex items-center justify-between gap-6 py-3">
            <dt>
              <kbd className="rounded-md border border-line-strong bg-white px-2 py-1 font-mono text-[13px] whitespace-nowrap">{keys}</kbd>
            </dt>
            <dd className="text-right text-[15px] text-ink-2">{what}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
