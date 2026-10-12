import { useEffect, useId, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { CheckIcon, EyeIcon, EyeOffIcon, PlusIcon } from '@/components/ui/Icons';
import { Pill } from '@/components/ui/Severity';
import { cn, daysUntil, uid } from '@/lib/format';
import { parseUrl } from '@/lib/url';
import { useApp } from '@/store/app';
import type { Environment, Identity, SignInMethod } from '@/types';

const SLOT_LABEL: Record<Identity['slot'], string> = { A: 'A · Owner', B: 'B · Second user', admin: 'Admin', none: 'Other' };
const METHOD_LABEL: Record<SignInMethod, string> = {
  login: 'Login request, refreshes on 401',
  bearer: 'Static bearer token',
  apikey: 'API key header',
};

function IdentityStatus({ identity }: { identity: Identity }) {
  if (identity.status === 'failed') return <span className="font-medium text-crit">✕ Sign-in failed</span>;
  if (identity.status === 'signed-out') return <span className="text-ink-2">Not signed in</span>;
  if (identity.method === 'bearer' && identity.tokenExpiresAt) {
    const d = daysUntil(identity.tokenExpiresAt);
    if (d <= 0) return <span className="font-medium text-crit">✕ Token expired</span>;
    if (d <= 7)
      return (
        <span className="font-medium text-caution">
          ◆ Token expires in {d} day{d === 1 ? '' : 's'}
        </span>
      );
  }
  return <span className="font-medium text-pine-ink">✓ Signed in</span>;
}

export function IdentitiesPage() {
  const identities = useApp((s) => s.identities);
  const addIdentity = useApp((s) => s.addIdentity);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [selected, setSelected] = useState<string>(identities[0]?.id ?? '');
  const handledAdd = useRef<string | null>(null);

  useEffect(() => {
    const key = params.get('add') === '1' ? location.key : null;
    if (key && handledAdd.current !== key) {
      handledAdd.current = key;
      const id = uid('idn');
      const hasB = identities.some((i) => i.slot === 'B');
      addIdentity({
        id,
        name: hasB ? `user${identities.length + 1}` : 'carol',
        slot: hasB ? 'none' : 'B',
        method: 'login',
        loginRequestId: 'login',
        tokenPath: '$.token',
        headerName: 'X-API-Key',
        hasSecret: false,
        secretValid: false,
        status: 'signed-out',
        isAdmin: false,
      });
      setSelected(id);
      setParams({}, { replace: true });
    }
  }, [params, identities, addIdentity, setParams, location.key]);

  useEffect(() => {
    if (location.hash === '#environments') document.getElementById('environments')?.scrollIntoView();
  }, [location.hash]);

  const current = identities.find((i) => i.id === selected) ?? identities[0];

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 md:px-10 md:py-8">
      <p className="text-[16px] text-ink-2">Identities are the test users ApiArmor signs in as. Use test accounts only. Select one to edit it.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Identities">
        {identities.map((i) => {
          const active = i.id === current?.id;
          return (
            <button
              key={i.id}
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(i.id)}
              className={cn(
                'rounded-2xl border bg-surface p-5 text-left transition-colors',
                active ? 'border-pine ring-1 ring-pine' : 'border-line hover:border-line-strong',
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-[18px] font-semibold">{i.name}</span>
                <Pill tone="brass">{SLOT_LABEL[i.slot]}</Pill>
              </span>
              <span className="mt-1 block text-[15px] text-ink-2">{METHOD_LABEL[i.method]}</span>
              <span className="mt-2 block text-[15px]">
                <IdentityStatus identity={i} />
              </span>
            </button>
          );
        })}
        <button
          onClick={() => setParams({ add: '1' })}
          className="flex min-h-[120px] items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong text-[15px] font-medium text-ink-2 hover:border-ink-3 hover:text-ink"
        >
          <PlusIcon className="h-5 w-5" /> Add identity
        </button>
      </div>

      {current && <IdentityEditor key={current.id} identity={current} onRemoved={() => setSelected(identities.find((i) => i.id !== current.id)?.id ?? '')} />}

      <Environments />
    </div>
  );
}

function IdentityEditor({ identity, onRemoved }: { identity: Identity; onRemoved: () => void }) {
  const requests = useApp((s) => s.requests);
  const identities = useApp((s) => s.identities);
  const update = useApp((s) => s.updateIdentity);
  const remove = useApp((s) => s.removeIdentity);
  const showToast = useApp((s) => s.showToast);
  const [form, setForm] = useState(() => ({
    name: identity.name,
    slot: identity.slot,
    method: identity.method,
    loginRequestId: identity.loginRequestId,
    tokenPath: identity.tokenPath,
    headerName: identity.headerName,
    expires: identity.tokenExpiresAt?.slice(0, 10) ?? '',
  }));
  const [secret, setSecret] = useState('');
  const [reveal, setReveal] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const f = { name: useId(), method: useId(), login: useId(), path: useId(), secret: useId(), slot: useId(), header: useId(), expires: useId(), hint: useId() };
  const posts = requests.filter((r) => r.method === 'POST');

  const secretLabel = form.method === 'login' ? 'Password' : form.method === 'bearer' ? 'Bearer token' : 'API key';
  const nameTaken = identities.some((i) => i.id !== identity.id && i.name === form.name.trim());

  const save = () => {
    if (!form.name.trim() || nameTaken) return;
    const patch: Partial<Identity> = {
      name: form.name.trim(),
      slot: form.slot,
      isAdmin: form.slot === 'admin',
      method: form.method,
      loginRequestId: form.loginRequestId,
      tokenPath: form.tokenPath,
      headerName: form.headerName,
      tokenExpiresAt: form.method === 'bearer' && form.expires ? new Date(form.expires + 'T23:59:00').toISOString() : undefined,
    };
    // Slots A and B are unique: moving one here frees it elsewhere.
    if (form.slot === 'A' || form.slot === 'B')
      identities.filter((i) => i.id !== identity.id && i.slot === form.slot).forEach((i) => update(i.id, { slot: 'none' }));
    if (secret) {
      // The value is never stored in the browser. In the real app it is sent once, encrypted at rest, and never returned.
      patch.hasSecret = true;
      patch.secretValid = secret.length >= 8;
      patch.status = 'signed-out';
    } else if (form.method !== identity.method) {
      patch.hasSecret = false;
      patch.status = 'signed-out';
    }
    update(identity.id, patch);
    setSecret('');
    setReveal(false);
    setTestMsg(null);
    showToast('success', secret ? `Saved ${patch.name}. The ${secretLabel.toLowerCase()} is encrypted and won’t be shown again.` : `Saved ${patch.name}.`);
  };

  const test = async () => {
    setTesting(true);
    setTestMsg(null);
    await new Promise((r) => setTimeout(r, 600));
    setTesting(false);
    const cur = useApp.getState().identities.find((i) => i.id === identity.id)!;
    const loginReq = requests.find((r) => r.id === cur.loginRequestId);
    if (!cur.hasSecret) {
      setTestMsg({ ok: false, text: `No ${secretLabel.toLowerCase()} saved yet. Enter one and save first.` });
      return;
    }
    if (cur.method === 'bearer' && cur.tokenExpiresAt && daysUntil(cur.tokenExpiresAt) <= 0) {
      update(identity.id, { status: 'failed' });
      setTestMsg({ ok: false, text: 'Sign-in failed: the token has expired (GET /api/account returned 401). Paste a new one.' });
      return;
    }
    if (!cur.secretValid) {
      update(identity.id, { status: 'failed' });
      setTestMsg({
        ok: false,
        text:
          cur.method === 'login'
            ? `Sign-in failed: ${loginReq ? `${loginReq.method} ${parseUrl(loginReq.url).path}` : 'the login request'} returned 401 Unauthorized. Check the password.`
            : 'Sign-in failed: the API returned 401 Unauthorized for this credential.',
      });
      return;
    }
    update(identity.id, { status: 'signed-in' });
    setTestMsg({
      ok: true,
      text:
        cur.method === 'login'
          ? `Signed in as ${cur.name}. Token from ${cur.tokenPath} is valid for 15 minutes; ApiArmor signs in again on 401.`
          : `Signed in as ${cur.name}. GET /api/account returned 200 OK.`,
    });
  };

  return (
    <section className="card mt-6 p-5 md:p-7" aria-labelledby="editing-title">
      <h2 id="editing-title" className="text-[19px] font-semibold">
        Editing: {identity.name}
      </h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label htmlFor={f.name}>
          <span className="label font-medium text-ink">Name</span>
          <input id={f.name} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={nameTaken || !form.name.trim()} />
          {nameTaken && <span className="mt-1 block text-[13px] text-crit">Another identity already uses this name.</span>}
        </label>
        <label htmlFor={f.slot}>
          <span className="label font-medium text-ink">Role in tests</span>
          <select id={f.slot} className="select" value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value as Identity['slot'] })}>
            <option value="A">Identity A (owner)</option>
            <option value="B">Identity B (second user)</option>
            <option value="admin">Admin</option>
            <option value="none">Other</option>
          </select>
        </label>
        <label htmlFor={f.method}>
          <span className="label font-medium text-ink">Sign-in method</span>
          <select id={f.method} className="select" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as SignInMethod })}>
            <option value="login">Run a login request</option>
            <option value="bearer">Static bearer token</option>
            <option value="apikey">API key header</option>
          </select>
        </label>

        {form.method === 'login' && (
          <>
            <label htmlFor={f.login}>
              <span className="label font-medium text-ink">Login request</span>
              <select id={f.login} className="select font-mono text-[14px]" value={form.loginRequestId} onChange={(e) => setForm({ ...form, loginRequestId: e.target.value })}>
                {posts.map((r) => (
                  <option key={r.id} value={r.id}>
                    POST {parseUrl(r.url).path}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={f.path}>
              <span className="label font-medium text-ink">Take token from (JSONPath)</span>
              <input id={f.path} className="input font-mono text-[14px]" value={form.tokenPath} onChange={(e) => setForm({ ...form, tokenPath: e.target.value })} />
            </label>
          </>
        )}
        {form.method === 'apikey' && (
          <label htmlFor={f.header}>
            <span className="label font-medium text-ink">Header name</span>
            <input id={f.header} className="input font-mono text-[14px]" value={form.headerName} onChange={(e) => setForm({ ...form, headerName: e.target.value })} />
          </label>
        )}
        {form.method === 'bearer' && (
          <label htmlFor={f.expires}>
            <span className="label font-medium text-ink">Token expires (optional)</span>
            <input id={f.expires} type="date" className="input" value={form.expires} onChange={(e) => setForm({ ...form, expires: e.target.value })} />
          </label>
        )}

        <div className="sm:col-span-2 lg:col-span-2">
          <label htmlFor={f.secret} className="label font-medium text-ink">
            {secretLabel}
          </label>
          <div className="relative">
            <input
              id={f.secret}
              type={reveal ? 'text' : 'password'}
              autoComplete="new-password"
              className="input pr-12 font-mono"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={identity.hasSecret ? '•••••••••••• saved · type to replace' : `Enter a ${secretLabel.toLowerCase()}`}
              aria-describedby={f.hint}
            />
            {secret && (
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? `Hide ${secretLabel.toLowerCase()}` : `Show ${secretLabel.toLowerCase()}`}
                className="absolute top-1/2 right-2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-ink-2 hover:bg-ink/5"
              >
                {reveal ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            )}
          </div>
          <p id={f.hint} className="mt-1.5 text-[13px] text-ink-2">
            Encrypted on save and never shown again.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={save} disabled={!form.name.trim() || nameTaken}>
          Save identity
        </Button>
        <Button onClick={test} disabled={testing}>
          {testing ? 'Signing in…' : 'Test sign-in'}
        </Button>
        <Button variant="ghost" className="ml-auto !text-crit hover:bg-crit-soft" onClick={() => setConfirmRemove(true)}>
          Remove identity
        </Button>
      </div>
      <div aria-live="polite">
        {testMsg && (
          <p className={cn('mt-4 rounded-xl px-4 py-3 text-[14px] font-medium', testMsg.ok ? 'bg-pine-soft text-pine-ink' : 'bg-crit-soft text-crit')}>
            {testMsg.text}
          </p>
        )}
      </div>

      <Dialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove ${identity.name}?`}
        description="Its saved secret is deleted. Requests that used it as identity A or B will need another identity before access tests can run."
        footer={
          <>
            <Button onClick={() => setConfirmRemove(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                remove(identity.id);
                setConfirmRemove(false);
                onRemoved();
                showToast('success', `Removed ${identity.name}.`);
              }}
            >
              Remove
            </Button>
          </>
        }
      />
    </section>
  );
}

function Environments() {
  const environments = useApp((s) => s.environments);
  const activeEnvId = useApp((s) => s.activeEnvId);
  const setActiveEnv = useApp((s) => s.setActiveEnv);
  const setSafeMode = useApp((s) => s.setSafeMode);
  const showToast = useApp((s) => s.showToast);
  const [adding, setAdding] = useState(false);

  return (
    <section id="environments" className="mt-10 scroll-mt-4" aria-labelledby="env-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="env-title" className="text-[19px] font-semibold">
          Environments
        </h2>
        <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
          <PlusIcon className="h-4 w-4" /> Add environment
        </Button>
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        {environments.map((e) => {
          const active = e.id === activeEnvId;
          return (
            <div key={e.id} className={cn('rounded-2xl border bg-surface p-5', active ? 'border-pine ring-1 ring-pine' : 'border-line')}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[17px] font-semibold">{e.name}</h3>
                <Pill tone={e.kind === 'production' ? 'crit' : 'pine'}>{e.kind === 'production' ? 'Production' : 'Development'}</Pill>
              </div>
              <p className="mt-2 font-mono text-[14px] text-ink-2">{e.baseUrl}</p>
              {e.kind === 'development' ? (
                <label className="mt-4 flex items-center gap-3 text-[15px]">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-pine"
                    checked={e.safeMode}
                    onChange={(ev) => {
                      setSafeMode(e.id, ev.target.checked);
                      showToast(ev.target.checked ? 'success' : 'caution', ev.target.checked ? `Safe mode on for ${e.name}.` : `Safe mode off for ${e.name}: fixture write tests allowed.`);
                    }}
                  />
                  Safe mode: read-only tests only
                </label>
              ) : (
                <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
                  Tests that change or delete data never run on Production environments, even with safe mode off.
                </p>
              )}
              <Variables env={e} />
              <div className="mt-4">
                {active ? (
                  <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-pine-ink">
                    <CheckIcon className="h-4 w-4" /> In use
                  </span>
                ) : (
                  <Button size="sm" onClick={() => (setActiveEnv(e.id), showToast('info', `Environment: ${e.name}`))}>
                    Use this environment
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <AddEnvironmentDialog open={adding} onOpenChange={setAdding} />
    </section>
  );
}

function Variables({ env }: { env: Environment }) {
  const update = useApp((s) => s.updateEnvironment);
  const [open, setOpen] = useState(false);
  const set = (i: number, patch: Partial<Environment['variables'][number]>) =>
    update(env.id, { variables: env.variables.map((v, j) => (j === i ? { ...v, ...patch } : v)) });
  return (
    <div className="mt-4 border-t border-line pt-3">
      <button className="link text-[14px]" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide' : 'Show'} variables ({env.variables.length})
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {env.variables.map((v, i) => {
            const fromIdentity = v.value.startsWith('(from');
            return (
              <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-2">
                <input className="input py-1.5 font-mono text-[13px]" value={v.key} aria-label="Variable name" onChange={(e) => set(i, { key: e.target.value })} />
                <input
                  className="input py-1.5 font-mono text-[13px] disabled:bg-surface-2 disabled:text-ink-3"
                  type={v.secret && !fromIdentity ? 'password' : 'text'}
                  value={v.value}
                  disabled={fromIdentity}
                  aria-label={`Value of ${v.key}`}
                  onChange={(e) => set(i, { value: e.target.value })}
                />
                <label className="flex items-center gap-1.5 text-[13px] text-ink-2">
                  <input type="checkbox" className="accent-pine" checked={v.secret} disabled={fromIdentity} onChange={(e) => set(i, { secret: e.target.checked })} />
                  Secret
                </label>
              </div>
            );
          })}
          <Button size="sm" variant="ghost" onClick={() => update(env.id, { variables: [...env.variables, { key: 'newVar', value: '', secret: false }] })}>
            <PlusIcon className="h-4 w-4" /> Add variable
          </Button>
        </div>
      )}
    </div>
  );
}

function AddEnvironmentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const add = useApp((s) => s.addEnvironment);
  const showToast = useApp((s) => s.showToast);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('http://localhost:8080');
  const [kind, setKind] = useState<Environment['kind']>('development');
  const parsed = parseUrl(baseUrl);
  const ids = { name: useId(), url: useId(), kind: useId() };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add environment"
      description="Point ApiArmor at another copy of your API. Mark anything with real users as Production."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!name.trim() || !parsed.ok}
            onClick={() => {
              add({
                id: uid('env'),
                name: name.trim(),
                kind,
                baseUrl: baseUrl.trim(),
                safeMode: true,
                variables: [
                  { key: 'baseUrl', value: baseUrl.trim(), secret: false },
                  { key: 'token', value: '(from the signed-in identity)', secret: true },
                ],
              });
              showToast('success', `Added ${name.trim()}. Safe mode is on.`);
              setName('');
              onOpenChange(false);
            }}
          >
            Add environment
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <label htmlFor={ids.name}>
          <span className="label">Name</span>
          <input id={ids.name} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="My API (local)" />
        </label>
        <label htmlFor={ids.url}>
          <span className="label">Base URL</span>
          <input id={ids.url} className="input font-mono text-[14px]" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} aria-invalid={!parsed.ok} />
          {!parsed.ok && <span className="mt-1 block text-[13px] text-crit">{parsed.error}</span>}
          {parsed.ok && (
            <span className="mt-1 block text-[13px] text-ink-2">
              Scope: {parsed.protocol}://{parsed.hostname}
              {parsed.port ? `:${parsed.port}` : ''}
              {parsed.path !== '/' ? parsed.path : ''}
            </span>
          )}
        </label>
        <label htmlFor={ids.kind}>
          <span className="label">Type</span>
          <select id={ids.kind} className="select" value={kind} onChange={(e) => setKind(e.target.value as Environment['kind'])}>
            <option value="development">Development</option>
            <option value="production">Production (never runs write tests)</option>
          </select>
        </label>
      </div>
    </Dialog>
  );
}
