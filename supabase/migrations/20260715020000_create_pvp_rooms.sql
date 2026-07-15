create table if not exists public.pvp_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-F0-9]{6}$'),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  guest_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'full', 'cancelled')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '30 minutes'),
  check (guest_user_id is null or guest_user_id <> host_user_id)
);

create index if not exists pvp_rooms_code_status_idx on public.pvp_rooms (code, status);
create index if not exists pvp_rooms_host_idx on public.pvp_rooms (host_user_id, created_at desc);
create index if not exists pvp_rooms_guest_idx on public.pvp_rooms (guest_user_id, created_at desc);

alter table public.pvp_rooms enable row level security;
revoke all on public.pvp_rooms from anon, authenticated;

create or replace function public.pvp_room_payload(p_room public.pvp_rooms, p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'id', p_room.id,
    'code', p_room.code,
    'status', p_room.status,
    'host_user_id', p_room.host_user_id,
    'host_login_id', coalesce((select lower(u.raw_user_meta_data->>'login_id') from auth.users u where u.id = p_room.host_user_id), '방장'),
    'guest_user_id', p_room.guest_user_id,
    'guest_login_id', (select lower(u.raw_user_meta_data->>'login_id') from auth.users u where u.id = p_room.guest_user_id),
    'is_host', p_room.host_user_id = p_user_id,
    'expires_at', p_room.expires_at
  );
$$;

create or replace function public.create_pvp_room()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
  v_room public.pvp_rooms%rowtype;
  v_attempt integer := 0;
begin
  if v_user_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception '로그인이 필요합니다.';
  end if;

  update public.pvp_rooms
  set status = 'cancelled', updated_at = clock_timestamp()
  where status in ('waiting', 'full') and (host_user_id = v_user_id or guest_user_id = v_user_id);

  loop
    v_attempt := v_attempt + 1;
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.pvp_rooms (code, host_user_id)
      values (v_code, v_user_id)
      returning * into v_room;
      exit;
    exception when unique_violation then
      if v_attempt >= 10 then raise exception '방 코드를 만들지 못했습니다.'; end if;
    end;
  end loop;

  return public.pvp_room_payload(v_room, v_user_id);
end;
$$;

create or replace function public.join_pvp_room(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.pvp_rooms%rowtype;
begin
  if v_user_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception '로그인이 필요합니다.';
  end if;
  p_code := upper(btrim(p_code));
  if p_code !~ '^[A-F0-9]{6}$' then raise exception '방 코드가 올바르지 않습니다.'; end if;

  select * into v_room
  from public.pvp_rooms
  where code = p_code and status in ('waiting', 'full') and expires_at > clock_timestamp()
  for update;

  if not found then raise exception '방을 찾을 수 없거나 만료되었습니다.'; end if;
  if v_room.host_user_id = v_user_id then return public.pvp_room_payload(v_room, v_user_id); end if;
  if v_room.guest_user_id is not null and v_room.guest_user_id <> v_user_id then raise exception '이미 가득 찬 방입니다.'; end if;

  update public.pvp_rooms
  set guest_user_id = v_user_id, status = 'full', updated_at = clock_timestamp()
  where id = v_room.id
  returning * into v_room;

  return public.pvp_room_payload(v_room, v_user_id);
end;
$$;

create or replace function public.get_pvp_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.pvp_rooms%rowtype;
begin
  if v_user_id is null then raise exception '로그인이 필요합니다.'; end if;
  select * into v_room from public.pvp_rooms where id = p_room_id;
  if not found or (v_room.host_user_id <> v_user_id and v_room.guest_user_id is distinct from v_user_id) then
    raise exception '방을 찾을 수 없습니다.';
  end if;
  return public.pvp_room_payload(v_room, v_user_id);
end;
$$;

create or replace function public.leave_pvp_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.pvp_rooms%rowtype;
begin
  if v_user_id is null then raise exception '로그인이 필요합니다.'; end if;
  select * into v_room from public.pvp_rooms where id = p_room_id for update;
  if not found then return; end if;
  if v_room.host_user_id = v_user_id then
    update public.pvp_rooms set status = 'cancelled', updated_at = clock_timestamp() where id = p_room_id;
  elsif v_room.guest_user_id = v_user_id then
    update public.pvp_rooms
    set guest_user_id = null, status = 'waiting', updated_at = clock_timestamp()
    where id = p_room_id;
  else
    raise exception '방 참가자가 아닙니다.';
  end if;
end;
$$;

revoke all on function public.pvp_room_payload(public.pvp_rooms, uuid) from public;
revoke all on function public.create_pvp_room() from public;
revoke all on function public.join_pvp_room(text) from public;
revoke all on function public.get_pvp_room(uuid) from public;
revoke all on function public.leave_pvp_room(uuid) from public;
grant execute on function public.create_pvp_room() to authenticated;
grant execute on function public.join_pvp_room(text) to authenticated;
grant execute on function public.get_pvp_room(uuid) to authenticated;
grant execute on function public.leave_pvp_room(uuid) to authenticated;
