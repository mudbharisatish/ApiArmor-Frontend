import * as RT from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from '@/lib/format';

export const Tabs = RT.Root;
export const TabPanel = RT.Content;

export function TabList({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <RT.List aria-label={label} className={cn('flex gap-1 overflow-x-auto border-b border-line', className)}>
      {children}
    </RT.List>
  );
}

export function Tab({ value, children }: { value: string; children: ReactNode }) {
  return (
    <RT.Trigger
      value={value}
      className="relative -mb-px shrink-0 border-b-2 border-transparent px-4 py-2.5 text-[15px] text-ink-2 hover:text-ink data-[state=active]:border-pine data-[state=active]:font-semibold data-[state=active]:text-pine-ink"
    >
      {children}
    </RT.Trigger>
  );
}
