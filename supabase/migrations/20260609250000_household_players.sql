-- Expose saved player names from other household members for game setup (read-only via RPC)

create or replace function public.get_household_players()
returns table (
  profile_id uuid,
  profile_name text,
  profile_favorite boolean,
  owner_user_id uuid,
  owner_label text,
  household_id uuid,
  household_name text
)
language sql
security definer
stable
set search_path = public
as $$
  select distinct
    pp.id,
    pp.name,
    pp.favorite,
    pp.user_id,
    split_part(u.email, '@', 1) as owner_label,
    h.id,
    h.name
  from public.household_members hm_me
  inner join public.household_members hm_them
    on hm_them.household_id = hm_me.household_id
    and hm_them.user_id <> hm_me.user_id
  inner join public.player_profiles pp on pp.user_id = hm_them.user_id
  inner join public.households h on h.id = hm_me.household_id
  inner join auth.users u on u.id = pp.user_id
  where hm_me.user_id = auth.uid()
  order by h.name, owner_label, pp.name;
$$;

revoke all on function public.get_household_players() from public;
grant execute on function public.get_household_players() to authenticated;
