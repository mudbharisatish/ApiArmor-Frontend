import { lazy, Suspense, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { CloseIcon, PlusIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/format';
import type { Header, RequestDraft } from '@/types';

const CodeEditor = lazy(() => import('./CodeEditor'));

const SECRET_HEADERS = ['authorization', 'cookie', 'x-api-key'];

export function HeadersPanel({ headers, onChange }: { headers: Header[]; onChange: (h: Header[]) => void }) {
  const update = (id: string, patch: Partial<Header>) => onChange(headers.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <table className="w-full text-[14px]">
        <caption className="sr-only">Request headers</caption>
        <thead>
          <tr className="text-left text-xs tracking-wider text-ink-2 uppercase">
            <th className="w-10 pb-2 font-semibold">
              <span className="sr-only">Send</span>
            </th>
            <th className="pb-2 font-semibold">Name</th>
            <th className="pb-2 font-semibold">Value</th>
            <th className="w-10 pb-2" />
          </tr>
        </thead>
        <tbody>
          {headers.map((h, i) => {
            const literalSecret = SECRET_HEADERS.includes(h.key.toLowerCase()) && !/\{\{/.test(h.value);
            return (
              <tr key={h.id} className="align-top">
                <td className="py-1 pr-2">
                  <input
                    type="checkbox"
                    checked={h.enabled}
                    onChange={(e) => update(h.id, { enabled: e.target.checked })}
                    aria-label={`Send header ${h.key || i + 1}`}
                    className="mt-3 h-4 w-4 accent-pine"
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    className="input py-2 font-mono text-[13px]"
                    value={h.key}
                    onChange={(e) => update(h.id, { key: e.target.value })}
                    aria-label={`Header ${i + 1} name`}
                    placeholder="Header-Name"
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    className={cn('input py-2 font-mono text-[13px]', !h.enabled && 'text-ink-3')}
                    value={h.value}
                    type={literalSecret ? 'password' : 'text'}
                    onChange={(e) => update(h.id, { value: e.target.value })}
                    aria-label={`Header ${i + 1} value`}
                    placeholder="value or {{variable}}"
                  />
                  {literalSecret && (
                    <p className="mt-1 text-[12px] text-ink-3">Masked. Tip: use {'{{token}}'} so the identity supplies it.</p>
                  )}
                </td>
                <td className="py-1">
                  <button
                    onClick={() => onChange(headers.filter((x) => x.id !== h.id))}
                    aria-label={`Remove header ${h.key || i + 1}`}
                    className="mt-1 grid h-9 w-9 place-items-center rounded-lg text-ink-2 hover:bg-ink/5"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Button
        size="sm"
        variant="ghost"
        className="mt-2"
        onClick={() => onChange([...headers, { id: `h${Date.now()}`, key: '', value: '', enabled: true }])}
      >
        <PlusIcon className="h-4 w-4" /> Add header
      </Button>
    </div>
  );
}

/** Line and column of a JSON parse error, from the engine's "position N" message. */
export function jsonError(text: string): string | null {
  const probe = text.replace(/\{\{\s*[\w.-]+\s*\}\}/g, '0');
  if (!probe.trim()) return null;
  try {
    JSON.parse(probe);
    return null;
  } catch (e) {
    const msg = (e as Error).message;
    const lc = msg.match(/line (\d+) column (\d+)/);
    if (lc) return `Line ${lc[1]}, column ${lc[2]}: ${msg.replace(/\s*\(line.*$/, '').replace(/ in JSON at position \d+/, '')}`;
    const pos = Number(msg.match(/position (\d+)/)?.[1]);
    if (!Number.isNaN(pos)) {
      const before = probe.slice(0, pos).split('\n');
      return `Line ${before.length}, column ${before[before.length - 1].length + 1}: ${msg.replace(/ in JSON at position \d+.*$/, '')}`;
    }
    return msg.includes('end of JSON') ? `Line ${probe.split('\n').length}: the JSON ends too early` : msg;
  }
}

export function BodyPanel({ request, onChange }: { request: RequestDraft; onChange: (body: string) => void }) {
  const isJson = useMemo(() => {
    const ct = request.headers.find((h) => h.enabled && h.key.toLowerCase() === 'content-type')?.value ?? '';
    return ct.includes('json') || /^\s*[[{]/.test(request.body);
  }, [request.headers, request.body]);
  const error = isJson ? jsonError(request.body) : null;

  if ((request.method === 'GET' || request.method === 'DELETE') && !request.body.trim()) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-[15px] text-ink-2">
        {request.method} requests don&rsquo;t have a body.
        <div>
          <button className="link mt-2 text-[14px]" onClick={() => onChange('{\n  \n}')}>
            Add a body anyway
          </button>
        </div>
      </div>
    );
  }

  const format = () => {
    try {
      const placeholders: string[] = [];
      const safe = request.body.replace(/"?\{\{\s*[\w.-]+\s*\}\}"?/g, (m) => {
        placeholders.push(m);
        return `"__VAR_${placeholders.length - 1}__"`;
      });
      const pretty = JSON.stringify(JSON.parse(safe), null, 2).replace(/"__VAR_(\d+)__"/g, (_, i) => placeholders[Number(i)]);
      onChange(pretty);
    } catch {
      /* the error message already explains the problem */
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-2">{isJson ? 'JSON body' : 'Body'} · Press Esc then Tab to leave the editor.</p>
        {isJson && (
          <Button size="sm" onClick={format} disabled={Boolean(error)}>
            Format
          </Button>
        )}
      </div>
      <Suspense fallback={<div className="h-[220px] animate-pulse rounded-[10px] border border-line bg-white" />}>
        <CodeEditor value={request.body} onChange={onChange} label="Request body" />
      </Suspense>
      <p role="status" className={cn('text-[13px]', error ? 'font-medium text-crit' : 'text-pine-ink')}>
        {isJson ? (error ? error : request.body.trim() ? '✓ Valid JSON' : '') : ''}
      </p>
    </div>
  );
}
