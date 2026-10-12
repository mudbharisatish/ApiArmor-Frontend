import { describe, expect, it } from 'vitest';
import { SEED_ENVIRONMENTS, SEED_IDENTITIES, SHOPLAB_ACCESS, SHOPLAB_REQUESTS } from '@/data/shoplab';
import type { Access, Environment } from '@/types';
import { planChecks, suggestAccess, summarisePlan } from './scanPlan';

const [alice, bob] = SEED_IDENTITIES;
const dev = SEED_ENVIRONMENTS[0];
const prod = SEED_ENVIRONMENTS[1];
const req = (id: string) => SHOPLAB_REQUESTS.find((r) => r.id === id)!;
const plan = (id: string, opts: { access?: Access; env?: Environment; b?: boolean } = {}) =>
  planChecks({
    request: req(id),
    access: opts.access ?? SHOPLAB_ACCESS[id],
    identityA: alice,
    identityB: opts.b === false ? undefined : bob,
    env: opts.env ?? dev,
  });
const reason = (p: ReturnType<typeof plan>, m: string) => p.find((x) => x.module === m)!.reason;

describe('planChecks', () => {
  it('matches the design: Get order by ID, owner only → 4 of 7 run, 3 skipped', () => {
    const p = plan('get-order');
    expect(summarisePlan(p)).toEqual({ run: 4, skipped: 3, total: 7 });
    expect(reason(p, 'a01.bfla')).toBe("Endpoint isn't admin-only");
    expect(reason(p, 'a04.transport')).toBe('TLS skipped on localhost; no cookies');
    expect(reason(p, 'a06.resource')).toBe('No login or page-size parameter');
  });

  it('every skipped check carries a reason', () => {
    for (const r of SHOPLAB_REQUESTS) for (const c of plan(r.id)) if (!c.run) expect(c.reason).toBeTruthy();
  });

  it('access options change the preview (TC-AEP-01)', () => {
    expect(summarisePlan(plan('get-order', { access: 'public' })).run).toBeLessThan(summarisePlan(plan('get-order')).run);
    expect(reason(plan('get-order', { access: 'admin' }), 'a01.bola')).toMatch(/Admin-only/);
  });

  it('skips object-level access without a second user, never passes it (TC-IS-07)', () => {
    const c = plan('get-order', { b: false }).find((x) => x.module === 'a01.bola')!;
    expect(c.run).toBe(false);
    expect(c.needsSecondUser).toBe(true);
  });

  it('safe mode blocks the delete test (TC-ESM-01)', () => {
    expect(reason(plan('delete-user'), 'a01.bfla')).toBe('Needs safe mode off (write test)');
  });

  it('safe mode off allows fixture delete test in Development (TC-ESM-02)', () => {
    const c = plan('delete-user', { env: { ...dev, safeMode: false } }).find((x) => x.module === 'a01.bfla')!;
    expect(c.run).toBe(true);
    expect(c.unsafe).toBe(true);
  });

  it('Production never runs destructive tests, even with safe mode off (TC-ESM-03)', () => {
    expect(reason(plan('delete-user', { env: { ...prod, safeMode: false } }), 'a01.bfla')).toMatch(/Production/);
  });

  it('public endpoint is not tested for object-level access (TC-EAS-04)', () => {
    expect(reason(plan('list-products'), 'a01.bola')).toBe('Endpoint is public');
  });
});

describe('suggestAccess', () => {
  it('suggests owner only for /api/orders/1042 (TC-AEP-02)', () => {
    expect(suggestAccess('GET', 'http://localhost:4000/api/orders/1042')).toBe('owner');
    expect(suggestAccess('DELETE', 'http://localhost:4000/api/admin/users/3')).toBe('admin');
    expect(suggestAccess('POST', 'http://localhost:4000/api/auth/login')).toBe('public');
  });
});

describe('OWASP category selection', () => {
  it('skips checks whose category is not selected, with a reason', () => {
    const p = planChecks({ request: req('get-order'), access: 'owner', identityA: alice, identityB: bob, env: dev, categories: ['A01'] });
    expect(summarisePlan(p).run).toBe(1);
    expect(p.find((x) => x.module === 'a02.misconfig')!.reason).toBe('A02 not selected for this scan');
  });
});
