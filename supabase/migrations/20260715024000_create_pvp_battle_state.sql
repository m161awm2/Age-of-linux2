create table if not exists public.pvp_battle_states (
  room_id uuid primary key references public.pvp_rooms(id) on delete cascade,
  sequence bigint not null default 0,
  snapshot jsonb not null,
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.pvp_battle_states enable row level security;
revoke all on public.pvp_battle_states from anon, authenticated;

create or replace function public.set_pvp_battle_state(p_room_id uuid, p_snapshot jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.pvp_rooms%rowtype;
  v_sequence bigint;
begin
  if v_user_id is null then raise exception '로그인이 필요합니다.'; end if;
  select * into v_room from public.pvp_rooms as room where room.id = p_room_id;
  if not found or v_room.status <> 'full' then raise exception '진행 중인 1대1 방이 아닙니다.'; end if;
  if v_user_id <> v_room.host_user_id then raise exception '방장만 전투 상태를 갱신할 수 있습니다.'; end if;
  if jsonb_typeof(p_snapshot) <> 'object' or jsonb_typeof(p_snapshot->'units') <> 'array' then
    raise exception '전투 상태 형식이 올바르지 않습니다.';
  end if;
  v_sequence := (p_snapshot->>'sequence')::bigint;
  if v_sequence is null or v_sequence < 1 then raise exception '전투 상태 순번이 올바르지 않습니다.'; end if;

  insert into public.pvp_battle_states (room_id, sequence, snapshot, updated_at)
  values (p_room_id, v_sequence, p_snapshot, clock_timestamp())
  on conflict (room_id) do update
  set sequence = excluded.sequence,
      snapshot = excluded.snapshot,
      updated_at = excluded.updated_at
  where excluded.sequence > public.pvp_battle_states.sequence;
end;
$$;

create or replace function public.get_pvp_battle_state(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.pvp_rooms%rowtype;
  v_snapshot jsonb;
begin
  if v_user_id is null then raise exception '로그인이 필요합니다.'; end if;
  select * into v_room from public.pvp_rooms as room where room.id = p_room_id;
  if not found or (v_user_id <> v_room.host_user_id and v_user_id is distinct from v_room.guest_user_id) then
    raise exception '방 참가자가 아닙니다.';
  end if;
  select state.snapshot into v_snapshot from public.pvp_battle_states as state where state.room_id = p_room_id;
  return v_snapshot;
end;
$$;

revoke all on function public.set_pvp_battle_state(uuid, jsonb) from public;
revoke all on function public.get_pvp_battle_state(uuid) from public;
grant execute on function public.set_pvp_battle_state(uuid, jsonb) to authenticated;
grant execute on function public.get_pvp_battle_state(uuid) to authenticated;
