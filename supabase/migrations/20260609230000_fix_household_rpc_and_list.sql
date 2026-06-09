-- Fix PL/pgSQL RETURNS TABLE / column name ambiguity in household RPCs
-- Add get_my_households() for reliable empty-list loading

create or replace function public.join_household_by_code(code text)
returns table (id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = public
as $function$
#variable_conflict use_column
declare
  h public.households%rowtype;
  normalized text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  normalized := upper(trim(code));
  if char_length(normalized) < 6 then
    raise exception 'Enter a valid invite code';
  end if;

  select * into h
  from public.households
  where public.households.invite_code = normalized;

  if not found then
    raise exception 'No household found with that invite code';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (h.id, auth.uid(), 'member')
  on conflict do nothing;

  return query select h.id, h.name, h.invite_code;
end;
$function$;

create or replace function public.get_my_households()
returns table (
  id uuid,
  name text,
  invite_code text,
  role text,
  joined_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select h.id, h.name, h.invite_code, hm.role, hm.joined_at
  from public.household_members hm
  inner join public.households h on h.id = hm.household_id
  where hm.user_id = auth.uid()
  order by hm.joined_at;
$$;

revoke all on function public.get_my_households() from public;
grant execute on function public.get_my_households() to authenticated;

drop policy if exists household_members_select_member on public.household_members;

create policy household_members_select_own
  on public.household_members for select
  using (user_id = auth.uid());
