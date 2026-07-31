import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const RoleSchema = z.enum(["student", "faculty", "admin"]);

async function assertAdmin(context: { supabase: any; userId: string }) {
  // Verified through the caller's own RLS-scoped session (users can read their own roles).
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

/** Current caller's roles + whether any admin exists (for bootstrap). */
export const adminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: mine } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: admins } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin").limit(1);
    return {
      roles: (mine ?? []).map((r: { role: string }) => r.role),
      isAdmin: (mine ?? []).some((r: { role: string }) => r.role === "admin"),
      adminExists: (admins ?? []).length > 0,
    };
  });

/** Claim admin when the platform has no admin yet (one-time bootstrap). */
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: admins } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin").limit(1);
    if ((admins ?? []).length > 0) throw new Error("An admin already exists");
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, department, avatar_url, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emails = new Map(authUsers?.users.map((u) => [u.id, u.email ?? ""]) ?? []);
    return (profiles ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      department: p.department,
      email: emails.get(p.id) ?? "",
      created_at: p.created_at,
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) =>
    z.object({
      userId: z.string().uuid(),
      role: RoleSchema,
      grant: z.boolean(),
    }).parse(v),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && data.role === "admin" && !data.grant) {
      throw new Error("You cannot remove your own admin role");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });