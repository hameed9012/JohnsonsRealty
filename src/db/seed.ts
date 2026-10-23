// `npm run seed` — re-applies the migration-safe base data without running migrations.
import 'dotenv/config';
import { getDb } from './client';
import { seedBase } from './seed-base';

seedBase(getDb())
  .then(() => {
    console.log('Base data checked (areas, features, settings).');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
