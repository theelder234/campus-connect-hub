import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SYSTEM = `You are CampusLink Study Assistant. Turn academic source material (lecture PDFs, slides, transcripts) into revision material.
Return concise, accurate study notes. Never invent facts that are not supported by the source.
Respond ONLY with JSON matching this shape:
{"title": string, "summary": string, "key_points": string[], "flashcards": [{"question": string, "answer": string}]}
Rules: summary = 4-8 sentence overview. key_points = 5-10 short bullet strings. flashcards = 6-12 exam-style Q/A pairs with answers of 1-3 sentences.`;

const Input = z
  .object({
    resourceId: z.string().uuid().optional(),
    text: z.string().min(50).max(60000).optional(),
    title: z.string().max(200).optional(),
  })
  .refine((v) => !!v.resourceId || !!v.text, { message: "Provide a resource or transcript text" });

const MAX_FILE_BYTES = 15 * 1024 * 1024;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export const summarizeSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => Input.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    let title = data.title?.trim() || "Study notes";
    let resourceId: string | null = null;
    let sourceType: "file" | "text" = "text";
    const content: Record<string, unknown>[] = [];

    if (data.resourceId) {
      const { data: res, error } = await supabase
        .from("resources")
        .select("id, title, file_path, file_type")
        .eq("id", data.resourceId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!res) throw new Error("Resource not found");

      const { data: blob, error: dlError } = await supabase.storage.from("resources").download(res.file_path);
      if (dlError || !blob) throw new Error(dlError?.message ?? "Could not read the file");
      const buf = new Uint8Array(await blob.arrayBuffer());
      if (buf.byteLength > MAX_FILE_BYTES) throw new Error("File is too large to summarize (max 15MB)");

      const mime = res.file_type || blob.type || "application/pdf";
      const filename = res.file_path.split("/").pop() ?? "document";
      resourceId = res.id;
      sourceType = "file";
      if (!data.title?.trim()) title = res.title;

      if (mime.startsWith("text/")) {
        content.push({ type: "text", text: new TextDecoder().decode(buf).slice(0, 60000) });
      } else {
        content.push({
          type: "file",
          file: { filename, file_data: `data:${mime};base64,${toBase64(buf)}` },
        });
      }
      content.unshift({ type: "text", text: `Create study notes and flashcards from this document titled "${res.title}".` });
    } else {
      content.push({
        type: "text",
        text: `Create study notes and flashcards from this transcript:\n\n${data.text}`,
      });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Rate limit hit. Please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in your workspace.");
      throw new Error(`AI error [${res.status}]: ${body}`);
    }
    const j = await res.json();
    const raw: string = j.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    let parsed: { title?: string; summary?: string; key_points?: string[]; flashcards?: { question: string; answer: string }[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("The AI response could not be read. Please try again.");
    }

    const flashcards = (parsed.flashcards ?? [])
      .filter((c) => c && typeof c.question === "string" && typeof c.answer === "string")
      .slice(0, 20);

    const { data: saved, error: insErr } = await supabase
      .from("study_notes")
      .insert({
        user_id: userId,
        resource_id: resourceId,
        title: (parsed.title || title).slice(0, 200),
        source_type: sourceType,
        summary: parsed.summary ?? "",
        key_points: (parsed.key_points ?? []).filter((p) => typeof p === "string").slice(0, 20),
        flashcards,
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);

    return saved;
  });

export const listStudyNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("study_notes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteStudyNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("study_notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });