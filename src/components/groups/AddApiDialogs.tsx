import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { MethodTag } from '@/components/ui/Severity';
import { parseCurl } from '@/lib/curl';
import { cn, uid } from '@/lib/format';
import { parseUrl } from '@/lib/url';
import { useApp } from '@/store/app';
import { METHODS, type Header, type Method } from '@/types';

/** Pick APIs that live in other groups and move them into this one. */
export function AddExistingDialog({ group, open, onOpenChange }: { group: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const requests = useApp((s) => s.requests);
  const moveRequests = useApp((s) => s.moveRequests);
  const showToast = useApp((s) => s.showToast);
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const searchId = useId();
  const others = requests.filter((r) => r.group !== group);
  const term = q.trim().toLowerCase();
  const shown = others.filter((r) => !term || `${r.name} ${r.url} ${r.group}`.toLowerCase().includes(term));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setPicked([]);
          setQ('');
        }
      }}
      width="max-w-xl"
      title={`Add existing APIs to ${group}`}
      description="Ticked APIs move here from their current group. Each API lives in one group."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={picked.length === 0}
            onClick={() => {
              moveRequests(picked, group);
              showToast('success', `Added ${picked.length} API${picked.length === 1 ? '' : 's'} to ${group}.`);
              setPicked([]);
              onOpenChange(false);
            }}
          >
            Add {picked.length || ''} to group
          </Button>
        </>
      }
    >
      {others.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-[15px] text-ink-2">
          Every API is already in this group. Create a new one instead.
        </p>
      ) : (
        <>
          <label htmlFor={searchId} className="sr-only">
            Search APIs
          </label>
          <input id={searchId} autoFocus type="search" className="input py-2" placeholder="Search by name, URL or group" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="mt-3 max-h-72 divide-y divide-line overflow-auto rounded-xl border border-line bg-white">
            {shown.map((r) => (
              <li key={r.id}>
                <label className="flex items-center gap-3 px-3 py-2.5 text-[14px] hover:bg-surface-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-pine"
                    checked={picked.includes(r.id)}
                    onChange={() => setPicked((p) => (p.includes(r.id) ? p.filter((x) => x !== r.id) : [...p, r.id]))}
                  />
                  <MethodTag method={r.method} className="w-14" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{r.name}</span>
                    <span className="block truncate font-mono text-[12px] text-ink-3">{parseUrl(r.url).path || r.url}</span>
                  </span>
                  <span className="shrink-0 rounded bg-surface-2 px-2 py-0.5 text-[12px] text-ink-2">{r.group}</span>
                </label>
              </li>
            ))}
            {shown.length === 0 && <li className="px-3 py-6 text-center text-[14px] text-ink-2">No APIs match.</li>}
          </ul>
        </>
      )}
    </Dialog>
  );
}

/** Create a brand-new API directly in a group, from a form or a pasted cURL command. */
export function NewApiDialog({
  group,
  open,
  onOpenChange,
  initialMode = 'form',
}: {
  group: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialMode?: 'form' | 'curl';
}) {
  const createRequest = useApp((s) => s.createRequest);
  const showToast = useApp((s) => s.showToast);
  const baseUrl = useApp((s) => s.environments.find((e) => e.id === s.activeEnvId)?.baseUrl ?? 'http://localhost:4000');
  const [mode, setMode] = useState<'form' | 'curl'>(initialMode);
  const [name, setName] = useState('');
  const [method, setMethod] = useState<Method>('GET');
  const [url, setUrl] = useState(`${baseUrl}/api/`);
  const [withAuth, setWithAuth] = useState(true);
  const [curl, setCurl] = useState('');
  const [touched, setTouched] = useState(false);
  const [curlError, setCurlError] = useState<string | null>(null);
  const ids = { name: useId(), method: useId(), url: useId(), curl: useId(), auth: useId() };

  const parsed = parseUrl(url);
  const urlError = !url.trim() ? 'Enter a URL.' : !parsed.ok ? (parsed.error ?? 'That isn’t a valid URL') : null;
  const nameError = !name.trim() ? 'Give the API a name.' : null;

  const reset = () => {
    setName('');
    setMethod('GET');
    setUrl(`${baseUrl}/api/`);
    setCurl('');
    setTouched(false);
    setCurlError(null);
    setMode(initialMode);
  };

  const finish = (apiName: string) => {
    showToast('success', `Added “${apiName}” to ${group}.`);
    reset();
    onOpenChange(false);
  };

  const submit = () => {
    if (mode === 'form') {
      setTouched(true);
      if (nameError || urlError) return;
      const headers: Header[] = [{ id: `h${Date.now()}a`, key: 'Accept', value: 'application/json', enabled: true }];
      if (withAuth) headers.unshift({ id: `h${Date.now()}b`, key: 'Authorization', value: 'Bearer {{token}}', enabled: true });
      if (method !== 'GET' && method !== 'DELETE') headers.push({ id: `h${Date.now()}c`, key: 'Content-Type', value: 'application/json', enabled: true });
      createRequest({ id: uid('req'), group, name: name.trim(), method, url: url.trim(), headers, body: method === 'GET' || method === 'DELETE' ? '' : '{\n  \n}' });
      finish(name.trim());
    } else {
      const result = parseCurl(curl);
      if (!result.ok) return setCurlError(result.error);
      const { method: m, url: u, headers, body } = result.value;
      const apiName = name.trim() || `${m} ${parseUrl(u).path || u}`;
      createRequest({ id: uid('req'), group, name: apiName, method: m, url: u, headers, body, imported: true });
      finish(apiName);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
      width="max-w-xl"
      title={`New API in ${group}`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Add API
          </Button>
        </>
      }
    >
      <div role="tablist" aria-label="How to add" className="mb-5 inline-flex rounded-lg bg-surface-2 p-1">
        {(
          [
            ['form', 'Fill in details'],
            ['curl', 'Paste cURL'],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn('rounded-md px-4 py-1.5 text-[14px]', mode === m ? 'bg-white font-semibold shadow-sm' : 'text-ink-2 hover:text-ink')}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="grid gap-4"
      >
        <label htmlFor={ids.name}>
          <span className="label font-medium text-ink">Name{mode === 'curl' && <span className="font-normal text-ink-3"> (optional)</span>}</span>
          <input
            id={ids.name}
            autoFocus
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Apply discount code"
            aria-invalid={mode === 'form' && touched && Boolean(nameError)}
          />
          {mode === 'form' && touched && nameError && <span className="mt-1 block text-[13px] font-medium text-crit">{nameError}</span>}
        </label>

        {mode === 'form' ? (
          <>
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <label htmlFor={ids.method}>
                <span className="label font-medium text-ink">Method</span>
                <select id={ids.method} className="select font-mono text-[14px]" value={method} onChange={(e) => setMethod(e.target.value as Method)}>
                  {METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label htmlFor={ids.url}>
                <span className="label font-medium text-ink">URL</span>
                <input
                  id={ids.url}
                  className="input font-mono text-[14px]"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  spellCheck={false}
                  aria-invalid={touched && Boolean(urlError)}
                />
                {touched && urlError && <span className="mt-1 block text-[13px] font-medium text-crit">{urlError}</span>}
              </label>
            </div>
            <label htmlFor={ids.auth} className="flex items-start gap-3 text-[14px]">
              <input id={ids.auth} type="checkbox" className="mt-0.5 h-4 w-4 accent-pine" checked={withAuth} onChange={(e) => setWithAuth(e.target.checked)} />
              <span>
                Send as the signed-in test user
                <span className="block text-[13px] text-ink-2">
                  Adds <code className="font-mono">Authorization: Bearer {'{{token}}'}</code>. Untick for public endpoints.
                </span>
              </span>
            </label>
            <p className="text-[13px] text-ink-2">You can edit headers, body and who-can-use settings in the workspace afterwards.</p>
          </>
        ) : (
          <label htmlFor={ids.curl}>
            <span className="label font-medium text-ink">cURL command</span>
            <textarea
              id={ids.curl}
              rows={5}
              spellCheck={false}
              className="input font-mono text-[13px]"
              value={curl}
              onChange={(e) => setCurl(e.target.value)}
              placeholder={"curl -X POST http://localhost:4000/api/orders -H 'Content-Type: application/json' -d '{\"productId\":7}'"}
              aria-invalid={Boolean(curlError)}
            />
            {curlError && <span className="mt-1 block text-[13px] font-medium text-crit">{curlError}</span>}
          </label>
        )}
      </form>
    </Dialog>
  );
}
