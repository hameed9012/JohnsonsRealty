'use client';

import type * as React from 'react';
import { DocumentHeader, SignatureLine } from '@/components/ui/documents';
import { StatusPill } from '@/components/ui/StatusStamp';
import { cx } from '@/lib/cx';
import { FORMS } from '@/lib/refs';
import { FORM_DEFS } from '@/forms/defs';
import { computeValue, displayValue } from '@/forms/model';
import { DOC_STATUS, type DocStatus } from '@/forms/status';
import type { DocData, DocValue, FieldDef, FieldKind, SectionDef, TableDef } from '@/forms/types';
import type { FormType } from '@/lib/refs';

export interface Signature {
  typedName: string;
  signedOn: string;
}

export interface AreaPick {
  label: string;
  city: string;
  zip: string;
}

export interface DocSheetProps {
  type: FormType;
  docNo: string;
  status: DocStatus;
  data: DocData;
  signatures: Record<string, Signature>;
  agentName: string | null;
  brokerage: { name: string; subline: string; contact: { label?: string; value: string }[] };
  editable?: boolean;
  /** The copy shared with a client leaves out brokerage-only sections. */
  hideInternal?: boolean;
  areas?: AreaPick[];
  errors?: Record<string, string>;
  onChange?: (patch: DocData) => void;
  onSign?: (party: string, patch: Partial<Signature>) => void;
}

const SPAN: Record<number, string> = { 2: 'doc-c2', 3: 'doc-c3', 4: 'doc-c4', 5: 'doc-c5', 6: 'doc-c6', 8: 'doc-c8', 12: 'doc-c12' };
const fid = (id: string) => 'doc-' + id.replace(/[^a-z0-9]+/gi, '-');

function inputType(kind: FieldKind) {
  return kind === 'date' ? 'date' : kind === 'datetime' ? 'datetime-local' : 'text';
}

function inputMode(kind: FieldKind): React.HTMLAttributes<HTMLInputElement>['inputMode'] {
  return kind === 'money' || kind === 'percent' ? 'decimal' : kind === 'number' ? 'numeric' : undefined;
}

const MONO: FieldKind[] = ['money', 'percent', 'number', 'date', 'datetime'];

/** A bare control for a table cell or a field, named by `label` for screen readers. */
function Control({ id, kind, label, value, options, placeholder, mono, error, onChange, areas, labelled }: { id: string; kind: FieldKind; label: string; value: DocValue | undefined; options?: readonly string[]; placeholder?: string; mono?: boolean; error?: string; onChange: (patch: DocData) => void; areas?: AreaPick[]; labelled?: boolean }) {
  const common = { id: fid(id), 'aria-label': labelled ? undefined : label, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? fid(id) + '-err' : undefined };
  const cls = cx('doc-in', (mono || MONO.includes(kind)) && 'doc-mono');
  if (kind === 'checkbox') return <input {...common} type="checkbox" className="doc-check" checked={value === true} onChange={(e) => onChange({ [id]: e.target.checked })} />;
  if (kind === 'textarea') return <textarea {...common} className={cls} rows={2} value={String(value ?? '')} placeholder={placeholder} onChange={(e) => onChange({ [id]: e.target.value })} />;
  if (kind === 'select')
    return (
      <select {...common} className={cls} value={String(value ?? '')} onChange={(e) => onChange({ [id]: e.target.value })}>
        <option value="" />
        {options?.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  if (kind === 'area')
    return (
      <select
        {...common}
        className={cls}
        value={String(value ?? '')}
        onChange={(e) => {
          // Quick area picker: choosing the area fills the municipality and ZIP, as the old generator did.
          const a = areas?.find((x) => x.label === e.target.value);
          onChange({ [id]: e.target.value, ...(a ? { prop_city: a.city, ...(a.zip ? { prop_zip: a.zip } : {}) } : {}) });
        }}
      >
        <option value="">Choose the area on the map…</option>
        {value && !areas?.some((a) => a.label === value) ? <option>{String(value)}</option> : null}
        {areas?.map((a) => (
          <option key={a.label}>{a.label}</option>
        ))}
      </select>
    );
  return <input {...common} className={cls} type={inputType(kind)} inputMode={inputMode(kind)} value={String(value ?? '')} placeholder={placeholder ?? (kind === 'money' ? '$0.00' : undefined)} onChange={(e) => onChange({ [id]: e.target.value })} />;
}

function Field({ f, p }: { f: FieldDef; p: DocSheetProps }) {
  const value = p.data[f.id];
  const span = SPAN[f.span ?? 12];
  const error = p.errors?.[f.id];
  if (f.kind === 'computed') {
    return (
      <div className={cx('doc-f', span)}>
        <span className="doc-l">{f.label}</span>
        <div className={cx('doc-v', f.compute !== 'price_words' && f.compute !== 'deposit_words' ? 'doc-mono doc-strong' : 'doc-words')} aria-live={p.editable ? 'polite' : undefined}>
          {computeValue(f.compute!, p.data)}
        </div>
      </div>
    );
  }
  if (f.kind === 'checkbox') {
    return (
      <div className={cx('doc-f doc-f--check', span)}>
        {p.editable ? (
          <label className="doc-tick">
            <Control id={f.id} kind="checkbox" label={f.label} value={value} onChange={p.onChange!} labelled />
            <span>{f.label}</span>
          </label>
        ) : (
          <span className="doc-tick">
            <span className="doc-box" aria-hidden>
              {value ? '✓' : ''}
            </span>
            <span>
              {f.label}
              <span className="sr-only">{value ? ' (ticked)' : ' (not ticked)'}</span>
            </span>
          </span>
        )}
      </div>
    );
  }
  if (f.kind === 'radio') {
    return (
      <fieldset className={cx('doc-f', span)}>
        <legend className="doc-l">{f.label}</legend>
        {p.editable ? (
          <div className="doc-yn">
            {f.options!.map((o) => (
              <label key={o} className="doc-tick">
                <input type="radio" className="doc-check" name={fid(f.id)} value={o} checked={value === o} onChange={() => p.onChange!({ [f.id]: o })} />
                <span>{o}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="doc-v">{String(value || '—')}</div>
        )}
      </fieldset>
    );
  }
  return (
    <div className={cx('doc-f', span, error && 'doc-f--error')}>
      {p.editable ? (
        <>
          <label className="doc-l" htmlFor={fid(f.id)}>
            {f.label}
          </label>
          <Control id={f.id} kind={f.kind} label={f.label} value={value} options={f.options} placeholder={f.placeholder} mono={f.mono} error={error} onChange={p.onChange!} areas={p.areas} labelled />
          {error ? (
            <span className="doc-err" id={fid(f.id) + '-err'}>
              {error}
            </span>
          ) : null}
        </>
      ) : (
        <>
          <span className="doc-l">{f.label}</span>
          <div className={cx('doc-v', (f.mono || MONO.includes(f.kind)) && 'doc-mono')}>{displayValue(f.kind, value) || '—'}</div>
        </>
      )}
    </div>
  );
}

function Table({ t, p }: { t: TableDef; p: DocSheetProps }) {
  const toggled = t.columns[0]?.kind === 'checkbox' ? t.columns[0].id : null;
  return (
    <div className="doc-tw">
      <table className="doc-t">
        <caption className="sr-only">{t.caption}</caption>
        <thead>
          <tr>
            {toggled ? <th scope="col">{t.columns[0]!.label}</th> : null}
            <th scope="col">Item</th>
            {t.columns.filter((c) => c.id !== toggled).map((c) => (
              <th key={c.id} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r) => {
            const key = (c: string) => `${t.id}.${r.id}.${c}`;
            const rowLabel = r.writeIn ? String(p.data[key('label')] || '') : r.label;
            const off = toggled && !p.data[key(toggled)];
            return (
              <tr key={r.id} className={cx(off && 'doc-off')}>
                {toggled ? (
                  <td className="doc-ck">
                    {p.editable ? (
                      <Control id={key(toggled)} kind="checkbox" label={`Include: ${rowLabel || r.label}`} value={p.data[key(toggled)]} onChange={p.onChange!} />
                    ) : (
                      <span className="doc-box" role="img" aria-label={p.data[key(toggled)] ? 'Ticked' : 'Not ticked'}>
                        {p.data[key(toggled)] ? '✓' : ''}
                      </span>
                    )}
                  </td>
                ) : null}
                <th scope="row" className="doc-name">
                  {r.writeIn && p.editable ? <Control id={key('label')} kind="text" label={r.label} value={p.data[key('label')]} placeholder={r.label} onChange={p.onChange!} /> : rowLabel || (p.editable ? r.label : '—')}
                </th>
                {t.columns.filter((c) => c.id !== toggled).map((c) => {
                  const kind = r.kind && c.kind === 'text' ? r.kind : c.kind;
                  return (
                    <td key={c.id}>
                      {p.editable ? (
                        <Control id={key(c.id)} kind={kind} label={`${rowLabel || r.label}: ${c.label}`} value={p.data[key(c.id)]} options={c.options} placeholder={c.placeholder} onChange={p.onChange!} />
                      ) : (
                        <span className={cx(MONO.includes(kind) && 'doc-mono')}>{displayValue(kind, p.data[key(c.id)])}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Signatures({ s, p }: { s: NonNullable<SectionDef['signatures']>[number]; p: DocSheetProps }) {
  const def = FORM_DEFS[p.type];
  return (
    <>
      {s.statement ? (
        <p className="doc-accept">
          <b>{s.statement[0]}</b> {s.statement[1]}
        </p>
      ) : null}
      <div className="doc-sigs">
        {s.parties.map((party) => {
          const d = def.signatures.find((x) => x.party === party)!;
          const label = d.agent ? `${d.label === 'Real Estate Agent' ? '' : d.label + ' · '}${p.agentName ? p.agentName + ', ' : ''}Real Estate Agent` : d.label;
          const sig = p.signatures[party] ?? { typedName: '', signedOn: '' };
          const err = p.errors?.[`sig.${party}`];
          if (!p.editable) return <SignatureLine key={party} label={label} name={sig.typedName} date={sig.signedOn ? displayValue('date', sig.signedOn) : undefined} />;
          return (
            <div key={party} className="doc-sig">
              <input className="doc-sig-in" value={sig.typedName} placeholder="Type name to sign" aria-label={`${label} signature`} aria-invalid={err ? true : undefined} onChange={(e) => p.onSign!(party, { typedName: e.target.value })} />
              <div className="jr-sig-meta">
                <span>{label}</span>
                <input type="date" className="doc-in doc-mono doc-sig-date" value={sig.signedOn} aria-label={`Date signed, ${label}`} onChange={(e) => p.onSign!(party, { signedOn: e.target.value })} />
              </div>
              {err ? <span className="doc-err">{err}</span> : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

/** The paper form: same look on screen, in print, in the PNG export and on the client's copy. */
export function DocSheet(p: DocSheetProps) {
  const def = FORM_DEFS[p.type];
  const meta = FORMS[p.type];
  const st = DOC_STATUS[p.status];
  const sections = def.sections.filter((s) => !(p.hideInternal && s.internal));
  const agreementNo = p.type === 'agreement_of_sale' || p.type === 'business_sale' ? p.docNo : String(p.data.agreement_no || '');
  const dateKind = def.dateKind ?? 'date';
  return (
    <article className="paper-sheet doc-sheet" data-theme="light">
      <DocumentHeader title={meta.title} subtitle={def.subtitle} formNo={`Form ${meta.formNo} · ${def.reference}`} contact={p.brokerage.contact} subline={p.brokerage.subline} />
      <div className="paper-body doc-body">
        <div className="doc-meta">
          <div className="doc-f">
            <span className="doc-l">{meta.numberLabel}</span>
            <div className="doc-v doc-mono">{p.docNo}</div>
          </div>
          <div className="doc-f">
            <span className="doc-l">Status</span>
            <div>
              <StatusPill status={st.s} label={st.l} />
            </div>
          </div>
          <div className="doc-f">
            {p.editable ? (
              <>
                <label className="doc-l" htmlFor={fid('doc_date')}>
                  {def.dateLabel}
                </label>
                <Control id="doc_date" kind={dateKind} label={def.dateLabel} value={p.data.doc_date} onChange={p.onChange!} labelled />
              </>
            ) : (
              <>
                <span className="doc-l">{def.dateLabel}</span>
                <div className="doc-v doc-mono">{displayValue(dateKind, p.data.doc_date) || '—'}</div>
              </>
            )}
          </div>
        </div>
        {sections.map((s, i) => (
          <section key={s.title} className="doc-sec">
            <h2 className="doc-bar">
              {def.unnumbered ? '' : `${i + 1} · `}
              {s.title}
              {s.note ? <i>{s.note}</i> : null}
            </h2>
            {s.fields?.length ? (
              <div className="doc-g">
                {s.fields.map((f) => (
                  <Field key={f.id} f={f} p={p} />
                ))}
              </div>
            ) : null}
            {s.table ? <Table t={s.table} p={p} /> : null}
            {s.after?.length ? (
              <div className="doc-g">
                {s.after
                  .filter((f) => !s.signatures)
                  .map((f) => (
                    <Field key={f.id} f={f} p={p} />
                  ))}
              </div>
            ) : null}
            {s.terms ? (
              <ol className="doc-terms">
                {s.terms.map(([lead, text]) => (
                  <li key={lead}>
                    <b>{lead}</b> {text}
                  </li>
                ))}
              </ol>
            ) : null}
            {s.signatures?.map((g, j) => (
              <Signatures key={j} s={g} p={p} />
            ))}
            {s.signatures && s.after?.length ? (
              <div className="doc-g">
                {s.after.map((f) => (
                  <Field key={f.id} f={f} p={p} />
                ))}
              </div>
            ) : null}
            {s.notice ? (
              <p className="doc-notice">
                <b>{s.notice[0].toUpperCase()}:</b> {s.notice[1]}
              </p>
            ) : null}
          </section>
        ))}
      </div>
      <footer className="paper-foot id">
        {p.brokerage.name} · {meta.numberLabel} {p.docNo}
        {def.footerAgreement && agreementNo ? ` · Agreement No. ${agreementNo}` : ''} · Form {meta.formNo}
      </footer>
    </article>
  );
}
