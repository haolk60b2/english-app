-- Run in SQL Editor after migration, with at least one app Auth user.
-- Every write is rolled back. Does not create accounts or leave test data.
begin;
do $$
declare account_id uuid;
begin
  select id into account_id from auth.users order by created_at desc limit 1;
  if account_id is null then raise exception 'Sign in to the app before this check'; end if;
  perform set_config('request.jwt.claim.sub', account_id::text, true);
end $$;
set local role authenticated;
do $$
declare affected integer;
begin
  insert into public.learning_data(user_id, payload)
    values(auth.uid(), '{"version":1}'::jsonb) on conflict(user_id) do nothing;
  if not exists(select 1 from public.learning_data where user_id=auth.uid()) then
    raise exception 'Own data is not readable';
  end if;
  update public.learning_data set revision=revision+1 where user_id=auth.uid();
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Own update is blocked'; end if;
  update public.learning_data set revision=revision+1 where user_id=auth.uid() and revision=-1;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Stale revision can overwrite'; end if;
  begin
    insert into public.learning_data(user_id, payload)
      values('00000000-0000-0000-0000-000000000001', '{}'::jsonb);
    raise exception 'Cross-account insert unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  if exists(select 1 from public.learning_data) then raise exception 'Cross-account read allowed'; end if;
  update public.learning_data set payload='{}'::jsonb;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-account update allowed'; end if;
end $$;
rollback;
