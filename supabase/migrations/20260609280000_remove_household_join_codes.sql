-- Join codes are obsolete: households are created per account, not joined via codes.

drop function if exists public.join_household_by_code(text);
drop function if exists public.set_household_invite_code(uuid, text);
drop function if exists public.regenerate_household_invite_code(uuid);
drop function if exists public.create_household(text);
drop function if exists public.get_my_households();

alter table public.households drop column if exists invite_code;

create or replace function public.create_household(household_name text)
returns table (id uuid, name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid := gen_random_uuid();
  trimmed text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  trimmed := trim(household_name);
  if char_length(trimmed) < 1 or char_length(trimmed) > 48 then
    raise exception 'Household name must be 1–48 characters';
  end if;

  insert into public.households (id, name, created_by)
  values (new_id, trimmed, auth.uid());

  insert into public.household_members (household_id, user_id, role)
  values (new_id, auth.uid(), 'owner');

  return query select new_id, trimmed;
end;
$$;

create or replace function public.get_my_households()
returns table (
  id uuid,
  name text,
  role text,
  joined_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select h.id, h.name, hm.role, hm.joined_at
  from public.household_members hm
  inner join public.households h on h.id = hm.household_id
  where hm.user_id = auth.uid()
  order by hm.joined_at;
$$;

revoke all on function public.create_household(text) from public;
grant execute on function public.create_household(text) to authenticated;

revoke all on function public.get_my_households() from public;
grant execute on function public.get_my_households() to authenticated;
