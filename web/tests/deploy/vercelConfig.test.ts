import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// DEP-02 / DEP-03: SPA fallback that never swallows a missing asset, and the
// security headers on every response. The file is parsed, not imported, so
// the test sees exactly what Vercel will read.

interface VercelConfig {
  rewrites: { source: string; destination: string }[];
  headers: { source: string; headers: { key: string; value: string }[] }[];
}

const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')) as VercelConfig;

// Vercel matches `source` against the whole pathname.
const fallbackRule = config.rewrites[0];
const fallback = new RegExp(`^${fallbackRule?.source ?? ''}$`);
const allResponses = config.headers.find((entry) => entry.source === '/(.*)');
const headerValue = (key: string) => allResponses?.headers.find((h) => h.key === key)?.value;

const directives = new Map(
  (headerValue('Content-Security-Policy') ?? '').split(';').map((part) => {
    const [name = '', ...sources] = part.trim().split(/\s+/);
    return [name, sources] as const;
  }),
);

describe('vercel.json SPA fallback (DEP-02)', () => {
  it('rewrites to index.html', () => {
    expect(fallbackRule?.destination).toBe('/index.html');
  });

  it.each(['/', '/paciente', '/profissional/pacientes/abc', '/login'])('serves index.html for the route %s', (path) => {
    expect(fallback.test(path)).toBe(true);
  });

  it.each(['/assets/x.js', '/assets/missing-abc123.css', '/favicon.ico', '/robots.txt'])(
    'leaves %s alone so a missing file is a real 404',
    (path) => {
      expect(fallback.test(path)).toBe(false);
    },
  );
});

describe('vercel.json security headers (DEP-03)', () => {
  it('applies to every path', () => {
    expect(allResponses).toBeDefined();
  });

  it.each([
    ['default-src', ["'self'"]],
    ['script-src', ["'self'"]],
    ['style-src', ["'self'"]],
    ['style-src-attr', ["'unsafe-inline'"]],
    ['img-src', ["'self'", 'data:']],
    ['frame-ancestors', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
  ])('CSP %s is exactly %j', (directive, expected) => {
    expect(directives.get(directive)).toEqual(expected);
  });

  it('allows connections only to itself and the API origin', () => {
    expect(directives.get('connect-src')).toEqual(["'self'", 'https://glucore.duckdns.org']);
  });

  it('never allows inline or eval scripts', () => {
    const csp = headerValue('Content-Security-Policy') ?? '';
    expect(directives.get('script-src')).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('sets nosniff, Referrer-Policy and Permissions-Policy', () => {
    expect(headerValue('X-Content-Type-Options')).toBe('nosniff');
    expect(headerValue('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headerValue('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
  });
});
