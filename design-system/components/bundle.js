/* @ds-bundle: {"format":4,"namespace":"JR","components":[{"name":"Logo"},{"name":"Icon"},{"name":"Button"},{"name":"FilterChip"},{"name":"StatusStamp"},{"name":"StatusPill"},{"name":"TextField"},{"name":"SelectField"},{"name":"SearchBar"},{"name":"ListingCard"},{"name":"PriceDisplay"},{"name":"StatRow"},{"name":"AreaChip"},{"name":"AgentCard"},{"name":"SalesLedger"},{"name":"ProcessSteps"},{"name":"ReferenceReceipt"},{"name":"EmptyState"},{"name":"NavBar"},{"name":"PortalSidebar"},{"name":"DocumentHeader"},{"name":"SignatureLine"},{"name":"ConfidentialPanel"},{"name":"StatTile"},{"name":"PipelineCard"},{"name":"Toast"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  var ICONS = {"bed":["M3 6v13","M3 15h18v4","M3 12h7v3","M10 11h8a3 3 0 0 1 3 3v1","M5.5 9.5h2.5v2h-2.5z"],"bath":["M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z","M6 12V6.5a2 2 0 0 1 4 0","M7 19l-1 2","M17 19l1 2"],"garage":["M3 21V9l9-5 9 5v12","M7 21v-8h10v8","M7 16h10"],"area":["M4 4h16v16H4z","M8 16l8-8","M12.5 8H16v3.5","M8 12.5V16h3.5"],"lot":["M3 20l4-14h10l4 14z","M9.5 6l-1 14","M14.5 6l1 14","M5 13h14"],"calendar":["M4 6h16v14H4z","M4 10h16","M8 3v4","M16 3v4","M8 14h2","M14 14h2"],"pool":["M3 17c2 0 2-1.5 4.5-1.5S9.5 17 12 17s2.5-1.5 4.5-1.5S19 17 21 17","M3 21c2 0 2-1.5 4.5-1.5S9.5 21 12 21s2.5-1.5 4.5-1.5S19 21 21 21","M8 14V5.5a2 2 0 0 1 4 0","M14 14V5.5a2 2 0 0 1 4 0","M8 9h6","M8 12h6"],"office":["M4 14h16","M6 14v6","M18 14v6","M8 4h8v7H8z","M12 11v3"],"laundry":["M5 3h14v18H5z","M5 7.5h14","M8 5.3h1.5","M8.2 14a3.8 3.8 0 1 0 7.6 0a3.8 3.8 0 1 0 -7.6 0"],"gate":["M4 21V5","M20 21V5","M4 9h16","M4 17h16","M9 9v8","M12 9v8","M15 9v8"],"pin":["M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z","M9.5 9.5a2.5 2.5 0 1 0 5.0 0a2.5 2.5 0 1 0 -5.0 0"],"school":["M2 9l10-5 10 5-10 5z","M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5","M22 9v6"],"police":["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z","M9 12l2 2 4-4"],"fire":["M12 21c-4 0-7-2.5-7-6.5 0-3 2-5 3-7 1 2 2 3 3 3 0-3 1-5.5 3-7.5 1 3 5 5.5 5 11.5 0 4-3 6.5-7 6.5z"],"key":["M4 15a4 4 0 1 0 8 0a4 4 0 1 0 -8 0","M11 12l9-9","M17 6l3 3","M14.5 8.5l2 2"],"document":["M6 3h9l4 4v14H6z","M15 3v4h4","M9 12h7","M9 16h7"],"stamp":["M9 13V9a3 3 0 1 1 6 0v4","M5 13h14v4H5z","M4 21h16"],"chat":["M4 5h16v11H9l-5 4z"],"search":["M5 11a6 6 0 1 0 12 0a6 6 0 1 0 -12 0","M20 20l-4.5-4.5"],"filter":["M4 6h16","M7 12h10","M10 18h4"],"heart":["M12 20s-8-5-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15 12 20 12 20z"],"arrow-right":["M5 12h14","M13 6l6 6-6 6"],"lock":["M6 11h12v10H6z","M8 11V7a4 4 0 0 1 8 0v4"],"camera":["M4 7h4l2-3h4l2 3h4v13H4z","M8.5 13a3.5 3.5 0 1 0 7.0 0a3.5 3.5 0 1 0 -7.0 0"],"user":["M8 8a4 4 0 1 0 8 0a4 4 0 1 0 -8 0","M4 21c1-4 4-6 8-6s7 2 8 6"],"users":["M5.5 8a3.5 3.5 0 1 0 7.0 0a3.5 3.5 0 1 0 -7.0 0","M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5","M15.5 4.8a3.5 3.5 0 0 1 0 6.4","M17.5 14.8c2 .7 3.4 2.4 4 5.2"],"chart":["M4 20V4","M4 20h16","M8 16v-5","M12 16V8","M16 16v-3"],"check":["M5 12.5l4.5 4.5L19 7.5"],"menu":["M4 7h16","M4 12h16","M4 17h16"],"home":["M3 11l9-7 9 7","M5 9.5V20h14V9.5","M10 20v-6h4v6"],"list":["M9 6h11","M9 12h11","M9 18h11","M4 6h1","M4 12h1","M4 18h1"],"pipeline":["M4 4h4v16H4z","M10 4h4v10h-4z","M16 4h4v6h-4z"],"inbox":["M4 4h16v16H4z","M4 14h4.5l1.5 2.5h4l1.5-2.5H20"],"bell":["M6 16V11a6 6 0 0 1 12 0v5l2 2H4z","M10 20.5h4"],"activity":["M3 12h4l3-7 4 14 3-7h4"],"settings":["M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0","M12 2.5v3","M12 18.5v3","M2.5 12h3","M18.5 12h3","M5.3 5.3l2.1 2.1","M16.6 16.6l2.1 2.1","M5.3 18.7l2.1-2.1","M16.6 7.4l2.1-2.1"],"dollar":["M12 3v18","M16.5 7.5c-.6-1.6-2.3-2.5-4.5-2.5-2.6 0-4.5 1.3-4.5 3.3 0 4.7 9.5 2.4 9.5 7.3 0 2-2 3.4-5 3.4-2.4 0-4.2-1-4.8-2.8"],"share":["M3.5 12a2.5 2.5 0 1 0 5.0 0a2.5 2.5 0 1 0 -5.0 0","M15.5 6a2.5 2.5 0 1 0 5.0 0a2.5 2.5 0 1 0 -5.0 0","M15.5 18a2.5 2.5 0 1 0 5.0 0a2.5 2.5 0 1 0 -5.0 0","M8.3 10.8l7.4-3.6","M8.3 13.2l7.4 3.6"],"image":["M4 5h16v14H4z","M4 16l5-5 4 4 2.5-2.5L20 17","M14.0 9a1.5 1.5 0 1 0 3.0 0a1.5 1.5 0 1 0 -3.0 0"]};

  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  function omit(o, keys) { var r = {}; for (var k in o) { if (keys.indexOf(k) < 0) r[k] = o[k]; } return r; }
  function money(v) {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'number') return '$' + Math.round(v).toLocaleString('en-US');
    return String(v);
  }
  function initials(name) {
    return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
  }

  var STATUS = {
    'available': ['Available', 'available'], 'active': ['Active', 'available'],
    'just-listed': ['Just Listed', 'new'], 'coming-soon': ['Coming Soon', 'new'], 'price-reduced': ['Price Reduced', 'new'],
    'under-offer': ['Under Offer', 'offer'], 'under-contract': ['Under Contract', 'offer'],
    'sold': ['Sold', 'sold'], 'settled': ['Settled', 'sold'],
    'for-lease': ['For Lease', 'lease'], 'leased': ['Leased', 'lease'],
    'draft': ['Draft', 'off'], 'off-market': ['Off Market', 'off'], 'withdrawn': ['Withdrawn', 'off'], 'archived': ['Archived', 'off'],
    'pending-review': ['Pending Review', 'offer'], 'changes-requested': ['Changes Requested', 'offer'], 'rejected': ['Rejected', 'confidential'],
    'listed-by-owner': ['Listed by Owner', 'lease'],
    'confidential': ['Confidential', 'confidential']
  };
  function status(s) { return STATUS[s] || [String(s || ''), 'off']; }

  /* Icon */
  function Icon(p) {
    var size = p.size || 20;
    var d = ICONS[p.name] || [];
    return h('svg', {
      className: cx('jr-icon', p.className), width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'square', strokeLinejoin: 'miter',
      role: p.label ? 'img' : undefined, 'aria-label': p.label || undefined, 'aria-hidden': p.label ? undefined : true
    }, d.map(function (x, i) { return h('path', { key: i, d: x }); }));
  }
  Icon.names = Object.keys(ICONS);

  /* Logo */
  function Mark(p) {
    var size = p.size || 40;
    var roof = p.tone === 'dark' ? 'var(--cream)' : 'var(--green-900)';
    var brass = { fill: 'none', stroke: 'var(--brass-500)' };
    return h('svg', { className: 'jr-mark', viewBox: '0 0 48 48', width: size, height: size, role: 'img', 'aria-label': p.decorative ? undefined : "Johnson's Realty", 'aria-hidden': p.decorative ? true : undefined },
      h('rect', { x: 1.2, y: 1.2, width: 45.6, height: 45.6, style: Object.assign({ strokeWidth: 1.6 }, brass) }),
      h('path', { d: 'M10 23 L24 11 L38 23', style: { fill: 'none', stroke: roof, strokeWidth: 2.8, strokeLinecap: 'square' } }),
      h('path', { d: 'M15.1 31a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0', style: Object.assign({ strokeWidth: 2.4 }, brass) }),
      h('path', { d: 'M23.9 31H36M31.5 31v4M34.6 31v3', style: Object.assign({ strokeWidth: 2.4 }, brass) }));
  }
  function Logo(p) {
    var tone = p.tone || 'light', size = p.size || (p.small ? 32 : 44);
    if (p.variant === 'mark') return h(Mark, { tone: tone, size: size });
    return h(p.href ? 'a' : 'span', { className: cx('jr-logo', 'jr-logo--' + tone, p.small && 'jr-logo--sm', p.className), href: p.href },
      h(Mark, { tone: tone, size: size, decorative: true }),
      h('span', null,
        h('span', { className: 'jr-logo-word' }, "Johnson’s Realty"),
        p.subline === false ? null : h('span', { className: 'jr-logo-sub' }, p.subline || 'Brokerage · Pennsylvania')));
  }

  /* Button */
  function Button(p) {
    var variant = p.variant || 'primary';
    var rest = omit(p, ['variant', 'size', 'icon', 'iconRight', 'withKey', 'loading', 'children', 'className', 'href']);
    var tag = p.href ? 'a' : 'button';
    if (!p.href && rest.type === undefined) rest.type = 'button';
    return h(tag, Object.assign(rest, {
      href: p.href, className: cx('jr-btn', 'jr-btn--' + variant, p.size === 'sm' && 'jr-btn--sm', p.loading && 'jr-btn--loading', p.className),
      'aria-busy': p.loading ? true : undefined
    }),
      p.icon ? h(Icon, { name: p.icon, size: 18 }) : null,
      p.children,
      p.withKey ? h(Icon, { name: 'key', size: 18, className: 'jr-btn-key' }) : (p.iconRight ? h(Icon, { name: p.iconRight, size: 18 }) : null));
  }

  /* FilterChip */
  function FilterChip(p) {
    return h('button', { type: 'button', className: 'jr-filter', 'aria-pressed': !!p.selected, onClick: p.onClick },
      p.selected ? h(Icon, { name: 'check', size: 16 }) : null, p.children,
      p.count !== undefined ? h('span', { className: 'jr-filter-count' }, p.count) : null);
  }

  /* Status */
  function StatusStamp(p) {
    var s = status(p.status), label = p.label || s[0];
    if (p.variant === 'ribbon') return h('span', { className: cx('jr-ribbon', 'jr-tone-' + s[1], p.className) }, label);
    return h('span', { className: cx('jr-stamp', 'jr-tone-' + s[1], p.size && 'jr-stamp--' + p.size, p.press && 'jr-stamp--press', p.className) }, label);
  }
  function StatusPill(p) {
    var s = status(p.status);
    return h('span', { className: cx('jr-pill', 'jr-tone-' + s[1], p.className) }, h('i', { className: 'jr-pill-dot', 'aria-hidden': true }), p.label || s[0]);
  }

  /* Fields */
  function TextField(p) {
    var id = p.id || ('f-' + String(p.label || 'field').toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    var rest = omit(p, ['label', 'hint', 'error', 'mono', 'multiline', 'className']);
    rest.id = id;
    rest.className = cx('jr-field-input', p.mono && 'jr-mono');
    rest['aria-invalid'] = p.error ? true : undefined;
    rest['aria-describedby'] = (p.hint || p.error) ? id + '-hint' : undefined;
    return h('div', { className: cx('jr-field', p.error && 'jr-field--error', p.className) },
      h('label', { className: 'jr-field-label', htmlFor: id }, p.label),
      h(p.multiline ? 'textarea' : 'input', rest),
      (p.error || p.hint) ? h('p', { className: 'jr-field-hint', id: id + '-hint' }, p.error || p.hint) : null);
  }
  function SelectField(p) {
    var id = p.id || ('s-' + String(p.label || 'select').toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    var rest = omit(p, ['label', 'hint', 'error', 'options', 'className', 'placeholder']);
    rest.id = id; rest.className = 'jr-field-input';
    var opts = (p.options || []).map(function (o, i) {
      var v = typeof o === 'string' ? { value: o, label: o } : o;
      return h('option', { key: i, value: v.value }, v.label);
    });
    if (p.placeholder) opts.unshift(h('option', { key: 'ph', value: '' }, p.placeholder));
    return h('div', { className: cx('jr-field', p.error && 'jr-field--error', p.className) },
      h('label', { className: 'jr-field-label', htmlFor: id }, p.label),
      h('select', rest, opts),
      (p.error || p.hint) ? h('p', { className: 'jr-field-hint' }, p.error || p.hint) : null);
  }

  /* SearchBar */
  function SearchBar(p) {
    var fields = p.fields || [];
    return h('form', { className: 'jr-search', role: 'search', onSubmit: function (e) { e.preventDefault(); if (p.onSearch) p.onSearch(e); } },
      fields.map(function (f, i) {
        var id = 'q-' + (f.name || i);
        return h('div', { className: 'jr-search-seg', key: id },
          h('label', { htmlFor: id }, f.label),
          h('select', { id: id, name: f.name, defaultValue: f.value },
            (f.options || []).map(function (o, j) { var v = typeof o === 'string' ? { value: o, label: o } : o; return h('option', { key: j, value: v.value }, v.label); })));
      }),
      h(Button, { type: 'submit', icon: 'search' }, p.submitLabel || 'Search'));
  }

  /* Price, stats */
  function PriceDisplay(p) {
    var kind = p.kind || 'sale';
    var label = p.label !== undefined ? p.label : ({ sale: 'Asking', sold: 'Sold for', rent: 'Rent', reduced: 'Now' })[kind];
    return h('div', { className: cx('jr-price', p.size === 'xl' && 'jr-price--xl', p.className) },
      label ? h('span', { className: 'jr-price-label' }, label) : null,
      h('div', { className: 'jr-price-line' },
        p.previous ? h('s', { className: 'jr-price-prev', 'aria-label': 'Was ' + money(p.previous) }, money(p.previous)) : null,
        h('span', { className: 'jr-price-amt' }, money(p.amount), kind === 'rent' ? h('span', { className: 'jr-price-unit' }, '/mo') : null)));
  }
  function StatRow(p) {
    return h('div', { className: cx('jr-stats', p.className) }, (p.items || []).map(function (it, i) {
      return h('div', { className: 'jr-stat', key: i }, it.icon ? h(Icon, { name: it.icon, size: 20 }) : null, h('b', null, it.value), h('span', null, it.label));
    }));
  }

  /* ListingCard */
  function ListingCard(p) {
    var media = p.photo
      ? h('div', { className: 'jr-card-img', style: { backgroundImage: 'url("' + p.photo + '")' }, role: 'img', 'aria-label': p.photoAlt || ('Photo of ' + p.address) })
      : h('div', { className: 'jr-card-ph' }, h(Mark, { size: 40, decorative: true }), 'Photos coming soon');
    return h('article', { className: cx('jr-card', p.layout === 'list' && 'jr-card--list', p.className) },
      h(p.href ? 'a' : 'div', { className: 'jr-card-media', href: p.href, tabIndex: p.href ? -1 : undefined, 'aria-hidden': p.href ? true : undefined },
        media,
        p.status ? h('span', { className: 'jr-card-flag' }, h(StatusStamp, { status: p.status, label: p.statusLabel, variant: 'ribbon' })) : null),
      h('div', { className: 'jr-card-body' },
        p.area ? h('p', { className: 'jr-card-area' }, p.area) : null,
        h('h3', { className: 'jr-card-addr' }, p.href ? h('a', { href: p.href }, p.address) : p.address),
        p.facts && p.facts.length ? h('ul', { className: 'jr-card-facts' }, p.facts.map(function (f, i) {
          return h('li', { key: i }, f.icon ? h(Icon, { name: f.icon, size: 16 }) : null, f.text);
        })) : null,
        h('div', { className: 'jr-card-foot' },
          h(PriceDisplay, { amount: p.price, kind: p.priceKind || 'sale', label: p.priceLabel, previous: p.previousPrice }),
          p.onSave !== undefined || p.saved !== undefined ? h('button', {
            type: 'button', className: 'jr-card-save', 'aria-pressed': !!p.saved,
            'aria-label': p.saved ? 'Remove from saved homes' : 'Save home', onClick: p.onSave
          }, h(Icon, { name: 'heart', size: 20 })) : null)));
  }

  /* AreaChip */
  function AreaChip(p) {
    return h(p.href ? 'a' : 'span', { className: 'jr-chip', href: p.href },
      h(Icon, { name: 'pin', size: 16 }), p.name,
      p.zip ? h('span', { className: 'jr-chip-zip' }, p.zip) : null,
      p.count !== undefined ? h('span', { className: 'jr-chip-count' }, p.count) : null);
  }

  /* AgentCard */
  function AgentCard(p) {
    return h('article', { className: cx('jr-agent', p.className) },
      h('div', { className: 'jr-agent-avatar', style: p.photo ? { backgroundImage: 'url("' + p.photo + '")' } : undefined, role: p.photo ? 'img' : undefined, 'aria-label': p.photo ? p.name : undefined }, p.photo ? null : initials(p.name)),
      h('div', { style: { minWidth: 0 } },
        h('h3', { className: 'jr-agent-name' }, p.name),
        p.title ? h('p', { className: 'jr-agent-title' }, p.title) : null,
        p.handle ? h('p', { className: 'jr-agent-handle' }, 'Chirper @' + String(p.handle).replace(/^@/, '')) : null,
        p.stats && p.stats.length ? h('ul', { className: 'jr-agent-stats' }, p.stats.map(function (s, i) { return h('li', { key: i }, h('b', null, s.value), h('span', null, s.label)); })) : h('div', { style: { height: 12 } }),
        p.action !== false ? h(Button, { variant: 'secondary', size: 'sm', onClick: p.onContact, href: p.href }, p.actionLabel || ('Contact ' + String(p.name || '').split(' ')[0])) : null));
  }

  /* SalesLedger */
  function SalesLedger(p) {
    var rows = p.rows || [];
    var cols = p.columns || ['no', 'date', 'property', 'agent', 'price'];
    var head = { no: 'No.', date: 'Date', property: 'Property', agent: 'Agent', status: 'Status', price: 'Price' };
    function cell(c, r) {
      if (c === 'no') return h('td', { className: 'num', key: c }, r.no);
      if (c === 'date') return h('td', { className: 'num', key: c }, r.date);
      if (c === 'property') return h('td', { key: c }, h('span', { className: 'jr-ledger-addr' }, r.address), r.area ? h('span', { className: 'jr-ledger-area' }, r.area) : null);
      if (c === 'agent') return h('td', { key: c }, r.agent);
      if (c === 'status') return h('td', { key: c }, h(StatusPill, { status: r.status }));
      if (c === 'price') return h('td', { className: 'num right', key: c }, money(r.price));
      return h('td', { key: c }, r[c]);
    }
    return h('div', { className: 'jr-ledger-wrap' },
      h('table', { className: 'jr-ledger' },
        p.caption ? h('caption', null, p.caption) : null,
        h('thead', null, h('tr', null, cols.map(function (c) { return h('th', { key: c, className: c === 'price' ? 'right' : undefined, scope: 'col' }, head[c] || c); }))),
        h('tbody', null, rows.map(function (r, i) { return h('tr', { key: i }, cols.map(function (c) { return cell(c, r); })); })),
        p.total ? h('tfoot', null, h('tr', null, h('td', { colSpan: cols.length - 1 }, p.totalLabel || 'Total'), h('td', { className: 'num right' }, money(p.total)))) : null));
  }

  /* ProcessSteps */
  function ProcessSteps(p) {
    return h('ol', { className: 'jr-steps' }, (p.steps || []).map(function (s, i) { return h('li', { key: i }, h('h4', null, s.title), h('p', null, s.text)); }));
  }

  /* ReferenceReceipt */
  function ReferenceReceipt(p) {
    return h('section', { className: 'jr-receipt', role: 'status' },
      h('span', { className: 'jr-eyebrow' }, p.eyebrow || 'Request received'),
      h('h3', null, p.title),
      h('div', { className: 'jr-receipt-ref' }, h('span', null, p.refLabel || 'Your reference number'), h('b', null, p.reference)),
      p.text ? h('p', null, p.text) : null,
      p.action || null);
  }

  /* EmptyState */
  function EmptyState(p) {
    return h('section', { className: 'jr-empty' }, h(Icon, { name: p.icon || 'search', size: 28 }), h('h3', null, p.title), p.text ? h('p', null, p.text) : null, p.action || null);
  }

  /* NavBar */
  function NavBar(p) {
    return h('header', { className: 'jr-nav' },
      h(Logo, { href: p.homeHref || '/', small: true, subline: false }),
      h('nav', { 'aria-label': 'Main' }, h('ul', null, (p.links || []).map(function (l, i) {
        return h('li', { key: i }, h('a', { href: l.href, 'aria-current': l.active ? 'page' : undefined }, l.label));
      }))),
      h('div', { className: 'jr-nav-actions' },
        p.portalHref ? h(Button, { variant: 'ghost', size: 'sm', href: p.portalHref, icon: 'user' }, 'Portal') : null,
        p.cta ? h(Button, { size: 'sm', href: p.cta.href, withKey: true }, p.cta.label) : null,
        h('button', { type: 'button', className: 'jr-btn jr-btn--ghost jr-btn--sm jr-nav-menu', 'aria-label': 'Open menu', onClick: p.onMenu }, h(Icon, { name: 'menu', size: 20 }))));
  }

  /* PortalSidebar */
  function PortalSidebar(p) {
    var nodes = [];
    (p.groups || []).forEach(function (g, gi) {
      if (g.label) nodes.push(h('div', { className: 'jr-side-group', key: 'g' + gi }, g.label));
      (g.items || []).forEach(function (it, ii) {
        nodes.push(h('a', { key: gi + '-' + ii, href: it.href, 'aria-current': it.active ? 'page' : undefined },
          h(Icon, { name: it.icon, size: 18 }), it.label, it.count !== undefined ? h('span', { className: 'jr-side-count' }, it.count) : null));
      });
    });
    return h('aside', { className: 'jr-side', 'aria-label': 'Portal' },
      h(Logo, { tone: 'dark', small: true, subline: 'Agent portal' }),
      h('nav', null, nodes),
      p.user ? h('div', { className: 'jr-side-user' }, h('span', { className: 'jr-mono-avatar' }, initials(p.user.name)), h('div', null, h('b', null, p.user.name), h('span', null, p.user.role))) : null);
  }

  /* DocumentHeader */
  function DocumentHeader(p) {
    return h('header', { className: 'jr-doc' },
      h('div', { className: 'jr-doc-band' },
        h(Logo, { tone: 'dark', subline: p.subline }),
        p.contact ? h('div', { className: 'jr-doc-contact' }, p.contact.map(function (c, i) { return h('div', { key: i }, c.label ? h('b', null, c.label + ' ') : null, c.value); })) : null),
      h('div', { className: 'jr-doc-title' },
        h('h1', null, p.title),
        p.subtitle ? h('div', { className: 'jr-doc-sub' }, p.subtitle) : null,
        p.formNo ? h('div', { className: 'jr-doc-ref' }, p.formNo) : null),
      h('div', { className: 'jr-doc-rule' }));
  }

  /* SignatureLine */
  function SignatureLine(p) {
    return h('div', { className: 'jr-sig' },
      h('div', { className: cx('jr-sig-name', !p.name && 'jr-sig-name--empty') }, p.name || 'Not yet signed'),
      h('div', { className: 'jr-sig-meta' }, h('span', null, p.label), p.date ? h('time', null, p.date) : null));
  }

  /* ConfidentialPanel */
  function ConfidentialPanel(p) {
    return h('section', { className: 'jr-conf', 'aria-label': p.title || 'Confidential' },
      h('div', { className: 'jr-conf-head' }, h(Icon, { name: 'lock', size: 16 }), p.title || 'Confidential', h('small', null, p.note || 'Agents only')),
      h('dl', null, (p.rows || []).reduce(function (a, r, i) {
        a.push(h('dt', { key: 't' + i }, r.label));
        a.push(h('dd', { key: 'd' + i, className: r.mono ? 'num' : undefined }, p.redacted ? h('span', { className: 'jr-redact', role: 'img', 'aria-label': 'Hidden' }) : r.value));
        return a;
      }, [])));
  }

  /* StatTile */
  function StatTile(p) {
    return h('div', { className: 'jr-tile' },
      h('span', { className: 'jr-tile-label' }, p.label),
      h('span', { className: 'jr-tile-value' }, p.value),
      p.meta ? h('span', { className: cx('jr-tile-meta', p.trend && 'jr-tile-meta--' + p.trend) }, p.trend === 'up' ? '▲ ' : p.trend === 'down' ? '▼ ' : '', p.meta) : null);
  }

  /* PipelineCard */
  function PipelineCard(p) {
    return h('article', { className: 'jr-pipe' },
      h('div', null, h(StatusPill, { status: p.status })),
      h('h4', null, p.address),
      p.client ? h('p', null, p.client) : null,
      h('div', { className: 'jr-pipe-foot' },
        h('span', null, money(p.value)),
        p.due ? h('time', null, p.due) : null,
        p.agent ? h('span', { className: 'jr-mono-avatar', title: p.agent }, initials(p.agent)) : null));
  }

  /* Toast */
  function Toast(p) {
    return h('div', { className: cx('jr-toast', p.tone && 'jr-toast--' + p.tone), role: 'status' },
      h('i', { className: 'jr-toast-mark', 'aria-hidden': true }), h('span', null, p.message),
      p.action ? h('button', { type: 'button', onClick: p.action.onClick }, p.action.label) : null);
  }

  var W = window;
  W.JR = W.JR || {};
  Object.assign(W.JR, {
    Logo: Logo, Icon: Icon, Button: Button, FilterChip: FilterChip, StatusStamp: StatusStamp, StatusPill: StatusPill,
    TextField: TextField, SelectField: SelectField, SearchBar: SearchBar, ListingCard: ListingCard, PriceDisplay: PriceDisplay,
    StatRow: StatRow, AreaChip: AreaChip, AgentCard: AgentCard, SalesLedger: SalesLedger, ProcessSteps: ProcessSteps,
    ReferenceReceipt: ReferenceReceipt, EmptyState: EmptyState, NavBar: NavBar, PortalSidebar: PortalSidebar,
    DocumentHeader: DocumentHeader, SignatureLine: SignatureLine, ConfidentialPanel: ConfidentialPanel, StatTile: StatTile,
    PipelineCard: PipelineCard, Toast: Toast, STATUS: STATUS
  });
})();
