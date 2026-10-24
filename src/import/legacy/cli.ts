// npm run import:legacy                      parses the files, writes import/legacy.json and prints the preview
// npm run import:legacy -- --yes             saves it (as the Owner); sellers already imported are skipped
//   --sale-price 795000 --sold-on 2027-01-15 the sold listing's sale (defaults: the file's asking price and settlement date)
// Uses the same database as the site (DATABASE_URL).
import { config } from 'dotenv';
import { writeFile } from 'node:fs/promises';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { users } from '@/db/schema';
import { uploadFromServer } from '@/lib/storage';
import { applyPlan } from './apply';
import { loadPlan, PLAN_FILE } from './source';

config({ path: '.env.local' });
config();

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const usd = (n: number | null) => (n == null ? '—' : `$${n.toLocaleString('en-US')}`);

async function main() {
  const plan = await loadPlan();
  await writeFile(PLAN_FILE, JSON.stringify(plan, null, 2) + '\n');
  console.log(`Wrote ${PLAN_FILE}\n`);
  console.log('Listings');
  for (const l of plan.listings) {
    const extra = l.terms?.furnishedPrice ? ` (${usd(l.terms.furnishedPrice as number)} furnished)` : '';
    console.log(`  ${l.key.padEnd(11)} ${l.status.padEnd(10)} ${(l.addressLine || '(no address)').padEnd(22)} postal ${(l.postal ?? '—').padEnd(4)} ${usd(l.price)}${l.purpose === 'rent' ? '/month' : ''}${extra}`);
  }
  console.log('\nClient files');
  for (const c of plan.clients) console.log(`  ${c.key.padEnd(11)} ${c.displayName}${c.tags.length ? `  [${c.tags.join(', ')}]` : ''}`);
  console.log('\nCheck before saving');
  for (const f of plan.flags) console.log(`  ${f.key.padEnd(11)} ${f.message}`);

  if (!process.argv.includes('--yes')) {
    console.log('\nNothing saved. Run again with --yes to import.');
    return;
  }
  const db = getDb();
  const owner = await db.query.users.findFirst({ where: and(eq(users.role, 'owner'), eq(users.status, 'active')), columns: { id: true } });
  if (!owner) throw new Error('No Owner account yet. Sign in to the site once as the Owner first.');
  const sold = plan.listings.find((l) => l.sale);
  const price = Number(arg('--sale-price') ?? sold?.sale?.price ?? 0);
  const soldOn = arg('--sold-on') ?? sold?.sale?.soldOn ?? '';
  const report = await applyPlan(db, plan, {
    actorId: owner.id,
    sale: sold ? { price, soldOn } : undefined,
    upload: (buf, type) => uploadFromServer(buf, type, 'listings'),
  });
  console.log('');
  for (const c of report.created) {
    console.log(`  Created ${c.client}${c.refNo ? `: ${c.refNo}` : ''}${c.saleNo ? `, Sale No. ${String(c.saleNo).padStart(3, '0')}` : ''}${c.photos ? `, ${c.photos} photos` : ''}`);
  }
  if (report.skipped.length) console.log(`  Already imported, skipped: ${report.skipped.join(', ')}`);
  for (const p of report.photosAdded) console.log(`  ${p.key}: ${p.photos} photos added${p.photoError ? `. ${p.photoError}` : ''}`);
  for (const c of report.created.filter((x) => x.photoError)) console.log(`  ${c.client}: ${c.photoError}`);
  for (const f of report.failed) console.log(`  Not imported: ${f.client}. ${f.message}`);
  if (report.failed.length) process.exitCode = 1;
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
