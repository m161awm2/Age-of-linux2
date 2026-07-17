create table if not exists public.player_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gold integer not null default 200 check (gold >= 0),
  tutorial_completed boolean not null default false,
  unlocked_special_paths text[] not null default '{}'::text[],
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint player_progress_special_paths_check
    check (unlocked_special_paths <@ array['ronin', 'fenrir']::text[])
);

alter table public.player_progress enable row level security;
revoke all on public.player_progress from anon, authenticated;

create or replace function public.create_player_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(new.is_anonymous, false) then
    insert into public.player_progress (user_id) values (new.id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists create_player_progress_after_signup on auth.users;
create trigger create_player_progress_after_signup
after insert on auth.users
for each row execute function public.create_player_progress();

-- 배포 전에 생성된 정식 계정도 새 진행도 시스템을 사용할 수 있게 한 번만 초기화한다.
insert into public.player_progress (user_id)
select id from auth.users where not coalesce(is_anonymous, false)
on conflict (user_id) do nothing;

alter table public.ranked_runs
  add column if not exists campaign_reward_claimed boolean not null default false;

create or replace function public.get_player_progress()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_progress public.player_progress%rowtype;
begin
  if v_user_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception '로그인이 필요합니다.';
  end if;
  insert into public.player_progress (user_id) values (v_user_id)
  on conflict (user_id) do nothing;
  select * into v_progress from public.player_progress where user_id = v_user_id;
  return jsonb_build_object(
    'gold', v_progress.gold,
    'tutorial_completed', v_progress.tutorial_completed,
    'unlocked_special_paths', to_jsonb(v_progress.unlocked_special_paths)
  );
end;
$$;

create or replace function public.complete_player_tutorial()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception '로그인이 필요합니다.';
  end if;
  update public.player_progress
  set tutorial_completed = true, updated_at = clock_timestamp()
  where user_id = auth.uid();
end;
$$;

create or replace function public.purchase_special_path(p_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_price constant integer := 200;
begin
  if v_user_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_path not in ('ronin', 'fenrir') then raise exception '잘못된 스페셜 계열입니다.'; end if;

  update public.player_progress
  set gold = gold - v_price,
      unlocked_special_paths = array_append(unlocked_special_paths, p_path),
      updated_at = clock_timestamp()
  where user_id = v_user_id
    and gold >= v_price
    and not (p_path = any(unlocked_special_paths));

  if not found then
    if exists (select 1 from public.player_progress where user_id = v_user_id and p_path = any(unlocked_special_paths)) then
      raise exception '이미 해금한 계열입니다.';
    end if;
    raise exception '보석이 부족합니다.';
  end if;
  return public.get_player_progress();
end;
$$;

-- 과거 버전에 존재하던 상점 장착 기능은 전투 중 병종 선택 방식으로 대체한다.
drop function if exists public.equip_special_path(text);

create or replace function public.claim_campaign_reward(p_run_id uuid, p_difficulty text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reward integer;
  v_gold integer;
begin
  if v_user_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception '로그인이 필요합니다.';
  end if;
  v_reward := case p_difficulty
    when 'Easy' then 10 when 'Normal' then 20 when 'Medium' then 40
    when 'Hard' then 70 when 'Impossible' then 100 else null end;
  if v_reward is null then raise exception '잘못된 난이도입니다.'; end if;

  update public.ranked_runs
  set campaign_reward_claimed = true
  where id = p_run_id and user_id = v_user_id and difficulty = p_difficulty
    and not campaign_reward_claimed
    and started_at <= clock_timestamp() - interval '5 seconds';
  if not found then raise exception '이미 보상을 받았거나 유효하지 않은 전투입니다.'; end if;

  insert into public.player_progress (user_id) values (v_user_id)
  on conflict (user_id) do nothing;
  update public.player_progress
  set gold = gold + v_reward, updated_at = clock_timestamp()
  where user_id = v_user_id
  returning gold into v_gold;
  return jsonb_build_object('awarded', v_reward, 'gold', v_gold);
end;
$$;

revoke all on function public.get_player_progress() from public;
revoke all on function public.complete_player_tutorial() from public;
revoke all on function public.purchase_special_path(text) from public;
revoke all on function public.claim_campaign_reward(uuid, text) from public;
grant execute on function public.get_player_progress() to authenticated;
grant execute on function public.complete_player_tutorial() to authenticated;
grant execute on function public.purchase_special_path(text) to authenticated;
grant execute on function public.claim_campaign_reward(uuid, text) to authenticated;
