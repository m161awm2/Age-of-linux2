create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  login_id text not null check (login_id ~ '^[a-z0-9_]{4,16}$'),
  last_seen_at timestamptz not null default clock_timestamp()
);

create index if not exists user_presence_last_seen_idx
  on public.user_presence (last_seen_at desc);

alter table public.user_presence enable row level security;
revoke all on public.user_presence from anon, authenticated;

create or replace function public.touch_user_presence()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_login_id text;
begin
  if v_user_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception '로그인이 필요합니다.';
  end if;

  select lower(btrim(coalesce(raw_user_meta_data->>'login_id', '')))
  into v_login_id
  from auth.users
  where id = v_user_id;

  if v_login_id !~ '^[a-z0-9_]{4,16}$' then
    raise exception '로그인 아이디를 확인할 수 없습니다.';
  end if;

  insert into public.user_presence (user_id, login_id, last_seen_at)
  values (v_user_id, v_login_id, clock_timestamp())
  on conflict (user_id) do update
  set login_id = excluded.login_id,
      last_seen_at = excluded.last_seen_at;
end;
$$;

create or replace function public.leave_user_presence()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return; end if;
  delete from public.user_presence where user_id = auth.uid();
end;
$$;

create or replace function public.get_online_users()
returns table (
  login_id text,
  last_seen_at timestamptz,
  is_me boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select presence.login_id,
         presence.last_seen_at,
         presence.user_id = auth.uid() as is_me
  from public.user_presence as presence
  where auth.uid() is not null
    and not coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
    and presence.last_seen_at >= now() - interval '2 minutes'
  order by is_me desc, presence.last_seen_at desc, presence.login_id
  limit 100;
$$;

revoke all on function public.touch_user_presence() from public;
revoke all on function public.leave_user_presence() from public;
revoke all on function public.get_online_users() from public;
grant execute on function public.touch_user_presence() to authenticated;
grant execute on function public.leave_user_presence() to authenticated;
grant execute on function public.get_online_users() to authenticated;
