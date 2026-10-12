export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export const METHODS: Method[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/** Who should be able to use an endpoint. ApiArmor judges access-control tests against this. */
export type Access = 'public' | 'authenticated' | 'owner' | 'admin';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type ModuleId =
  | 'a01.bola'
  | 'a01.bfla'
  | 'a02.misconfig'
  | 'a04.transport'
  | 'a06.resource'
  | 'a07.auth'
  | 'a10.exceptions';

export type OwaspId = 'A01' | 'A02' | 'A03' | 'A04' | 'A05' | 'A06' | 'A07' | 'A08' | 'A09' | 'A10';

export interface Header {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface ApiRequest {
  id: string;
  group: string;
  name: string;
  method: Method;
  url: string;
  headers: Header[];
  body: string;
  imported?: boolean;
}

/** Fields of a request the editor can change (and keep as an unsaved draft). */
export type RequestDraft = Pick<ApiRequest, 'method' | 'url' | 'headers' | 'body'>;

export type FindingStatus =
  | 'new'
  | 'open'
  | 'came-back'
  | 'fixed'
  | 'verified'
  | 'false-positive'
  | 'accepted-risk';

export interface HistoryEntry {
  at: string;
  text: string;
  reason?: string;
}

export interface EvidencePanel {
  label: string;
  meta: string;
  lines: string[];
}

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  module: ModuleId;
  owasp: OwaspId;
  api: string;
  cwe: string;
  method: Method | 'ALL';
  endpoint: string;
  /** Requests in the ShopLab collection whose scan reports this finding. */
  requestIds: string[];
  evidence: {
    intro: string;
    baseline: EvidencePanel;
    attack: EvidencePanel;
    note?: string;
  };
  explanation: {
    what: string;
    why: string;
    fix: string;
    code: string;
    codeLang: string;
  };
  /** Request that reproduces the attack, used by Copy as cURL. Secrets are redacted. */
  attackCurl: string;
  /** True when replaying would change or delete data. */
  destructive?: boolean;
}

export interface FindingState {
  status: FindingStatus;
  firstSeen: string;
  lastSeen: string;
  history: HistoryEntry[];
  /** The static ShopLab treats this flaw as fixed once the user marks it Fixed. */
  simulatedFixed: boolean;
  verifiedAt?: string;
}

export type SignInMethod = 'login' | 'bearer' | 'apikey';

export interface Identity {
  id: string;
  name: string;
  slot: 'A' | 'B' | 'admin' | 'none';
  method: SignInMethod;
  loginRequestId: string;
  tokenPath: string;
  headerName: string;
  /** Secrets never live in the frontend. We only remember that one was saved and whether it looked valid. */
  hasSecret: boolean;
  secretValid: boolean;
  status: 'signed-in' | 'signed-out' | 'failed';
  tokenExpiresAt?: string;
  isAdmin: boolean;
}

export interface EnvVariable {
  key: string;
  value: string;
  secret: boolean;
}

export interface Environment {
  id: string;
  name: string;
  kind: 'development' | 'production';
  baseUrl: string;
  safeMode: boolean;
  variables: EnvVariable[];
}

export type CheckStatus = 'waiting' | 'running' | 'done' | 'skipped' | 'not-run' | 'inconclusive';

/** One module run against one request. */
export interface ScanUnit {
  requestId: string;
  module: ModuleId;
  status: CheckStatus;
  reason?: string;
  probesDone: number;
  probesTotal: number;
  findingIds: string[];
  note?: string;
}

export type ScanState = 'running' | 'finished' | 'cancelled' | 'partial' | 'interrupted';

export interface ScanRecord {
  id: string;
  kind: 'request' | 'collection' | 'rescan';
  title: string;
  method?: Method;
  path?: string;
  requestIds: string[];
  envId: string;
  safeMode: boolean;
  profile: ScanProfile;
  /** OWASP categories this scan covered. */
  categories?: OwaspId[];
  startedAt: string;
  finishedAt?: string;
  state: ScanState;
  units: ScanUnit[];
  foundFindingIds: string[];
}

export type ScanProfile = 'default' | 'passive';

export interface ScanSettings {
  rateLimit: number;
  burstSize: number;
  timeoutMs: number;
  idPatterns: string;
}

export interface SendResult {
  ok: boolean;
  status?: number;
  statusText?: string;
  timeMs: number;
  headers: [string, string][];
  body: string;
  contentType?: string;
  truncatedNotice?: string;
  error?: { kind: 'refused' | 'dns' | 'timeout' | 'tls' | 'blocked' | 'invalid'; title: string; nextStep: string };
  sentAs?: string;
  sizeBytes: number;
  url: string;
  method: Method;
}
