import { useEffect } from 'react';
import { Outlet, useMatches } from 'react-router-dom';
import { ensureRunnerAlive } from '@/lib/scanRunner';
import { useApp } from '@/store/app';
import { CommandPalette } from '../CommandPalette';
import { ShortcutsDialog } from '../ShortcutsDialog';
import { ToastHost } from '../ui/Toast';
import { Header } from './Header';
import { MobileNav, ResponsibleUse, Sidebar } from './Sidebar';

export interface RouteHandle {
  title: string;
}

export function AppShell() {
  const matches = useMatches();
  const handle = [...matches].reverse().find((m) => (m.handle as RouteHandle | undefined)?.title)?.handle as
    | RouteHandle
    | undefined;
  const title = handle?.title ?? 'ApiArmor';
  const hydrated = useApp((s) => s.hydrated);
  const setPaletteOpen = useApp((s) => s.setPaletteOpen);

  useEffect(() => {
    document.title = title === 'Home' ? 'ApiArmor' : `${title} · ApiArmor`;
  }, [title]);

  useEffect(() => {
    if (hydrated) ensureRunnerAlive();
  }, [hydrated]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPaletteOpen]);

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-brass px-4 py-2 font-semibold text-night focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <div className="md:hidden">
        <MobileNav />
      </div>
      <div className="sticky top-0 hidden h-screen w-[240px] shrink-0 md:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={title} />
        <main id="main" className="min-w-0 flex-1">
          {hydrated ? <Outlet /> : <p className="p-10 text-ink-2">Loading your workspace…</p>}
        </main>
        <div className="bg-night p-4 md:hidden">
          <ResponsibleUse />
        </div>
      </div>
      <ToastHost />
      <CommandPalette />
      <ShortcutsDialog />
    </div>
  );
}
