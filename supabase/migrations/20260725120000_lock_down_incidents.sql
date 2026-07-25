-- Close public read access to incident data.
--
-- public.incidents holds customer names, customer identifiers, institution
-- names and transaction amounts. Row Level Security was enabled previously but
-- a permissive policy left the table readable by the anon role, which means it
-- was readable by anyone holding the publishable anon key — i.e. anybody who
-- loaded the site. This migration removes that access.
--
-- Access model after this migration:
--   anon          → no access at all.
--   authenticated → read incidents, create them, and update status/severity
--                   plus the audit timeline.
--   service_role  → full access (bypasses RLS); this is what the API uses.

-- Incident ownership. The queue has always shown an "Assigned To" column but
-- had nowhere to store an assignee, so the value was fabricated in the browser.
alter table public.incidents add column if not exists assigned_to varchar(160);
create index if not exists incidents_assigned_to_idx on public.incidents (assigned_to);

alter table public.incidents enable row level security;

-- Drop every existing policy on the table so no previously created permissive
-- policy survives, whatever it was named.
do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'incidents'
  loop
    execute format('drop policy if exists %I on public.incidents', policy_name);
  end loop;
end $$;

-- Remove table-level grants from the browser-facing roles. Without a grant,
-- PostgREST refuses the request before RLS is even consulted.
revoke all on public.incidents from anon;
revoke all on public.incidents from public;

grant select, insert, update on public.incidents to authenticated;

-- Signed-in analysts may read the incident queue.
create policy "Authenticated users can read incidents"
  on public.incidents
  for select
  to authenticated
  using (true);

-- Signed-in analysts may raise new incidents.
create policy "Authenticated users can create incidents"
  on public.incidents
  for insert
  to authenticated
  with check (true);

-- Signed-in analysts may triage existing incidents. Deletion is intentionally
-- not granted: incident history must be preserved for audit, so closing an
-- incident is a status change rather than a delete.
create policy "Authenticated users can update incidents"
  on public.incidents
  for update
  to authenticated
  using (true)
  with check (true);
