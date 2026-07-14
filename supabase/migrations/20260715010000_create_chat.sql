create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  login_id text not null check (login_id ~ '^[a-z0-9_]{4,16}$'),
  message text not null check (char_length(message) between 1 and 200),
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists chat_messages_created_idx
  on public.chat_messages (created_at desc);
create index if not exists chat_messages_user_created_idx
  on public.chat_messages (user_id, created_at desc);

alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from anon, authenticated;

create or replace function public.send_chat_message(p_message text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_login_id text := lower(auth.jwt()->'user_metadata'->>'login_id');
  v_message_id bigint;
begin
  if v_user_id is null then raise exception '로그인이 필요합니다.'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then raise exception '정식 로그인이 필요합니다.'; end if;
  if v_login_id is null or v_login_id !~ '^[a-z0-9_]{4,16}$' then raise exception '아이디 정보가 올바르지 않습니다.'; end if;

  p_message := btrim(p_message);
  if char_length(p_message) not between 1 and 200 then raise exception '메시지는 1~200자로 입력하세요.'; end if;
  if exists (
    select 1 from public.chat_messages
    where user_id = v_user_id and created_at > clock_timestamp() - interval '2 seconds'
  ) then raise exception 'Too fast: 도배 방지를 위해 잠시 기다려 주세요.'; end if;
  if (
    select count(*) from public.chat_messages
    where user_id = v_user_id and created_at > clock_timestamp() - interval '1 minute'
  ) >= 12 then raise exception 'Too fast: 1분 전송 제한을 초과했습니다.'; end if;

  insert into public.chat_messages (user_id, login_id, message)
  values (v_user_id, v_login_id, p_message)
  returning id into v_message_id;
  return v_message_id;
end;
$$;

create or replace function public.get_chat_messages(p_limit integer default 60)
returns table (
  id bigint,
  login_id text,
  message text,
  created_at timestamptz,
  is_me boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select recent.id, recent.login_id, recent.message, recent.created_at, recent.user_id = auth.uid()
  from (
    select chat.id, chat.user_id, chat.login_id, chat.message, chat.created_at
    from public.chat_messages as chat
    where not coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
    order by chat.created_at desc
    limit least(greatest(p_limit, 1), 100)
  ) as recent
  order by recent.created_at;
$$;

revoke all on function public.send_chat_message(text) from public;
revoke all on function public.get_chat_messages(integer) from public;
grant execute on function public.send_chat_message(text) to authenticated;
grant execute on function public.get_chat_messages(integer) to authenticated;
