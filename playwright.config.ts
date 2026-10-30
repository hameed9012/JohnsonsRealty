import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const env = {
  DATABASE_URL: 'pglite:./.e2e-data/e2e',
  E2E_TEST_AUTH: '1',
  AUTH_SECRET: 'e2e-only-secret-not-used-anywhere-else-0123456789',
  AUTH_DISCORD_ID: 'e2e',
  AUTH_DISCORD_SECRET: 'e2e',
  NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
  NEXT_DIST_DIR: '.next-e2e',
  // The tests send many messages as one user; the real limit is tested in the unit tests.
  SEND_LIMIT: '1000',
  // Cloudinary stays unset, so uploads use the local driver.
  CLOUDINARY_CLOUD_NAME: '',
  CLOUDINARY_API_KEY: '',
  CLOUDINARY_API_SECRET: '',
};

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /legacy-import/ },
    // The legacy import adds real listings, so it runs once everything else has finished.
    { name: 'import', use: { ...devices['Desktop Chrome'] }, testMatch: /legacy-import/, dependencies: ['chromium'] },
  ],
  webServer: {
    // Fresh database and data cache every run: wipe both, migrate, seed test users, build, start.
    command: `node -e "for (const d of ['.e2e-data/e2e','.e2e-data/uploads','.next-e2e']) require('fs').rmSync(d,{recursive:true,force:true})" && npx tsx src/db/migrate.ts && npx tsx tests/e2e/seed.ts && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 600_000,
    reuseExistingServer: false,
    env,
  },
});
