import { useState } from 'react';
import { LayoutBottomIcon, LayoutRightIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/format';
import { formatBytes } from '@/lib/shoplabResponder';
import { useApp } from '@/store/app';

/** JSON with light syntax colour. Every token is rendered as React text, so a body can never run as HTML. */
function JsonText({ text }: { text: string }) {
  if (text.length > 400_000) return <>{text}</>;
  const parts = text.split(/("(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|\b-?\d+(?:\.\d+)?(?:e[+-]?\d+)?\b|\btrue\b|\bfalse\b|\bnull\b)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 0) return p;
        const cls = p.startsWith('"')
          ? parts[i + 1]?.trimStart().startsWith(':')
            ? 'text-[#a7c4b5]'
            : 'text-[#e3cf98]'
          : /true|false|null/.test(p)
            ? 'text-[#d9a3b3]'
            : 'text-[#9fc3e0]';
        return (
          <span key={i} className={cls}>
            {p}
          </span>
        );
      })}
    </>
  );
}

export function ResponsePanel({ requestId }: { requestId: string }) {
  const res = useApp((s) => s.responses[requestId]);
  const sending = useApp((s) => s.sending[requestId]);
  const layout = useApp((s) => s.responseLayout);
  const setLayout = useApp((s) => s.setResponseLayout);
  const [tab, setTab] = useState<'body' | 'headers'>('body');

  const statusTone = !res?.status
    ? ''
    : res.status < 300
      ? 'bg-pine-soft text-pine-ink'
      : res.status < 500
        ? 'bg-caution-soft text-caution'
        : 'bg-crit-soft text-crit';

  return (
    <section aria-labelledby="response-title" className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2">
        <h2 id="response-title" className="text-[18px] font-semibold">
          Response
        </h2>
        <button
          onClick={() => setLayout(layout === 'right' ? 'bottom' : 'right')}
          className="grid h-8 w-8 place-items-center rounded-md text-ink-2 hover:bg-ink/5"
          aria-label={layout === 'right' ? 'Show response below the editor' : 'Show response beside the editor'}
          title={layout === 'right' ? 'Show below' : 'Show beside'}
        >
          {layout === 'right' ? <LayoutBottomIcon className="h-[18px] w-[18px]" /> : <LayoutRightIcon className="h-[18px] w-[18px]" />}
        </button>
      </div>

      <div aria-live="polite" aria-busy={Boolean(sending)} className="mt-3 flex min-h-0 flex-1 flex-col">
        {sending ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center text-[15px] text-ink-2">
            <span className="animate-pulse-dot mr-2 inline-block h-2 w-2 rounded-full bg-pine" />
            Sending…
          </div>
        ) : !res ? (
          <div className="rounded-2xl border border-dashed border-line-strong px-6 py-8 text-center text-[15px] leading-relaxed text-ink-2">
            Press <strong className="text-ink">Send</strong> to see the response,
            <br />
            or <strong className="text-ink">Scan</strong> to test it for security problems.
          </div>
        ) : res.error ? (
          <div className="rounded-2xl border border-crit/25 bg-crit-soft/60 p-5">
            <p className="text-[15px] font-semibold text-crit">{res.error.title}</p>
            <p className="mt-1.5 text-[14px] text-ink-2">{res.error.nextStep}</p>
            <p className="mt-3 font-mono text-[12px] break-all text-ink-3">
              {res.method} {res.url}
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 text-[13px]">
              <span className={cn('rounded-md px-2 py-0.5 font-semibold', statusTone)}>
                {res.status} {res.statusText}
              </span>
              <span className="text-ink-2">{res.timeMs} ms</span>
              <span className="text-ink-2">{formatBytes(res.sizeBytes)}</span>
              <span className="ml-auto text-ink-3">{res.sentAs ? `sent as ${res.sentAs}` : 'no credentials'}</span>
            </div>
            <div role="tablist" aria-label="Response parts" className="flex gap-1 border-b border-line px-2">
              {(['body', 'headers'] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={cn(
                    '-mb-px border-b-2 px-3 py-2 text-[14px] capitalize',
                    tab === t ? 'border-pine font-semibold text-pine-ink' : 'border-transparent text-ink-2',
                  )}
                >
                  {t === 'headers' ? `Headers (${res.headers.length})` : 'Body'}
                </button>
              ))}
            </div>
            {res.truncatedNotice && tab === 'body' && (
              <p className="border-b border-caution/20 bg-caution-soft px-4 py-2 text-[13px] text-caution">{res.truncatedNotice}</p>
            )}
            {tab === 'body' ? (
              <pre className="code-block min-h-[160px] flex-1 rounded-none text-[12.5px] whitespace-pre-wrap">
                {res.body ? res.contentType?.includes('json') ? <JsonText text={res.body} /> : res.body : '(empty body)'}
              </pre>
            ) : (
              <dl className="flex-1 overflow-auto p-4 font-mono text-[12.5px]">
                {res.headers.map(([k, v], i) => (
                  <div key={i} className="grid grid-cols-[minmax(120px,40%)_1fr] gap-3 border-b border-line/60 py-1.5">
                    <dt className="text-ink-2">{k}</dt>
                    <dd className="break-all">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
