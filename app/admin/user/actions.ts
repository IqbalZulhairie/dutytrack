"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RegisterUserState = {
  status: "idle" | "success" | "error";
  message: string;
  createdUser?: { id: string; fullName: string; staffId: string; email: string };
};

function readField(formData: FormData, name: string, trim = true) {
  const value = formData.get(name);
  if (typeof value !== "string") return "";
  return trim ? value.trim() : value;
}

export async function registerUser(
  _previousState: RegisterUserState,
  formData: FormData,
): Promise<RegisterUserState> {
  void _previousState;

  const sessionClient = await createSupabaseServerClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();

  if (authError || !authData.user) {
    return { status: "error", message: "Sign in to register users." };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { status: "error", message: "Server setup is incomplete: SUPABASE_SERVICE_ROLE_KEY is missing." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: currentProfile, error: currentProfileError } = await adminClient
    .from("profiles")
    .select("role_id")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (currentProfileError) {
    return { status: "error", message: `Could not verify your account permissions: ${currentProfileError.message}` };
  }
  if (!currentProfile) {
    return { status: "error", message: "Your account profile could not be verified." };
  }

  const { data: currentRole, error: currentRoleError } = await adminClient
    .from("roles")
    .select("role_name")
    .eq("id", currentProfile.role_id)
    .maybeSingle();

  if (currentRoleError) {
    return { status: "error", message: `Could not verify your account role: ${currentRoleError.message}` };
  }
  if (!currentRole || !["admin", "administrator"].includes(currentRole.role_name.toLowerCase())) {
    return { status: "error", message: "Only administrators can register staff accounts." };
  }

  const fullName = readField(formData, "fullName");
  const staffId = readField(formData, "staffId");
  const email = readField(formData, "email").toLowerCase();
  const password = readField(formData, "password", false);
  const confirmPassword = readField(formData, "confirmPassword", false);

  if (!fullName || fullName.length > 120) {
    return { status: "error", message: "Enter a name between 1 and 120 characters." };
  }
  if (!staffId || staffId.length > 50) {
    return { status: "error", message: "Enter a staff ID between 1 and 50 characters." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { status: "error", message: "Password must contain at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { status: "error", message: "The passwords do not match." };
  }

  const { data: selectedRole, error: selectedRoleError } = await adminClient
    .from("roles")
    .select("id, role_name")
    .ilike("role_name", "staff")
    .maybeSingle();

  if (selectedRoleError) {
    return { status: "error", message: `Could not verify the staff role: ${selectedRoleError.message}` };
  }
  if (!selectedRole) {
    return { status: "error", message: "The staff role is not configured. Contact your administrator." };
  }
  if (selectedRole.role_name.toLowerCase() !== "staff") {
    return { status: "error", message: "Only staff accounts can be registered through this form." };
  }

  const { data: createdAuthUser, error: createUserError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, staff_id: staffId },
  });

  if (createUserError) {
    return { status: "error", message: `Could not create the authentication account: ${createUserError.message}` };
  }
  if (!createdAuthUser.user) {
    return { status: "error", message: "Supabase did not return the created authentication account." };
  }

  const { error: insertProfileError } = await adminClient.from("profiles").insert({
    id: createdAuthUser.user.id,
    staff_id: staffId,
    full_name: fullName,
    email,
    role_id: selectedRole.id,
  });

  if (insertProfileError) {
    const { error: rollbackError } = await adminClient.auth.admin.deleteUser(createdAuthUser.user.id);
    if (rollbackError) {
      return {
        status: "error",
        message: `Profile insertion failed (${insertProfileError.message}) and the Auth account could not be rolled back (${rollbackError.message}).`,
      };
    }
    return {
      status: "error",
      message: `Profile insertion failed; the new Auth account was removed. ${insertProfileError.message}`,
    };
  }

  return {
    status: "success",
    message: `${fullName} was registered successfully.`,
    createdUser: { id: createdAuthUser.user.id, fullName, staffId, email },
  };
}
