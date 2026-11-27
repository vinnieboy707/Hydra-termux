-- Chronos database schema (Supabase project qpjbikkfkpzywyzanrgv), read from the live database on 2026-11-24.
-- Recreates an empty project exactly: functions, tables with their checks, indexes, row-level security, policies,
-- grants, the owner trigger and the private releases bucket. The server functions that use it are in
-- server/functions; test/server.test.cjs checks that every table and column the engine, the functions and the portal
-- use is defined here, and portal/real_check.sql checks the live database still matches what the code needs.
-- Owner: whoever signs in with vinnieboy707@gmail.com is given the owner role by grant_owner_role(); every policy
-- below is owner-only. Run in the Supabase SQL editor of an EMPTY project.

-- ── functions ────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_owner_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if lower(new.email) = 'vinnieboy707@gmail.com' then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) || '{"role":"owner"}'::jsonb;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.is_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'owner'
$function$
;

-- ── tables ───────────────────────────────────────────────────────────────────────────────────────────────────────
create table public.agent_events (
  id bigint generated always as identity not null,
  ts timestamp with time zone not null default now(),
  agent text not null,
  severity text not null,
  source text not null,
  message text not null,
  action text,
  outcome text,
  detail jsonb,
  constraint agent_events_pkey PRIMARY KEY (id),
  constraint agent_events_outcome_check CHECK ((outcome = ANY (ARRAY['detected'::text, 'fixed'::text, 'escalated'::text, 'failed'::text, 'none'::text, 'applied'::text, 'done'::text, 'kept'::text, 'pending'::text, 'resolved'::text, 'reverted'::text, 'started'::text, 'vetoed'::text]))),
  constraint agent_events_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])))
);
alter table public.agent_events enable row level security;

create table public.approvals (
  id bigint generated always as identity not null,
  created_at timestamp with time zone not null default now(),
  agent text not null,
  kind text not null,
  title text not null,
  detail jsonb not null,
  status text not null default 'pending'::text,
  decided_at timestamp with time zone,
  expires_at timestamp with time zone not null default (now() + '24:00:00'::interval),
  ref text,
  applied_at timestamp with time zone,
  applied_result text,
  constraint approvals_ref_key UNIQUE (ref),
  constraint approvals_pkey PRIMARY KEY (id),
  constraint approvals_kind_check CHECK ((kind = ANY (ARRAY['key'::text, 'limit'::text, 'contract'::text, 'funds'::text, 'code'::text, 'other'::text]))),
  constraint approvals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'expired'::text])))
);
alter table public.approvals enable row level security;

create table public.balances_verified (
  label text not null,
  token text not null,
  address text not null,
  amount text,
  verified boolean not null,
  block bigint not null,
  ts timestamp with time zone not null,
  constraint balances_verified_pkey PRIMARY KEY (label, token)
);
alter table public.balances_verified enable row level security;

create table public.devices (
  id uuid not null default gen_random_uuid(),
  name text not null,
  pubkey text not null,
  code text not null,
  status text not null default 'pending'::text,
  can_publish boolean not null default false,
  created_at timestamp with time zone not null default now(),
  decided_at timestamp with time zone,
  last_seen timestamp with time zone,
  version text,
  executor_address text,
  kms_key text,
  executor_at timestamp with time zone,
  constraint devices_pubkey_key UNIQUE (pubkey),
  constraint devices_pkey PRIMARY KEY (id),
  constraint devices_name_check CHECK (((length(name) >= 1) AND (length(name) <= 64))),
  constraint devices_pubkey_check CHECK ((pubkey ~ '^[A-Za-z0-9+/=]{40,120}$'::text)),
  constraint devices_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'revoked'::text]))),
  constraint devices_executor_address_check CHECK (((executor_address IS NULL) OR (executor_address ~ '^0x[0-9a-fA-F]{40}$'::text))),
  constraint devices_kms_key_check CHECK (((kms_key IS NULL) OR (kms_key ~ '^projects/[a-z0-9-]+/locations/[a-z0-9-]+/keyRings/[A-Za-z0-9_-]+/cryptoKeys/[A-Za-z0-9_-]+/cryptoKeyVersions/[0-9]+$'::text)))
);
alter table public.devices enable row level security;

create table public.executions (
  tx_hash text not null,
  sent_at timestamp with time zone,
  route_key text not null,
  status text not null,
  receipt_block bigint,
  gas_used numeric,
  gas_usd numeric,
  profit_usd numeric,
  net_usd numeric,
  tax_reserve_usd numeric,
  updated_at timestamp with time zone not null default now(),
  constraint executions_pkey PRIMARY KEY (tx_hash),
  constraint executions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'success'::text, 'reverted'::text, 'dropped'::text])))
);
alter table public.executions enable row level security;

create table public.heartbeats (
  service text not null,
  ts timestamp with time zone not null,
  mode text,
  version text,
  detail jsonb,
  constraint heartbeats_pkey PRIMARY KEY (service)
);
alter table public.heartbeats enable row level security;

create table public.mode_events (
  id bigint generated always as identity not null,
  ts timestamp with time zone not null,
  mode text not null,
  reason text not null,
  constraint mode_events_pkey PRIMARY KEY (id),
  constraint mode_events_mode_check CHECK ((mode = ANY (ARRAY['SHADOW'::text, 'LIVE'::text])))
);
alter table public.mode_events enable row level security;

create table public.opportunities (
  id bigint generated always as identity not null,
  scanned_at timestamp with time zone not null,
  block bigint not null,
  route_key text not null,
  asset text not null,
  amount_raw numeric not null,
  legs jsonb not null,
  gross_usd numeric not null,
  gas_usd numeric not null,
  premium_usd numeric not null,
  net_usd numeric not null,
  constraint opportunities_block_route_key_key UNIQUE (block, route_key),
  constraint opportunities_pkey PRIMARY KEY (id)
);
alter table public.opportunities enable row level security;

create table public.payouts (
  tx_hash text not null,
  ts timestamp with time zone not null,
  kind text not null,
  token text not null,
  amount_raw text not null,
  amount_usd numeric,
  to_address text not null,
  block bigint not null,
  constraint payouts_pkey PRIMARY KEY (tx_hash),
  constraint payouts_kind_check CHECK ((kind = ANY (ARRAY['withdraw'::text, 'tax'::text, 'payout'::text]))),
  constraint payouts_tx_hash_check CHECK ((tx_hash ~ '^0x[0-9a-fA-F]{64}$'::text))
);
alter table public.payouts enable row level security;

create table public.releases (
  version text not null,
  sha256 text not null,
  size_bytes bigint not null,
  path text not null,
  notes text,
  published_by uuid,
  created_at timestamp with time zone not null default now(),
  constraint releases_pkey PRIMARY KEY (version),
  constraint releases_published_by_fkey FOREIGN KEY (published_by) REFERENCES devices(id),
  constraint releases_sha256_check CHECK ((sha256 ~ '^[0-9a-f]{64}$'::text)),
  constraint releases_version_check CHECK ((version ~ '^\d+\.\d+\.\d+$'::text))
);
alter table public.releases enable row level security;

create table public.reports (
  id bigint generated always as identity not null,
  ts timestamp with time zone not null default now(),
  day text not null,
  kind text not null,
  title text not null,
  body jsonb not null default '{}'::jsonb,
  critical boolean not null default false,
  constraint reports_pkey PRIMARY KEY (id),
  constraint reports_kind_check CHECK ((kind = ANY (ARRAY['daily-report'::text, 'alert'::text, 'build-request'::text, 'audit'::text])))
);
alter table public.reports enable row level security;

create table public.revenue_entries (
  id bigint generated always as identity not null,
  received_on date not null,
  business text not null,
  description text,
  amount numeric(14,2) not null,
  currency text not null default 'USD'::text,
  method text not null,
  evidence text not null,
  tax_reserved numeric(14,2),
  created_at timestamp with time zone not null default now(),
  constraint revenue_entries_pkey PRIMARY KEY (id),
  constraint revenue_entries_amount_check CHECK ((amount > (0)::numeric)),
  constraint revenue_entries_business_check CHECK (((length(business) >= 1) AND (length(business) <= 80))),
  constraint revenue_entries_currency_check CHECK ((currency ~ '^[A-Z]{3}$'::text)),
  constraint revenue_entries_description_check CHECK ((length(description) <= 500)),
  constraint revenue_entries_evidence_check CHECK (((length(evidence) >= 3) AND (length(evidence) <= 500))),
  constraint revenue_entries_method_check CHECK ((method = ANY (ARRAY['bank'::text, 'card'::text, 'cash'::text, 'check'::text, 'crypto'::text, 'other'::text]))),
  constraint revenue_entries_tax_reserved_check CHECK ((tax_reserved >= (0)::numeric))
);
alter table public.revenue_entries enable row level security;

create table public.shadow_runs (
  id bigint generated always as identity not null,
  ts timestamp with time zone not null,
  block bigint not null,
  route_key text not null,
  stage text not null,
  win boolean not null,
  net_usd numeric,
  profit_usd numeric,
  gas_usd numeric,
  failed jsonb,
  error text,
  constraint shadow_runs_block_route_key_key UNIQUE (block, route_key),
  constraint shadow_runs_pkey PRIMARY KEY (id),
  constraint shadow_runs_stage_check CHECK ((stage = ANY (ARRAY['preflight'::text, 'simulation'::text, 'done'::text])))
);
alter table public.shadow_runs enable row level security;

create table public.route_stats (
  id bigint generated always as identity not null,
  ts timestamp with time zone not null,
  block bigint not null,
  device uuid not null,
  route_key text not null,
  path text not null,
  legs smallint not null,
  lender text not null,
  size_usd numeric,
  gross_usd numeric,
  premium_usd numeric,
  gas_usd numeric,
  net_usd numeric not null,
  floor_usd numeric,
  killer text not null,
  approved boolean not null default false,
  constraint route_stats_pkey PRIMARY KEY (id),
  constraint route_stats_once UNIQUE (device, block, route_key),
  constraint route_stats_device_fkey FOREIGN KEY (device) REFERENCES devices(id) ON DELETE CASCADE,
  constraint route_stats_legs_check CHECK (((legs >= 2) AND (legs <= 6))),
  constraint route_stats_killer_check CHECK ((killer = ANY (ARRAY['no price gap'::text, 'flash-loan fee'::text, 'gas'::text, 'below your floor'::text, 'price impact cap'::text, 'flash liquidity'::text, 'venue not executable'::text, 'gas ceiling'::text, 'other rule'::text, 'none'::text])))
);
alter table public.route_stats enable row level security;

create table public.watchdog_state (
  service text not null,
  down boolean not null default false,
  since timestamp with time zone not null default now(),
  constraint watchdog_state_pkey PRIMARY KEY (service)
);
alter table public.watchdog_state enable row level security;

-- ── indexes ──────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE INDEX agent_events_ts_idx ON public.agent_events USING btree (ts DESC);
CREATE INDEX approvals_decided_idx ON public.approvals USING btree (status) WHERE ((applied_at IS NULL) AND (status = ANY (ARRAY['approved'::text, 'denied'::text])));
CREATE INDEX approvals_status_idx ON public.approvals USING btree (status, created_at DESC);
CREATE INDEX devices_status_idx ON public.devices USING btree (status, created_at DESC);
CREATE INDEX executions_sent_idx ON public.executions USING btree (sent_at DESC);
CREATE INDEX mode_events_ts_idx ON public.mode_events USING btree (ts DESC);
CREATE INDEX opportunities_scanned_idx ON public.opportunities USING btree (scanned_at DESC);
CREATE INDEX payouts_ts_idx ON public.payouts USING btree (ts DESC);
CREATE INDEX reports_ts_idx ON public.reports USING btree (ts DESC);
CREATE INDEX revenue_entries_date_idx ON public.revenue_entries USING btree (received_on DESC);
CREATE INDEX shadow_runs_ts_idx ON public.shadow_runs USING btree (ts DESC);
CREATE INDEX route_stats_ts_idx ON public.route_stats USING btree (ts DESC);
CREATE INDEX route_stats_route_idx ON public.route_stats USING btree (route_key, ts DESC);

-- ── policies (owner only) ────────────────────────────────────────────────────────────────────────────────────────
create policy owner_read on public.agent_events for SELECT to authenticated using (is_owner());
create policy owner_decide on public.approvals for UPDATE to authenticated using ((is_owner() AND (status = 'pending'::text) AND (expires_at > now()))) with check ((is_owner() AND (status = ANY (ARRAY['approved'::text, 'denied'::text]))));
create policy owner_read on public.approvals for SELECT to authenticated using (is_owner());
create policy owner_read on public.balances_verified for SELECT to authenticated using (is_owner());
create policy owner_decide on public.devices for UPDATE to authenticated using (is_owner()) with check ((is_owner() AND (status = ANY (ARRAY['approved'::text, 'denied'::text, 'revoked'::text]))));
create policy owner_read on public.devices for SELECT to authenticated using (is_owner());
create policy owner_read on public.executions for SELECT to authenticated using (is_owner());
create policy owner_read on public.heartbeats for SELECT to authenticated using (is_owner());
create policy owner_read on public.mode_events for SELECT to authenticated using (is_owner());
create policy owner_read on public.opportunities for SELECT to authenticated using (is_owner());
create policy owner_read on public.payouts for SELECT to authenticated using (is_owner());
create policy owner_read on public.releases for SELECT to authenticated using (is_owner());
create policy owner_read on public.reports for SELECT to authenticated using (is_owner());
create policy owner_all on public.revenue_entries for ALL to authenticated using (is_owner()) with check (is_owner());
create policy owner_read on public.shadow_runs for SELECT to authenticated using (is_owner());
create policy owner_read on public.route_stats for SELECT to authenticated using (is_owner());
create policy owner_read on public.watchdog_state for SELECT to authenticated using (is_owner());

-- ── grants: nothing for signed-out visitors; signed-in only what the portal does (policies make it owner-only) ──
revoke all on public.agent_events from anon, authenticated;
revoke all on public.approvals from anon, authenticated;
revoke all on public.balances_verified from anon, authenticated;
revoke all on public.devices from anon, authenticated;
revoke all on public.executions from anon, authenticated;
revoke all on public.heartbeats from anon, authenticated;
revoke all on public.mode_events from anon, authenticated;
revoke all on public.opportunities from anon, authenticated;
revoke all on public.payouts from anon, authenticated;
revoke all on public.releases from anon, authenticated;
revoke all on public.reports from anon, authenticated;
revoke all on public.revenue_entries from anon, authenticated;
revoke all on public.shadow_runs from anon, authenticated;
revoke all on public.route_stats from anon, authenticated;
revoke all on public.watchdog_state from anon, authenticated;
grant select on public.agent_events to authenticated;
grant select on public.approvals to authenticated;
grant update (decided_at, status) on public.approvals to authenticated;
grant select on public.balances_verified to authenticated;
grant select on public.devices to authenticated;
grant update (can_publish, decided_at, status) on public.devices to authenticated;
grant select on public.executions to authenticated;
grant select on public.heartbeats to authenticated;
grant select on public.mode_events to authenticated;
grant select on public.opportunities to authenticated;
grant select on public.payouts to authenticated;
grant select on public.releases to authenticated;
grant select on public.reports to authenticated;
grant delete, insert, select on public.revenue_entries to authenticated;
grant select on public.shadow_runs to authenticated;
grant select on public.route_stats to authenticated;
grant select on public.watchdog_state to authenticated;

-- ── views: the path to profit, last 24 hours (row-level security of route_stats applies: security_invoker) ──────
create or replace view public.route_insights with (security_invoker = true) as
select route_key, min(path) as path, max(legs) as legs, count(*) as samples, max(net_usd) as best_net_usd,
  percentile_cont(0.5) within group (order by net_usd) as median_net_usd, max(net_usd - coalesce(floor_usd, 0)) as best_gap_usd,
  avg(gross_usd) as avg_gross_usd, avg(premium_usd) as avg_premium_usd, avg(gas_usd) as avg_gas_usd,
  mode() within group (order by killer) as usual_killer, count(*) filter (where approved) as approved, max(ts) as last_seen
from public.route_stats where ts > now() - interval '24 hours' group by route_key;
create or replace view public.profit_gap with (security_invoker = true) as
select killer, count(*) as samples, max(net_usd) as best_net_usd, max(net_usd - coalesce(floor_usd, 0)) as best_gap_usd,
  avg(gross_usd) as avg_gross_usd, avg(gas_usd) as avg_gas_usd, max(ts) as last_seen
from public.route_stats where ts > now() - interval '24 hours' group by killer;
-- the road to mainnet, each step done or not, from live data (portal panel and the insights function)
create or replace view public.mainnet_progress with (security_invoker = true) as
with road as (
  select r from (select detail->'road' rd from public.heartbeats where jsonb_typeof(detail->'road') = 'array' and ts > now() - interval '1 day' order by ts desc limit 1) h, jsonb_array_elements(h.rd) r
),
hb as (select * from public.heartbeats where ts > now() - interval '15 minutes'),
rc as (select r->>'id' id, r->>'status' st from public.heartbeats h, jsonb_array_elements(coalesce(h.detail->'realcheck'->'results', '[]'::jsonb)) r where h.ts > now() - interval '2 days')
-- the engine's own verified road to cash (the VP checks each step on chain, in receipts and in your real checks)
select (r->>'step')::int as step, (r->>'title') as what, coalesce((r->>'done')::boolean, false) as done, coalesce(r->>'evidence', r->>'todo') as detail, (r->>'version') as version from road
union all
-- before an engine on 2.9.0 reports its road: what the database alone can see
select * from (values
  (1, 'an engine is running and reporting', exists (select 1 from hb), coalesce((select string_agg(service || ' ' || mode || ' v' || coalesce(version, '?'), ', ') from hb), 'no heartbeat in 15 minutes: open Termux or run chronos phone'), '2.9'),
  (2, 'contract v2 deployed', exists (select 1 from public.heartbeats where (detail->'contract'->>'kind') = '2'), coalesce((select 'v' || (detail->'contract'->>'kind') from public.heartbeats where detail ? 'contract' order by ts desc limit 1), 'none yet') || ': chronos mainnet deploys v2 on YES', '3.0'),
  (3, 'real checks: none failing', exists (select 1 from rc) and not exists (select 1 from rc where st = 'fail'), coalesce('failing: ' || (select string_agg(distinct id, ', ') from rc where st = 'fail'), case when exists (select 1 from rc) then 'all pass or not run' else 'not run yet: chronos verify-real' end), '3.0'),
  (4, 'cloud engine approved', exists (select 1 from public.devices where name = 'chronos-engine' and status = 'approved'), coalesce((select 'chronos-engine is ' || status || ' (code ' || code || ')' from public.devices where name = 'chronos-engine' order by created_at desc limit 1), 'not created yet: Cloud Shell step'), '4.0'),
  (5, 'HSM executor handed to your phone', exists (select 1 from public.devices where executor_address is not null and status = 'approved'), coalesce((select executor_address from public.devices where executor_address is not null and status = 'approved' order by executor_at desc limit 1), 'offered by the cloud engine once approved'), '4.0'),
  (6, 'shadow test won in the last 7 days', exists (select 1 from public.shadow_runs where win and ts > now() - interval '7 days'), (select count(*) filter (where win) || ' wins of ' || count(*) || ' shadow runs' from public.shadow_runs where ts > now() - interval '7 days'), '7.0'),
  (7, 'LIVE mode', exists (select 1 from hb where mode = 'LIVE'), 'switches by itself once your promotion rules hold', '7.0'),
  (8, 'verified on-chain profit', exists (select 1 from public.executions where net_usd > 0 and status = 'success'), coalesce((select count(*) || ' profitable executions, net $' || round(sum(net_usd)::numeric, 2) from public.executions where status = 'success' and net_usd > 0), 'none yet'), '8.0')
) as t(step, what, done, detail, version)
where not exists (select 1 from road);
revoke all on public.route_insights, public.profit_gap, public.mainnet_progress from anon, authenticated;
grant select on public.route_insights, public.profit_gap, public.mainnet_progress to authenticated;

-- ── watchdog (pg_cron, every 5 minutes): an engine silent for 15 minutes is reported once as critical, and once
-- when it is back. Reads heartbeats, writes reports; no secret involved. ─────────────────────────────────────────
create extension if not exists pg_cron;
create or replace function public.chronos_watchdog() returns integer
language plpgsql security definer set search_path = public as $$
declare h record; n integer := 0; st public.watchdog_state;
begin
  for h in select service, ts, mode, version from public.heartbeats where ts > now() - interval '7 days' loop
    select * into st from public.watchdog_state where service = h.service;
    if h.ts < now() - interval '15 minutes' then
      if st is null or not st.down then
        insert into public.watchdog_state(service, down, since) values (h.service, true, now())
          on conflict (service) do update set down = true, since = now();
        insert into public.reports(day, kind, title, body, critical) values (to_char(now() at time zone 'America/Los_Angeles', 'YYYY-MM-DD'), 'alert',
          left('Engine silent: ' || h.service || ' (no heartbeat for ' || round(extract(epoch from now() - h.ts) / 60) || ' min)', 200),
          jsonb_build_object('source', 'watchdog', 'service', h.service, 'last_heartbeat', h.ts, 'mode', h.mode, 'version', h.version, 'fix', 'open Termux (the engine restarts) or run: chronos phone; cloud engine: gcloud compute instances start chronos-engine'), true);
        n := n + 1;
      end if;
    elsif st is not null and st.down then
      update public.watchdog_state set down = false, since = now() where service = h.service;
      insert into public.reports(day, kind, title, body, critical) values (to_char(now() at time zone 'America/Los_Angeles', 'YYYY-MM-DD'), 'alert',
        left('Engine back: ' || h.service || ' (silent for ' || round(extract(epoch from now() - st.since) / 60) || ' min)', 200),
        jsonb_build_object('source', 'watchdog', 'service', h.service, 'down_since', st.since, 'mode', h.mode, 'version', h.version), false);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.chronos_watchdog() from public, anon, authenticated;
select cron.schedule('chronos-watchdog', '*/5 * * * *', 'select public.chronos_watchdog()');

-- ── cleanup (pg_cron, daily 11:17 UTC): raw telemetry past its useful life; money records are never deleted ──────
create or replace function public.chronos_retention() returns jsonb
language plpgsql security definer set search_path = public as $$
declare a integer; b integer;
begin
  delete from public.route_stats where ts < now() - interval '14 days'; get diagnostics a = row_count;
  delete from public.agent_events where ts < now() - interval '30 days'; get diagnostics b = row_count;
  return jsonb_build_object('route_stats', a, 'agent_events', b);
end $$;
revoke all on function public.chronos_retention() from public, anon, authenticated;
select cron.schedule('chronos-retention', '17 11 * * *', 'select public.chronos_retention()');

-- ── owner role at sign-in ───────────────────────────────────────────────────────────────────────────────────────
create trigger grant_owner_role_trg BEFORE INSERT OR UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION public.grant_owner_role();

-- ── storage: private bucket for release archives (served only through signed 120-second links) ─────────────────
insert into storage.buckets (id, name, public) values ('releases', 'releases', false) on conflict (id) do nothing;

-- ── email to you (Resend), from the database itself: works even when your phone is off ─────────────────────────────
-- The Resend API key lives only in Supabase Vault (name resend_api_key, put there by you in the SQL editor); the
-- recipient is Vault alert_email, else the portal owner's email. No key: nothing is sent, and email_log says why.
create extension if not exists pg_net;
create table public.email_log (
  id bigint generated always as identity not null,
  ts timestamp with time zone not null default now(),
  subject text not null,
  request_id bigint,
  sent boolean not null default false,
  why text,
  constraint email_log_pkey PRIMARY KEY (id)
);
alter table public.email_log enable row level security;
create policy owner_read on public.email_log for SELECT to authenticated using (is_owner());
revoke all on public.email_log from anon, authenticated;
grant select on public.email_log to authenticated;
create or replace function public.chronos_email(subject text, body text, html text default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare k text; dest text; rid bigint; norm text; esc text;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  select decrypted_secret into dest from vault.decrypted_secrets where name = 'alert_email' limit 1;
  if dest is null then select email into dest from auth.users where raw_app_meta_data->>'role' = 'owner' order by created_at limit 1; end if;
  if k is null or dest is null then
    insert into public.email_log(subject, sent, why) values (left(subject, 200), false, case when k is null then 'no resend_api_key in Vault' else 'no alert_email in Vault and no owner account' end);
    return false;
  end if;
  -- the same alert again within 30 minutes (numbers aside: "silent for 16 min" = "silent for 18 min") is not emailed
  -- again, so a repeating alert can never use up the day's emails and hide the next, different one (2.9.12)
  norm := regexp_replace(left(subject, 200), '[0-9]+', '#', 'g');
  -- (a verified step, money made, a success and the daily report are always sent: each one is news)
  if subject !~ '^(✓|★|Chronos daily report)' and exists (select 1 from public.email_log where sent and ts > now() - interval '30 minutes' and regexp_replace(email_log.subject, '[0-9]+', '#', 'g') = norm) then
    insert into public.email_log(subject, sent, why) values (left(subject, 200), false, 'same alert emailed in the last 30 minutes');
    return false;
  end if;
  if (select count(*) from public.email_log where sent and ts > now() - interval '1 day') >= 40 then
    insert into public.email_log(subject, sent, why) values (left(subject, 200), false, 'daily limit of 40 emails reached');
    return false;
  end if;
  -- every email is HTML: the engine's own page (the daily report), else this branded card around the alert text
  if html is null then
    esc := replace(replace(replace(left(body, 20000), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
    html := '<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif">'
      || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9"><tr><td align="center" style="padding:16px 8px">'
      || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px">'
      || '<tr><td style="background:#0b1f3a;padding:20px 24px;border-radius:12px 12px 0 0"><div style="font-size:12px;color:#93c5fd;letter-spacing:.1em;text-transform:uppercase;font-weight:700">APEX Sovereign · Chronos</div>'
      || '<div style="font-size:19px;color:#ffffff;font-weight:700;margin-top:6px">' || replace(replace(replace(left(subject, 200), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</div></td></tr>'
      || '<tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px;padding:20px 24px;font-size:14px;line-height:1.55;color:#0f172a">'
      || replace(esc, E'\n', '<br>') || '</td></tr>'
      || '<tr><td style="padding:16px 24px 24px;font-size:11px;color:#94a3b8;text-align:center">Commands run in Termux on your phone. Chronos never moves money because of an email.</td></tr>'
      || '</table></td></tr></table></body></html>';
  end if;
  select net.http_post(url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || k, 'Content-Type', 'application/json'),
    body := jsonb_build_object('from', 'Chronos <onboarding@resend.dev>', 'to', jsonb_build_array(dest), 'subject', left(subject, 200), 'text', left(body, 20000), 'html', left(html, 200000))) into rid;
  insert into public.email_log(subject, request_id, sent) values (left(subject, 200), rid, true);
  return true;
end $$;
drop function if exists public.chronos_email(text, text);
revoke all on function public.chronos_email(text, text, text) from public, anon, authenticated;
create or replace function public.chronos_email_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- emailed: the daily report, critical alerts, money made, every road-to-cash step verified, and every success (★)
  if new.kind = 'daily-report'
     or (new.kind = 'alert' and (new.critical or coalesce(new.body->>'level', '') in ('money', 'success') or new.title like '✓ Step %' or new.title like '★ %')) then
    perform public.chronos_email(coalesce(nullif(new.body->>'subject', ''), new.title), coalesce(new.body->>'text', new.body->>'fix', new.body::text) || E'\n\n— Chronos (your portal has the details)', nullif(new.body->>'html', ''));
  end if;
  return new;
end $$;
revoke all on function public.chronos_email_report() from public, anon, authenticated;
create trigger chronos_email_report after insert on public.reports for each row execute function public.chronos_email_report();

-- ── chain research and the price-move relay (v2.9.7) ─────────────────────────────────────────────────────────────
-- chain_trades: every flash-loan transaction your engines studied on Arbitrum One (from receipts and event logs, read
--   through your own nodes). The views below turn them into who wins (competitors), where (venue_usage) and with which
--   parameters (chain_policies). Written only by an approved engine through the ingest function; owner-only to read.
-- pool_moves: the price-move relay. An engine whose node streams swap logs posts which watched pools moved; the row is
--   broadcast at once on Realtime topic "chronos-pool-moves" (by the ingest function), so engines whose plan has no log stream re-quote only the
--   pools that moved instead of every pool every block. Rows are kept 2 hours. The broadcast carries public chain facts
--   only (pool addresses and a block number); an engine treats it as a hint and re-quotes from the chain itself.

-- reports also carries the VP's audits (lib/vpaudit.cjs files them with kind 'audit')
alter table public.reports drop constraint if exists reports_kind_check;
alter table public.reports add constraint reports_kind_check CHECK ((kind = ANY (ARRAY['daily-report'::text, 'alert'::text, 'build-request'::text, 'audit'::text])));

create table public.chain_trades (
  tx_hash text not null,
  block bigint not null,
  seen_at timestamp with time zone not null default now(),
  device uuid,
  contract text not null,
  sender text,
  lender text not null,
  assets text[] not null default '{}'::text[],
  success boolean not null,
  legs smallint not null,
  venues text[] not null default '{}'::text[],
  gas_used bigint,
  gas_price_gwei numeric,
  gas_usd numeric,
  kept_usd numeric,
  net_usd numeric,
  priced boolean not null default true,
  constraint chain_trades_pkey PRIMARY KEY (tx_hash),
  constraint chain_trades_device_fkey FOREIGN KEY (device) REFERENCES devices(id) ON DELETE SET NULL,
  constraint chain_trades_tx_check CHECK ((tx_hash ~ '^0x[0-9a-f]{64}$'::text)),
  constraint chain_trades_contract_check CHECK ((contract ~ '^0x[0-9a-f]{40}$'::text)),
  constraint chain_trades_legs_check CHECK (((legs >= 0) AND (legs <= 30)))
);
alter table public.chain_trades enable row level security;
create index if not exists chain_trades_block_idx on public.chain_trades using btree (block desc);
create index if not exists chain_trades_contract_idx on public.chain_trades using btree (contract, block desc);

create table public.pool_moves (
  id bigint generated always as identity not null,
  ts timestamp with time zone not null default now(),
  block bigint not null,
  pools text[] not null,
  device uuid,
  constraint pool_moves_pkey PRIMARY KEY (id),
  constraint pool_moves_device_fkey FOREIGN KEY (device) REFERENCES devices(id) ON DELETE CASCADE,
  constraint pool_moves_pools_check CHECK (((cardinality(pools) >= 1) AND (cardinality(pools) <= 500)))
);
alter table public.pool_moves enable row level security;
create index if not exists pool_moves_ts_idx on public.pool_moves using btree (ts desc);

-- the broadcast itself is sent by the ingest edge function (Realtime broadcast API): realtime.messages has no
-- partitions in this project, so a database-side realtime.send would be dropped silently. This trigger is a no-op hook.
create or replace function public.chronos_pool_moves_broadcast() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  return null;
end $$;
revoke all on function public.chronos_pool_moves_broadcast() from public, anon, authenticated;
drop trigger if exists pool_moves_broadcast_trg on public.pool_moves;
create trigger pool_moves_broadcast_trg AFTER INSERT ON public.pool_moves FOR EACH ROW EXECUTE FUNCTION public.chronos_pool_moves_broadcast();

drop policy if exists owner_read on public.chain_trades;
create policy owner_read on public.chain_trades for SELECT to authenticated using (is_owner());
drop policy if exists owner_read on public.pool_moves;
create policy owner_read on public.pool_moves for SELECT to authenticated using (is_owner());
revoke all on public.chain_trades from anon, authenticated;
revoke all on public.pool_moves from anon, authenticated;
grant select on public.chain_trades to authenticated;
grant select on public.pool_moves to authenticated;

-- who wins on chain (last 30 days): one row per arbitrage contract
create or replace view public.competitors with (security_invoker = true) as
select contract, count(*) as txs, count(*) filter (where success) as succeeded,
  count(*) filter (where success and net_usd > 0) as profitable,
  round(100.0 * count(*) filter (where success) / count(*), 1) as success_pct,
  sum(net_usd) filter (where success and net_usd is not null) as net_usd_total,
  percentile_cont(0.5) within group (order by net_usd) filter (where success and net_usd > 0) as median_net_usd,
  max(net_usd) as best_net_usd,
  percentile_cont(0.5) within group (order by legs) as median_legs,
  percentile_cont(0.5) within group (order by gas_used) as median_gas,
  array_agg(distinct lender) as lenders,
  (select array_agg(distinct v) from public.chain_trades t2, unnest(t2.venues) v where t2.contract = t.contract) as venues,
  min(seen_at) as first_seen, max(seen_at) as last_seen, max(block) as last_block
from public.chain_trades t where seen_at > now() - interval '30 days' group by contract;

-- where they win (last 30 days): every venue seen in those trades; "unknown factory 0x…" = a venue Chronos lacks
create or replace view public.venue_usage with (security_invoker = true) as
select v as venue, (v not like 'unknown factory%') as supported, count(*) as swaps, count(distinct t.tx_hash) as txs,
  count(distinct t.tx_hash) filter (where t.success and t.net_usd > 0) as in_profitable_txs,
  sum(t.net_usd) filter (where t.success and t.net_usd > 0) as profitable_net_usd, max(t.seen_at) as last_seen
from public.chain_trades t, unnest(t.venues) v where t.seen_at > now() - interval '30 days' group by v;

-- the parameters the winners actually use (last 7 days, successful trades that kept money after gas)
create or replace view public.chain_policies with (security_invoker = true) as
with w as (select * from public.chain_trades where seen_at > now() - interval '7 days'),
p as (select * from w where success and net_usd > 0)
select 'trades_studied' as key, to_jsonb(count(*)) as value, count(*) as samples, 'flash-loan transactions, each read in its receipt' as basis from w
union all select 'profitable_pct', to_jsonb(round(100.0 * (select count(*) from p) / nullif(count(*), 0), 1)), count(*), 'share that kept money after gas' from w
union all select 'revert_pct', to_jsonb(round(100.0 * count(*) filter (where not success) / nullif(count(*), 0), 1)), count(*), 'share that reverted (gas lost)' from w
union all select 'net_usd_p25_p50_p75', jsonb_build_array(percentile_cont(0.25) within group (order by net_usd), percentile_cont(0.5) within group (order by net_usd), percentile_cont(0.75) within group (order by net_usd)), count(*), 'net profit per winning trade, USD' from p
union all select 'gas_units_p50_p90', jsonb_build_array(percentile_cont(0.5) within group (order by gas_used), percentile_cont(0.9) within group (order by gas_used)), count(*), 'gas used per winning trade' from p
union all select 'gas_price_gwei_p50_p90', jsonb_build_array(percentile_cont(0.5) within group (order by gas_price_gwei), percentile_cont(0.9) within group (order by gas_price_gwei)), count(*), 'effective gas price the winners paid' from p
union all select 'gas_usd_p50', to_jsonb(percentile_cont(0.5) within group (order by gas_usd)), count(*), 'gas cost per winning trade, USD' from p
union all select 'legs_share', coalesce((select jsonb_object_agg(legs, n) from (select legs, count(*) n from p group by legs) x), '{}'::jsonb), count(*), 'winning trades by number of swaps' from p
union all select 'lender_share', coalesce((select jsonb_object_agg(lender, n) from (select lender, count(*) n from p group by lender) x), '{}'::jsonb), count(*), 'winning trades by flash-loan source' from p
union all select 'asset_share', coalesce((select jsonb_object_agg(a, n) from (select a, count(*) n from p, unnest(p.assets) a group by a order by n desc limit 12) x), '{}'::jsonb), count(*), 'tokens borrowed by winning trades' from p
union all select 'top_venues', coalesce((select jsonb_agg(v order by n desc) from (select v, count(*) n from p, unnest(p.venues) v group by v order by n desc limit 10) x), '[]'::jsonb), count(*), 'venues in winning trades, most used first' from p;

revoke all on public.competitors, public.venue_usage, public.chain_policies from anon, authenticated;
grant select on public.competitors, public.venue_usage, public.chain_policies to authenticated;

-- retention: relay rows 2 hours (every 15 minutes), studied trades 90 days (daily)
create or replace function public.chronos_retention() returns jsonb
language plpgsql security definer set search_path = public as $$
declare a integer; b integer; c integer; d integer;
begin
  delete from public.route_stats where ts < now() - interval '14 days'; get diagnostics a = row_count;
  delete from public.agent_events where ts < now() - interval '30 days'; get diagnostics b = row_count;
  delete from public.chain_trades where seen_at < now() - interval '90 days'; get diagnostics c = row_count;
  delete from public.pool_moves where ts < now() - interval '2 hours'; get diagnostics d = row_count;
  return jsonb_build_object('route_stats', a, 'agent_events', b, 'chain_trades', c, 'pool_moves', d);
end $$;
revoke all on function public.chronos_retention() from public, anon, authenticated;
create or replace function public.chronos_prune_moves() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.pool_moves where ts < now() - interval '2 hours'; get diagnostics n = row_count; return n;
end $$;
revoke all on function public.chronos_prune_moves() from public, anon, authenticated;
select cron.schedule('chronos-prune-moves', '*/15 * * * *', 'select public.chronos_prune_moves()');

-- ── chain signals (v2.9.7): lib/chainsignals.cjs in SQL, over every engine's studied trades (last 7 days) ──────────
-- One row per indicator group: trades, wins (succeeded and kept money after gas), win and revert rates, median and
-- total net, and the verdict (exploit / avoid / watch, needs 3 trades). The insights function hands these to every
-- engine, which quotes routes shaped like the winners first.
create or replace view public.chain_indicators with (security_invoker = true) as
with t as (
  select tx_hash, contract, sender, lender, success, legs, net_usd, assets, gas_used, gas_price_gwei,
    (success and coalesce(net_usd, 0) > 0) as win, extract(hour from seen_at at time zone 'UTC')::int as hr,
    array(select distinct v from unnest(venues) v) as vs
  from public.chain_trades where seen_at > now() - interval '7 days'
),
k as (
  select 'lender' as id, lender as key, t.* from t
  union all select 'legs', legs::text, t.* from t
  union all select 'venue', v, t.* from t, unnest(t.vs) v
  union all select 'venue-pair', a || ' + ' || b, t.* from t, unnest(t.vs) a, unnest(t.vs) b where a collate "C" < b collate "C"
  union all select 'asset', x, t.* from t, unnest(t.assets) x
  union all select 'contract', contract, t.* from t
  union all select 'sender', sender, t.* from t where sender is not null
  union all select 'hour', hr::text, t.* from t
  union all select 'unknown-venue', v, t.* from t, unnest(t.vs) v where v like 'unknown factory%'
),
g as (
  select id, key, count(*) as samples, count(*) filter (where win) as wins,
    round(100.0 * count(*) filter (where win) / count(*), 1) as win_pct,
    round(100.0 * count(*) filter (where not success) / count(*), 1) as revert_pct,
    percentile_disc(0.5) within group (order by net_usd) filter (where win) as median_net_usd,
    round(coalesce(sum(net_usd) filter (where win), 0), 4) as total_net_usd
  from k group by id, key
)
select id, key, samples, wins, win_pct, revert_pct, median_net_usd, total_net_usd, case
    when samples < 3 then 'watch'
    when revert_pct >= 50 or (wins = 0 and samples >= 6) then 'avoid'
    when win_pct >= 30 and total_net_usd > 0 then 'exploit'
    else 'watch' end as verdict
from g;

create or replace view public.chain_numbers with (security_invoker = true) as
with t as (select *, (success and coalesce(net_usd, 0) > 0) as win from public.chain_trades where seen_at > now() - interval '7 days')
select count(*) as trades, count(*) filter (where win) as wins,
  round(100.0 * count(*) filter (where win) / nullif(count(*), 0), 1) as win_pct,
  round(100.0 * count(*) filter (where not success) / nullif(count(*), 0), 1) as revert_pct,
  min(net_usd) filter (where win) as lowest_winning_net_usd,
  percentile_disc(0.5) within group (order by net_usd) filter (where win) as median_winning_net_usd,
  percentile_disc(0.5) within group (order by gas_used) filter (where win) as winner_gas_p50,
  percentile_disc(0.9) within group (order by gas_used) filter (where win) as winner_gas_p90,
  percentile_disc(0.5) within group (order by gas_price_gwei) filter (where win) as winner_gwei_p50,
  percentile_disc(0.9) within group (order by gas_price_gwei) filter (where win) as winner_gwei_p90
from t;
revoke all on public.chain_indicators, public.chain_numbers from anon, authenticated;
grant select on public.chain_indicators, public.chain_numbers to authenticated;
