-- pgcrypto가 extensions 스키마에 설치된 환경에서도 방 코드 생성이 동작하도록
-- 확장 함수 gen_random_bytes() 대신 PostgreSQL 기본 UUID 생성 함수를 사용한다.
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

revoke all on function public.create_pvp_room() from public;
grant execute on function public.create_pvp_room() to authenticated;
