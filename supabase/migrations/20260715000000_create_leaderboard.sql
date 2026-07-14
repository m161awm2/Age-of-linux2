create table if not exists public.ranked_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  difficulty text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  game_version text not null,
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  duration_ms integer check (duration_ms > 0)
);

create index if not exists ranked_runs_user_started_idx
  on public.ranked_runs (user_id, started_at desc);

create table if not exists public.leaderboard_scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 12),
  difficulty text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  game_version text not null,
  best_time_ms integer not null check (best_time_ms > 0),
  unit_composition jsonb not null default '{}'::jsonb,
  achieved_at timestamptz not null default clock_timestamp(),
  primary key (user_id, difficulty, game_version)
);

create index if not exists leaderboard_order_idx
  on public.leaderboard_scores (difficulty, game_version, best_time_ms);

alter table public.ranked_runs enable row level security;
alter table public.leaderboard_scores enable row level security;
alter table public.leaderboard_scores
  add column if not exists unit_composition jsonb not null default '{}'::jsonb;

revoke all on public.ranked_runs from anon, authenticated;
revoke all on public.leaderboard_scores from anon, authenticated;

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
  if p_difficulty not in ('Easy', 'Medium', 'Hard') then raise exception '잘못된 난이도입니다.'; end if;
  if char_length(p_game_version) not between 1 and 32 then raise exception '잘못된 게임 버전입니다.'; end if;

  insert into public.ranked_runs (user_id, difficulty, game_version)
  values (v_user_id, p_difficulty, p_game_version)
  returning id into v_run_id;

  return v_run_id;
end;
$$;

drop function if exists public.finish_ranked_run(uuid, text);

create or replace function public.finish_ranked_run(
  p_run_id uuid,
  p_nickname text,
  p_unit_composition jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_run public.ranked_runs%rowtype;
  v_finished_at timestamptz := clock_timestamp();
  v_duration_ms integer;
  v_personal_best boolean;
  v_unit record;
begin
  if v_user_id is null then raise exception '로그인이 필요합니다.'; end if;
  p_nickname := btrim(p_nickname);
  if p_nickname !~ '^[가-힣A-Za-z0-9 _-]{2,12}$' then raise exception '닉네임 형식이 올바르지 않습니다.'; end if;
  if jsonb_typeof(p_unit_composition) <> 'object' then raise exception '병종 조합 형식이 올바르지 않습니다.'; end if;
  if (select count(*) from jsonb_each(p_unit_composition)) > 20 then raise exception '병종 조합이 너무 큽니다.'; end if;
  for v_unit in select key, value from jsonb_each_text(p_unit_composition) loop
    if v_unit.key !~ '^[A-Za-z]+$' or v_unit.value !~ '^[0-9]{1,4}$' then
      raise exception '병종 조합 값이 올바르지 않습니다.';
    end if;
  end loop;

  select * into v_run
  from public.ranked_runs
  where id = p_run_id and user_id = v_user_id
  for update;

  if not found then raise exception '전투 기록을 찾을 수 없습니다.'; end if;
  if v_run.finished_at is not null then raise exception '이미 등록된 전투입니다.'; end if;

  v_duration_ms := floor(extract(epoch from (v_finished_at - v_run.started_at)) * 1000);
  if v_duration_ms < 5000 or v_duration_ms > 10800000 then raise exception '유효하지 않은 전투 시간입니다.'; end if;

  update public.ranked_runs
  set finished_at = v_finished_at, duration_ms = v_duration_ms
  where id = p_run_id;

  select not exists (
    select 1 from public.leaderboard_scores
    where user_id = v_user_id
      and difficulty = v_run.difficulty
      and game_version = v_run.game_version
      and best_time_ms <= v_duration_ms
  ) into v_personal_best;

  insert into public.leaderboard_scores
    (user_id, nickname, difficulty, game_version, best_time_ms, unit_composition, achieved_at)
  values
    (v_user_id, p_nickname, v_run.difficulty, v_run.game_version, v_duration_ms, p_unit_composition, v_finished_at)
  on conflict (user_id, difficulty, game_version) do update
  set nickname = excluded.nickname,
      best_time_ms = excluded.best_time_ms,
      unit_composition = excluded.unit_composition,
      achieved_at = excluded.achieved_at
  where excluded.best_time_ms < public.leaderboard_scores.best_time_ms;

  return jsonb_build_object(
    'accepted', true,
    'duration_ms', v_duration_ms,
    'personal_best', v_personal_best
  );
end;
$$;

create or replace function public.get_leaderboard(
  p_difficulty text,
  p_game_version text,
  p_limit integer default 100
) returns table (
  position bigint,
  nickname text,
  best_time_ms integer,
  is_me boolean,
  unit_composition jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    row_number() over (order by scores.best_time_ms, scores.achieved_at) as position,
    scores.nickname,
    scores.best_time_ms,
    scores.user_id = auth.uid() as is_me,
    scores.unit_composition
  from public.leaderboard_scores as scores
  where scores.difficulty = p_difficulty
    and scores.game_version = p_game_version
  order by scores.best_time_ms, scores.achieved_at
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.set_rank_nickname(
  p_nickname text,
  p_game_version text
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_changed integer;
begin
  if v_user_id is null then raise exception '로그인이 필요합니다.'; end if;
  p_nickname := btrim(p_nickname);
  if p_nickname !~ '^[가-힣A-Za-z0-9 _-]{2,12}$' then raise exception '닉네임 형식이 올바르지 않습니다.'; end if;

  update public.leaderboard_scores
  set nickname = p_nickname
  where user_id = v_user_id and game_version = p_game_version;
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

revoke all on function public.start_ranked_run(text, text) from public;
revoke all on function public.finish_ranked_run(uuid, text, jsonb) from public;
revoke all on function public.get_leaderboard(text, text, integer) from public;
revoke all on function public.set_rank_nickname(text, text) from public;
grant execute on function public.start_ranked_run(text, text) to authenticated;
grant execute on function public.finish_ranked_run(uuid, text, jsonb) to authenticated;
grant execute on function public.get_leaderboard(text, text, integer) to authenticated;
grant execute on function public.set_rank_nickname(text, text) to authenticated;
