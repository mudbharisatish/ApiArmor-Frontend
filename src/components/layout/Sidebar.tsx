import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/format';
import { useOpenFindingCount } from '@/store/app';
import { ShieldLogo } from '../ui/Icons';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/collections', label: 'Collections' },
  { to: '/groups', label: 'Groups' },
  { to: '/scans', label: 'Scans' },
  { to: '/findings', label: 'Findings', badge: true },
  { to: '/identities', label: 'Identities' },
];

export function ResponsibleUse({ className }: { className?: string }) {
  return (
    <aside aria-label="Responsible use" className={cn('rounded-lg bg-night-2 p-3.5', className)}>
      <p className="text-[13px] font-semibold text-brass">Responsible use</p>
      <p className="mt-1 text-[13px] leading-snug text-night-ink/85">
        Only scan APIs you own or have written permission to test.
      </p>
    </aside>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <ShieldLogo className="h-7 w-7 text-brass" />
      <div className="leading-tight">
        <p className="text-[17px] font-semibold tracking-tight text-white">ApiArmor</p>
        <p className="text-[12px] text-night-ink/75">Running locally</p>
      </div>
    </div>
  );
}

export function Sidebar() {
  const open = useOpenFindingCount();
  return (
    <div className="flex h-full flex-col bg-night px-3.5 pt-5 pb-4">
      <div className="px-2">
        <Brand />
      </div>
      <nav aria-label="Main" className="mt-7 flex-1">
        <ul className="space-y-1">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex h-11 items-center justify-between rounded-lg px-3 text-[16px] transition-colors',
                    isActive ? 'bg-night-3 font-medium text-brass' : 'text-night-ink hover:bg-night-2',
                  )
                }
              >
                <span>{item.label}</span>
                {item.badge && open > 0 && (
                  <span
                    className="rounded-full bg-brass px-2 py-px text-[12px] font-semibold text-night"
                    aria-label={`${open} open findings`}
                  >
                    {open}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <ResponsibleUse />
    </div>
  );
}

/** Below 768 px the sidebar stacks: brand and a scrollable nav row across the top. */
export function MobileNav() {
  const open = useOpenFindingCount();
  return (
    <div className="bg-night px-4 pt-4 pb-3">
      <Brand />
      <nav aria-label="Main" className="-mx-4 mt-3 overflow-x-auto px-4">
        <ul className="flex gap-1.5">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex h-11 items-center gap-2 rounded-lg px-3.5 text-[15px] whitespace-nowrap',
                    isActive ? 'bg-night-3 font-medium text-brass' : 'text-night-ink',
                  )
                }
              >
                {item.label}
                {item.badge && open > 0 && (
                  <span className="rounded-full bg-brass px-2 text-xs font-semibold text-night">{open}</span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
