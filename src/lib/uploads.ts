import { supabase } from "@/integrations/supabase/client";

export type AttachmentKind = "image" | "pdf" | "document" | "other";

export const CHAT_MAX_BYTES = 20 * 1024 * 1024;
export const TUTOR_MAX_BYTES = 10 * 1024 * 1024;
export const TUTOR_MAX_FILES = 3;

export const CHAT_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.zip";
export const TUTOR_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,application/pdf,.docx,.txt,.md,.csv";

const CHAT_EXT = ["png", "jpg", "jpeg", "webp", "gif", "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "md", "csv", "zip"];
const TUTOR_EXT = ["png", "jpg", "jpeg", "webp", "gif", "pdf", "docx", "txt", "md", "csv"];

export function extOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function kindOf(type: string | null | undefined, name = ""): AttachmentKind {
  if (type?.startsWith("image/")) return "image";
  if (type === "application/pdf" || extOf(name) === "pdf") return "pdf";
  if (["doc", "docx", "txt", "md", "csv", "ppt", "pptx", "xls", "xlsx"].includes(extOf(name))) return "document";
  return "other";
}

/** Returns an error message, or null when the file is allowed. */
export function validateFile(file: File, scope: "chat" | "tutor"): string | null {
  const allowed = scope === "chat" ? CHAT_EXT : TUTOR_EXT;
  const max = scope === "chat" ? CHAT_MAX_BYTES : TUTOR_MAX_BYTES;
  if (!allowed.includes(extOf(file.name))) return `${file.name}: this file type isn't supported.`;
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > max) return `${file.name} is larger than ${Math.round(max / 1024 / 1024)} MB.`;
  return null;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120);
}

/** Uploads to private storage with real progress reporting (XHR). */
export async function uploadWithProgress(
  bucket: string,
  path: string,
  file: File,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("You are signed out. Please sign in again.");
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const url = `${base}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", key);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = `Upload failed (${xhr.status})`;
      try {
        const j = JSON.parse(xhr.responseText);
        msg = j.message || j.error || msg;
      } catch { /* keep default */ }
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Network error while uploading"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
  });
}
