import { MODULES } from '@/data/taxonomy';
import type { Access, Environment, Identity, ModuleId, OwaspId, RequestDraft, ScanProfile } from '@/types';
import { hasObjectId, isLocalHost, parseUrl } from './url';

export interface PlanContext {
  request: RequestDraft;
  access: Access;
  identityA?: Identity;
  identityB?: Identity;
  env: Environment;
  profile?: ScanProfile;
  /** OWASP categories chosen for this scan. Omitted means all. */
  categories?: OwaspId[];
}

export interface PlannedCheck {
  module: ModuleId;
  run: boolean;
  /** Why the check is skipped. Skipped checks always carry a reason. */
  reason?: string;
  /** True when the reason is a missing second test user. */
  needsSecondUser?: boolean;
  /** Write probes against fixture data. */
  unsafe?: boolean;
}

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const PAGE_PARAMS = ['limit', 'pageSize', 'page_size', 'per_page', 'size'];

export function hasCredentials(req: RequestDraft): boolean {
  const authHeader = req.headers.some(
    (h) => h.enabled && ['authorization', 'cookie', 'x-api-key'].includes(h.key.trim().toLowerCase()),
  );
  const { query } = parseUrl(req.url);
  return authHeader || ['token', 'access_token', 'api_key'].some((k) => query.has(k));
}

export function isLoginPath(path: string): boolean {
  return /\/(auth\/)?(login|signin|sign-in|password-reset|reset-password|otp|signup|register)(\/|$)/i.test(path);
}

/** Work out which of the seven MVP checks will run for a request, and why the others are skipped. */
export function planChecks(ctx: PlanContext): PlannedCheck[] {
  const { request: req, access, identityB, env } = ctx;
  const url = parseUrl(req.url);
  const path = url.path;
  const isWrite = WRITE_METHODS.includes(req.method);
  const production = env.kind === 'production';
  const creds = hasCredentials(req);
  const local = isLocalHost(url.hostname);
  const passiveOnly = ctx.profile === 'passive';

  const writeGuard = (): string | undefined => {
    if (!isWrite) return undefined;
    if (production) return 'Production environment: write tests never run';
    if (env.safeMode) return 'Needs safe mode off (write test)';
    return undefined;
  };

  const plan: PlannedCheck[] = MODULES.map(({ id, passive, owasp }) => {
    if (ctx.categories && !ctx.categories.includes(owasp))
      return { module: id, run: false, reason: `${owasp} not selected for this scan` };
    if (passiveOnly && !passive) return { module: id, run: false, reason: 'Passive-only scan profile' };

    switch (id) {
      case 'a01.bola': {
        if (access === 'public') return { module: id, run: false, reason: 'Endpoint is public' };
        if (access === 'admin') return { module: id, run: false, reason: 'Admin-only; covered by function-level' };
        if (!hasObjectId(path)) return { module: id, run: false, reason: 'No object ID in the request' };
        if (!identityB) return { module: id, run: false, reason: 'No second test user', needsSecondUser: true };
        const guard = writeGuard();
        if (guard) return { module: id, run: false, reason: guard };
        return { module: id, run: true, unsafe: isWrite };
      }
      case 'a01.bfla': {
        const adminish =
          access === 'admin' || /\/(admin|internal|manage|debug)(\/|$)/i.test(path) || req.method === 'DELETE';
        if (!adminish) return { module: id, run: false, reason: "Endpoint isn't admin-only" };
        if (!identityB) return { module: id, run: false, reason: 'No second test user', needsSecondUser: true };
        const guard = writeGuard();
        if (guard) return { module: id, run: false, reason: guard };
        return { module: id, run: true, unsafe: isWrite };
      }
      case 'a02.misconfig':
        return { module: id, run: true };
      case 'a04.transport': {
        const cookies = isLoginPath(path) || req.headers.some((h) => h.enabled && h.key.toLowerCase() === 'cookie');
        if (!local) return { module: id, run: true };
        if (!cookies) return { module: id, run: false, reason: 'TLS skipped on localhost; no cookies' };
        return { module: id, run: true };
      }
      case 'a06.resource': {
        const login = isLoginPath(path);
        const paged = PAGE_PARAMS.some((p) => url.query.has(p));
        if (!login && !paged) return { module: id, run: false, reason: 'No login or page-size parameter' };
        if (production) return { module: id, run: false, reason: 'Production environment: burst tests are off' };
        return { module: id, run: true };
      }
      case 'a07.auth': {
        if (access === 'public') return { module: id, run: false, reason: 'Endpoint is public' };
        if (!creds) return { module: id, run: false, reason: "Request doesn't send credentials" };
        return { module: id, run: true };
      }
      case 'a10.exceptions': {
        const hasInput = req.body.trim().length > 0 || [...url.query.keys()].length > 0 || creds;
        if (!hasInput) return { module: id, run: false, reason: 'No body, query or auth header' };
        return { module: id, run: true };
      }
    }
  });
  return plan;
}

export function summarisePlan(plan: PlannedCheck[]) {
  const run = plan.filter((p) => p.run).length;
  return { run, skipped: plan.length - run, total: plan.length };
}

/** Suggest who should be able to use an endpoint from its path and method. */
export function suggestAccess(method: string, rawUrl: string): Access {
  const { path } = parseUrl(rawUrl);
  if (/\/(admin|internal|manage|debug)(\/|$)/i.test(path)) return 'admin';
  if (isLoginPath(path) || /\/(products|health|status|public)(\/|$)/i.test(path)) return 'public';
  if (hasObjectId(path)) return 'owner';
  if (method === 'DELETE') return 'admin';
  return 'authenticated';
}
