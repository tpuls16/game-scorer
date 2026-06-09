create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 48),
  invite_code text not null unique check (char_length(invite_code) between 6 and 12),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')) default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_id_idx on public.household_members (user_id);

alter table public.households enable row level security;
alter table public.household_members enable row level security;

create policy households_select_member
  on public.households for select
  using (
    id in (
      select household_id from public.household_members
      where user_id = auth.uid()
    )
  );

create policy household_members_select_member
  on public.household_members for select
  using (
    user_id = auth.uid()
    or household_id in (
      select hm.household_id from public.household_members hm
      where hm.user_id = auth.uid()
    )
  );

create or replace function public.create_household(household_name text)
returns table (id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid := gen_random_uuid();
  code text;
  trimmed text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  trimmed := trim(household_name);
  if char_length(trimmed) < 1 or char_length(trimmed) > 48 then
    raise exception 'Household name must be 1–48 characters';
  end if;

  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.households (id, name, invite_code, created_by)
  values (new_id, trimmed, code, auth.uid());

  insert into public.household_members (household_id, user_id, role)
  values (new_id, auth.uid(), 'owner');

  return query select new_id, trimmed, code;
end;
$$;

create or replace function public.join_household_by_code(code text)
returns table (id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
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

  select * into h from public.households where invite_code = normalized;
  if not found then
    raise exception 'No household found with that invite code';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (h.id, auth.uid(), 'member')
  on conflict do nothing;

  return query select h.id, h.name, h.invite_code;
end;
$$;

revoke all on function public.create_household(text) from public;
revoke all on function public.join_household_by_code(text) from public;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household_by_code(text) to authenticated;
