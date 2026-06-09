-- Saved scoring names per authenticated user (Phase 1 cloud sync)
create table public.player_profiles (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index player_profiles_user_id_idx on public.player_profiles (user_id);

alter table public.player_profiles enable row level security;

create policy "player_profiles_select_own"
  on public.player_profiles for select
  using (auth.uid() = user_id);

create policy "player_profiles_insert_own"
  on public.player_profiles for insert
  with check (auth.uid() = user_id);

create policy "player_profiles_update_own"
  on public.player_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "player_profiles_delete_own"
  on public.player_profiles for delete
  using (auth.uid() = user_id);
