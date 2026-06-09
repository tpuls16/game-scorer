revoke all on function public.create_household(text) from anon;
revoke all on function public.join_household_by_code(text) from anon;
revoke all on function public.set_household_invite_code(uuid, text) from anon;
revoke all on function public.regenerate_household_invite_code(uuid) from anon;

revoke all on table public.player_profiles from anon;
revoke all on table public.households from anon;
revoke all on table public.household_members from anon;
