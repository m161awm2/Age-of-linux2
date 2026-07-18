alter table public.player_progress
  drop constraint if exists player_progress_special_paths_check;

alter table public.player_progress
  add constraint player_progress_special_paths_check
  check (unlocked_special_paths <@ array['ronin', 'fenrir', 'hatchling']::text[]);

create or replace function public.purchase_special_path(p_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_price integer;
begin
  if v_user_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception '로그인이 필요합니다.';
  end if;

  v_price := case p_path
    when 'ronin' then 200
    when 'fenrir' then 200
    when 'hatchling' then 500
    else null
  end;
  if v_price is null then raise exception '잘못된 스페셜 계열입니다.'; end if;

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

revoke all on function public.purchase_special_path(text) from public;
grant execute on function public.purchase_special_path(text) to authenticated;

create or replace function public.send_pvp_spawn(p_room_id uuid, p_unit_kind text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.pvp_rooms%rowtype;
  v_event public.pvp_room_events%rowtype;
begin
  if v_user_id is null then raise exception '로그인이 필요합니다.'; end if;
  if not (p_unit_kind = any(array[
    'soldier', 'spearman', 'halberd', 'paladin', 'crusader', 'spartan', 'shieldGuard',
    'archer', 'musketeer', 'gatlingGunner', 'javelin', 'retiarius', 'fireArcher', 'siphonarioi',
    'knight', 'chariot', 'wingedHussar', 'dragoon',
    'fenrir', 'ronin', 'viking', 'sanada', 'hatchling', 'adultDragon'
  ]::text[])) then raise exception '소환 병종이 올바르지 않습니다.'; end if;

  select * into v_room from public.pvp_rooms where id = p_room_id;
  if not found or v_room.status <> 'full' or v_room.guest_user_id is null then
    raise exception '진행 가능한 1대1 방이 아닙니다.';
  end if;
  if v_user_id <> v_room.host_user_id and v_user_id <> v_room.guest_user_id then
    raise exception '방 참가자가 아닙니다.';
  end if;

  insert into public.pvp_room_events (room_id, user_id, unit_kind)
  values (p_room_id, v_user_id, p_unit_kind)
  returning * into v_event;

  return jsonb_build_object(
    'id', v_event.id,
    'user_id', v_event.user_id,
    'unit_kind', v_event.unit_kind,
    'created_at', v_event.created_at
  );
end;
$$;

revoke all on function public.send_pvp_spawn(uuid, text) from public;
grant execute on function public.send_pvp_spawn(uuid, text) to authenticated;
