-- RiskFusion AI production schema. Demo data is inserted idempotently by the
-- application startup seed so the same fixture powers local SQLite and Postgres.
create table if not exists public.incidents (
  id varchar(32) primary key,
  title varchar(160) not null,
  incident_type varchar(80) not null,
  severity varchar(16) not null,
  status varchar(32) not null,
  risk_score integer not null,
  ai_confidence double precision not null,
  customer_name varchar(120) not null,
  customer_id varchar(32) not null,
  bank varchar(100) not null,
  source_location varchar(100) not null,
  detected_at timestamp without time zone not null,
  updated_at timestamp without time zone not null,
  description text not null,
  transaction_amount double precision,
  currency varchar(8) not null default 'INR',
  signals jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  mitre_techniques jsonb not null default '[]'::jsonb
);

create index if not exists incidents_severity_idx on public.incidents (severity);
create index if not exists incidents_status_idx on public.incidents (status);
create index if not exists incidents_detected_at_idx on public.incidents (detected_at);

-- The API connects with a server-only database credential; do not expose this
-- demo incident table through the public Data API.
alter table public.incidents enable row level security;
