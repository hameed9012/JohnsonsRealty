import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertNotProduction } from '@/db/seed-dev';
import { testAuthEnabled } from '@/lib/test-auth';

describe('test-only sign-in', () => {
  const ok = { E2E_TEST_AUTH: '1', DATABASE_URL: 'pglite:./.e2e-data/x' };
  it('works only when every gate holds', () => {
    expect(testAuthEnabled(ok)).toBe(true);
    expect(testAuthEnabled({ ...ok, E2E_TEST_AUTH: undefined })).toBe(false);
    expect(testAuthEnabled({ ...ok, VERCEL: '1' })).toBe(false);
    expect(testAuthEnabled({ ...ok, VERCEL_ENV: 'production' })).toBe(false);
    expect(testAuthEnabled({ ...ok, DATABASE_URL: 'postgres://neon.tech/db' })).toBe(false);
  });
});

describe('dev seed', () => {
  it('refuses production and Vercel', () => {
    expect(() => assertNotProduction({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow();
    expect(() => assertNotProduction({ VERCEL_ENV: 'production' } as unknown as NodeJS.ProcessEnv)).toThrow();
    expect(() => assertNotProduction({ VERCEL_ENV: 'preview' } as unknown as NodeJS.ProcessEnv)).toThrow();
    expect(() => assertNotProduction({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).not.toThrow();
  });
});

// App code never writes raw colours, font sizes or spacing values; tokens only.
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const TOKEN_FILES = ['tokens.css', 'bundle.css', 'type-tokens.css'];

describe('design tokens only', () => {
  const files = walk('src').filter((f) => /\.(css|tsx?)$/.test(f) && !TOKEN_FILES.includes(path.basename(f)));

  it('has no raw hex colours', () => {
    const bad = files.filter((f) => /#[0-9a-fA-F]{3,8}\b/.test(readFileSync(f, 'utf8').replace(/href="#[^"]*"|'#'|"#"|`#`/g, '')));
    expect(bad).toEqual([]);
  });

  it('has no literal font sizes', () => {
    const bad = files.filter((f) => /font-size:\s*\d|fontSize:\s*['"]?\d|font:\s*\d{3}\s+\d+px/.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });

  it('has no literal spacing on padding, margin or gap', () => {
    const re = /(padding|margin|gap)(-[a-z]+)?\s*:\s*[^;]*\b([2-9]|\d{2,})px/;
    const bad = files.filter((f) => f.endsWith('.css') && readFileSync(f, 'utf8').split('\n').some((l) => re.test(l)));
    expect(bad).toEqual([]);
  });
});

describe('Discord sign-in callback', () => {
  it('drops only the iss parameter, and only on the Discord callback', async () => {
    const { withoutDiscordIssuer } = await import('@/lib/auth-callback');
    expect(withoutDiscordIssuer('https://example.test/api/auth/callback/discord?code=abc&state=xyz&iss=https%3A%2F%2Fdiscord.com')).toBe('https://example.test/api/auth/callback/discord?code=abc&state=xyz');
    expect(withoutDiscordIssuer('https://example.test/api/auth/callback/discord?code=abc&state=xyz')).toBeNull();
    expect(withoutDiscordIssuer('https://example.test/api/auth/session?iss=x')).toBeNull();
  });
});
