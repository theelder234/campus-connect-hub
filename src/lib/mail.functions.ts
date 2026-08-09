import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function hashCode(email: string, code: string) {
  const bytes = new TextEncoder().encode(`${email.toLowerCase()}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Emails a 6-digit verification code to a freshly signed-up, unconfirmed address. */
export const sendSignupOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendOtpMail } = await import("./mailer.server");

    // Resolve the account without revealing whether it exists.
    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (!linkData?.user || linkData.user.email_confirmed_at) return { sent: true };

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await supabaseAdmin.from("email_otps").insert({
      email,
      code_hash: await hashCode(email, code),
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });

    try {
      await sendOtpMail(email, code);
    } catch (e) {
      console.error("otp mail failed", e);
      return { sent: false };
    }
    return { sent: true };
  });

/** Verifies the code and confirms the account so the user can sign in. */
export const verifySignupOtp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/) }).parse(input),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("email_otps")
      .select("id, code_hash, expires_at, attempts, consumed_at")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row || row.consumed_at || new Date(row.expires_at) < new Date()) {
      throw new Error("That code has expired. Request a new one.");
    }
    if (row.attempts >= 5) throw new Error("Too many attempts. Request a new code.");

    if (row.code_hash !== (await hashCode(email, data.code))) {
      await supabaseAdmin.from("email_otps").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      throw new Error("Incorrect code.");
    }

    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (!linkData?.user) throw new Error("Account not found.");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(linkData.user.id, {
      email_confirm: true,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("email_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);
    return { verified: true };
  });

/** Sends the welcome email once per account (email/password and Google users alike). */
export const sendWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ appUrl: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendWelcomeMail } = await import("./mailer.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, welcome_email_sent")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile || profile.welcome_email_sent) return { sent: false };

    const email = (context.claims as { email?: string } | null)?.email;
    if (!email) return { sent: false };

    try {
      await sendWelcomeMail(email, profile.full_name ?? "there", data.appUrl);
    } catch (e) {
      console.error("welcome mail failed", e);
      return { sent: false };
    }
    await supabaseAdmin
      .from("profiles")
      .update({ welcome_email_sent: true })
      .eq("id", context.userId);
    return { sent: true };
  });