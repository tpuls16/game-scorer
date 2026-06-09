-- Household roster: shared player names per household (replaces per-user player_profiles for game setup)

create table public.household_players (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 24),
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index household_players_household_name_lower_idx
  on public.household_players (household_id, lower(trim(name)));

create index household_players_household_id_idx on public.household_players (household_id);

alter table public.household_players enable row level security;

create policy household_players_select_member
  on public.household_players for select
  using (
    household_id in (
      select household_id from public.household_members
      where user_id = auth.uid()
    )
  );

create policy household_players_insert_member
  on public.household_players for insert
  with check (
    household_id in (
      select household_id from public.household_members
      where user_id = auth.uid()
    )
  );

create policy household_players_update_member
  on public.household_players for update
  using (
    household_id in (
      select household_id from public.household_members
      where user_id = auth.uid()
    )
  )
  with check (
    household_id in (
      select household_id from public.household_members
      where user_id = auth.uid()
    )
  );

create policy household_players_delete_member
  on public.household_players for delete
  using (
    household_id in (
      select household_id from public.household_members
      where user_id = auth.uid()
    )
  );

revoke all on table public.household_players from anon;
grant select, insert, update, delete on table public.household_players to authenticated;
