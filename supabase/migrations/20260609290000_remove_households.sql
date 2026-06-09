-- Households are obsolete: one account owns players, games, and history.

insert into public.player_profiles (id, user_id, name, favorite, created_at, updated_at)
select hp.id, hm.user_id, hp.name, hp.favorite, hp.created_at, hp.updated_at
from public.household_players hp
inner join public.household_members hm
  on hm.household_id = hp.household_id
 and hm.role = 'owner'
on conflict (id) do update
set
  name = excluded.name,
  favorite = excluded.favorite,
  updated_at = excluded.updated_at;

drop function if exists public.get_household_players();
drop function if exists public.delete_household(uuid);
drop function if exists public.get_my_households();
drop function if exists public.create_household(text);
drop function if exists public.join_household_by_code(text);
drop function if exists public.set_household_invite_code(uuid, text);
drop function if exists public.regenerate_household_invite_code(uuid);

drop table if exists public.household_players;
drop table if exists public.household_members cascade;
drop table if exists public.households cascade;
