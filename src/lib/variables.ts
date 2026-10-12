import type { Environment } from '@/types';

export interface VariableInfo {
  name: string;
  defined: boolean;
  secret: boolean;
  /** What the hover shows. Secret values are always masked. */
  display: string;
}

const VAR_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;

export function findVariables(text: string): string[] {
  return [...new Set([...text.matchAll(VAR_RE)].map((m) => m[1]))];
}

export function describeVariable(name: string, env: Environment): VariableInfo {
  const v = env.variables.find((x) => x.key === name);
  if (!v) return { name, defined: false, secret: false, display: 'Not defined in this environment' };
  return { name, defined: true, secret: v.secret, display: v.secret ? '••••• (secret)' : v.value };
}

/** Split text into plain and {{variable}} segments, for inline highlighting. */
export function splitVariables(text: string): { text: string; variable?: string }[] {
  const out: { text: string; variable?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(VAR_RE)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], variable: m[1] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** Resolve variables for sending. Secrets resolve to placeholders that never reach the UI. */
export function resolveVariables(text: string, env: Environment, identityName?: string): string {
  return text.replace(VAR_RE, (whole, name: string) => {
    if (name === 'token') return `tok_${identityName ?? 'anon'}`;
    if (name === 'password') return 'pw_redacted';
    const v = env.variables.find((x) => x.key === name);
    return v ? v.value : whole;
  });
}
