-- Run through MCP execute_sql after normalization. All writes are rolled back.
begin;
do $$
declare account_id uuid;
begin
  select id into account_id from auth.users order by created_at desc limit 1;
  if account_id is null then raise exception 'Sign in to the app before this check'; end if;
  perform set_config('request.jwt.claim.sub',account_id::text,true);
end $$;
set local role authenticated;
do $$
declare initial jsonb; saved jsonb; changes jsonb; affected integer; original_claim text := auth.uid()::text;
begin
  initial := public.get_learning_changes(0);
  saved := public.save_learning_changes((initial->>'revision')::bigint,jsonb_build_object(
    'cards',jsonb_build_array(jsonb_build_object('id','_verify_sync_','front','verify','back','kiểm tra',
      'due',now(),'createdAt',now(),'tags','[]'::jsonb,'level','B1','leitnerStage',0)),
    'deletedCardIds','[]'::jsonb,'lessons','[]'::jsonb));
  if saved->>'conflict' <> 'false' then raise exception 'Own save failed'; end if;
  changes := public.get_learning_changes((initial->>'revision')::bigint);
  if jsonb_array_length(changes->'cards') <> 1 then raise exception 'Incremental read is incorrect'; end if;
  saved := public.save_learning_changes((initial->>'revision')::bigint,'{"cards":[],"lessons":[]}'::jsonb);
  if saved->>'conflict' <> 'true' then raise exception 'Stale revision can overwrite'; end if;
  begin
    insert into public.library_progress(user_id,lesson_id)
      values('ffffffff-ffff-ffff-ffff-ffffffffffff','not-yours');
    raise exception 'Cross-account insert unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub','ffffffff-ffff-ffff-ffff-ffffffffffff',true);
  if exists(select 1 from public.cards) then raise exception 'Cross-account read allowed'; end if;
  update public.cards set front='wrong account';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-account update allowed'; end if;
  perform set_config('request.jwt.claim.sub',original_claim,true);
end $$;
rollback;
