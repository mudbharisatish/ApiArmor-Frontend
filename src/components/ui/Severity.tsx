import { SEVERITY_LABEL } from '@/data/taxonomy';
import { cn } from '@/lib/format';
import type { FindingStatus, Method, Severity } from '@/types';
import { statusLabel } from '@/store/app';

/** Severity is never shown by colour alone: every badge carries a distinct shape and the word. */
export function SeverityIcon({ severity, className }: { severity: Severity; className?: string }) {
  const c = cn('inline-block shrink-0', className);
  switch (severity) {
    case 'critical':
      return (
        <svg aria-hidden viewBox="0 0 10 10" className={cn(c, 'h-2.5 w-2.5')}>
          <path d="M5 1l4 8H1z" fill="currentColor" />
        </svg>
      );
    case 'high':
      return (
        <svg aria-hidden viewBox="0 0 10 10" className={cn(c, 'h-2 w-2')}>
          <path d="M5 0.5l4.5 4.5L5 9.5 0.5 5z" fill="currentColor" />
        </svg>
      );
    case 'medium':
      return (
        <svg aria-hidden viewBox="0 0 10 10" className={cn(c, 'h-2.5 w-2.5')}>
          <circle cx="5" cy="5" r="4.5" fill="currentColor" />
        </svg>
      );
    case 'low':
      return (
        <svg aria-hidden viewBox="0 0 10 10" className={cn(c, 'h-2.5 w-2.5')}>
          <circle cx="5" cy="5" r="3.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
  }
}

export const SEVERITY_TEXT: Record<Severity, string> = {
  critical: 'text-crit',
  high: 'text-high',
  medium: 'text-med',
  low: 'text-low',
};
const SEVERITY_BADGE: Record<Severity, string> = {
  critical: 'bg-crit-soft text-crit',
  high: 'bg-high-soft text-high',
  medium: 'bg-med-soft text-med',
  low: 'bg-low-soft text-low',
};

export function SeverityBadge({ severity, suffix, size = 'sm' }: { severity: Severity; suffix?: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-semibold whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[13px]' : 'px-2.5 py-1 text-[15px]',
        SEVERITY_BADGE[severity],
      )}
    >
      <SeverityIcon severity={severity} />
      {SEVERITY_LABEL[severity]}
      {suffix && <span>· {suffix}</span>}
    </span>
  );
}

export function SeverityText({ severity }: { severity: Severity }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-semibold', SEVERITY_TEXT[severity])}>
      <SeverityIcon severity={severity} />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

const METHOD_COLOR: Record<string, string> = {
  GET: 'text-pine-ink',
  POST: 'text-high',
  PUT: 'text-med',
  PATCH: 'text-med',
  DELETE: 'text-crit',
};

export function MethodTag({ method, className }: { method: Method | string; className?: string }) {
  return (
    <span className={cn('font-mono text-[12px] font-medium tracking-wide', METHOD_COLOR[method] ?? 'text-ink-2', className)}>
      {method}
    </span>
  );
}

export function FindingStatusText({ status }: { status: FindingStatus }) {
  const tone =
    status === 'came-back'
      ? 'text-caution font-semibold'
      : status === 'new'
        ? 'text-ink font-medium'
        : status === 'verified'
          ? 'text-pine-ink font-medium'
          : status === 'fixed'
            ? 'text-pine-ink'
            : 'text-ink';
  return <span className={tone}>{statusLabel(status)}</span>;
}

export function Pill({ children, tone = 'neutral', className }: { children: React.ReactNode; tone?: 'neutral' | 'pine' | 'brass' | 'crit' | 'caution'; className?: string }) {
  const tones = {
    neutral: 'bg-low-soft text-ink-2',
    pine: 'bg-pine-soft text-pine-ink',
    brass: 'bg-brass-soft text-brass-ink',
    crit: 'bg-crit-soft text-crit',
    caution: 'bg-caution-soft text-caution',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  );
}
