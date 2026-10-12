export interface ParsedUrl {
  ok: boolean;
  protocol: string;
  host: string;
  hostname: string;
  port: string;
  path: string;
  query: URLSearchParams;
  error?: string;
}

/** Parse a request URL that may still contain {{variables}}. */
export function parseUrl(raw: string): ParsedUrl {
  const text = raw.trim().replace(/\{\{\s*(\w+)\s*\}\}/g, 'VAR_$1');
  const empty: ParsedUrl = {
    ok: false,
    protocol: '',
    host: '',
    hostname: '',
    port: '',
    path: '',
    query: new URLSearchParams(),
  };
  if (!text) return { ...empty, error: 'Enter a URL' };
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(text) ? text : `http://${text}`);
    if (!/^https?:$/.test(u.protocol)) return { ...empty, error: 'Use an http:// or https:// URL' };
    return {
      ok: true,
      protocol: u.protocol.replace(':', ''),
      host: u.host,
      hostname: u.hostname,
      port: u.port,
      path: decodeURIComponent(u.pathname),
      query: u.searchParams,
    };
  } catch {
    return { ...empty, error: 'That isn’t a valid URL' };
  }
}

export function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.test')
  );
}

/** Replace concrete IDs with {id} so findings group by route. */
export function templatePath(path: string): string {
  return path
    .split('/')
    .map((seg) => (/^\d+$/.test(seg) || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(seg) ? '{id}' : seg))
    .join('/');
}

export function hasObjectId(path: string): boolean {
  return path.split('/').some((seg) => /^\d+$/.test(seg) || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(seg) || seg === '{id}');
}
