alter table public.ranked_runs
  drop constraint if exists ranked_runs_difficulty_check;
alter table public.ranked_runs
  add constraint ranked_runs_difficulty_check
  check (difficulty in ('Easy', 'Normal', 'Medium', 'Hard', 'Impossible'));

alter table public.leaderboard_scores
  drop constraint if exists leaderboard_scores_difficulty_check;
alter table public.leaderboard_scores
  add constraint leaderboard_scores_difficulty_check
  check (difficulty in ('Easy', 'Normal', 'Medium', 'Hard', 'Impossible'));

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
  if char_length(p_game_version) not between 1 and 32 then raise exception '잘못된 게임 버전입니다.'; end if;

  insert into public.ranked_runs (user_id, difficulty, game_version)
  values (v_user_id, p_difficulty, p_game_version)
  returning id into v_run_id;

  return v_run_id;
end;
$$;

revoke all on function public.start_ranked_run(text, text) from public;
grant execute on function public.start_ranked_run(text, text) to authenticated;
