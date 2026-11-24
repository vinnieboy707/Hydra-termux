# GEMINI.md — Root Project Config
## API Dashboard Swarm — Master Instructions for All Agents

You are one agent in a coordinated multi-agent build system. This file is
your shared context. Your specific role file (in `/roles/`) overrides
anything here that conflicts, but everything below always applies.

---

## 1. What this project is
An API aggregator dashboard: pulls data from Open Banking Tracker (OAuth,
compliance-sensitive) plus general-purpose public APIs, normalizes it into
one schema, and displays it in a single web dashboard. Deployable as a web
app and a local self-host.

## 2. How the system works (so you don't fight it)
- A coordinator (`coordinator/coordinator.py`) — plain Python, no AI — owns
  task state in SQLite. It decides what's runnable based on dependencies.
  You do not decide what to work on; you claim whatever task the coordinator
  hands you for your role.
- Tasks chain like dominoes: yours may depend on another task's output.
  Never start work assuming an upstream task is done — check the task's
  `depends_on` and read its actual output file.
- Shared learning happens through the `findings` table, not through you
  "remembering" anything. If you discover an error pattern, cause, or fix,
  write it as a finding. Before starting risky work, check findings for
  your role — another agent may have already hit and solved this.

## 3. Strict mode — applies to every agent, every task
- **Never guess a business rule, credential format, or API contract.** If
  a required input is missing or ambiguous, output exactly:
  `BLOCKED: <what is missing and why>` and stop. A wrong guess that looks
  plausible is worse than an honest block — it fails silently downstream.
- **No placeholder content.** Every file you create must be complete and
  functional for its stated scope. `// TODO: implement this` is not an
  acceptable deliverable — either implement it or output `BLOCKED`.
- **No silent failure, anywhere.** Every error path must be caught,
  logged with enough detail to diagnose, and surfaced — never swallowed.
- **No secrets, tokens, or PII in code, logs, or output files, ever.**
  This is non-negotiable across all roles, not just auth-agent.
- **One quote/copy-paste rule for external sources:** if you reference
  external API documentation, paraphrase it — do not paste large blocks
  of third-party docs into project files.
- **Every file you create needs a one-line header comment stating its
  purpose.** No file exists without a stated reason.

## 4. Phases (the actual build order — do not skip ahead)
1. **spec** — document every API source's auth, limits, schema, freshness
2. **schema** — unified DB schema all sources normalize into
3. **backend** — fetch/normalize/store for general APIs
4. **auth** — Open Banking OAuth (compliance-sensitive, own strict rules)
5. **frontend** — dashboard UI (depends on backend + auth both being done)
6. **webhooks** — scheduled refresh + validated webhook endpoints
7. **tests** — including explicit failure-path coverage, not just happy path
8. **audit** — re-run tests, re-check compliance, reopen failures with findings
9. **deploy** — package for web + local host, only after audit passes

Full dependency graph lives in `tasks/seed_tasks.py` — that file is the
source of truth, not this summary. If they ever disagree, the code wins.

## 5. Folder structure (do not create files outside this structure)
```
api-dashboard-swarm/
├── GEMINI.md              <- this file
├── README.md
├── coordinator/
│   ├── coordinator.py     <- task graph + findings, no app logic here
│   └── schema.sql          <- coordinator's OWN db (tasks/findings), not the app schema
├── roles/
│   └── <role>.GEMINI.md   <- one strict-mode file per specialist
├── worker/
│   └── worker.py          <- generic runner, invokes this CLI per role
├── tasks/
│   └── seed_tasks.py       <- THE task graph for this specific app
├── output/                 <- where each task's result gets written
└── app/                     <- the actual application code goes here, organized
    ├── schema.sql           <- the APP's data schema (from schema-agent)
    ├── backend/             <- one file per API source
    ├── auth/                <- Open Banking OAuth module
    ├── frontend/            <- dashboard UI
    ├── webhooks/
    └── tests/
```
If your task requires a file outside this structure, output `BLOCKED:
structure does not account for <need>` rather than inventing a new
top-level folder.

## 6. Definition of done (applies before you mark anything complete)
A task is NOT done if:
- it contains a BLOCKED marker you didn't resolve
- it has untested error branches (for code tasks)
- it duplicates something another finding already flagged as wrong
- it guesses at something the spec left ambiguous

A task IS done when its output file exists, matches its role's strict
rules, and — if it's code — the described error handling actually exists
in the code, not just in a comment saying it will be added later.

## 7. What you do NOT have authority to do
- Do not change the dependency graph in `tasks/seed_tasks.py` — flag a
  problem with it as a finding; a human decides whether to change it.
- Do not deploy (that's deploy-agent's job, gated on audit passing).
- Do not weaken a strict-mode rule "to keep things moving" — a blocked
  task with a clear reason is a correct outcome, not a failure of yours.
- Do not invoke an MCP tool that isn't listed in your role's "Approved
  MCP Tools" section, even if it would be technically convenient — tool
  access per role is a compliance boundary, not a suggestion. If a task
  seems to need a tool outside your approved list, output `BLOCKED: task
  requires <tool>, not in my approved list` rather than reaching for it.

## 8. MCP servers and extensions
This project's MCP servers are declared in `.gemini/settings.json` and
bundled for distribution via `gemini-extension.json` (install with
`gemini extensions link .`). Run `/mcp` inside a Gemini CLI session to
confirm what's actually connected before assuming a tool is available —
config existing on disk is not the same as a server being live.

Access is scoped narrowly per role on purpose: `auth-agent` gets only
`filesystem`, `auditor-agent` gets the broadest read access matching its
cross-cutting job, and no role gets `github` unless it has an actual
repo-facing reason to. See each role's own `.GEMINI.md` for its exact
approved list — this is enforced by convention (agents self-check against
their file), not by a technical sandbox, so the auditor-agent's review of
"did this task only use approved tools" is a real check, not a formality.

## 9. Coding standards & workflow loop
This project follows the explore → plan → implement → verify loop that
Anthropic documents publicly for agentic coding (Claude Code's own
best-practices guide, not anything proprietary to a specific model —
the same MCP protocol and pattern applies across Claude Code, Sonnet,
and Opus, and works the same way for Gemini CLI here):

1. **Explore first.** Read the actual upstream output file(s) for your
   task before writing anything — do not assume what a prior stage
   produced; check.
2. **State a precise definition of done before starting.** Not "build
   the auth module" but "auth module exists, handles token refresh, has
   zero plaintext secrets, and BLOCKED markers resolved or explicit." A
   vague target produces vague verification.
3. **Implement against that definition**, not against a general sense of
   "make it good."
4. **Verify before reporting done** — run the actual tests/lints/build
   your task produced, don't just read your own code and assume it's
   correct. This is why test-agent and auditor-agent exist as separate
   roles: self-verification alone is not sufficient for this project.
5. **Report precisely what was and wasn't achieved** — including partial
   completion and BLOCKED markers — rather than a summary that implies
   full success when it wasn't.

This file plays the same role Claude Code's own CLAUDE.md convention
plays: persistent, project-level context every agent reads before
touching anything, kept short and explicit rather than long and vague —
that's what the publicly documented evidence says actually improves
agent adherence, not a stylistic choice made for this project alone.
