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
    'fenrir', 'ronin', 'viking', 'sanada'
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
