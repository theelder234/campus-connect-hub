import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { buildAttachmentParts, type TutorAttachment } from "./tutor-files.server";
import { streamResponsesText } from "./responses.server";

const SYSTEM = `You are CampusLink AI Tutor, a helpful Socratic academic assistant for university students.
Guide students toward the answer step-by-step rather than just giving it away.
Ask a clarifying question when needed. Explain concepts clearly with examples.
If the student asks for a full solution, offer a brief hint first, then reveal the solution only if they insist.
When the student attaches files (past question papers, lecture notes, photos of problems), read them carefully and base your answer on their content; refer to specific questions or sections by number.
Cite key formulas or definitions when helpful. Keep responses focused and encouraging.`;

const MODEL = "openai/gpt-6-astra";

const Attachment = z.object({
  path: z.string().min(3).max(400),
  name: z.string().min(1).max(200),
  type: z.string().max(200),
  size: z.number().int().nonnegative(),
});

const Input = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().max(4000),
  attachments: z.array(Attachment).max(3).default([]),
}).refine((v) => v.message.trim().length > 0 || v.attachments.length > 0, { message: "Write a message or attach a file" });

export const tutorSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => Input.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    // Files must live in the caller's own folder.
    for (const a of data.attachments) {
      if (!a.path.startsWith(`${userId}/`)) throw new Error("You can only attach your own files");
    }

    const text = data.message.trim() || "Please help me with the attached file(s).";

    let convId = data.conversationId;
    if (!convId) {
      const title = (data.message.trim() || data.attachments[0]?.name || "New conversation").slice(0, 60);
      const { data: conv, error } = await supabase.from("ai_conversations").insert({ user_id: userId, title }).select().single();
      if (error) throw new Error(error.message);
      convId = conv.id;
    }

    const { data: history } = await supabase.from("ai_messages")
      .select("role, content, attachments").eq("conversation_id", convId).order("created_at");

    // Re-send files from earlier turns (most recent first, capped) so follow-up questions still see them.
    const prior = (history ?? []) as { role: string; content: string; attachments: TutorAttachment[] | null }[];
    let budget = Math.max(0, 5 - data.attachments.length);
    const keepFiles = new Set<number>();
    for (let i = prior.length - 1; i >= 0 && budget > 0; i--) {
      const n = prior[i].attachments?.length ?? 0;
      if (prior[i].role === "user" && n > 0 && n <= budget) { keepFiles.add(i); budget -= n; }
    }

    const input: unknown[] = [];
    for (let i = 0; i < prior.length; i++) {
      const m = prior[i];
      if (m.role === "assistant") {
        input.push({ role: "assistant", content: [{ type: "output_text", text: m.content }] });
        continue;
      }
      const atts = m.attachments ?? [];
      const parts: unknown[] = [{ type: "input_text", text: m.content }];
      if (atts.length && keepFiles.has(i)) parts.push(...(await buildAttachmentParts(supabase, atts)));
      else if (atts.length) parts.push({ type: "input_text", text: `[Earlier attachments: ${atts.map((a) => a.name).join(", ")}]` });
      input.push({ role: "user", content: parts });
    }

    const newParts = await buildAttachmentParts(supabase, data.attachments);
    input.push({ role: "user", content: [{ type: "input_text", text }, ...newParts] });

    await supabase.from("ai_messages").insert({
      conversation_id: convId, role: "user", content: text, attachments: data.attachments,
    });

    const reply = await streamResponsesText({ apiKey: key, model: MODEL, instructions: SYSTEM, input });
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
      .select("id, role, content, attachments, created_at").eq("conversation_id", data.conversationId).order("created_at");
    return (msgs ?? []).map((m) => ({ ...m, attachments: (m.attachments ?? []) as TutorAttachment[] }));
  });
