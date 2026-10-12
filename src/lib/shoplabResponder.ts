import type { Environment, Method, RequestDraft, SendResult } from '@/types';
import { isLocalHost, parseUrl } from './url';
import { resolveVariables } from './variables';

/**
 * Static stand-in for the ShopLab demo API and the request executor.
 * There is no backend: responses come from the fixtures below, and other hosts
 * produce the same kinds of error the real executor reports.
 */

const ORDERS: Record<number, object> = {
  1042: {
    id: 1042,
    ownerId: 'usr_alice',
    status: 'shipped',
    total: 58.2,
    currency: 'GBP',
    items: [{ productId: 7, name: 'Ceramic mug', quantity: 2, price: 12.5 }, { productId: 11, name: 'Tea sampler', quantity: 1, price: 33.2 }],
    shippingAddress: { name: 'Alice Example', line1: '1 Test Street', city: 'London', postcode: 'E1 6AN' },
    createdAt: '2026-10-02T09:14:00Z',
  },
  1043: {
    id: 1043,
    ownerId: 'usr_alice',
    status: 'pending',
    total: 19.99,
    currency: 'GBP',
    items: [{ productId: 3, name: 'Notebook', quantity: 1, price: 19.99 }],
    shippingAddress: { name: 'Alice Example', line1: '1 Test Street', city: 'London', postcode: 'E1 6AN' },
    createdAt: '2026-10-06T16:40:00Z',
  },
  1057: {
    id: 1057,
    ownerId: 'usr_bob',
    status: 'delivered',
    total: 74,
    currency: 'GBP',
    items: [{ productId: 21, name: 'Desk lamp', quantity: 1, price: 74 }],
    shippingAddress: { name: 'Bob Example', line1: '22 Sample Road', city: 'Leeds', postcode: 'LS1 4AP' },
    createdAt: '2026-10-07T11:02:00Z',
  },
};

const USERS: Record<number, object> = {
  1: { id: 1, userId: 'usr_alice', name: 'Alice Example', email: 'alice@shoplab.test', phone: '+44 7700 900123', joined: '2025-03-01' },
  2: { id: 2, userId: 'usr_bob', name: 'Bob Example', email: 'bob@shoplab.test', phone: '+44 7700 900456', joined: '2025-06-12' },
  3: { id: 3, userId: 'usr_admin', name: 'Shop Admin', email: 'admin@shoplab.test', phone: null, joined: '2025-01-01' },
};

const PRODUCT_NAMES = ['Ceramic mug', 'Notebook', 'Tea sampler', 'Desk lamp', 'Canvas tote', 'Pen set', 'Plant pot', 'Water bottle'];

function product(i: number) {
  return {
    id: i,
    name: `${PRODUCT_NAMES[i % PRODUCT_NAMES.length]} ${Math.floor(i / PRODUCT_NAMES.length) + 1}`,
    price: Number((5 + ((i * 7.31) % 80)).toFixed(2)),
    // A planted XSS canary: ApiArmor must always render response bodies as plain text.
    description: i === 4 ? '<script>alert(1)</script> Our best-selling tote.' : 'A ShopLab demo product.',
  };
}

const PRODUCT_COUNT = 10_000;
/** Bodies bigger than this are cut off in the response panel. */
export const RESPONSE_LIMIT_BYTES = 1_000_000;

const BASE_HEADERS: [string, string][] = [
  ['X-Powered-By', 'Express'],
  ['X-ShopLab', 'intentionally-vulnerable'],
  ['Access-Control-Allow-Origin', '*'],
];

interface Reply {
  status: number;
  body: unknown;
  headers?: [string, string][];
  contentType?: string;
}

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  500: 'Internal Server Error',
};

function json(status: number, body: unknown, headers?: [string, string][]): Reply {
  return { status, body, headers };
}

function route(method: Method, path: string, query: URLSearchParams, body: string, sender: string | undefined, authed: boolean): Reply {
  const p = path.replace(/^\/secure/, '');
  const secure = path.startsWith('/secure/');
  const unauth = json(401, { error: 'Unauthorized' });

  if (p === '/api/auth/login' && method === 'POST') {
    let parsed: { email?: string } = {};
    try {
      parsed = JSON.parse(body || '{}');
    } catch {
      return json(400, { error: 'Invalid JSON body' });
    }
    if (!parsed.email) return json(400, { error: 'email and password are required' });
    return json(200, { token: 'eyJhbGciOiJIUzI1NiJ9.•••••.•••••', expiresIn: 900, user: { email: parsed.email } }, [
      ['Set-Cookie', secure ? 'session=•••••; Path=/; Secure; HttpOnly; SameSite=Lax' : 'session=•••••; Path=/'],
    ]);
  }
  if (p === '/api/auth/logout' && method === 'POST') return { status: 204, body: '' };

  if (p === '/api/products' && method === 'GET') {
    const limit = Math.max(1, Number(query.get('limit')) || 20);
    const capped = secure ? Math.min(limit, 100) : Math.min(limit, PRODUCT_COUNT);
    return json(200, { total: PRODUCT_COUNT, limit: capped, items: '__PRODUCTS__' + capped });
  }

  if (!authed) return unauth;

  if (p === '/api/orders' && method === 'GET')
    return json(200, Object.values(ORDERS).filter((o) => (o as { ownerId: string }).ownerId === `usr_${sender}`));
  if (p === '/api/orders' && method === 'POST') {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body || '{}');
    } catch {
      return json(400, { error: 'Invalid JSON body' });
    }
    if (typeof parsed.quantity !== 'number' || typeof parsed.productId !== 'number') {
      if (secure) return json(400, { error: 'Invalid order' });
      return {
        status: 500,
        contentType: 'text/plain',
        body: `TypeError: quantity.toFixed is not a function\n    at createOrder (/app/src/orders.js:41:27)\n    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)\n    at next (/app/node_modules/express/lib/router/route.js:149:13)`,
      };
    }
    return json(201, { id: 1061, ownerId: `usr_${sender}`, status: 'pending', ...parsed });
  }
  const order = p.match(/^\/api\/orders\/(\d+)$/);
  if (order && method === 'GET') {
    const o = ORDERS[Number(order[1])] as { ownerId: string } | undefined;
    if (!o || (secure && o.ownerId !== `usr_${sender}`)) return json(404, { error: 'Order not found' });
    return json(200, o);
  }
  const profile = p.match(/^\/api\/users\/(\d+)\/profile$/);
  if (profile && method === 'GET') {
    const u = USERS[Number(profile[1])];
    return u ? json(200, u) : json(404, { error: 'User not found' });
  }
  if (p === '/api/account' && method === 'GET') {
    const u = Object.values(USERS).find((x) => (x as { userId: string }).userId === `usr_${sender}`);
    return json(200, { ...(u ?? USERS[1]), role: sender === 'admin' ? 'admin' : 'customer' });
  }
  if (p === '/api/exports/orders.csv' && method === 'GET')
    return { status: 200, contentType: 'text/csv', body: 'id,date,total,currency\n1042,2026-10-02,58.20,GBP\n1043,2026-10-06,19.99,GBP\n' };
  if (p === '/api/wallet' && method === 'GET') return json(200, { userId: `usr_${sender}`, balance: 124.5, currency: 'GBP' });
  const del = p.match(/^\/api\/admin\/users\/(\w+)$/);
  if (del && method === 'DELETE') {
    if (secure && sender !== 'admin') return json(403, { error: 'Admin role required' });
    return json(200, { deleted: del[1], note: 'ShopLab data is re-seeded on every start.' });
  }
  if (p === '/api/admin/users' && method === 'GET') return json(200, Object.values(USERS));
  if (p === '/api/debug/config' && method === 'GET' && !secure)
    return json(200, {
      env: 'development',
      port: 4000,
      databaseUrl: 'postgres://shoplab:•••••@db:5432/shoplab',
      jwtSecret: '•••••',
      featureFlags: { newCheckout: true, legacyApi: true },
    });

  const known = ['/api/orders', '/api/account', '/api/wallet', '/api/products'];
  if (known.includes(p)) return json(405, { error: `${method} not allowed` });
  return json(404, { error: 'Not found' });
}

export interface SendInput {
  request: RequestDraft;
  env: Environment;
  /** Name of the identity whose token fills {{token}}. */
  sender?: string;
  senderSignedIn: boolean;
}

/** Simulate sending a request. Resolves after a short, realistic delay. */
export async function simulateSend({ request, env, sender, senderSignedIn }: SendInput): Promise<SendResult> {
  const started = performance.now();
  const resolvedUrl = resolveVariables(request.url, env, sender);
  const url = parseUrl(resolvedUrl);
  const base = { method: request.method, url: resolvedUrl, headers: [] as [string, string][], body: '', sizeBytes: 0 };
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  if (!url.ok) {
    return {
      ...base,
      ok: false,
      timeMs: 0,
      error: { kind: 'invalid', title: url.error ?? 'Invalid URL', nextStep: 'Check the URL, including the http:// or https:// prefix.' },
    };
  }
  if (/\{\{/.test(resolvedUrl)) {
    return {
      ...base,
      ok: false,
      timeMs: 0,
      error: {
        kind: 'invalid',
        title: 'The URL uses a variable this environment doesn’t define',
        nextStep: 'Define it on the Identities and environments page, or switch environment.',
      },
    };
  }
  if (['169.254.169.254', 'metadata.google.internal'].includes(url.hostname)) {
    await wait(40);
    return {
      ...base,
      ok: false,
      timeMs: Math.round(performance.now() - started),
      error: {
        kind: 'blocked',
        title: 'Blocked by ApiArmor policy: cloud metadata address',
        nextStep: 'ApiArmor never sends requests to cloud metadata endpoints.',
      },
    };
  }

  const isShopLab = isLocalHost(url.hostname) && url.port === '4000';
  if (!isShopLab) {
    const local = isLocalHost(url.hostname);
    const privateIp = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname);
    if (local) {
      await wait(30);
      return {
        ...base,
        ok: false,
        timeMs: Math.round(performance.now() - started),
        error: {
          kind: 'refused',
          title: `Connection refused by ${url.host}`,
          nextStep: 'Check the API is running and the port is correct.',
        },
      };
    }
    if (privateIp) {
      await wait(1500);
      return {
        ...base,
        ok: false,
        timeMs: 10_000,
        error: {
          kind: 'timeout',
          title: `Timed out after 10 s waiting for ${url.host}`,
          nextStep: 'Check you are on the same network as the API, and that a firewall isn’t blocking the port.',
        },
      };
    }
    await wait(120);
    return {
      ...base,
      ok: false,
      timeMs: Math.round(performance.now() - started),
      error: {
        kind: 'dns',
        title: `Couldn’t find the host ${url.hostname} (DNS lookup failed)`,
        nextStep: 'Check the hostname for typos. In this static build only ShopLab on localhost:4000 answers.',
      },
    };
  }

  const authHeader = request.headers.find((h) => h.enabled && h.key.toLowerCase() === 'authorization');
  const tokenInUrl = url.query.has('token');
  const authed = senderSignedIn && (Boolean(authHeader?.value.trim().match(/^bearer\s+\S+/i)) || tokenInUrl);
  const body = resolveVariables(request.body, env, sender);
  const reply = route(request.method, url.path, url.query, body, sender, authed);

  let text: string;
  let truncatedNotice: string | undefined;
  let sizeBytes: number;
  const bodyStr = typeof reply.body === 'string' ? reply.body : '';
  if (typeof reply.body === 'object' && reply.body && 'items' in reply.body && String((reply.body as { items: unknown }).items).startsWith('__PRODUCTS__')) {
    const count = Number(String((reply.body as { items: string }).items).replace('__PRODUCTS__', ''));
    const shown = Math.min(count, 200);
    const items = Array.from({ length: shown }, (_, i) => product(i + 1));
    const obj = { ...(reply.body as object), items };
    text = JSON.stringify(obj, null, 2);
    const perItem = text.length / Math.max(shown, 1);
    sizeBytes = Math.round(perItem * count);
    if (count > shown && sizeBytes > RESPONSE_LIMIT_BYTES) {
      truncatedNotice = `Response is ${formatBytes(sizeBytes)} (${count.toLocaleString()} items). Showing the first ${shown} items; bodies over ${formatBytes(RESPONSE_LIMIT_BYTES)} are cut off to keep the page responsive.`;
    } else if (count > shown) {
      text = JSON.stringify({ ...(reply.body as object), items: Array.from({ length: count }, (_, i) => product(i + 1)) }, null, 2);
      sizeBytes = text.length;
    }
  } else {
    text = bodyStr || (reply.status === 204 ? '' : JSON.stringify(reply.body, null, 2));
    sizeBytes = new Blob([text]).size;
  }

  const contentType = reply.contentType ?? 'application/json; charset=utf-8';
  await wait(60 + Math.random() * 90);
  return {
    ...base,
    ok: true,
    status: reply.status,
    statusText: STATUS_TEXT[reply.status] ?? '',
    timeMs: Math.round(performance.now() - started),
    headers: [['Content-Type', contentType], ...BASE_HEADERS, ...(reply.headers ?? []), ['Content-Length', String(sizeBytes)]],
    body: text,
    contentType,
    truncatedNotice,
    sizeBytes,
    sentAs: authed ? sender : undefined,
  };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
