'use strict';
// The VP's honeycomb mind-state: what the company knows right now, one cell per topic (a blocker, a route, a pool, a
// node, an incident, an audit check, a decision), each cell holding its latest evidence, how often it was seen and how
// much it is worth keeping. It expands and contracts by itself:
//   · expand: a new topic gets a new cell; the cell budget grows with how much is happening (events in the last
//     hour), from MIN to MAX cells;
//   · contract: every cell's weight decays (half-life 12 h unless seen again); past the budget, the weakest cells of a
//     kind are folded into that kind's summary cell (count and last evidence kept) and removed.
// Cells hold facts the engine measured or was told by a real source (scans, logs, audits, Blockscout) — never the AI's
// guesses: an agent's conclusion is stored as its own cell kind ('analysis') and labelled as such.
// Persisted in data/mind.json; the agents read it as compact context (context()).
const fs = require('fs');
const path = require('path');

// Task-driven and sparing (your policy): cells grow only for work in progress. openTask() gives a task its room;
// facts observed for it are its cells; when the VP accepts the task (a change verified, an audit clean, a report
// delivered) collapse() folds every cell of it into ONE line — the accepted outcome — and frees the room. The mind
// itself costs no AI usage; only the lines the analyst reads do, so context() is capped too.
const MIN = 20, MAX = 120, HALF_LIFE = 12 * 3600000, PER_TASK = 15, KEEP_DONE = 30;

class Mind {
  constructor({ dataDir = null, now = () => Date.now(), min = MIN, max = MAX, halfLife = HALF_LIFE } = {}) { // max: CHRONOS_MIND_MAX_CELLS
    Object.assign(this, { now, min, max, halfLife });
    this.file = dataDir ? path.join(dataDir, 'mind.json') : null;
    this.cells = new Map(); this.events = [];
    if (this.file) { try { const j = JSON.parse(fs.readFileSync(this.file, 'utf8')); for (const c of j.cells || []) this.cells.set(c.id, c); this.events = j.events || []; } catch (_) { /* a new mind */ } }
  }
  /** how many cells the mind may hold now: grows with recent activity */
  budget() { const t = this.now(); this.events = this.events.filter((e) => t - e < 3600000); return Math.min(this.max, Math.max(this.min, this.min + PER_TASK * this.openTasks().length + Math.floor(this.events.length / 4))); }
  openTasks() { return [...this.cells.values()].filter((c) => c.kind === 'task' && !c.done); }

  // ── worker cells: the VP opens one per task; the cell does the work and checks its own quality before it may
  // submit; the VP verifies quality and effectiveness and accepts (the cell collapses to one line) or rejects with its
  // reasons (the cell works again). Three rejections → escalated to you, then collapsed with that outcome.
  /** the VP opens a worker cell for a task → the cell (state 'working') */
  openCell(id, task, { by = 'vp', maxAttempts = 3 } = {}) {
    if (by !== 'vp') throw new Error('only the VP opens cells');
    const c = this.openTask(id, task); Object.assign(c, { state: 'working', attempts: 0, maxAttempts, rejections: [], submission: null }); return c;
  }
  cell(id) { return this.cells.get(`task:${id}`) || null; }
  /**
   * the cell submits its work: refused unless its own quality check passed (selfCheck: { passed, checks: [text] })
   * → 'submitted' | 'refused: …'
   */
  submit(id, work, selfCheck) {
    const c = this.cell(id); if (!c || c.state !== 'working') return 'refused: no working cell ' + id;
    if (!selfCheck || !selfCheck.passed) { this.observe('selfcheck', id, `not submitted: ${(selfCheck && selfCheck.checks || []).join('; ')}`, 1, { task: id }); return 'refused: the cell\'s own quality check failed'; }
    c.state = 'submitted'; c.submission = { at: this.now(), work: String(work).slice(0, 600), selfCheck: (selfCheck.checks || []).slice(0, 6) };
    this.observe('submission', id, `attempt ${c.attempts + 1}: ${String(work).slice(0, 250)}`, 2, { task: id });
    return 'submitted';
  }
  /** the VP's review of a submission: accept (collapse) or reject with reasons (back to work, or escalated) */
  review(id, { accept, why, final = false }) {
    const c = this.cell(id); if (!c || c.state !== 'submitted') return 'nothing to review';
    if (accept) { const line = `accepted by the VP after ${c.attempts + 1} attempt(s): ${why} · work: ${c.submission.work.slice(0, 160)}`; this.collapse(id, line); return 'accepted'; }
    c.attempts += 1; c.rejections.push({ at: this.now(), why: String(why).slice(0, 300), work: c.submission.work }); c.submission = null;
    if (final) { this.collapse(id, `rejected by the VP: ${why}`); return 'closed'; }
    if (c.attempts >= c.maxAttempts) { this.collapse(id, `escalated to you after ${c.attempts} rejected attempts; last reason: ${why}`); return 'escalated'; }
    c.state = 'working'; this.observe('rejection', id, `rejected (${c.attempts}/${c.maxAttempts}): ${why}`, 2, { task: id });
    return 'rejected';
  }
  /** a task starts: it gets a cell and room for its facts (expand) */
  openTask(id, title) { const c = this.observe('task', id, title, 3); c.done = false; return c; }
  /** the VP accepted the task: its cells fold into one line, the outcome (contract) → cells freed */
  collapse(id, outcome) {
    const t = this.now(); let freed = 0;
    for (const [k, c] of this.cells) if (c.task === id) { this.cells.delete(k); freed++; }
    const tc = this.cells.get(`task:${id}`);
    if (tc) { tc.done = true; tc.kind = 'done'; tc.text = String(outcome).slice(0, 300); tc.last = t; tc.w = 1; this.cells.delete(`task:${id}`); this.cells.set(`done:${id}`, { ...tc, id: `done:${id}` }); }
    const done = [...this.cells.values()].filter((c) => c.kind === 'done').sort((a, b) => b.last - a.last);
    for (const c of done.slice(KEEP_DONE)) this.cells.delete(c.id);
    return freed;
  }
  weight(c) { return (c.w || 1) * Math.pow(0.5, (this.now() - c.last) / this.halfLife); }

  /** a fact about a topic: kind ('blocker', 'route', 'pool', 'node', 'incident', 'audit', 'decision', 'analysis', …),
   *  key (stable id within the kind), text (the evidence, plain), importance (1 normal, up to 5) */
  observe(kind, key, text, importance = 1, { task = null } = {}) {
    const t = this.now(); const id = `${kind}:${key}`; this.events.push(t);
    const c = this.cells.get(id) || { id, kind, key, first: t, n: 0, w: 0, text: '', task };
    if (task) c.task = task;
    c.n += 1; c.last = t; c.text = String(text).slice(0, 300); c.w = Math.min(50, this.weight({ ...c, w: c.w || 0 }) + importance);
    this.cells.set(id, c); this.contract(); return c;
  }
  /** fold the weakest cells into their kind's summary until within budget */
  contract() {
    const cap = this.budget(); if (this.cells.size <= cap) return 0;
    const all = [...this.cells.values()].filter((c) => !c.summary && c.kind !== 'task').sort((a, b) => this.weight(a) - this.weight(b)); // open tasks are never folded
    let folded = 0;
    for (const c of all) {
      if (this.cells.size <= cap) break;
      const sid = `${c.kind}:*`; const s = this.cells.get(sid) || { id: sid, kind: c.kind, key: '*', summary: true, first: c.first, n: 0, w: 0, folded: 0, text: '' };
      s.folded += 1; s.n += c.n; s.last = Math.max(s.last || 0, c.last); s.w = Math.min(10, (s.w || 0) + 0.1); s.text = `${s.folded} older ${c.kind} topic(s) folded; last: ${c.key}: ${c.text}`.slice(0, 300);
      this.cells.delete(c.id); this.cells.set(sid, s); folded++;
    }
    return folded;
  }
  /** the most relevant cells for a question (word overlap × weight), strongest first, as compact lines */
  context(query = '', n = 20) {
    const q = new Set(String(query).toLowerCase().split(/[^a-z0-9_.\-]+/).filter((w) => w.length > 2));
    const rel = (c) => { const ws = `${c.kind} ${c.key} ${c.text}`.toLowerCase(); let k = 0; for (const w of q) if (ws.includes(w)) k++; return k; };
    return [...this.cells.values()].map((c) => ({ c, s: this.weight(c) * (1 + rel(c)) })).sort((a, b) => b.s - a.s).slice(0, n)
      .map(({ c }) => `[${c.kind}${c.summary ? ' summary' : ''}] ${c.key}: ${c.text} (seen ${c.n}×, last ${Math.round((this.now() - c.last) / 60000)} min ago)`);
  }
  save() { if (!this.file) return; try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file, JSON.stringify({ cells: [...this.cells.values()], events: this.events.slice(-2000) }), { mode: 0o600 }); } catch (_) { /* best effort */ } }
  get size() { return this.cells.size; }
}

module.exports = { Mind, MIN, MAX, HALF_LIFE, PER_TASK, KEEP_DONE };
