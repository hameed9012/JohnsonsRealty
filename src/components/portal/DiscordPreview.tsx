import type * as React from 'react';
import type { DiscordMessage } from '@/discord/embeds';

/** Discord's light markdown: **bold**, ~~strike~~, <t:…> timestamps, mentions. Enough to preview our embeds. */
function md(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|~~(.+?)~~|<t:(\d+):\w>|<@&?(\d+)>|<#(\d+)>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<b key={i++}>{m[1]}</b>);
    else if (m[2]) out.push(<s key={i++}>{m[2]}</s>);
    else if (m[3]) out.push(<span key={i++} className="dc-chip">{new Date(Number(m[3]) * 1000).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>);
    else if (m[4]) out.push(<span key={i++} className="dc-chip">@{text.slice(m.index + 2, m.index + 3) === '&' ? 'role' : 'member'}</span>);
    else if (m[5]) out.push(<span key={i++} className="dc-chip">#channel</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Discord-styled preview of a message the bot will post. Colours are the embed's own strip colour. */
export function DiscordPreview({ message, label }: { message: DiscordMessage; label: string }) {
  return (
    <figure className="dc-preview" aria-label={label}>
      <figcaption className="label label--brass">{label}</figcaption>
      {message.content ? <div className="dc-content">{md(message.content)}</div> : null}
      {message.embeds?.map((e, i) => (
        <div key={i} className="dc-embed" style={{ borderLeftColor: e.color !== undefined ? `#${e.color.toString(16).padStart(6, '0')}` : undefined }}>
          <div className="dc-embed-main">
            {e.author ? <div className="dc-author">{e.author.name}</div> : null}
            {e.title ? <div className="dc-title">{e.title}</div> : null}
            {e.description ? <div className="dc-desc">{md(e.description)}</div> : null}
            {e.fields?.length ? (
              <div className="dc-fields">
                {e.fields.map((f, j) => (
                  <div key={j} className={f.inline ? 'dc-field' : 'dc-field dc-field--wide'}>
                    <div className="dc-field-name">{f.name}</div>
                    <div>{md(f.value)}</div>
                  </div>
                ))}
              </div>
            ) : null}
            {e.image ? <div className="dc-image">Image: {e.image.url.split('/').pop()}</div> : null}
            {e.footer ? <div className="dc-footer">{e.footer.text}</div> : null}
          </div>
          {e.thumbnail ? <div className="dc-thumb" aria-hidden /> : null}
        </div>
      ))}
      {message.components?.length ? (
        <div className="dc-buttons">
          {message.components.flatMap((r) =>
            (r as { components: { label?: string; style: number; disabled?: boolean }[] }).components.map((c, k) => (
              <span key={k} className={`dc-button dc-button--${c.style}${c.disabled ? ' dc-button--off' : ''}`}>
                {c.label}
                {c.style === 5 ? ' ↗' : ''}
              </span>
            )),
          )}
        </div>
      ) : null}
    </figure>
  );
}
