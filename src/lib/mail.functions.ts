import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Sends a nodemailer confirmation link to a freshly signed-up, unconfirmed email. */
export const sendSignupConfirmation = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ email: z.string().email(), redirectTo: z.string().url() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendConfirmationMail } = await import("./mailer.server");

    const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: data.email,
      options: { redirectTo: data.redirectTo },
    });
    // Never reveal whether the address exists.
    if (error || !linkData?.properties?.action_link) return { sent: true };
    if (linkData.user?.email_confirmed_at) return { sent: true };

    try {
      await sendConfirmationMail(data.email, linkData.properties.action_link);
    } catch (e) {
      console.error("confirmation mail failed", e);
      return { sent: false };
    }
    return { sent: true };
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