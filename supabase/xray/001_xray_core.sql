-- Mokkoi X-ray: orders, reports, evidence and findings.
-- Apply to the Mokkoi X-ray Supabase project (not the legacy mobile-builder project).
--
-- Access model:
--   * Server code (Vercel API + report worker) uses the service role, which bypasses RLS.
--   * Signed-in customers may read their own orders and reports (owner policies below),
--     for a future "my reports" page.
--   * Anonymous visitors get nothing directly. Shared report links (/r/:token) are served
--     by the API, which looks the report up by its unguessable share_token and only
--     returns approved reports.

-- gen_random_uuid() is built into Postgres 13+ (no extension needed).

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table if not exists public.xray_orders (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  plan            text not null check (plan in ('quick', 'full', 'deep', 'verified')),
  -- 0 = public data only, 1 = seller-shared data, 2 = code audit
  access_level    smallint not null default 0 check (access_level between 0 and 2),
  listing_url     text not null check (char_length(listing_url) between 8 and 2048),
  -- The business's own website, when the listing doesn't show it publicly.
  website_url     text check (char_length(website_url) <= 2048),
  email           text not null check (char_length(email) between 3 and 320),
  notes           text check (char_length(notes) <= 4000),
  -- Optional listing details the buyer pasted (Flippa hides some tabs behind a login).
  listing_text    text check (char_length(listing_text) <= 20000),
  status          text not null default 'awaiting_payment' check (status in (
                    'awaiting_payment', -- created, not paid yet
                    'queued',           -- paid, waiting for the report worker (Quick)
                    'running',          -- worker has claimed it
                    'review',           -- report drafted, waiting for founder review
                    'approved',         -- founder approved; share link is live
                    'manual',           -- paid Full/Deep/Verified, delivered by hand
                    'failed',
                    'cancelled')),
  paid_at         timestamptz,
  payment_ref     text,
  user_id         uuid references auth.users (id) on delete set null,
  terms_accepted  boolean not null default false,
  seller_consent  boolean not null default false,
  attempts        smallint not null default 0,
  last_error      text,
  run_started_at  timestamptz,
  source          text
);

create index if not exists xray_orders_status_idx on public.xray_orders (status, created_at);
create index if not exists xray_orders_user_idx on public.xray_orders (user_id);

-- ---------------------------------------------------------------------------
-- Reports (one row per engine run; the latest approved one is what customers see)
-- ---------------------------------------------------------------------------
create table if not exists public.xray_reports (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.xray_orders (id) on delete cascade,
  created_at       timestamptz not null default now(),
  status           text not null default 'draft' check (status in ('draft', 'approved', 'superseded')),
  approved_at      timestamptz,
  share_token      text not null unique check (char_length(share_token) >= 32),
  harness_version  text not null,
  score            smallint check (score between 0 and 100),
  verdict          text check (verdict in ('green', 'yellow', 'red')),
  cost_usd         numeric(8, 4) not null default 0,
  model_usage      jsonb not null default '{}'::jsonb,
  -- The full rendered report (verdict, claims, red flags, questions, appendix).
  report           jsonb not null
);

create index if not exists xray_reports_order_idx on public.xray_reports (order_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Evidence: every collector result, timestamped. Findings must cite these keys.
-- ---------------------------------------------------------------------------
create table if not exists public.xray_evidence (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references public.xray_reports (id) on delete cascade,
  evidence_key  text not null,               -- e.g. "E7", stable within a report
  collector     text not null,               -- e.g. "dns", "wayback", "listing"
  title         text not null,
  summary       text not null,
  source_url    text,
  data          jsonb not null default '{}'::jsonb,
  fetched_at    timestamptz not null,
  unique (report_id, evidence_key)
);

-- ---------------------------------------------------------------------------
-- Findings: what the specialists proposed and what the skeptic decided.
-- Rejected/dropped findings are kept for evals and audits, never shown to customers.
-- ---------------------------------------------------------------------------
create table if not exists public.xray_findings (
  id               uuid primary key default gen_random_uuid(),
  report_id        uuid not null references public.xray_reports (id) on delete cascade,
  finding_key      text not null,
  section          text not null,
  severity         text not null check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  title            text not null,
  detail           text not null,
  evidence_keys    text[] not null default '{}',
  status           text not null check (status in ('kept', 'downgraded', 'dropped', 'rejected')),
  skeptic_reason   text,
  created_at       timestamptz not null default now(),
  unique (report_id, finding_key)
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.xray_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists xray_orders_touch on public.xray_orders;
create trigger xray_orders_touch
  before update on public.xray_orders
  for each row execute function public.xray_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.xray_orders   enable row level security;
alter table public.xray_reports  enable row level security;
alter table public.xray_evidence enable row level security;
alter table public.xray_findings enable row level security;

-- Table privileges. New tables are not exposed to the Data API automatically on this
-- project, so grant exactly what each role needs: the server (service_role) reads and
-- writes everything; signed-in users may only select (RLS filters to their own rows);
-- anonymous visitors get nothing.
revoke all on public.xray_orders, public.xray_reports, public.xray_evidence, public.xray_findings from anon;
grant usage on schema public to service_role, authenticated;
grant select, insert, update, delete on public.xray_orders, public.xray_reports, public.xray_evidence, public.xray_findings to service_role;
grant select on public.xray_orders, public.xray_reports, public.xray_evidence, public.xray_findings to authenticated;

drop policy if exists "xray orders: owner reads" on public.xray_orders;
create policy "xray orders: owner reads" on public.xray_orders
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "xray reports: owner reads approved" on public.xray_reports;
create policy "xray reports: owner reads approved" on public.xray_reports
  for select to authenticated
  using (
    status = 'approved'
    and exists (
      select 1 from public.xray_orders o
      where o.id = xray_reports.order_id and o.user_id = (select auth.uid())
    )
  );

drop policy if exists "xray evidence: owner reads" on public.xray_evidence;
create policy "xray evidence: owner reads" on public.xray_evidence
  for select to authenticated
  using (
    exists (
      select 1 from public.xray_reports r
      join public.xray_orders o on o.id = r.order_id
      where r.id = xray_evidence.report_id and r.status = 'approved' and o.user_id = (select auth.uid())
    )
  );

drop policy if exists "xray findings: owner reads kept" on public.xray_findings;
create policy "xray findings: owner reads kept" on public.xray_findings
  for select to authenticated
  using (
    status in ('kept', 'downgraded')
    and exists (
      select 1 from public.xray_reports r
      join public.xray_orders o on o.id = r.order_id
      where r.id = xray_findings.report_id and r.status = 'approved' and o.user_id = (select auth.uid())
    )
  );

-- Writes happen only through the service role (no insert/update/delete policies).
