import { describe, expect, it } from 'vitest';
import { parseCurl, redactHeader, toCurl } from './curl';

describe('parseCurl', () => {
  it('creates a GET request with a header (TC-CI-01)', () => {
    const r = parseCurl("curl -X GET http://localhost:8080/api/invoices/77 -H 'Authorization: Bearer abc123'");
    expect(r.ok && r.value.method).toBe('GET');
    expect(r.ok && r.value.url).toBe('http://localhost:8080/api/invoices/77');
    expect(r.ok && r.value.headers[0]).toMatchObject({ key: 'Authorization', value: 'Bearer abc123' });
  });

  it('rejects empty input (TC-CI-02)', () => {
    expect(parseCurl('   ')).toEqual({ ok: false, error: 'Paste a cURL command first.' });
  });

  it('rejects non-cURL text (TC-CI-03)', () => {
    const r = parseCurl('hello world');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/doesn't look like a cURL command/);
  });

  it('rejects a command without a URL (TC-CI-04)', () => {
    const r = parseCurl("curl -X POST -H 'Accept: application/json'");
    expect(!r.ok && r.error).toBe("Couldn't find a URL in that command.");
  });

  it('imports method, headers and a JSON body (TC-CI-05)', () => {
    const r = parseCurl(`curl -X POST http://localhost:4000/api/orders -H 'Content-Type: application/json' -H 'Accept: application/json' -d '{"a":1}'`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.method).toBe('POST');
    expect(r.value.headers).toHaveLength(2);
    expect(r.value.body).toBe('{\n  "a": 1\n}');
  });

  it('handles a 10,000-character command (TC-CI-06)', () => {
    const r = parseCurl(`curl http://localhost:4000/api/x -H 'X-Long: ${'a'.repeat(10_000)}'`);
    expect(r.ok).toBe(true);
  });

  it('infers POST from data and joins line continuations', () => {
    const r = parseCurl("curl 'http://localhost:4000/api/orders' \\\n  --data-raw '{\"q\":2}'");
    expect(r.ok && r.value.method).toBe('POST');
  });
});

describe('redaction', () => {
  it('never exposes tokens in copied cURL', () => {
    expect(redactHeader('Authorization', 'Bearer secret.jwt.value')).toBe('Bearer •••••');
    expect(toCurl('GET', 'http://x/api?token=abc', [{ key: 'Cookie', value: 'session=1' }])).not.toMatch(/abc|session=1/);
  });
});
