// Reads the kit files from disk and builds the plan. Node only (the CLI and the portal's server action).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildPlan, type LegacyPlan } from './map';
import { parseFormsFile, parseGlance, parseSellerFiles } from './parse';

/** The seller files under their current name; the original name still works. */
export const SELLER_FILES = 'import/johnsons-realty-seller-files.md';
export const FORMS_FILE = 'import/forms-pa-latest.html';
export const PLAN_FILE = 'import/legacy.json';

export async function loadPlan(root = process.cwd()): Promise<LegacyPlan> {
  const [md, html] = await Promise.all([readSellerFiles(root), readFile(path.join(root, 'import', 'forms-pa-latest.html'), 'utf8')]);
  return buildPlan(parseSellerFiles(md), parseFormsFile(html), parseGlance(md));
}

async function readSellerFiles(root: string): Promise<string> {
  try {
    return await readFile(path.join(root, 'import', 'johnsons-realty-seller-files.md'), 'utf8');
  } catch {
    return readFile(path.join(root, 'import', 'seller-files.md'), 'utf8');
  }
}
