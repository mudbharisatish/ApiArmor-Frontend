import type { Finding, FindingState } from '@/types';

/**
 * The thirteen planted ShopLab flaws (D-01 … D-13), as ApiArmor reports them.
 * Lines in evidence starting with "- " / "+ " mark the only difference between baseline and attack.
 * Tokens and secrets are always redacted as •••••.
 */
export const FINDINGS: Finding[] = [
  {
    id: 'D-01',
    title: 'Another signed-in user can read any order',
    severity: 'critical',
    module: 'a01.bola',
    owasp: 'A01',
    api: 'API1',
    cwe: 'CWE-639',
    method: 'GET',
    endpoint: '/api/orders/{id}',
    requestIds: ['get-order'],
    evidence: {
      intro:
        "ApiArmor asked for order 1042 as its owner, alice, then sent the same request as bob. Only the token changed. Bob received the same order, including Alice's shipping address.",
      baseline: {
        label: 'Baseline · sent as alice (owner)',
        meta: '200 OK · 81 ms',
        lines: [
          'GET /api/orders/1042',
          '- Authorization: Bearer ••••• (alice)',
          '',
          '{',
          '  "id": 1042,',
          '  "ownerId": "usr_alice",',
          '  "shippingAddress": { "name": "Alice Example", … }',
          '}',
        ],
      },
      attack: {
        label: 'Attack · sent as bob',
        meta: '200 OK · same object',
        lines: [
          'GET /api/orders/1042',
          '+ Authorization: Bearer ••••• (bob)',
          '',
          '{',
          '  "id": 1042,',
          '  "ownerId": "usr_alice",',
          '  "shippingAddress": { "name": "Alice Example", … }',
          '}',
        ],
      },
    },
    explanation: {
      what: 'The endpoint returns an order to any signed-in user who asks for its ID. It checks that a token is present, but never checks that the order belongs to the person asking.',
      why: 'Order IDs are sequential, so anyone with an account can walk through every order in the shop and read other customers’ names, addresses and purchases. This is the most common serious API flaw (Broken Object Level Authorization).',
      fix: 'Look the order up by both its ID and the signed-in user’s ID. Return 404 (not 403) when it doesn’t belong to them, so attackers can’t tell which IDs exist.',
      code: `// Before
const order = await db.orders.findById(req.params.id);

// After: scope every lookup to the signed-in user
const order = await db.orders.findOne({
  id: req.params.id,
  ownerId: req.user.id,
});
if (!order) return res.status(404).json({ error: 'Order not found' });`,
      codeLang: 'ts',
    },
    attackCurl: `curl 'http://localhost:4000/api/orders/1042' -H 'Authorization: Bearer •••••' -H 'Accept: application/json'`,
  },
  {
    id: 'D-05',
    title: 'Debug endpoint exposes configuration',
    severity: 'critical',
    module: 'a02.misconfig',
    owasp: 'A02',
    api: 'API8',
    cwe: 'CWE-16',
    method: 'GET',
    endpoint: '/api/debug/config',
    requestIds: ['debug-config'],
    evidence: {
      intro:
        'ApiArmor probed a short list of well-known debug paths without credentials. /api/debug/config answered with the server’s configuration, including secret names and a database URL. It isn’t documented in the collection as a public endpoint.',
      baseline: {
        label: 'Expected · a hidden route',
        meta: '404 Not Found',
        lines: ['GET /api/debug/config', '- (no credentials)', '', '{ "error": "Not found" }'],
      },
      attack: {
        label: 'Probe · sent with no credentials',
        meta: '200 OK · 1.2 KB',
        lines: [
          'GET /api/debug/config',
          '+ (no credentials)',
          '',
          '{',
          '  "env": "development",',
          '  "databaseUrl": "postgres://shoplab:•••••@db:5432",',
          '  "jwtSecret": "•••••",',
          '  "featureFlags": { … }',
          '}',
        ],
      },
    },
    explanation: {
      what: 'A debug route that prints the app’s configuration is enabled and reachable by anyone.',
      why: 'Configuration often includes database credentials and signing secrets. With the JWT secret an attacker can forge a token for any user, including admins.',
      fix: 'Remove debug routes from production builds, or register them only when an explicit development flag is set and the request comes from localhost.',
      code: `if (process.env.NODE_ENV === 'development' && process.env.ENABLE_DEBUG === '1') {
  app.get('/api/debug/config', localhostOnly, debugConfig);
}`,
      codeLang: 'ts',
    },
    attackCurl: `curl 'http://localhost:4000/api/debug/config'`,
  },
  {
    id: 'D-10',
    title: 'Unsigned tokens are accepted',
    severity: 'critical',
    module: 'a07.auth',
    owasp: 'A07',
    api: 'API2',
    cwe: 'CWE-347',
    method: 'GET',
    endpoint: '/api/account',
    requestIds: ['my-account'],
    evidence: {
      intro:
        'ApiArmor took alice’s token, set the header to {"alg":"none"} and removed the signature. The API accepted it and returned alice’s account. Anyone can now write a token for any user.',
      baseline: {
        label: 'Baseline · signed token (alice)',
        meta: '200 OK · 64 ms',
        lines: [
          'GET /api/account',
          '- Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.•••••.•••••',
          '',
          '{ "id": "usr_alice", "email": "alice@shoplab.test", … }',
        ],
      },
      attack: {
        label: 'Attack · alg: none, no signature',
        meta: '200 OK · same data',
        lines: [
          'GET /api/account',
          '+ Authorization: Bearer eyJhbGciOiJub25lIn0.•••••.',
          '',
          '{ "id": "usr_alice", "email": "alice@shoplab.test", … }',
        ],
      },
    },
    explanation: {
      what: 'The token check trusts the algorithm named inside the token. A token that says "alg: none" skips signature verification entirely.',
      why: 'An attacker can change the user ID in the token, remove the signature and act as anyone, including an admin. No password needed.',
      fix: 'Pin the algorithms you accept when verifying, and reject anything else. Never let the token choose.',
      code: `// Before
jwt.verify(token, secret);

// After
jwt.verify(token, secret, { algorithms: ['HS256'] });`,
      codeLang: 'ts',
    },
    attackCurl: `curl 'http://localhost:4000/api/account' -H 'Authorization: Bearer eyJhbGciOiJub25lIn0.•••••.'`,
  },
  {
    id: 'D-02',
    title: "Another user's profile is readable",
    severity: 'high',
    module: 'a01.bola',
    owasp: 'A01',
    api: 'API1',
    cwe: 'CWE-639',
    method: 'GET',
    endpoint: '/api/users/{id}/profile',
    requestIds: ['get-profile'],
    evidence: {
      intro: 'ApiArmor read profile 1 as its owner, alice, then repeated the request as bob. Bob got Alice’s profile.',
      baseline: {
        label: 'Baseline · sent as alice (owner)',
        meta: '200 OK · 58 ms',
        lines: [
          'GET /api/users/1/profile',
          '- Authorization: Bearer ••••• (alice)',
          '',
          '{ "id": 1, "name": "Alice Example", "phone": "+44 7700 900123" }',
        ],
      },
      attack: {
        label: 'Attack · sent as bob',
        meta: '200 OK · same object',
        lines: [
          'GET /api/users/1/profile',
          '+ Authorization: Bearer ••••• (bob)',
          '',
          '{ "id": 1, "name": "Alice Example", "phone": "+44 7700 900123" }',
        ],
      },
    },
    explanation: {
      what: 'Profiles are returned by ID without checking who is asking.',
      why: 'Anyone with an account can collect every customer’s name and phone number.',
      fix: 'Only return the full profile to its owner. If other users need to see something, return a public subset from a separate endpoint.',
      code: `if (req.params.id !== req.user.id) {
  return res.status(404).json({ error: 'Not found' });
}`,
      codeLang: 'ts',
    },
    attackCurl: `curl 'http://localhost:4000/api/users/1/profile' -H 'Authorization: Bearer •••••'`,
  },
  {
    id: 'D-03',
    title: 'Non-admin can delete users',
    severity: 'high',
    module: 'a01.bfla',
    owasp: 'A01',
    api: 'API5',
    cwe: 'CWE-285',
    method: 'DELETE',
    endpoint: '/api/admin/users/{id}',
    requestIds: ['delete-user'],
    destructive: true,
    evidence: {
      intro:
        'With safe mode off, ApiArmor created a throwaway test user, then asked bob (not an admin) to delete it. The delete succeeded. No existing data was touched.',
      baseline: {
        label: 'Baseline · sent as admin',
        meta: '204 No Content',
        lines: ['DELETE /api/admin/users/usr_fixture_1', '- Authorization: Bearer ••••• (admin)', '', '(empty body)'],
      },
      attack: {
        label: 'Attack · sent as bob',
        meta: '204 No Content · deleted',
        lines: [
          'DELETE /api/admin/users/usr_fixture_2',
          '+ Authorization: Bearer ••••• (bob)',
          '',
          '(empty body)',
          '',
          'GET /api/admin/users/usr_fixture_2 → 404 (it is gone)',
        ],
      },
      note: 'Fixture users are created by ApiArmor for this test and deleted only by it.',
    },
    explanation: {
      what: 'The admin route checks that a user is signed in, but not that they are an admin.',
      why: 'Any customer can delete any account, including other admins.',
      fix: 'Check the role on every admin route, ideally with one shared guard applied to the whole /admin router.',
      code: `adminRouter.use(requireRole('admin'));
adminRouter.delete('/users/:id', deleteUser);`,
      codeLang: 'ts',
    },
    attackCurl: `curl -X DELETE 'http://localhost:4000/api/admin/users/usr_fixture_2' -H 'Authorization: Bearer •••••'`,
  },
  {
    id: 'D-08',
    title: 'No limit on failed logins',
    severity: 'high',
    module: 'a06.resource',
    owasp: 'A06',
    api: 'API4',
    cwe: 'CWE-307',
    method: 'POST',
    endpoint: '/api/auth/login',
    requestIds: ['login'],
    evidence: {
      intro:
        'ApiArmor sent 30 wrong-password logins for the dedicated lockout-test account in 10 seconds. Every one got a normal 401; none were slowed, blocked or locked out.',
      baseline: {
        label: 'Expected · after 5 failures',
        meta: '429 Too Many Requests',
        lines: ['POST /api/auth/login  ×6', '- { "email": "lockout-test@shoplab.test", … }', '', 'Retry-After: 60'],
      },
      attack: {
        label: 'Burst · 30 requests in 10 s',
        meta: '30 × 401 · no limit',
        lines: [
          'POST /api/auth/login  ×30',
          '+ { "email": "lockout-test@shoplab.test", "password": "•••••" }',
          '',
          '401 Unauthorized  (30 of 30)',
          'No 429, no Retry-After, no lockout',
        ],
      },
      note: 'Only the dedicated lockout-test account is used for burst tests.',
    },
    explanation: {
      what: 'The login endpoint accepts unlimited password guesses.',
      why: 'Attackers can try leaked password lists against every account until one works (credential stuffing).',
      fix: 'Rate-limit login by IP and by account, and lock or slow down an account after repeated failures.',
      code: `app.post('/api/auth/login',
  rateLimit({ windowMs: 60_000, limit: 5, keyGenerator: (req) => req.body.email }),
  login);`,
      codeLang: 'ts',
    },
    attackCurl: `curl -X POST 'http://localhost:4000/api/auth/login' -H 'Content-Type: application/json' -d '{"email":"lockout-test@shoplab.test","password":"•••••"}'`,
  },
  {
    id: 'D-13',
    title: 'Malformed auth header lets requests through',
    severity: 'high',
    module: 'a10.exceptions',
    owasp: 'A10',
    api: 'API8',
    cwe: 'CWE-636',
    method: 'GET',
    endpoint: '/api/wallet',
    requestIds: ['my-wallet'],
    evidence: {
      intro:
        'ApiArmor sent "Authorization: Bearer" with no token. The auth middleware threw, the error was swallowed, and the request reached the wallet handler, which returned a balance. The check failed open.',
      baseline: {
        label: 'Baseline · valid token (alice)',
        meta: '200 OK · 49 ms',
        lines: ['GET /api/wallet', '- Authorization: Bearer ••••• (alice)', '', '{ "balance": 124.50, "currency": "GBP" }'],
      },
      attack: {
        label: 'Attack · malformed header',
        meta: '200 OK · real data',
        lines: ['GET /api/wallet', '+ Authorization: Bearer', '', '{ "balance": 0, "currency": "GBP", "userId": null }'],
      },
    },
    explanation: {
      what: 'When the auth header can’t be parsed, the middleware calls next() instead of rejecting the request.',
      why: 'Any error in the auth check becomes a way in. Attackers deliberately send broken headers to find these paths.',
      fix: 'Fail closed: any error while checking credentials must end the request with 401.',
      code: `try {
  req.user = verify(parseBearer(req.headers.authorization));
  next();
} catch {
  res.status(401).json({ error: 'Unauthorized' }); // never next()
}`,
      codeLang: 'ts',
    },
    attackCurl: `curl 'http://localhost:4000/api/wallet' -H 'Authorization: Bearer'`,
  },
  {
    id: 'D-04',
    title: 'CORS allows any website with credentials',
    severity: 'medium',
    module: 'a02.misconfig',
    owasp: 'A02',
    api: 'API8',
    cwe: 'CWE-942',
    method: 'ALL',
    endpoint: '/api routes',
    requestIds: ['*'],
    evidence: {
      intro:
        'ApiArmor resent the request with Origin: https://evil.example. The API echoed that origin back and allowed credentials, so any website a signed-in user visits can read their data.',
      baseline: {
        label: 'Baseline · no Origin header',
        meta: '200 OK',
        lines: ['GET /api/orders/1042', '- (no Origin)', '', 'Access-Control-Allow-Origin: (not set)'],
      },
      attack: {
        label: 'Probe · hostile origin',
        meta: '200 OK · origin reflected',
        lines: [
          'GET /api/orders/1042',
          '+ Origin: https://evil.example',
          '',
          'Access-Control-Allow-Origin: https://evil.example',
          'Access-Control-Allow-Credentials: true',
        ],
      },
      note: 'Grouped per host: one finding covers every /api route.',
    },
    explanation: {
      what: 'The CORS setup copies whatever Origin the browser sends into Access-Control-Allow-Origin, and allows cookies.',
      why: 'A malicious site can make a victim’s browser call your API with their session and read the responses.',
      fix: 'Use an explicit allowlist of your own front-end origins.',
      code: `app.use(cors({
  origin: ['https://shop.example.com'],
  credentials: true,
}));`,
      codeLang: 'ts',
    },
    attackCurl: `curl 'http://localhost:4000/api/orders/1042' -H 'Origin: https://evil.example' -H 'Authorization: Bearer •••••' -i`,
  },
  {
    id: 'D-07',
    title: 'Session cookie missing HttpOnly and SameSite',
    severity: 'medium',
    module: 'a04.transport',
    owasp: 'A04',
    api: 'API8',
    cwe: 'CWE-614',
    method: 'POST',
    endpoint: '/api/auth/login',
    requestIds: ['login'],
    evidence: {
      intro: 'The login response sets a session cookie without the HttpOnly and SameSite flags.',
      baseline: {
        label: 'Expected cookie',
        meta: 'Secure; HttpOnly; SameSite',
        lines: ['Set-Cookie: session=•••••;', '- Path=/; Secure; HttpOnly; SameSite=Lax'],
      },
      attack: {
        label: 'Observed cookie',
        meta: 'flags missing',
        lines: ['Set-Cookie: session=•••••;', '+ Path=/'],
      },
      note: 'Secure is not checked on localhost, where HTTPS is often absent by design.',
    },
    explanation: {
      what: 'The session cookie can be read by page scripts and is sent on cross-site requests.',
      why: 'Any XSS bug becomes account takeover, and cross-site request forgery is easier.',
      fix: 'Set HttpOnly, SameSite and (outside localhost) Secure on every session cookie.',
      code: `res.cookie('session', token, {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
});`,
      codeLang: 'ts',
    },
    attackCurl: `curl -X POST 'http://localhost:4000/api/auth/login' -H 'Content-Type: application/json' -d '{"email":"alice@shoplab.test","password":"•••••"}' -i`,
  },
  {
    id: 'D-09',
    title: 'Page size has no upper limit',
    severity: 'medium',
    module: 'a06.resource',
    owasp: 'A06',
    api: 'API4',
    cwe: 'CWE-770',
    method: 'GET',
    endpoint: '/api/products?limit=',
    requestIds: ['list-products'],
    evidence: {
      intro: 'ApiArmor raised limit from 20 to 10000. The API returned every product it had in one response, with no cap.',
      baseline: {
        label: 'Baseline · limit=20',
        meta: '200 OK · 4 KB',
        lines: ['GET /api/products', '- ?limit=20', '', '[ … 20 items … ]'],
      },
      attack: {
        label: 'Probe · limit=10000',
        meta: '200 OK · 1.9 MB',
        lines: ['GET /api/products', '+ ?limit=10000', '', '[ … 10000 items … ]', 'No cap applied (expected ≤ 100)'],
      },
    },
    explanation: {
      what: 'The page-size parameter is passed straight to the database query.',
      why: 'One request can make the server load and serialise the whole table. A few in parallel can take the API down.',
      fix: 'Clamp the page size to a sensible maximum.',
      code: `const limit = Math.min(Number(req.query.limit) || 20, 100);`,
      codeLang: 'ts',
    },
    attackCurl: `curl 'http://localhost:4000/api/products?limit=10000'`,
  },
  {
    id: 'D-12',
    title: 'Wrong field types cause a 500 with a stack trace',
    severity: 'medium',
    module: 'a10.exceptions',
    owasp: 'A10',
    api: 'API8',
    cwe: 'CWE-209',
    method: 'POST',
    endpoint: '/api/orders',
    requestIds: ['create-order'],
    evidence: {
      intro: 'ApiArmor sent quantity as an array instead of a number. The server crashed with a 500 and returned its stack trace.',
      baseline: {
        label: 'Baseline · valid body',
        meta: '201 Created',
        lines: ['POST /api/orders', '- { "productId": 7, "quantity": 1 }', '', '{ "id": 1061, "status": "pending" }'],
      },
      attack: {
        label: 'Probe · type swap',
        meta: '500 · stack trace',
        lines: [
          'POST /api/orders',
          '+ { "productId": 7, "quantity": [1] }',
          '',
          'TypeError: quantity.toFixed is not a function',
          '    at createOrder (/app/src/orders.js:41:27)',
          '    at Layer.handle (/app/node_modules/express/…)',
        ],
      },
    },
    explanation: {
      what: 'Input isn’t validated, so bad types reach the business logic and crash it. The default error handler then prints the stack trace.',
      why: 'Stack traces reveal file paths, libraries and versions, which helps attackers plan targeted exploits.',
      fix: 'Validate request bodies with a schema and return a generic 400. Hide stack traces outside development.',
      code: `const CreateOrder = z.object({
  productId: z.number().int(),
  quantity: z.number().int().min(1).max(50),
});
const parsed = CreateOrder.safeParse(req.body);
if (!parsed.success) return res.status(400).json({ error: 'Invalid order' });`,
      codeLang: 'ts',
    },
    attackCurl: `curl -X POST 'http://localhost:4000/api/orders' -H 'Authorization: Bearer •••••' -H 'Content-Type: application/json' -d '{"productId":7,"quantity":[1]}'`,
  },
  {
    id: 'D-06',
    title: 'Framework revealed; nosniff header missing',
    severity: 'low',
    module: 'a02.misconfig',
    owasp: 'A02',
    api: 'API8',
    cwe: 'CWE-16',
    method: 'ALL',
    endpoint: '/api routes',
    requestIds: ['*'],
    evidence: {
      intro: 'Every /api response announces the framework and omits X-Content-Type-Options.',
      baseline: {
        label: 'Expected headers',
        meta: 'hardened',
        lines: ['- X-Content-Type-Options: nosniff', '- (no X-Powered-By)'],
      },
      attack: {
        label: 'Observed headers',
        meta: 'on all /api routes',
        lines: ['+ X-Powered-By: Express', '+ (X-Content-Type-Options missing)'],
      },
      note: 'Grouped per host: one finding covers every /api route.',
    },
    explanation: {
      what: 'Responses reveal the server framework and let browsers guess content types.',
      why: 'Version banners help attackers pick known exploits; MIME sniffing can turn uploaded files into scripts.',
      fix: 'Disable the X-Powered-By header and send nosniff. Helmet does both.',
      code: `app.disable('x-powered-by');
app.use(helmet());`,
      codeLang: 'ts',
    },
    attackCurl: `curl 'http://localhost:4000/api/products' -I`,
  },
  {
    id: 'D-11',
    title: 'Session token accepted in the URL',
    severity: 'low',
    module: 'a07.auth',
    owasp: 'A07',
    api: 'API2',
    cwe: 'CWE-598',
    method: 'GET',
    endpoint: '/api/exports/orders.csv',
    requestIds: ['export-orders'],
    evidence: {
      intro: 'The export link carries the session token as a query parameter, and the API accepts it there.',
      baseline: {
        label: 'Expected · token in a header',
        meta: '200 OK',
        lines: ['GET /api/exports/orders.csv', '- Authorization: Bearer •••••'],
      },
      attack: {
        label: 'Observed · token in the URL',
        meta: '200 OK · CSV returned',
        lines: ['+ GET /api/exports/orders.csv?token=•••••', '', 'id,date,total', '1042,2026-10-02,58.20'],
      },
    },
    explanation: {
      what: 'The endpoint reads the session token from the query string.',
      why: 'URLs end up in browser history, proxy logs and Referer headers, so the token leaks.',
      fix: 'Accept tokens only in the Authorization header. For download links, issue a short-lived, single-use signed URL.',
      code: `const url = signDownloadUrl('/exports/orders.csv', { userId, expiresIn: 60 });`,
      codeLang: 'ts',
    },
    attackCurl: `curl 'http://localhost:4000/api/exports/orders.csv?token=•••••'`,
  },
];

export const FINDING_BY_ID = Object.fromEntries(FINDINGS.map((f) => [f.id, f])) as Record<string, Finding>;

/** Findings a scan of the given request and module reports (before simulated fixes). */
export function findingsFor(requestId: string, path: string, module: string): Finding[] {
  return FINDINGS.filter((f) => {
    if (f.module !== module) return false;
    if (f.requestIds.includes('*')) return path.startsWith('/api/');
    return f.requestIds.includes(requestId);
  });
}

const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

/** Initial triage state: the last full scan ran 45 minutes ago. */
export function seedFindingStates(): Record<string, FindingState> {
  const lastScan = ago(45);
  const out: Record<string, FindingState> = {};
  for (const f of FINDINGS) {
    out[f.id] = {
      status: 'open',
      firstSeen: ago(60 * 24 * 3),
      lastSeen: lastScan,
      history: [
        { at: ago(60 * 24 * 3), text: 'First seen in a full collection scan' },
        { at: lastScan, text: 'Seen again in a full collection scan' },
      ],
      simulatedFixed: false,
    };
  }
  out['D-01'] = {
    status: 'new',
    firstSeen: lastScan,
    lastSeen: lastScan,
    history: [{ at: lastScan, text: 'First seen in a full collection scan' }],
    simulatedFixed: false,
  };
  out['D-10'] = {
    status: 'came-back',
    firstSeen: ago(60 * 24 * 3),
    lastSeen: lastScan,
    history: [
      { at: ago(60 * 24 * 3), text: 'First seen in a full collection scan' },
      { at: ago(60 * 24 * 2), text: 'Marked Fixed' },
      { at: lastScan, text: 'Came back: found again by a later scan after being marked Fixed' },
    ],
    simulatedFixed: false,
  };
  return out;
}

export const LAST_FULL_SCAN_MINUTES_AGO = 45;
