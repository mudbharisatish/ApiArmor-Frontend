import type { ModuleId, OwaspId, Severity } from '@/types';

/** OWASP Top 10:2025 — ApiArmor's primary framework. Say "mapped to", never "compliant". */
export const OWASP: Record<OwaspId, string> = {
  A01: 'Broken Access Control',
  A02: 'Security Misconfiguration',
  A03: 'Software Supply Chain Failures',
  A04: 'Cryptographic Failures',
  A05: 'Injection',
  A06: 'Insecure Design',
  A07: 'Authentication Failures',
  A08: 'Software or Data Integrity Failures',
  A09: 'Security Logging and Alerting Failures',
  A10: 'Mishandling of Exceptional Conditions',
};

/** OWASP API Security Top 10 (2023) — kept as a cross-reference. */
export const API_TOP10: Record<string, string> = {
  API1: 'Broken Object Level Authorization',
  API2: 'Broken Authentication',
  API3: 'Broken Object Property Level Authorization',
  API4: 'Unrestricted Resource Consumption',
  API5: 'Broken Function Level Authorization',
  API6: 'Unrestricted Access to Sensitive Business Flows',
  API7: 'Server Side Request Forgery',
  API8: 'Security Misconfiguration',
  API9: 'Improper Inventory Management',
  API10: 'Unsafe Consumption of APIs',
};

export interface ModuleDef {
  id: ModuleId;
  name: string;
  owasp: OwaspId;
  api: string;
  /** Probes sent per request when the module runs. */
  probes: number;
  /** Active modules send attack probes; passive ones only inspect the baseline. */
  passive: boolean;
}

/** The seven MVP test modules, in the order a scan runs them. */
export const MODULES: ModuleDef[] = [
  { id: 'a01.bola', name: 'Object-level access', owasp: 'A01', api: 'API1', probes: 3, passive: false },
  { id: 'a01.bfla', name: 'Function-level access', owasp: 'A01', api: 'API5', probes: 4, passive: false },
  { id: 'a02.misconfig', name: 'Misconfiguration', owasp: 'A02', api: 'API8', probes: 9, passive: true },
  { id: 'a04.transport', name: 'Transport and cookies', owasp: 'A04', api: 'API8', probes: 3, passive: true },
  { id: 'a06.resource', name: 'Rate and size limits', owasp: 'A06', api: 'API4', probes: 32, passive: false },
  { id: 'a07.auth', name: 'Authentication', owasp: 'A07', api: 'API2', probes: 6, passive: false },
  { id: 'a10.exceptions', name: 'Error handling', owasp: 'A10', api: 'API8', probes: 20, passive: false },
];

export const MODULE_BY_ID = Object.fromEntries(MODULES.map((m) => [m.id, m])) as Record<ModuleId, ModuleDef>;

/** Categories the MVP does not test yet. Always shown, so a clean result never hides gaps. */
export const NOT_TESTED: { id: OwaspId; label: string }[] = [
  { id: 'A03', label: 'Supply chain' },
  { id: 'A05', label: 'Injection' },
  { id: 'A08', label: 'Integrity' },
  { id: 'A09', label: 'Logging' },
];

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];
export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/** Categories the MVP has tests for. The rest are listed but can't be selected yet. */
export const TESTABLE_OWASP: OwaspId[] = [...new Set(MODULES.map((m) => m.owasp))];
