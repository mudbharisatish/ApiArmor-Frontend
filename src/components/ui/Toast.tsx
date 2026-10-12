import { useApp } from '@/store/app';
import { cn } from '@/lib/format';

const TONE = {
  success: 'border-pine/30 bg-pine-soft text-pine-ink',
  info: 'border-line-strong bg-surface text-ink',
  caution: 'border-caution/30 bg-caution-soft text-caution',
  error: 'border-crit/30 bg-crit-soft text-crit',
};

/** A single status message at a time, announced politely; closes on × or after ~4.5 s. */
export function ToastHost() {
  const toast = useApp((s) => s.toast);
  const dismiss = useApp((s) => s.dismissToast);
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed right-4 bottom-4 left-4 z-[60] flex justify-end sm:left-auto">
      {toast && (
        <div
          key={toast.id}
          className={cn(
            'animate-toast-in pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-[15px] shadow-lg',
            TONE[toast.kind],
          )}
        >
          <p className="flex-1 leading-snug">{toast.text}</p>
          <button
            onClick={dismiss}
            aria-label="Dismiss message"
            className="-mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md hover:bg-ink/10"
          >
            <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
