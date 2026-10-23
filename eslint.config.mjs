import next from 'eslint-config-next';

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'design-system/**', 'reference/**', 'drizzle/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts'] },
  ...next,
];

export default config;
