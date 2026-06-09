-- Family account usernames: sign in with username or email

create table public.account_usernames (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,32}$'),
  created_at timestamptz not null default now()
);

create unique index account_usernames_username_lower_idx
  on public.account_usernames (lower(username));

alter table public.account_usernames enable row level security;

create policy account_usernames_select_own
  on public.account_usernames for select
  using (user_id = auth.uid());

create policy account_usernames_insert_own
  on public.account_usernames for insert
  with check (user_id = auth.uid());

revoke all on table public.account_usernames from anon;
grant select, insert on table public.account_usernames to authenticated;

create or replace function public.is_username_available(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := trim(p_username);
  if v_username !~ '^[A-Za-z0-9_]{3,32}$' then
    return false;
  end if;

  return not exists (
    select 1
    from public.account_usernames
    where lower(username) = lower(v_username)
  );
end;
$$;

create or replace function public.register_account_username(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.account_usernames where user_id = auth.uid()) then
    raise exception 'This account already has a username.';
  end if;

  v_username := trim(p_username);
  if v_username !~ '^[A-Za-z0-9_]{3,32}$' then
    raise exception 'Username must be 3–32 letters, numbers, or underscores.';
  end if;

  insert into public.account_usernames (user_id, username)
  values (auth.uid(), v_username);
exception
  when unique_violation then
    raise exception 'That username is already taken.';
end;
$$;

create or replace function public.resolve_login_email(p_identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_email text;
begin
  v_id := trim(p_identifier);
  if v_id = '' then
    return null;
  end if;

  if position('@' in v_id) > 0 then
    return lower(v_id);
  end if;

  select u.email into v_email
  from public.account_usernames au
  join auth.users u on u.id = au.user_id
  where lower(au.username) = lower(v_id);

  return v_email;
end;
$$;

revoke all on function public.is_username_available(text) from public;
revoke all on function public.register_account_username(text) from public;
revoke all on function public.resolve_login_email(text) from public;

grant execute on function public.is_username_available(text) to anon, authenticated;
grant execute on function public.register_account_username(text) to authenticated;
grant execute on function public.resolve_login_email(text) to anon, authenticated;
