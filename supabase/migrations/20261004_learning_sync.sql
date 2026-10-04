-- Run in the SQL Editor of the Supabase project configured in .env.
-- Existing cards/decks tables and data are left intact. Local card IDs are text.
create table if not exists public.learning_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint learning_payload_object check (jsonb_typeof(payload) = 'object')
);

alter table public.learning_data enable row level security;
revoke all on public.learning_data from anon;
grant select, insert, update on public.learning_data to authenticated;

drop policy if exists "Read own learning data" on public.learning_data;
create policy "Read own learning data" on public.learning_data
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Insert own learning data" on public.learning_data;
create policy "Insert own learning data" on public.learning_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Update own learning data" on public.learning_data;
create policy "Update own learning data" on public.learning_data
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
