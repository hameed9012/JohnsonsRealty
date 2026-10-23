import Link from 'next/link';
import type * as React from 'react';

// A small, safe Markdown renderer for guides, careers and the About text. It never injects HTML:
// it supports paragraphs, ## and ### headings, - and 1. lists, **bold**, *italic* and [links](url).

function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) out.push(<strong key={`${key}-${i++}`}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('*')) out.push(<em key={`${key}-${i++}`}>{t.slice(1, -1)}</em>);
    else {
      const [, label, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t)!;
      const safe = /^(https?:\/\/|\/)/.test(href!) ? href! : '#';
      out.push(
        safe.startsWith('/') ? (
          <Link key={`${key}-${i++}`} href={safe}>
            {label}
          </Link>
        ) : (
          <a key={`${key}-${i++}`} href={safe} rel="noopener noreferrer" target="_blank">
            {label}
          </a>
        ),
      );
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className = 'prose body-l' }: { source: string; className?: string }) {
  const blocks = source.replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={`${className} markdown`}>
      {blocks.map((b, bi) => {
        const k = `b${bi}`;
        if (b.startsWith('### ')) return <h3 key={k} className="heading-3">{inline(b.slice(4), k)}</h3>;
        if (b.startsWith('## ')) return <h2 key={k} className="heading-2">{inline(b.slice(3), k)}</h2>;
        const lines = b.split('\n');
        if (lines.every((l) => /^[-*] /.test(l))) {
          return (
            <ul key={k}>
              {lines.map((l, li) => (
                <li key={li}>{inline(l.slice(2), `${k}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => /^\d+\. /.test(l))) {
          return (
            <ol key={k}>
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\d+\. /, ''), `${k}-${li}`)}</li>
              ))}
            </ol>
          );
        }
        return <p key={k}>{lines.flatMap((l, li) => (li ? [<br key={`br${li}`} />, ...inline(l, `${k}-${li}`)] : inline(l, `${k}-${li}`)))}</p>;
      })}
    </div>
  );
}
