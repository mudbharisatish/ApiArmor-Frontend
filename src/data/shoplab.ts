import type { Access, ApiRequest, Environment, Identity } from '@/types';

/** ShopLab: the bundled practice API with planted flaws. Static data only — no backend. */
export const SHOPLAB_ORIGIN = 'http://localhost:4000';

let hid = 0;
const h = (key: string, value: string, enabled = true) => ({ id: `h${++hid}`, key, value, enabled });
const auth = () => h('Authorization', 'Bearer {{token}}');
const accept = () => h('Accept', 'application/json');

export const SHOPLAB_REQUESTS: ApiRequest[] = [
  {
    id: 'login',
    group: 'Auth',
    name: 'Login',
    method: 'POST',
    url: `${SHOPLAB_ORIGIN}/api/auth/login`,
    headers: [h('Content-Type', 'application/json'), accept()],
    body: '{\n  "email": "alice@shoplab.test",\n  "password": "{{password}}"\n}',
  },
  {
    id: 'list-orders',
    group: 'Orders',
    name: 'List my orders',
    method: 'GET',
    url: `${SHOPLAB_ORIGIN}/api/orders`,
    headers: [auth(), accept()],
    body: '',
  },
  {
    id: 'get-order',
    group: 'Orders',
    name: 'Get order by ID',
    method: 'GET',
    url: `${SHOPLAB_ORIGIN}/api/orders/1042`,
    headers: [auth(), accept()],
    body: '',
  },
  {
    id: 'create-order',
    group: 'Orders',
    name: 'Create order',
    method: 'POST',
    url: `${SHOPLAB_ORIGIN}/api/orders`,
    headers: [auth(), h('Content-Type', 'application/json')],
    body: '{\n  "productId": 7,\n  "quantity": 1\n}',
  },
  {
    id: 'get-profile',
    group: 'Account',
    name: 'Get user profile',
    method: 'GET',
    url: `${SHOPLAB_ORIGIN}/api/users/1/profile`,
    headers: [auth(), accept()],
    body: '',
  },
  {
    id: 'my-account',
    group: 'Account',
    name: 'My account',
    method: 'GET',
    url: `${SHOPLAB_ORIGIN}/api/account`,
    headers: [auth(), accept()],
    body: '',
  },
  {
    id: 'export-orders',
    group: 'Account',
    name: 'Export my orders',
    method: 'GET',
    url: `${SHOPLAB_ORIGIN}/api/exports/orders.csv?token={{token}}`,
    headers: [h('Accept', 'text/csv')],
    body: '',
  },
  {
    id: 'list-products',
    group: 'Products',
    name: 'List products',
    method: 'GET',
    url: `${SHOPLAB_ORIGIN}/api/products?limit=20`,
    headers: [accept()],
    body: '',
  },
  {
    id: 'my-wallet',
    group: 'Wallet',
    name: 'My wallet',
    method: 'GET',
    url: `${SHOPLAB_ORIGIN}/api/wallet`,
    headers: [auth(), accept()],
    body: '',
  },
  {
    id: 'delete-user',
    group: 'Admin',
    name: 'Delete user',
    method: 'DELETE',
    url: `${SHOPLAB_ORIGIN}/api/admin/users/7`,
    headers: [auth(), accept()],
    body: '',
  },
  {
    id: 'debug-config',
    group: 'Ops',
    name: 'Debug config',
    method: 'GET',
    url: `${SHOPLAB_ORIGIN}/api/debug/config`,
    headers: [auth(), accept()],
    body: '',
  },
];

export const GROUP_ORDER = ['Auth', 'Orders', 'Account', 'Products', 'Wallet', 'Admin', 'Ops', 'Imported'];

/** Access expectations the demo collection ships with. */
export const SHOPLAB_ACCESS: Record<string, Access> = {
  login: 'public',
  'list-orders': 'authenticated',
  'get-order': 'owner',
  'create-order': 'authenticated',
  'get-profile': 'owner',
  'my-account': 'authenticated',
  'export-orders': 'authenticated',
  'list-products': 'public',
  'my-wallet': 'authenticated',
  'delete-user': 'admin',
  'debug-config': 'admin',
};

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

export const SEED_IDENTITIES: Identity[] = [
  {
    id: 'alice',
    name: 'alice',
    slot: 'A',
    method: 'login',
    loginRequestId: 'login',
    tokenPath: '$.token',
    headerName: 'X-API-Key',
    hasSecret: true,
    secretValid: true,
    status: 'signed-in',
    isAdmin: false,
  },
  {
    id: 'bob',
    name: 'bob',
    slot: 'B',
    method: 'login',
    loginRequestId: 'login',
    tokenPath: '$.token',
    headerName: 'X-API-Key',
    hasSecret: true,
    secretValid: true,
    status: 'signed-in',
    isAdmin: false,
  },
  {
    id: 'admin',
    name: 'admin',
    slot: 'admin',
    method: 'bearer',
    loginRequestId: 'login',
    tokenPath: '$.token',
    headerName: 'X-API-Key',
    hasSecret: true,
    secretValid: true,
    status: 'signed-in',
    tokenExpiresAt: inDays(2),
    isAdmin: true,
  },
];

export const SEED_ENVIRONMENTS: Environment[] = [
  {
    id: 'shoplab',
    name: 'ShopLab (local)',
    kind: 'development',
    baseUrl: SHOPLAB_ORIGIN,
    safeMode: true,
    variables: [
      { key: 'baseUrl', value: SHOPLAB_ORIGIN, secret: false },
      { key: 'token', value: '(from the signed-in identity)', secret: true },
      { key: 'password', value: '(from the identity)', secret: true },
    ],
  },
  {
    id: 'staging',
    name: 'My API (staging)',
    kind: 'production',
    baseUrl: 'http://192.168.1.20:8080',
    safeMode: true,
    variables: [
      { key: 'baseUrl', value: 'http://192.168.1.20:8080', secret: false },
      { key: 'token', value: '(from the signed-in identity)', secret: true },
    ],
  },
];

/** A ready-made command for the "Use a sample command" link on Home. */
export const SAMPLE_CURL = `curl -X GET 'http://localhost:4000/api/users/2/profile' \\
  -H 'Accept: application/json' \\
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.sample'`;
