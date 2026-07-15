create table if not exists public.chat_announcement (
  id smallint primary key default 1 check (id = 1),
  user_id uuid not null references auth.users(id) on delete cascade,
  login_id text not null,
  message text not null check (char_length(message) between 1 and 200),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.chat_announcement enable row level security;
revoke all on public.chat_announcement from anon, authenticated;

create or replace function public.get_chat_announcement()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select case when announcement.id is null then null else jsonb_build_object(
    'login_id', announcement.login_id,
    'message', announcement.message,
    'updated_at', announcement.updated_at
  ) end
  from (select 1) as singleton
  left join public.chat_announcement as announcement on announcement.id = 1
  where auth.uid() is not null;
$$;

create or replace function public.set_chat_announcement(p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_login_id text := lower(auth.jwt()->'user_metadata'->>'login_id');
begin
  if v_user_id is null then raise exception '로그인이 필요합니다.'; end if;
  if v_login_id is null or not (v_login_id = any(array['admin', 'm161awm']::text[])) then
    raise exception '공지 작성 권한이 없습니다.';
  end if;

  p_message := btrim(p_message);
  if p_message = '' then
    delete from public.chat_announcement where id = 1;
    return;
  end if;
  if char_length(p_message) > 200 then raise exception '공지는 200자까지 입력할 수 있습니다.'; end if;

  insert into public.chat_announcement (id, user_id, login_id, message, updated_at)
  values (1, v_user_id, v_login_id, p_message, clock_timestamp())
  on conflict (id) do update
  set user_id = excluded.user_id,
      login_id = excluded.login_id,
      message = excluded.message,
      updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.get_chat_announcement() from public;
revoke all on function public.set_chat_announcement(text) from public;
grant execute on function public.get_chat_announcement() to authenticated;
grant execute on function public.set_chat_announcement(text) to authenticated;
