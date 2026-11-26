'use strict';
// Every failure, mirrored. When a route fails, the price gap that made it lose points the other way: the same pools in
// the opposite direction gain what this direction lost, minus the fees and gas both directions pay. The scanner quotes
// both directions of every shortlisted route (lib/scan.cjs flips them); this module pairs each failed route with its
// mirror and says what the mirror did, with real quotes only:
//   · mirror approved          → a success: it is taken (shadow test, then LIVE by your rules) and you are told;
//   · mirror profitable, below your floor → a lead: the gap to your floor is the number to beat;
//   · both directions lose     → the price gap is smaller than the round trip's fees and gas (the "fee wall"),
//                                measured here, so the desk knows the size of gap that would pay.
// A mirror success fires the success webhook (kind 'mirror', level 'success') and a phone notification, at most once
// per route every 6 hours. Honest limit: the opposite of a loss is often a smaller loss, because both directions pay
// fees; every one is still checked.
const SIX_H = 6 * 3600000;
const usd = (v) => (Number(v) < 0 ? '-$' : '$') + Math.abs(Number(v) || 0).toFixed(2);

/** the forward/reverse pairs of one scan, both quoted */
function pairs(res) {
  const cs = (res && res.candidates) || []; const byKey = new Map(cs.filter((c) => c.key).map((c) => [c.key, c]));
  const out = [];
  for (const r of cs) if (r.flip === 'reverse' && r.flipOf && byKey.has(r.flipOf)) out.push({ forward: byKey.get(r.flipOf), reverse: r });
  return out;
}

/** each failed route with what its mirror did */
function mirrors(res, floorUsd) {
  const out = [];
  for (const { forward, reverse } of pairs(res)) {
    for (const [failed, mirror] of [[forward, reverse], [reverse, forward]]) {
      if (failed.approved || !Number.isFinite(failed.netUsd) || !Number.isFinite(mirror.netUsd)) continue;
      const kind = mirror.approved ? 'success' : mirror.netUsd > 0 ? 'lead' : 'fee-wall';
      // fee wall: how much bigger the price gap must be for the better direction to clear your floor
      const wall = Math.max(0, (Number.isFinite(floorUsd) ? floorUsd : 0) - Math.max(failed.netUsd, mirror.netUsd));
      out.push({ kind, failed, mirror, gainUsd: mirror.netUsd - failed.netUsd, wallUsd: wall, path: (mirror.loopPath || mirror.path || []).join('>') });
    }
  }
  return out;
}

/** one pass per scan: successes told (and webhooked), the closest lead and the fee wall kept for the report */
function capitalize(st, res, floorUsd, { now, notify = () => {}, webhook = null }) {
  st.told = st.told || {}; const ms = mirrors(res, floorUsd); const fired = [];
  for (const m of ms.filter((x) => x.kind === 'success')) {
    const k = m.mirror.key || m.path;
    if (st.told[k] && now - st.told[k] < SIX_H) continue; st.told[k] = now;
    const text = `${(m.failed.loopPath || m.failed.path || []).join('>')} failed (${usd(m.failed.netUsd)}); its mirror ${m.path} nets ${usd(m.mirror.netUsd)} at block ${res.blockNumber} and cleared every rule: it goes to its shadow test now.`;
    notify('success', '★ A failure\'s mirror pays', text); fired.push(k);
    if (webhook) webhook('mirror', { level: 'success', title: '★ A failure\'s mirror pays', text, block: res.blockNumber, failed: { path: m.failed.path, netUsd: m.failed.netUsd }, mirror: { path: m.mirror.path, netUsd: m.mirror.netUsd, key: k } }).catch(() => {});
  }
  for (const k of Object.keys(st.told)) if (now - st.told[k] > 4 * SIX_H) delete st.told[k];
  const lead = ms.filter((x) => x.kind !== 'success').sort((a, b) => b.mirror.netUsd - a.mirror.netUsd)[0] || null;
  st.last = { at: now, block: res && res.blockNumber, failures: ms.length, successes: ms.filter((x) => x.kind === 'success').length, leads: ms.filter((x) => x.kind === 'lead').length,
    best: lead ? { path: lead.path, netUsd: lead.mirror.netUsd, failedNetUsd: lead.failed.netUsd, wallUsd: lead.wallUsd } : null };
  return { mirrors: ms, fired };
}

/** report lines */
function lines(st) {
  const l = st && st.last;
  if (!l) return ['MIRRORS: no scan mirrored yet'];
  return [`MIRRORS (each failed route's opposite direction, last scan at block ${l.block}): ${l.failures} failures mirrored · ${l.successes} mirror(s) paid · ${l.leads} profitable below your floor`,
    l.best ? `  closest mirror: ${l.best.path} ${usd(l.best.netUsd)} (its failed side ${usd(l.best.failedNetUsd)}); a price gap ${usd(l.best.wallUsd)} wider would clear your floor` : '  no route had both directions quoted'];
}

module.exports = { pairs, mirrors, capitalize, lines };
