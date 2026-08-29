-- Supabase schema cho English App
-- Chạy trong SQL Editor của Supabase

-- 1. Decks
create table if not exists decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text,
  level text check (level in ('A1','A2','B1','B2','C1','C2')),
  created_at timestamptz default now()
);

-- 2. Cards (FSRS fields)
create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid references decks(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  front text not null,
  back text not null,
  example text,
  phonetic text,
  level text default 'B1',
  tags text[] default '{}',
  -- FSRS fields
  state smallint default 0, -- 0 New, 1 Learning, 2 Review, 3 Relearning
  step int default 0,
  stability double precision default 0,
  difficulty double precision default 0,
  due timestamptz default now(),
  last_review timestamptz,
  reps int default 0,
  lapses int default 0,
  created_at timestamptz default now()
);

-- 3. Review logs
create table if not exists review_logs (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  rating smallint not null, -- 1 Again, 2 Hard, 3 Good, 4 Easy
  state smallint,
  due timestamptz,
  stability double precision,
  difficulty double precision,
  elapsed_days int,
  scheduled_days int,
  review timestamptz default now()
);

-- 4. Progress / Streak
create table if not exists user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  streak int default 0,
  last_study_date date,
  total_reviews int default 0,
  xp int default 0,
  level int default 1,
  updated_at timestamptz default now()
);

-- 5. Writing submissions
create table if not exists writings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  prompt text,
  content text not null,
  feedback jsonb,
  score int,
  created_at timestamptz default now()
);

-- RLS
alter table decks enable row level security;
alter table cards enable row level security;
alter table review_logs enable row level security;
alter table user_progress enable row level security;
alter table writings enable row level security;

create policy "Users can manage own decks" on decks for all using (auth.uid() = user_id);
create policy "Users can manage own cards" on cards for all using (auth.uid() = user_id);
create policy "Users can manage own logs" on review_logs for all using (auth.uid() = user_id);
create policy "Users can manage own progress" on user_progress for all using (auth.uid() = user_id);
create policy "Users can manage own writings" on writings for all using (auth.uid() = user_id);
