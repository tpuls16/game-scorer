create or replace function public.set_household_invite_code(
  target_household_id uuid,
  new_code text
)
returns table (id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
  h public.households%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  normalized := upper(trim(new_code));
  if char_length(normalized) < 6 or char_length(normalized) > 12 then
    raise exception 'Join code must be 6–12 characters';
  end if;

  if normalized !~ '^[A-Z0-9]+$' then
    raise exception 'Join code can only use letters and numbers';
  end if;

  if not exists (
    select 1 from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role = 'owner'
  ) then
    raise exception 'Only the household owner can change the join code';
  end if;

  update public.households
  set invite_code = normalized
  where id = target_household_id
  returning * into h;

  if not found then
    raise exception 'Household not found';
  end if;

  return query select h.id, h.name, h.invite_code;
exception
  when unique_violation then
    raise exception 'That join code is already in use — pick another one';
end;
$$;

create or replace function public.regenerate_household_invite_code(target_household_id uuid)
returns table (id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
  h public.households%rowtype;
  attempts int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role = 'owner'
  ) then
    raise exception 'Only the household owner can generate a new join code';
  end if;

  if not exists (select 1 from public.households where id = target_household_id) then
    raise exception 'Household not found';
  end if;

  loop
    attempts := attempts + 1;
    if attempts > 5 then
      raise exception 'Could not generate a unique join code — try again';
    end if;
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      update public.households
      set invite_code = code
      where id = target_household_id
      returning * into h;
      exit;
    exception
      when unique_violation then
        continue;
    end;
  end loop;

  return query select h.id, h.name, h.invite_code;
end;
$$;

revoke all on function public.set_household_invite_code(uuid, text) from public;
revoke all on function public.regenerate_household_invite_code(uuid) from public;
grant execute on function public.set_household_invite_code(uuid, text) to authenticated;
grant execute on function public.regenerate_household_invite_code(uuid) to authenticated;
