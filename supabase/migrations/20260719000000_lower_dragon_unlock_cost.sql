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
    when 'hatchling' then 250
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
