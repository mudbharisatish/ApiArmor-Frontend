import * as RD from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '@/lib/format';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: string;
}

export function Dialog({ open, onOpenChange, title, description, children, footer, width = 'max-w-lg' }: DialogProps) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-night/45" />
        <RD.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 max-h-[88vh] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl',
            width,
          )}
        >
          <RD.Title className="text-xl font-semibold tracking-tight">{title}</RD.Title>
          {description ? (
            <RD.Description asChild>
              <div className="mt-2 text-[15px] leading-relaxed text-ink-2">{description}</div>
            </RD.Description>
          ) : (
            <RD.Description className="sr-only">{title}</RD.Description>
          )}
          {children && <div className="mt-5">{children}</div>}
          {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
          <RD.Close
            aria-label="Close"
            className="absolute top-4 right-4 grid h-9 w-9 place-items-center rounded-lg text-ink-2 hover:bg-ink/5"
          >
            <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </RD.Close>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
