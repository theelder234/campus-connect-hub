import { unzipSync, strFromU8 } from "fflate";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TutorAttachment = { path: string; name: string; type: string; size: number };

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_TEXT = 60_000;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function docxToText(bytes: Uint8Array): string {
  const files = unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" });
  const xml = files["word/document.xml"];
  if (!xml) throw new Error("This Word file could not be read");
  return strFromU8(xml)
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Downloads each file with the caller's own permissions and converts it to Responses input parts. */
export async function buildAttachmentParts(supabase: SupabaseClient, atts: TutorAttachment[]) {
  const parts: Record<string, unknown>[] = [];
  for (const a of atts) {
    const { data: blob, error } = await supabase.storage.from("tutor-uploads").download(a.path);
    if (error || !blob) throw new Error(`Could not open ${a.name}`);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (!bytes.byteLength) throw new Error(`${a.name} is empty`);
    if (bytes.byteLength > MAX_BYTES) throw new Error(`${a.name} is too large (max 10 MB)`);
    const ext = a.name.split(".").pop()?.toLowerCase() ?? "";
    const mime = a.type || blob.type;

    if (mime.startsWith("image/")) {
      parts.push({ type: "input_text", text: `Attached image: ${a.name}` });
      parts.push({ type: "input_image", image_url: `data:${mime};base64,${toBase64(bytes)}` });
    } else if (mime === "application/pdf" || ext === "pdf") {
      parts.push({ type: "input_file", filename: a.name, file_data: `data:application/pdf;base64,${toBase64(bytes)}` });
    } else if (ext === "docx") {
      const text = docxToText(bytes);
      if (!text) throw new Error(`${a.name} has no readable text`);
      parts.push({ type: "input_text", text: `Contents of attached Word document "${a.name}":\n\n${text.slice(0, MAX_TEXT)}` });
    } else if (["txt", "md", "csv"].includes(ext) || mime.startsWith("text/")) {
      const text = new TextDecoder().decode(bytes).trim();
      parts.push({ type: "input_text", text: `Contents of attached file "${a.name}":\n\n${text.slice(0, MAX_TEXT)}` });
    } else {
      throw new Error(`${a.name}: this file type isn't supported by the tutor`);
    }
  }
  return parts;
}
