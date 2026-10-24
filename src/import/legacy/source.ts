// Reads the kit files from disk and builds the plan. Node only (the CLI and the portal's server action).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildPlan, type LegacyPlan } from './map';
import { parseFormsFile, parseGlance, parseSellerFiles } from './parse';

export const SELLER_FILES = 'import/seller-files.md';
export const FORMS_FILE = 'import/forms-pa-latest.html';
export const PLAN_FILE = 'import/legacy.json';

export async function loadPlan(root = process.cwd()): Promise<LegacyPlan> {
  const [md, html] = await Promise.all([readFile(path.join(root, SELLER_FILES), 'utf8'), readFile(path.join(root, FORMS_FILE), 'utf8')]);
  return buildPlan(parseSellerFiles(md), parseFormsFile(html), parseGlance(md));
}
