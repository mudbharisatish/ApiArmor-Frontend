import type { Header, Method } from '@/types';
import { METHODS } from '@/types';

export interface ParsedCurl {
  method: Method;
  url: string;
  headers: Header[];
  body: string;
}

export type CurlResult = { ok: true; value: ParsedCurl } | { ok: false; error: string };

export const MAX_CURL_LENGTH = 100_000;

/** Split a shell command into words, honouring quotes and backslash line continuations. */
function tokenize(input: string): string[] {
  const text = input.replace(/\\\r?\n/g, ' ');
  const out: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  let inWord = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === '\\' && quote === '"' && i + 1 < text.length) cur += text[++i];
      else cur += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      inWord = true;
    } else if (c === '\\' && i + 1 < text.length) {
      cur += text[++i];
      inWord = true;
    } else if (/\s/.test(c)) {
      if (inWord) out.push(cur);
      cur = '';
      inWord = false;
    } else {
      cur += c;
      inWord = true;
    }
  }
  if (inWord) out.push(cur);
  return out;
}

let n = 0;
const header = (key: string, value: string): Header => ({ id: `ch${Date.now()}${++n}`, key, value, enabled: true });

const DATA_FLAGS = ['-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode', '--json'];
const VALUE_FLAGS = ['-o', '--output', '-A', '--user-agent', '-e', '--referer', '-m', '--max-time', '--connect-timeout', '-w', '--write-out'];

export function parseCurl(input: string): CurlResult {
  const text = input.trim();
  if (!text) return { ok: false, error: 'Paste a cURL command first.' };
  if (text.length > MAX_CURL_LENGTH)
    return { ok: false, error: `That command is too long (over ${MAX_CURL_LENGTH.toLocaleString()} characters).` };

  const words = tokenize(text);
  if (words[0]?.replace(/^\$\s*/, '') !== 'curl')
    return { ok: false, error: "That doesn't look like a cURL command. It should start with curl." };

  let method: Method | undefined;
  let url = '';
  const headers: Header[] = [];
  const data: string[] = [];

  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    const next = () => words[++i] ?? '';
    if (w === '-X' || w === '--request') {
      const m = next().toUpperCase();
      method = (METHODS as string[]).includes(m) ? (m as Method) : 'GET';
    } else if (w.startsWith('-X') && w.length > 2) {
      const m = w.slice(2).toUpperCase();
      method = (METHODS as string[]).includes(m) ? (m as Method) : 'GET';
    } else if (w === '-H' || w === '--header') {
      const raw = next();
      const idx = raw.indexOf(':');
      if (idx > 0) headers.push(header(raw.slice(0, idx).trim(), raw.slice(idx + 1).trim()));
    } else if (DATA_FLAGS.includes(w)) {
      if (w === '--json' && !headers.some((h) => h.key.toLowerCase() === 'content-type'))
        headers.push(header('Content-Type', 'application/json'));
      data.push(next());
    } else if (w === '-u' || w === '--user') {
      headers.push(header('Authorization', `Basic ${btoa(next())}`));
    } else if (w === '-b' || w === '--cookie') {
      headers.push(header('Cookie', next()));
    } else if (w === '--url') {
      url = next();
    } else if (VALUE_FLAGS.includes(w)) {
      next();
    } else if (w.startsWith('-')) {
      // Flags without values (-i, -s, -L, -k, --compressed …) don't change the request.
    } else if (!url) {
      url = w;
    }
  }

  if (!url || !/^(https?:\/\/|localhost|\d{1,3}\.|\{\{)/i.test(url))
    return { ok: false, error: "Couldn't find a URL in that command." };

  let body = data.join('&');
  try {
    if (body) body = JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    /* not JSON: keep as typed */
  }

  return { ok: true, value: { method: method ?? (body ? 'POST' : 'GET'), url, headers, body } };
}

/** Build a cURL command for a request. Secrets are always redacted. */
export function toCurl(method: string, url: string, headers: { key: string; value: string }[], body?: string): string {
  const q = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;
  const parts = [`curl${method === 'GET' ? '' : ` -X ${method}`} ${q(redactUrl(url))}`];
  for (const h of headers) parts.push(`-H ${q(`${h.key}: ${redactHeader(h.key, h.value)}`)}`);
  if (body) parts.push(`-d ${q(body)}`);
  return parts.join(' \\\n  ');
}

export function redactHeader(key: string, value: string): string {
  const k = key.toLowerCase();
  if (k === 'authorization') return value.replace(/^(\w+)\s+.*$/, '$1 •••••');
  if (k === 'cookie' || k === 'x-api-key' || k === 'set-cookie') return '•••••';
  return value;
}

export function redactUrl(url: string): string {
  return url.replace(/([?&](?:token|access_token|api_key)=)[^&]*/gi, '$1•••••');
}
