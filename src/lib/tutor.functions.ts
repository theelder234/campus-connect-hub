import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SYSTEM = `You are CampusLink AI Tutor, a helpful Socratic academic assistant for university students.
Guide students toward the answer step-by-step rather than just giving it away.
Ask a clarifying question when needed. Explain concepts clearly with examples.
If the student asks for a full solution, offer a brief hint first, then reveal the solution only if they insist.
Cite key formulas or definitions when helpful. Keep responses focused and encouraging.`;

const Input = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
});

export const tutorSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => Input.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    let convId = data.conversationId;
    if (!convId) {
      const { data: conv, error } = await supabase.from("ai_conversations").insert({
        user_id: userId, title: data.message.slice(0, 60),
      }).select().single();
      if (error) throw new Error(error.message);
      convId = conv.id;
    }

    const { data: history } = await supabase.from("ai_messages")
      .select("role, content").eq("conversation_id", convId).order("created_at");

    await supabase.from("ai_messages").insert({ conversation_id: convId, role: "user", content: data.message });

    const messages = [
      { role: "system", content: SYSTEM },
      ...((history as { role: string; content: string }[]) ?? []),
      { role: "user", content: data.message },
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Rate limit hit. Please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in your workspace.");
      throw new Error(`AI error [${res.status}]: ${body}`);
    }
    const j = await res.json();
    const reply: string = j.choices?.[0]?.message?.content ?? "";
    await supabase.from("ai_messages").insert({ conversation_id: convId, role: "assistant", content: reply });

    return { conversationId: convId, reply };
  });

export const tutorListConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("ai_conversations").select("id, title, created_at").order("created_at", { ascending: false });
    return data ?? [];
  });

export const tutorLoadMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ conversationId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: msgs } = await context.supabase.from("ai_messages")
      .select("id, role, content, created_at").eq("conversation_id", data.conversationId).order("created_at");
    return msgs ?? [];
  });