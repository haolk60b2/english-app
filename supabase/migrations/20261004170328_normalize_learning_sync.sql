-- Normalize the old per-user snapshot. Keep learning_data as a read-only backup.
-- Run atomically: any conversion error rolls back both schema and data changes.
begin;

alter table public.cards add column if not exists client_id text;
alter table public.cards add column if not exists back_en text;
alter table public.cards add column if not exists back_vi text;
alter table public.cards add column if not exists example_vi text;
alter table public.cards add column if not exists leitner_stage smallint not null default 0;
alter table public.cards add column if not exists elapsed_days integer not null default 0;
alter table public.cards add column if not exists scheduled_days integer not null default 0;
alter table public.cards add column if not exists learning_steps integer not null default 0;
alter table public.cards add column if not exists sync_revision bigint not null default 0;
alter table public.cards add column if not exists deleted_at timestamptz;
alter table public.cards add column if not exists updated_at timestamptz not null default now();
update public.cards set client_id=id::text where client_id is null;
alter table public.cards alter column client_id set not null;
create unique index if not exists cards_user_client_id_key on public.cards(user_id, client_id);
create index if not exists cards_user_sync_revision_idx on public.cards(user_id, sync_revision);
create index if not exists cards_user_due_idx on public.cards(user_id, due) where deleted_at is null;

alter table public.user_progress add column if not exists daily_goal integer not null default 20;
alter table public.user_progress add column if not exists last_daily_gen date;
alter table public.user_progress add column if not exists sync_revision bigint not null default 0;

create table if not exists public.learning_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  current_session_date date,
  updated_at timestamptz not null default now()
);
create table if not exists public.study_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  study_date date not null,
  session_data jsonb not null check (
    jsonb_typeof(session_data)='object' and
    not (session_data ? 'reviewCards') and not (session_data ? 'newCards')
  ),
  sync_revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key(user_id, study_date)
);
create index if not exists study_sessions_user_revision_idx on public.study_sessions(user_id, sync_revision);
create table if not exists public.library_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null,
  is_read boolean not null default true,
  sync_revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key(user_id, lesson_id)
);
create index if not exists library_progress_user_revision_idx on public.library_progress(user_id, sync_revision);

-- Replace only the policies on tables used by this sync protocol.
-- The old ALL policies were not restricted to authenticated users.
do $$
declare table_name text; policy_name text;
begin
  foreach table_name in array array['cards','user_progress','learning_sync_state','study_sessions','library_progress'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update on public.%I to authenticated', table_name);
    execute format('revoke delete on public.%I from authenticated', table_name);
    for policy_name in select policyname from pg_policies where schemaname='public' and tablename=table_name loop
      execute format('drop policy %I on public.%I', policy_name, table_name);
    end loop;
    execute format('create policy "Read own data" on public.%I for select to authenticated using ((select auth.uid())=user_id)',table_name);
    execute format('create policy "Insert own data" on public.%I for insert to authenticated with check ((select auth.uid())=user_id)',table_name);
    execute format('create policy "Update own data" on public.%I for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',table_name);
  end loop;
end $$;

-- Convert a client card into explicit SQL columns. The database UUID stays
-- independent of the client ID, preserving all existing deck/log foreign keys.
create or replace function public.learning_card_record(p_user uuid, p_card jsonb, p_revision bigint)
returns public.cards language sql volatile security invoker set search_path = '' as $$
  select jsonb_populate_record(null::public.cards, jsonb_build_object(
    'id',gen_random_uuid(),'user_id',p_user,'client_id',p_card->>'id',
    'front',p_card->>'front','back',p_card->>'back','back_en',p_card->>'backEn','back_vi',p_card->>'backVi',
    'example',p_card->>'example','phonetic',p_card->>'phonetic','example_vi',p_card->>'exampleVi',
    'level',coalesce(p_card->>'level','B1'),'tags',coalesce(p_card->'tags','[]'::jsonb),
    'state',coalesce(p_card->'state','0'::jsonb),'step',coalesce(p_card->'learning_steps','0'::jsonb),
    'learning_steps',coalesce(p_card->'learning_steps','0'::jsonb),
    'stability',coalesce(p_card->'stability','0'::jsonb),'difficulty',coalesce(p_card->'difficulty','0'::jsonb),
    'elapsed_days',coalesce(p_card->'elapsed_days','0'::jsonb),'scheduled_days',coalesce(p_card->'scheduled_days','0'::jsonb),
    'reps',coalesce(p_card->'reps','0'::jsonb),'lapses',coalesce(p_card->'lapses','0'::jsonb),
    'leitner_stage',coalesce(p_card->'leitnerStage','0'::jsonb),'due',p_card->>'due','last_review',p_card->>'last_review',
    'created_at',p_card->>'createdAt','updated_at',now(),'sync_revision',p_revision,'deleted_at',null
  ));
$$;
revoke all on function public.learning_card_record(uuid,jsonb,bigint) from public, anon;
grant execute on function public.learning_card_record(uuid,jsonb,bigint) to authenticated;

create or replace function public.save_learning_changes(p_expected_revision bigint, p_changes jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  account_id uuid := auth.uid(); current_revision bigint; next_revision bigint;
  changed_at timestamptz := now(); progress jsonb; session jsonb;
begin
  if account_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if jsonb_typeof(p_changes) <> 'object' then raise exception 'Invalid changes'; end if;
  insert into public.learning_sync_state(user_id) values(account_id) on conflict(user_id) do nothing;
  select revision into current_revision from public.learning_sync_state where user_id=account_id for update;
  if current_revision <> p_expected_revision then
    return jsonb_build_object('conflict',true,'revision',current_revision,'updated_at',null);
  end if;
  next_revision := current_revision+1;
  insert into public.cards
    select converted.* from jsonb_array_elements(coalesce(p_changes->'cards','[]'::jsonb)) item
      cross join lateral public.learning_card_record(account_id,item.value,next_revision) converted
    on conflict(user_id,client_id) do update set
      front=excluded.front,back=excluded.back,back_en=excluded.back_en,back_vi=excluded.back_vi,
      example=excluded.example,example_vi=excluded.example_vi,phonetic=excluded.phonetic,
      level=excluded.level,tags=excluded.tags,state=excluded.state,step=excluded.step,learning_steps=excluded.learning_steps,
      stability=excluded.stability,difficulty=excluded.difficulty,elapsed_days=excluded.elapsed_days,
      scheduled_days=excluded.scheduled_days,reps=excluded.reps,lapses=excluded.lapses,
      leitner_stage=excluded.leitner_stage,due=excluded.due,last_review=excluded.last_review,
      created_at=excluded.created_at,updated_at=excluded.updated_at,sync_revision=excluded.sync_revision,deleted_at=null;
  update public.cards set deleted_at=changed_at, updated_at=changed_at, sync_revision=next_revision
    where user_id=account_id and client_id in (select jsonb_array_elements_text(coalesce(p_changes->'deletedCardIds','[]'::jsonb)));
  if p_changes ? 'progress' then
    progress := p_changes->'progress';
    insert into public.user_progress(user_id,streak,last_study_date,total_reviews,xp,level,daily_goal,last_daily_gen,updated_at,sync_revision)
      values(account_id,(progress->>'streak')::integer,(progress->>'lastStudyDate')::date,
        (progress->>'totalReviews')::integer,(progress->>'xp')::integer,(progress->>'level')::integer,
        (progress->>'dailyGoal')::integer,(progress->>'lastDailyGen')::date,changed_at,next_revision)
      on conflict(user_id) do update set streak=excluded.streak,last_study_date=excluded.last_study_date,
        total_reviews=excluded.total_reviews,xp=excluded.xp,level=excluded.level,daily_goal=excluded.daily_goal,
        last_daily_gen=excluded.last_daily_gen,updated_at=excluded.updated_at,sync_revision=excluded.sync_revision;
  end if;
  if p_changes ? 'session' then
    session := p_changes->'session';
    if session <> 'null'::jsonb then
      insert into public.study_sessions(user_id,study_date,session_data,sync_revision,updated_at)
        values(account_id,(session->>'date')::date,session,next_revision,changed_at)
        on conflict(user_id,study_date) do update set session_data=excluded.session_data,
          sync_revision=excluded.sync_revision,updated_at=excluded.updated_at;
    end if;
    update public.learning_sync_state set current_session_date=case when session='null'::jsonb then null else (session->>'date')::date end
      where user_id=account_id;
  end if;
  insert into public.library_progress(user_id,lesson_id,is_read,sync_revision,updated_at)
    select account_id,lesson->>'id',(lesson->>'read')::boolean,next_revision,changed_at
      from jsonb_array_elements(coalesce(p_changes->'lessons','[]'::jsonb)) lesson
    on conflict(user_id,lesson_id) do update set is_read=excluded.is_read,sync_revision=excluded.sync_revision,updated_at=excluded.updated_at;
  update public.learning_sync_state set revision=next_revision,updated_at=changed_at where user_id=account_id;
  return jsonb_build_object('conflict',false,'revision',next_revision,'updated_at',changed_at);
end $$;
revoke all on function public.save_learning_changes(bigint,jsonb) from public, anon;
grant execute on function public.save_learning_changes(bigint,jsonb) to authenticated;

create or replace function public.get_learning_changes(p_since_revision bigint default 0)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare account_id uuid := auth.uid(); state public.learning_sync_state;
begin
  if account_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_since_revision < 0 then raise exception 'Invalid revision'; end if;
  insert into public.learning_sync_state(user_id) values(account_id) on conflict(user_id) do nothing;
  -- Keep RPC writers out until all rows for this response have been read.
  select * into state from public.learning_sync_state where user_id=account_id for share;
  return jsonb_build_object(
    'revision',state.revision,'updated_at',state.updated_at,'current_session_date',state.current_session_date,
    'cards',coalesce((select jsonb_agg(case when c.deleted_at is not null
      then jsonb_build_object('client_id',c.client_id,'deleted_at',c.deleted_at) else to_jsonb(c) end order by c.client_id) from public.cards c
      where c.user_id=account_id and c.sync_revision>p_since_revision),'[]'::jsonb),
    'progress',(select to_jsonb(p) from public.user_progress p where p.user_id=account_id and p.sync_revision>p_since_revision),
    'session',(select s.session_data from public.study_sessions s where s.user_id=account_id and s.study_date=state.current_session_date
      and state.revision>p_since_revision),
    'lessons',coalesce((select jsonb_agg(to_jsonb(l) order by l.lesson_id) from public.library_progress l
      where l.user_id=account_id and l.sync_revision>p_since_revision),'[]'::jsonb)
  );
end $$;
revoke all on function public.get_learning_changes(bigint) from public, anon;
grant execute on function public.get_learning_changes(bigint) to authenticated;

-- Import each original snapshot once. Retain every original payload unchanged.
do $$
declare old public.learning_data; previous_claim text := current_setting('request.jwt.claim.sub',true); session jsonb;
begin
  for old in select * from public.learning_data where user_id not in (select user_id from public.learning_sync_state) loop
    perform set_config('request.jwt.claim.sub',old.user_id::text,true);
    session := old.payload->'session';
    if session is not null and session <> 'null'::jsonb then
      session := (session-'reviewCards'-'newCards') || jsonb_build_object(
        'reviewIds',coalesce((select jsonb_agg(card->>'id') from jsonb_array_elements(old.payload->'session'->'reviewCards') card),'[]'::jsonb),
        'newIds',coalesce((select jsonb_agg(card->>'id') from jsonb_array_elements(old.payload->'session'->'newCards') card),'[]'::jsonb));
    else session := 'null'::jsonb; end if;
    perform public.save_learning_changes(0,jsonb_build_object(
      'cards',old.payload->'cards','deletedCardIds','[]'::jsonb,'progress',old.payload->'progress','session',session,
      'lessons',coalesce((select jsonb_agg(jsonb_build_object('id',lesson,'read',true))
        from jsonb_array_elements_text(old.payload->'read') lesson),'[]'::jsonb)));
  end loop;
  perform set_config('request.jwt.claim.sub',coalesce(previous_claim,''),true);
end $$;

-- Include pre-existing SQL-only cards/progress in the first download, too.
update public.cards set sync_revision=1 where sync_revision=0 and user_id is not null;
update public.user_progress set sync_revision=1 where sync_revision=0;
insert into public.learning_sync_state(user_id,revision)
  select user_id,1 from (select user_id from public.cards where user_id is not null union select user_id from public.user_progress) owners
  on conflict(user_id) do nothing;

-- Older deployed clients must not keep overwriting the archived snapshot.
revoke insert,update,delete on public.learning_data from authenticated;
grant select on public.learning_data to authenticated;
notify pgrst, 'reload schema';
commit;
