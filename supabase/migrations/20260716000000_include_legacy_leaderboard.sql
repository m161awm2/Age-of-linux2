create or replace function public.get_leaderboard(
  p_difficulty text,
  p_game_version text,
  p_limit integer default 100
) returns table (
  rank_position bigint,
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
  with ranked_candidates as (
    select
      scores.*,
      row_number() over (
        partition by scores.user_id
        order by scores.best_time_ms, scores.achieved_at
      ) as user_best_position
    from public.leaderboard_scores as scores
    where scores.difficulty = p_difficulty
      and (
        scores.game_version = p_game_version
        or (
          p_game_version = '2026-07-15-difficulty-v2'
          and scores.game_version = '2026-07-15'
        )
      )
      and not coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
  ), best_scores as (
    select *
    from ranked_candidates
    where user_best_position = 1
  )
  select
    row_number() over (order by scores.best_time_ms, scores.achieved_at) as rank_position,
    scores.nickname,
    scores.best_time_ms,
    scores.user_id = auth.uid() as is_me,
    scores.unit_composition
  from best_scores as scores
  order by scores.best_time_ms, scores.achieved_at
  limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.get_leaderboard(text, text, integer) from public;
grant execute on function public.get_leaderboard(text, text, integer) to authenticated;
