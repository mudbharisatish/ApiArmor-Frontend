import * as Tooltip from '@radix-ui/react-tooltip';
import { useRef } from 'react';
import { cn } from '@/lib/format';
import { isLocalHost, parseUrl } from '@/lib/url';
import { describeVariable, findVariables, splitVariables } from '@/lib/variables';
import type { Environment } from '@/types';

/**
 * URL input with inline {{variable}} highlighting: a mirrored layer behind a transparent input.
 * Defined variables are tinted; undefined ones get a red wavy underline. Chips below show values (secrets masked).
 */
export function UrlField({
  value,
  onChange,
  env,
  id,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  env: Environment;
  id: string;
  onSubmit: () => void;
}) {
  const mirror = useRef<HTMLDivElement>(null);
  const sync = (el: HTMLInputElement) => {
    if (mirror.current) mirror.current.scrollLeft = el.scrollLeft;
  };
  const vars = findVariables(value).map((n) => describeVariable(n, env));
  const parsed = parseUrl(value);
  const warnHttp = parsed.ok && parsed.protocol === 'http' && !isLocalHost(parsed.hostname) && !findVariables(parsed.hostname).length;
  const hint = !value.trim() ? null : !parsed.ok ? parsed.error : null;

  return (
    <div className="min-w-0 flex-1">
      <div className="relative">
        <div
          ref={mirror}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg border border-transparent bg-white px-3.5 py-2.5 font-mono text-[14px] leading-6 whitespace-pre text-ink"
        >
          {splitVariables(value).map((seg, i) =>
            seg.variable ? (
              <span
                key={i}
                className={cn(
                  'rounded-sm',
                  vars.find((v) => v.name === seg.variable)?.defined
                    ? 'bg-brass-soft text-brass-ink'
                    : 'text-crit underline decoration-crit decoration-wavy underline-offset-4',
                )}
              >
                {seg.text}
              </span>
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )}
        </div>
        <input
          id={id}
          value={value}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => {
            onChange(e.target.value);
            sync(e.target);
          }}
          onScroll={(e) => sync(e.currentTarget)}
          onKeyUp={(e) => sync(e.currentTarget)}
          onSelect={(e) => sync(e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) onSubmit();
          }}
          aria-label="Request URL"
          aria-invalid={Boolean(hint)}
          aria-describedby={hint || warnHttp ? `${id}-hint` : undefined}
          className="input relative bg-transparent font-mono text-[14px] leading-6 text-transparent caret-ink selection:bg-brass-soft selection:text-ink"
          style={{ background: 'transparent' }}
        />
      </div>
      {(hint || warnHttp) && (
        <p id={`${id}-hint`} className={cn('mt-1.5 text-[13px]', hint ? 'text-crit' : 'text-caution')}>
          {hint ?? 'This URL isn’t encrypted (http://). Fine for local testing; use https:// for anything else.'}
        </p>
      )}
      {vars.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="text-ink-3">Variables:</span>
          {vars.map((v) => (
            <Tooltip.Root key={v.name}>
              <Tooltip.Trigger asChild>
                <button
                  type="button"
                  className={cn(
                    'rounded-md px-1.5 py-0.5 font-mono',
                    v.defined ? 'bg-brass-soft text-brass-ink' : 'bg-crit-soft text-crit',
                  )}
                >
                  {`{{${v.name}}}`}
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content sideOffset={4} className="z-50 rounded-md bg-night px-2.5 py-1.5 font-mono text-[12px] text-night-ink shadow-lg">
                  {v.display}
                  <Tooltip.Arrow className="fill-night" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          ))}
        </div>
      )}
    </div>
  );
}
