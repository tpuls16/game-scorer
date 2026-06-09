import { getCurrentUser } from "./auth.js";
import { getSupabaseClient } from "./supabase-client.js";

/** @typedef {{ id: string, name: string, inviteCode: string, role: string, joinedAt: string, memberCount?: number }} HouseholdMembership */

/**
 * @param {unknown} row
 * @returns {HouseholdMembership | null}
 */
function mapMembershipRow(row) {
  if (!row?.id || !row?.name) return null;
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code ?? "",
    role: row.role ?? "member",
    joinedAt: row.joined_at ?? "",
  };
}

/** @returns {Promise<HouseholdMembership[]>} */
export async function loadMyHouseholds() {
  const user = getCurrentUser();
  if (!user) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("get_my_households");

  if (error) {
    console.error("Failed to load households", error);
    throw new Error(error.message || "Could not load your households.");
  }

  return (data ?? []).map((row) => mapMembershipRow(row)).filter(Boolean);
}

/**
 * @param {string} name
 * @returns {Promise<HouseholdMembership>}
 */
export async function createHousehold(name) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("create_household", {
    household_name: name.trim(),
  });

  if (error) {
    console.error("Failed to create household", error);
    throw new Error(error.message || "Could not create household.");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) {
    throw new Error("Could not create household.");
  }

  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    role: "owner",
    joinedAt: new Date().toISOString(),
    memberCount: 1,
  };
}

/**
 * @param {string} inviteCode
 * @returns {Promise<HouseholdMembership>}
 */
export async function joinHouseholdByCode(inviteCode) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("join_household_by_code", {
    code: inviteCode.trim(),
  });

  if (error) {
    console.error("Failed to join household", error);
    throw new Error(error.message || "Could not join household.");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) {
    throw new Error("Could not join household.");
  }

  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    role: "member",
    joinedAt: new Date().toISOString(),
  };
}

/**
 * @param {string} householdId
 * @param {string} inviteCode
 * @returns {Promise<HouseholdMembership>}
 */
export async function setHouseholdInviteCode(householdId, inviteCode) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("set_household_invite_code", {
    target_household_id: householdId,
    new_code: inviteCode.trim(),
  });

  if (error) {
    console.error("Failed to set household invite code", error);
    throw new Error(error.message || "Could not save join code.");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) {
    throw new Error("Could not save join code.");
  }

  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    role: "owner",
    joinedAt: new Date().toISOString(),
  };
}

/**
 * @param {string} householdId
 * @returns {Promise<HouseholdMembership>}
 */
export async function regenerateHouseholdInviteCode(householdId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("regenerate_household_invite_code", {
    target_household_id: householdId,
  });

  if (error) {
    console.error("Failed to regenerate household invite code", error);
    throw new Error(error.message || "Could not generate a new join code.");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) {
    throw new Error("Could not generate a new join code.");
  }

  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    role: "owner",
    joinedAt: new Date().toISOString(),
  };
}
