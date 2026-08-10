import { createFileRoute } from "@tanstack/react-router";

/**
 * Watches for new accounts (Google OAuth included) that never received the
 * welcome email and sends it. Safe to call repeatedly — the profiles
 * `welcome_email_sent` flag makes it idempotent.
 *
 * Auth: `Authorization: Bearer $WELCOME_SWEEP_SECRET` or `?token=`.
 */
async function sweep(request: Request) {
  const secret = process.env["WELCOME_SWEEP_SECRET"];
  if (!secret) return Response.json({ error: "not configured" }, { status: 500 });

  const url = new URL(request.url);
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = bearer ?? url.searchParams.get("token") ?? "";
  if (token !== secret) return new Response("Unauthorized", { status: 401 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendWelcomeMail } = await import("@/lib/mailer.server");
  const appUrl = "https://campus-networkk.lovable.app";

  const { data: pending, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name")
    .eq("welcome_email_sent", false)
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!pending?.length) return Response.json({ checked: 0, sent: 0, failed: 0 });

  let sent = 0;
  let failed = 0;
  for (const profile of pending) {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    const email = authUser?.user?.email;
    if (!email) continue;
    try {
      await sendWelcomeMail(email, profile.full_name ?? "there", appUrl);
      await supabaseAdmin.from("profiles").update({ welcome_email_sent: true }).eq("id", profile.id);
      sent += 1;
    } catch (e) {
      console.error("welcome sweep failed for", profile.id, e);
      failed += 1;
    }
  }
  return Response.json({ checked: pending.length, sent, failed });
}

export const Route = createFileRoute("/api/public/welcome-sweep")({
  server: { handlers: { GET: ({ request }) => sweep(request), POST: ({ request }) => sweep(request) } },
});
