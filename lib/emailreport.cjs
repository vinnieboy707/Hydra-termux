'use strict';
// The daily report as an email (2.9.12): a professional HTML page that reads well in Gmail, Outlook and phone mail
// (tables and inline styles only; no scripts, no images, no tracking), with the plain text kept as the fallback.
// What it shows, every day: where the money is (verified from receipts), how many steps are left from today to
// $100,000 and which one is next, the road to cash with who acts on each step, the profit ladder with what you keep
// after the 30% tax reserve, what needs you (with the exact command), and what the VP decided. Buttons open your
// portal (CHRONOS_PORTAL_URL) at the right section; without a portal url the buttons are left out.

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const usd = (v) => { const n = Number(v) || 0; return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
const C = { ink: '#0f172a', sub: '#475569', faint: '#94a3b8', line: '#e2e8f0', bg: '#f1f5f9', card: '#ffffff', brand: '#0b1f3a', accent: '#2563eb', ok: '#15803d', okBg: '#dcfce7', warn: '#b45309', warnBg: '#fef3c7', bad: '#b91c1c', badBg: '#fee2e2' };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

function pill(text, tone) {
  const [fg, bg] = tone === 'ok' ? [C.ok, C.okBg] : tone === 'bad' ? [C.bad, C.badBg] : [C.warn, C.warnBg];
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;color:${fg};background:${bg}">${esc(text)}</span>`;
}
function bar(pct, color = C.accent) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td style="background:${C.line};border-radius:4px;height:8px;padding:0"><table role="presentation" width="${p || 1}%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td style="background:${p ? color : C.line};border-radius:4px;height:8px;font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr></table>`;
}
function button(label, href) {
  return `<a href="${esc(href)}" style="display:inline-block;margin:4px 8px 4px 0;padding:10px 16px;border-radius:8px;background:${C.accent};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px">${esc(label)}</a>`;
}
function section(title, inner) {
  return `<tr><td style="padding:8px 24px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${C.card};border:1px solid ${C.line};border-radius:12px"><tr><td style="padding:18px 20px">
<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${C.faint};font-weight:700;margin-bottom:10px">${esc(title)}</div>${inner}</td></tr></table></td></tr>`;
}
function kpi(label, value, note) {
  return `<td width="25%" valign="top" style="padding:6px"><div style="background:${C.bg};border-radius:10px;padding:12px">
<div style="font-size:11px;color:${C.sub};text-transform:uppercase;letter-spacing:.06em">${esc(label)}</div>
<div style="font-size:20px;font-weight:700;color:${C.ink};margin-top:4px">${esc(value)}</div>${note ? `<div style="font-size:11px;color:${C.faint};margin-top:2px">${esc(note)}</div>` : ''}</div></td>`;
}
// commands in a step's text become code chips you can copy
const withCode = (s) => esc(s).replace(/(chronos [a-z][a-z-]*(?: [a-z0-9_-]+)?(?: --[a-z-]+)?|cloud\/gcp-setup\.sh)/g, `<code style="font-family:${MONO};font-size:12px;background:${C.bg};border:1px solid ${C.line};border-radius:4px;padding:1px 5px;color:${C.ink}">$1</code>`);

/**
 * r: { day, version, cash: treasury kpis, trading, risk, road: milestones list, realizedUsd, needsYou: [text],
 *      decisions: [{what, outcome, why}], departments: {name: status}, vpNote, objective: {n, of, text}, portalUrl }
 * → { subject, html }
 */
function build(r) {
  const M = require('./milestones.cjs');
  const F = r.cash || {}, T = r.trading || {}, K = r.risk || {};
  const road = r.road || [];
  const steps = M.stepsLeft(road, r.realizedUsd ?? F.realizedNetUsdAllTime);
  const cur = road.find((m) => !m.done) || null;
  const mode = K.mode || 'SHADOW';
  const tone = mode === 'LIVE' ? 'ok' : K.safeMode || (r.needsYou || []).length ? 'warn' : 'warn';
  const portal = /^https:\/\//.test(r.portalUrl || '') ? r.portalUrl.replace(/\/+$/, '') : null;
  const subject = `Chronos daily report · ${r.day} · ${usd(F.netUsdLast24h)} 24 h · ${steps.left} steps to $100k`;

  const header = `<tr><td style="background:${C.brand};padding:24px;border-radius:12px 12px 0 0">
<div style="font-size:12px;color:#93c5fd;letter-spacing:.1em;text-transform:uppercase;font-weight:700">APEX Sovereign · Chronos</div>
<div style="font-size:22px;color:#ffffff;font-weight:700;margin-top:6px">Daily report · ${esc(r.day)}</div>
<div style="margin-top:10px">${pill(mode === 'LIVE' ? 'LIVE: trading' : `${mode}: rehearsing, nothing sent`, tone)} ${K.safeMode ? pill('SAFE MODE', 'bad') : ''} <span style="font-size:12px;color:#cbd5e1;margin-left:6px">v${esc(r.version || '')}</span></div></td></tr>`;

  const kpis = section('Money (verified from receipts)', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
${kpi('Last 24 h', usd(F.netUsdLast24h), `${F.tradesLast24h || 0} trade(s)`)}${kpi('All time', usd(F.realizedNetUsdAllTime), `gas ${usd(F.realizedGasUsdAllTime)}`)}${kpi('Tax reserve', usd(F.taxReserveUsd), '30% of profit')}${kpi('Executor gas', F.executorGasEth == null ? '—' : `${Number(F.executorGasEth).toFixed(4)} ETH`, F.executorReady ? 'ready' : 'not ready')}
</tr></table>`);

  const pctDone = steps.total ? (steps.done / steps.total) * 100 : 0;
  const progress = section(`From today to $100,000 · ${steps.done} of ${steps.total} steps done · ${steps.left} left`, `${bar(pctDone)}
<div style="font-size:15px;color:${C.ink};margin-top:12px"><b>Next:</b> ${steps.next ? esc(steps.next.kind === 'road' ? `step ${steps.next.step}, ${steps.next.title}` : steps.next.title) : 'every step is done'}</div>
${cur ? `<div style="font-size:13px;color:${C.sub};margin-top:6px">${cur.owner === 'you' ? '<b style="color:' + C.warn + '">Yours:</b> ' : '<b>Chronos is on it:</b> '}${withCode(cur.todo || '')}</div>` : ''}
${r.objective ? `<div style="font-size:12px;color:${C.faint};margin-top:8px">VP objective ${r.objective.n} of ${r.objective.of}: ${esc(r.objective.text)}</div>` : ''}
${portal ? `<div style="margin-top:12px">${button('Open the road to cash', portal + '/#road')}${button('Portal', portal + '/')}</div>` : ''}`);

  const roadRows = road.map((m) => {
    const mark = m.done ? `<span style="color:${C.ok};font-weight:700">✓</span>` : m === cur ? `<span style="color:${C.accent};font-weight:700">▶</span>` : `<span style="color:${C.faint}">○</span>`;
    const who = m.owner === 'you' ? pill('you', 'warn') : pill('Chronos', 'ok');
    const detail = m.done ? esc(m.evidence || 'verified') : withCode(m.todo || '');
    return `<tr><td valign="top" width="22" style="padding:8px 0;font-size:15px">${mark}</td><td style="padding:8px 0;border-bottom:1px solid ${C.line}">
<div style="font-size:14px;color:${C.ink};font-weight:${m === cur ? 700 : 500}">${m.step}. ${esc(m.title)} <span style="font-size:11px;color:${C.faint}">v${esc(m.version)}</span> ${who}</div>
<div style="font-size:12px;color:${C.sub};margin-top:3px">${detail}</div></td></tr>`;
  }).join('');
  const roadSec = section(`Road to first profit · ${road.filter((m) => m.done).length} of ${road.length}`, `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${roadRows}</table>`);

  const curRung = steps.ladder.find((x) => !x.done);
  const ladderRows = steps.ladder.map((x) => `<tr><td style="padding:7px 0;border-bottom:1px solid ${C.line}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
<td style="font-size:13px;color:${C.ink};font-weight:${x === curRung ? 700 : 500}">${x.done ? '✓' : x === curRung ? '▶' : '○'} ${x.rung}. ${esc(x.title)}</td>
<td align="right" style="font-size:12px;color:${C.sub};white-space:nowrap">you keep $${x.keepUsd.toLocaleString('en-US')}</td></tr>
<tr><td colspan="2" style="padding-top:5px">${bar(x.pct, x.done ? C.ok : C.accent)}</td></tr></table></td></tr>`).join('');
  const ladderSec = section(`Profit ladder to $100,000 · ${steps.ladder.filter((x) => x.done).length} of ${steps.ladder.length} rungs`, `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${ladderRows}</table>
<div style="font-size:11px;color:${C.faint};margin-top:8px">Counted only from on-chain receipts, after gas. "You keep" is after the 30% tax reserve.</div>`);

  const needs = (r.needsYou || []);
  const needsSec = section(`Needs you · ${needs.length}`, needs.length ? needs.map((s) => `<div style="font-size:13px;color:${C.ink};padding:8px 10px;margin-bottom:6px;background:${C.warnBg};border-radius:8px">${withCode(s)}</div>`).join('') : `<div style="font-size:13px;color:${C.ok}">Nothing needs you today.</div>`);

  const tradeSec = section('Trading and risk', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;color:${C.ink}">
<tr><td style="padding:4px 0;color:${C.sub}">Last scan</td><td align="right">${esc(T.cyclesChecked ?? '—')} cycles · ${esc(T.rawGaps ?? '—')} raw gaps · ${esc(T.approved ?? '—')} approved</td></tr>
<tr><td style="padding:4px 0;color:${C.sub}">Best route</td><td align="right">${usd(T.bestNetUsd)}</td></tr>
<tr><td style="padding:4px 0;color:${C.sub}">Top blocker</td><td align="right">${esc(T.topBlocker || 'none')}${T.topBlockerBestUsd ? ` (${usd(T.topBlockerBestUsd)})` : ''}</td></tr>
<tr><td style="padding:4px 0;color:${C.sub}">Today</td><td align="right">${esc(K.sentToday ?? 0)} sent · ${esc(K.revertsToday ?? 0)} reverted · gas ${usd(K.gasUsdToday)}</td></tr>
${K.heldWhy ? `<tr><td style="padding:4px 0;color:${C.sub}">Held because</td><td align="right">${esc(K.heldWhy)}</td></tr>` : ''}</table>`);

  const dec = (r.decisions || []).slice(-8);
  const vpSec = section('VP decisions (24 h)', `${r.vpNote ? `<div style="font-size:13px;color:${C.ink};font-style:italic;margin-bottom:10px">${esc(r.vpNote).slice(0, 1500)}</div>` : ''}${dec.length ? dec.map((d) => `<div style="font-size:12px;color:${C.sub};padding:3px 0">• <b style="color:${C.ink}">${esc(d.what)}</b>: ${esc(d.outcome)}${d.why ? ' · ' + esc(d.why) : ''}</div>`).join('') : `<div style="font-size:12px;color:${C.sub}">No decisions in the last 24 h.</div>`}
${r.departments ? `<div style="margin-top:10px">${Object.entries(r.departments).map(([k, v]) => pill(`${k}: ${String(v).toUpperCase()}`, v === 'green' ? 'ok' : v === 'red' ? 'bad' : 'warn')).join(' ')}</div>` : ''}`);

  const footer = `<tr><td style="padding:18px 24px 28px;font-size:11px;color:${C.faint};text-align:center">Chronos never sends a trade or moves money because of an email; every money action needs you (YES).<br>Reply commands run in Termux on your phone. Sent once a day; urgent alerts come separately.</td></tr>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:${FONT}">
<div style="display:none;max-height:0;overflow:hidden">${esc(`${steps.left} steps to $100k · next: ${steps.next ? (steps.next.title || '') : 'done'} · ${needs.length} need you`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${C.bg}"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:640px">
${header}${kpis}${progress}${needsSec}${roadSec}${ladderSec}${tradeSec}${vpSec}${footer}
</table></td></tr></table></body></html>`;
  return { subject, html };
}

module.exports = { build, esc, usd };
