// Reads the brokerage's previous records: import/seller-files.md (one section per seller, bold sub-headings
// with two-column tables or bullet lists) and the SELLERS / EXTRA objects in import/forms-pa-latest.html.
// Pure functions; nothing is retyped by hand.

export type Block = Record<string, string> | string[];

export interface LegacySection {
  key: string;
  /** "Elaine Porter: 7063 Franklin Court". */
  heading: string;
  /** The person part of the heading: "Elaine Porter". */
  name: string;
  spare: boolean;
  intro: string;
  blocks: Record<string, Block>;
}

export interface GlanceRow {
  seller: string;
  selling: string;
  asking: string;
  lowest: string;
  timeline: string;
}

const SKIP = new Set(['at a glance', 'business sellers', 'towns and areas']);

/** "Priya and Daniel Raman" → raman; "Estate of Harold Brennan (spare seller)" → brennan. */
export function sectionKey(name: string): string {
  const words = name.replace(/\(.*?\)/g, '').trim().split(/\s+/);
  return (words[words.length - 1] ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

const unescapeMd = (s: string) => s.replace(/\\([_*#|\\-])/g, '$1').trim();

function tableRows(lines: string[]): string[][] {
  return lines
    .filter((l) => l.trim().startsWith('|'))
    .map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => unescapeMd(c)))
    .filter((cells) => !cells.every((c) => /^-+$/.test(c.replace(/\s/g, ''))));
}

export function parseGlance(md: string): GlanceRow[] {
  const start = md.indexOf('## At a glance');
  if (start < 0) return [];
  const end = md.indexOf('\n## ', start + 5);
  const rows = tableRows(md.slice(start, end < 0 ? undefined : end).split('\n'));
  return rows.slice(1).map(([seller = '', selling = '', asking = '', lowest = '', timeline = '']) => ({ seller, selling, asking, lowest, timeline }));
}

export function parseSellerFiles(md: string): LegacySection[] {
  const sections: LegacySection[] = [];
  const parts = md.split(/\n(?=## )/);
  for (const part of parts) {
    const m = /^## (.+)$/m.exec(part);
    if (!m) continue;
    const heading = m[1]!.trim();
    if (SKIP.has(heading.toLowerCase())) continue;
    const name = heading.split(':')[0]!.replace(/\((spare sellers?)\)/i, '').trim();
    const lines = part.split('\n').slice(1);
    const blocks: Record<string, Block> = {};
    const intro: string[] = [];
    let current: string | null = null;
    let buf: string[] = [];
    const flush = () => {
      if (!current) return;
      const rows = tableRows(buf);
      const bullets = buf.filter((l) => /^\s*[-•]\s+/.test(l)).map((l) => unescapeMd(l.replace(/^\s*[-•]\s+/, '')));
      if (rows.length > 1 && /^field$/i.test(rows[0]![0] ?? '')) blocks[current] = Object.fromEntries(rows.slice(1).filter((r) => r.length >= 2).map((r) => [r[0]!, r.slice(1).join(' | ')]));
      else if (rows.length) blocks[current] = Object.fromEntries(rows.filter((r) => r.length >= 2).map((r) => [r[0]!, r.slice(1).join(' | ')]));
      else if (bullets.length) blocks[current] = bullets;
      buf = [];
    };
    for (const line of lines) {
      const b = /^\*\*(.+?)\*\*\s*$/.exec(line.trim());
      if (b) {
        flush();
        current = b[1]!.trim();
        continue;
      }
      if (current) buf.push(line);
      else if (line.trim()) intro.push(line.trim());
    }
    flush();
    sections.push({ key: sectionKey(name), heading, name, spare: /spare/i.test(heading), intro: intro.join(' '), blocks });
  }
  return sections;
}

// ---- The forms tool's JavaScript objects ----

/** Parses a JavaScript object/array literal (single or double quotes, bare keys). No eval. */
export function parseJsLiteral(src: string): unknown {
  let i = 0;
  const ws = () => {
    while (i < src.length) {
      if (/\s/.test(src[i]!)) i++;
      else if (src.startsWith('//', i)) i = src.indexOf('\n', i) < 0 ? src.length : src.indexOf('\n', i);
      else break;
    }
  };
  const str = (): string => {
    const q = src[i++]!;
    let out = '';
    while (i < src.length && src[i] !== q) {
      if (src[i] === '\\') {
        const n = src[i + 1]!;
        out += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'u' ? String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16)) : n;
        i += n === 'u' ? 6 : 2;
      } else out += src[i++];
    }
    i++;
    return out;
  };
  const value = (): unknown => {
    ws();
    const c = src[i];
    if (c === '{') {
      i++;
      const o: Record<string, unknown> = {};
      for (;;) {
        ws();
        if (src[i] === '}') {
          i++;
          return o;
        }
        let key: string;
        if (src[i] === '"' || src[i] === "'") key = str();
        else {
          const m = /^[A-Za-z_$][\w$-]*/.exec(src.slice(i))!;
          key = m[0];
          i += key.length;
        }
        ws();
        i++; // :
        o[key] = value();
        ws();
        if (src[i] === ',') i++;
      }
    }
    if (c === '[') {
      i++;
      const a: unknown[] = [];
      for (;;) {
        ws();
        if (src[i] === ']') {
          i++;
          return a;
        }
        a.push(value());
        ws();
        if (src[i] === ',') i++;
      }
    }
    if (c === '"' || c === "'") return str();
    const m = /^(true|false|null|-?\d+(\.\d+)?)/.exec(src.slice(i));
    if (!m) throw new Error(`Unexpected "${src.slice(i, i + 20)}"`);
    i += m[0].length;
    return m[0] === 'true' ? true : m[0] === 'false' ? false : m[0] === 'null' ? null : Number(m[0]);
  };
  return value();
}

/** The object literal assigned to `const NAME = …;` in the forms tool. */
export function extractConst(html: string, name: string): unknown {
  const at = html.indexOf(`const ${name} = `);
  if (at < 0) throw new Error(`${name} not found in the forms file`);
  let i = html.indexOf('=', at) + 1;
  while (/\s/.test(html[i]!)) i++;
  // Find the matching closing brace, skipping strings.
  let depth = 0;
  let j = i;
  for (; j < html.length; j++) {
    const ch = html[j]!;
    if (ch === '"' || ch === "'") {
      const q = ch;
      j++;
      while (html[j] !== q) j += html[j] === '\\' ? 2 : 1;
    } else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) break;
    }
  }
  return parseJsLiteral(html.slice(i, j + 1));
}

export interface FormSeller {
  name: string;
  spare?: boolean;
  radios?: string[];
  f: Record<string, string>;
}

export interface FormExtra {
  f?: Record<string, string>;
  radios?: string[];
  cn?: boolean;
  /** r1…r20: [answer, detail] for the disclosure statement. */
  spds?: Record<string, [string, string]>;
}

export function parseFormsFile(html: string): { sellers: Record<string, FormSeller>; extra: Record<string, FormExtra> } {
  return { sellers: extractConst(html, 'SELLERS') as Record<string, FormSeller>, extra: extractConst(html, 'EXTRA') as Record<string, FormExtra> };
}
