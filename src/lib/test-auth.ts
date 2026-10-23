/**
 * Test-only sign-in for end-to-end tests (Discord OAuth cannot run in CI).
 * Enabled only when ALL hold: E2E_TEST_AUTH=1, not running on Vercel, and the database is the embedded
 * pglite engine. Any one missing and the route answers 404, so it cannot work in production.
 */
export function testAuthEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.E2E_TEST_AUTH === '1' && !env.VERCEL && !env.VERCEL_ENV && (env.DATABASE_URL ?? '').startsWith('pglite:');
}
