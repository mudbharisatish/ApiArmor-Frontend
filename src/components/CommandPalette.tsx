import * as RD from '@radix-ui/react-dialog';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FINDINGS } from '@/data/findings';
import { cn } from '@/lib/format';
import { allGroups, useApp } from '@/store/app';
import { MethodTag, SeverityIcon, SEVERITY_TEXT } from './ui/Severity';
import { SearchIcon } from './ui/Icons';

interface Item {
  id: string;
  group: 'Pages' | 'Groups' | 'Requests' | 'Environments' | 'Findings';
  label: string;
  hint?: React.ReactNode;
  run: () => void;
}

export function CommandPalette() {
  const open = useApp((s) => s.paletteOpen);
  const setOpen = useApp((s) => s.setPaletteOpen);
  const requests = useApp((s) => s.requests);
  const groups = useApp((s) => s.groups);
  const environments = useApp((s) => s.environments);
  const setActiveEnv = useApp((s) => s.setActiveEnv);
  const showToast = useApp((s) => s.showToast);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const items = useMemo<Item[]>(() => {
    const go = (to: string) => () => navigate(to);
    return [
      ...[
        ['Home', '/'],
        ['Collections', '/collections'],
        ['Groups', '/groups'],
        ['Scans', '/scans'],
        ['Findings', '/findings'],
        ['Identities and environments', '/identities'],
      ].map(([label, to]) => ({ id: `p:${to}`, group: 'Pages' as const, label, run: go(to) })),
      ...allGroups({ groups, requests }).map((g) => ({
        id: `g:${g}`,
        group: 'Groups' as const,
        label: g,
        hint: <span className="text-xs text-ink-3">{requests.filter((r) => r.group === g).length} APIs</span>,
        run: go(`/groups/${encodeURIComponent(g)}`),
      })),
      ...requests.map((r) => ({
        id: `r:${r.id}`,
        group: 'Requests' as const,
        label: `${r.group} / ${r.name}`,
        hint: <MethodTag method={r.method} />,
        run: go(`/collections/${r.id}`),
      })),
      ...environments.map((e) => ({
        id: `e:${e.id}`,
        group: 'Environments' as const,
        label: `Switch to ${e.name}`,
        hint: <span className="text-xs text-ink-3 capitalize">{e.kind}</span>,
        run: () => {
          setActiveEnv(e.id);
          showToast('info', `Environment: ${e.name}`);
        },
      })),
      ...FINDINGS.map((f) => ({
        id: `f:${f.id}`,
        group: 'Findings' as const,
        label: f.title,
        hint: (
          <span className={cn('flex items-center gap-1 text-xs font-semibold', SEVERITY_TEXT[f.severity])}>
            <SeverityIcon severity={f.severity} />
            {f.owasp}
          </span>
        ),
        run: go(`/findings/${f.id}`),
      })),
    ];
  }, [requests, groups, environments, navigate, setActiveEnv, showToast]);

  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((i) => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q)) : items;
  const clamped = Math.min(active, Math.max(filtered.length - 1, 0));

  const choose = (item: Item | undefined) => {
    if (!item) return;
    setOpen(false);
    setQuery('');
    item.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((clamped + 1) % Math.max(filtered.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((clamped - 1 + filtered.length) % Math.max(filtered.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(filtered[clamped]);
    }
  };

  let lastGroup = '';
  return (
    <RD.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery('');
      }}
    >
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-night/45" />
        <RD.Content className="fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-32px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
          <RD.Title className="sr-only">Command palette</RD.Title>
          <RD.Description className="sr-only">Jump to a page, request, environment or finding.</RD.Description>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <SearchIcon className="h-5 w-5 text-ink-3" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Jump to a request, environment or finding…"
              className="h-14 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-3"
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-list"
              aria-activedescendant={filtered[clamped] ? `pal-${filtered[clamped].id}` : undefined}
            />
          </div>
          <ul id="palette-list" role="listbox" className="max-h-[52vh] overflow-auto p-2">
            {filtered.length === 0 && <li className="px-3 py-6 text-center text-ink-2">Nothing matches “{query}”.</li>}
            {filtered.map((item, i) => {
              const header = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <li key={item.id} role="presentation">
                  {header && <p className="px-3 pt-3 pb-1 text-xs font-semibold tracking-wider text-ink-3 uppercase">{item.group}</p>}
                  <div
                    id={`pal-${item.id}`}
                    role="option"
                    aria-selected={i === clamped}
                    onMouseMove={() => setActive(i)}
                    onClick={() => choose(item)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[15px]',
                      i === clamped && 'bg-pine-soft',
                    )}
                  >
                    <span className="truncate">{item.label}</span>
                    {item.hint}
                  </div>
                </li>
              );
            })}
          </ul>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
