-- 브라우저에서 임의로 실행 ID를 만든 뒤 보상을 직접 청구하지 못하도록
-- 미완료 실행의 중복 생성과 승리 완료 전 보상 수령을 차단한다.
create or replace function public.start_ranked_run(
  p_difficulty text,
  p_game_version text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_run_id uuid;
begin
  if v_user_id is null then raise exception '로그인이 필요합니다.'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then raise exception '정식 로그인이 필요합니다.'; end if;
  if p_difficulty not in ('Easy', 'Normal', 'Medium', 'Hard', 'Impossible') then raise exception '잘못된 난이도입니다.'; end if;
  if p_game_version <> '2026-07-15-difficulty-v2' then raise exception '지원하지 않는 게임 버전입니다.'; end if;

  -- 계정마다 진행 중 실행은 하나만 유지한다. 동시에 여러 요청이 와도 직렬화한다.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
  delete from public.ranked_runs
  where user_id = v_user_id and finished_at is null;

  insert into public.ranked_runs (user_id, difficulty, game_version)
  values (v_user_id, p_difficulty, p_game_version)
  returning id into v_run_id;

  return v_run_id;
end;
$$;

create or replace function public.claim_campaign_reward(p_run_id uuid, p_difficulty text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_run public.ranked_runs%rowtype;
  v_reward integer;
  v_min_duration_ms integer;
  v_gold integer;
begin
  if v_user_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_run
  from public.ranked_runs
  where id = p_run_id and user_id = v_user_id
  for update;

  if not found then raise exception '유효하지 않은 전투입니다.'; end if;
  if v_run.difficulty <> p_difficulty then raise exception '전투 난이도가 일치하지 않습니다.'; end if;
  if v_run.game_version <> '2026-07-15-difficulty-v2' then raise exception '지원하지 않는 게임 버전입니다.'; end if;
  if v_run.finished_at is null or v_run.duration_ms is null then
    raise exception '승리가 확인되지 않은 전투입니다.';
  end if;
  if v_run.campaign_reward_claimed then raise exception '이미 보상을 받은 전투입니다.'; end if;

  v_reward := case v_run.difficulty
    when 'Easy' then 10 when 'Normal' then 20 when 'Medium' then 40
    when 'Hard' then 70 when 'Impossible' then 100 else null end;
  v_min_duration_ms := case v_run.difficulty
    when 'Easy' then 15000 when 'Normal' then 20000 when 'Medium' then 25000
    when 'Hard' then 30000 when 'Impossible' then 45000 else null end;
  if v_reward is null or v_min_duration_ms is null then raise exception '잘못된 난이도입니다.'; end if;
  if v_run.duration_ms < v_min_duration_ms then raise exception '유효하지 않은 전투 시간입니다.'; end if;

  update public.ranked_runs
  set campaign_reward_claimed = true
  where id = v_run.id and not campaign_reward_claimed;
  if not found then raise exception '이미 보상을 받은 전투입니다.'; end if;

  insert into public.player_progress (user_id) values (v_user_id)
  on conflict (user_id) do nothing;
  update public.player_progress
  set gold = gold + v_reward, updated_at = clock_timestamp()
  where user_id = v_user_id
  returning gold into v_gold;

  return jsonb_build_object('awarded', v_reward, 'gold', v_gold);
end;
$$;

revoke all on function public.start_ranked_run(text, text) from public;
revoke all on function public.claim_campaign_reward(uuid, text) from public;
grant execute on function public.start_ranked_run(text, text) to authenticated;
grant execute on function public.claim_campaign_reward(uuid, text) to authenticated;
