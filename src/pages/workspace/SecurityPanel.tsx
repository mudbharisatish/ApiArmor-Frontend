import * as RG from '@radix-ui/react-radio-group';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { MODULE_BY_ID, TESTABLE_OWASP } from '@/data/taxonomy';
import { cn } from '@/lib/format';
import { planChecks, summarisePlan } from '@/lib/scanPlan';
import { accessFor, pairFor, useActiveEnv, useApp } from '@/store/app';
import type { Access, RequestDraft } from '@/types';

const OPTIONS: { value: Access; label: string; hint: string }[] = [
  { value: 'public', label: 'Public', hint: 'No sign-in needed' },
  { value: 'authenticated', label: 'Any signed-in user', hint: 'Same data for everyone' },
  { value: 'owner', label: 'Owner only', hint: 'Only the user who owns it' },
  { value: 'admin', label: 'Admin only', hint: 'Admin role required' },
];

export function SecurityPanel({ requestId, request }: { requestId: string; request: RequestDraft }) {
  const state = useApp();
  const env = useActiveEnv();
  const setAccess = useApp((s) => s.setAccess);
  const setPair = useApp((s) => s.setPair);
  const access = accessFor(state, requestId);
  const suggested = !state.access[requestId];
  const pair = pairFor(state, requestId);
  const identities = state.identities;
  const idA = identities.find((i) => i.id === pair.a);
  const idB = identities.find((i) => i.id === pair.b);
  const plan = planChecks({ request, access, identityA: idA, identityB: idB, env, profile: state.scanProfile, categories: state.owaspSelection });
  const { run, skipped, total } = summarisePlan(plan);
  const [showChecks, setShowChecks] = useState(false);
  const legendId = useId();
  const aId = useId();
  const bId = useId();
  const isDelete = request.method === 'DELETE';
  const isWrite = request.method !== 'GET';

  return (
    <div className="space-y-4">
      <fieldset className="rounded-2xl border border-line bg-surface px-5 pt-2 pb-5">
        <legend id={legendId} className="px-2 text-[16px] font-semibold">
          Who should be able to use this endpoint?
        </legend>
        <p className="text-[14px] leading-relaxed text-ink-2">
          ApiArmor judges access-control tests against this. Change it and watch which checks will run.
        </p>
        {suggested && (
          <p className="mt-2 inline-flex rounded-md bg-brass-soft px-2 py-1 text-[13px] text-brass-ink">
            Suggested from the path. Change it if it&rsquo;s wrong.
          </p>
        )}

        <RG.Root
          aria-labelledby={legendId}
          value={access}
          onValueChange={(v) => setAccess(requestId, v as Access)}
          className="mt-4 grid gap-2.5 sm:grid-cols-2"
        >
          {OPTIONS.map((o) => (
            <RG.Item
              key={o.value}
              value={o.value}
              className={cn(
                'flex items-start gap-3 rounded-xl border bg-white px-4 py-3 text-left transition-colors',
                access === o.value ? 'border-pine bg-pine-soft/40 ring-1 ring-pine' : 'border-line-strong hover:border-ink-3',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2',
                  access === o.value ? 'border-pine' : 'border-ink-3',
                )}
              >
                <RG.Indicator className="h-2 w-2 rounded-full bg-pine" />
              </span>
              <span>
                <span className="block text-[15px] font-semibold">{o.label}</span>
                <span className="block text-[14px] text-ink-2">{o.hint}</span>
              </span>
            </RG.Item>
          ))}
        </RG.Root>

        <div className="mt-4 flex flex-wrap gap-3">
          <label htmlFor={aId}>
            <span className="label">{access === 'admin' ? 'Admin (identity A)' : 'Owner (identity A)'}</span>
            <select id={aId} className="select w-40" value={pair.a} onChange={(e) => setPair(requestId, { a: e.target.value })}>
              {identities.length === 0 && <option value="">No identities</option>}
              {identities.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={bId}>
            <span className="label">Other user (identity B)</span>
            <select id={bId} className="select w-44" value={pair.b} onChange={(e) => setPair(requestId, { b: e.target.value })}>
              <option value="">None</option>
              {identities
                .filter((i) => i.id !== pair.a)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                    {i.isAdmin ? ' (admin)' : ''}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {idB?.isAdmin && (
          <p className="mt-2 text-[13px] text-caution">Identity B should be an ordinary user, not an admin, or access tests can&rsquo;t tell the difference.</p>
        )}

        {isDelete && env.safeMode && (
          <p className="mt-4 rounded-lg bg-caution-soft px-3 py-2.5 text-[14px] text-caution" role="note">
            Delete tests are skipped while safe mode is on. With safe mode off, ApiArmor creates a throwaway test user and
            deletes only that one; your existing data is never touched.
          </p>
        )}
        {isWrite && env.kind === 'production' && (
          <p className="mt-4 rounded-lg bg-crit-soft px-3 py-2.5 text-[14px] text-crit" role="note">
            {env.name} is a Production environment: tests that change or delete data never run here, even with safe mode off.
          </p>
        )}

        <div className="mt-4 rounded-xl bg-pine-soft/50 px-5 py-4" aria-live="polite">
          <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="text-[15px] font-semibold">Scan preview</span>
            <span className="text-[15px]">
              {run} of {total} checks will run · {skipped} skipped
            </span>
          </p>
          <p className="mt-1 text-[14px] text-ink-2">
            OWASP: {state.owaspSelection.length === TESTABLE_OWASP.length ? 'all available categories' : [...state.owaspSelection].sort().join(', ') || 'none selected'}
            {' · '}change in the scan step
          </p>
          <p className="mt-1 text-[15px]">
            {env.safeMode ? 'Safe mode: read-only tests' : env.kind === 'production' ? 'Safe mode off · Production: no write tests' : 'Safe mode off: fixture write tests allowed'}
          </p>
          <button className="link mt-2 text-[13px]" aria-expanded={showChecks} onClick={() => setShowChecks((v) => !v)}>
            {showChecks ? 'Hide checks' : 'Show which checks'}
          </button>
          {showChecks && (
            <ul className="mt-3 divide-y divide-line/70 text-[14px]">
              {plan.map((p) => (
                <li key={p.module} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
                  <span>
                    <span className="font-medium">{MODULE_BY_ID[p.module].name}</span>{' '}
                    <span className="font-mono text-[12px] text-ink-3">{MODULE_BY_ID[p.module].owasp}</span>
                  </span>
                  {p.run ? (
                    <span className="font-medium text-pine-ink">✓ Will run{p.unsafe ? ' (fixture data)' : ''}</span>
                  ) : (
                    <span className="text-ink-2">
                      — {p.reason}
                      {p.needsSecondUser && (
                        <>
                          {' · '}
                          <Link to="/identities?add=1" className="link">
                            Add one
                          </Link>
                        </>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </fieldset>
    </div>
  );
}
