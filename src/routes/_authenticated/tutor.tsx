import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { tutorSend, tutorListConversations, tutorLoadMessages } from "@/lib/tutor.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Plus, Send, Paperclip, FileText } from "lucide-react";
import { toast } from "sonner";
import { PendingAttachments, type PendingFile } from "@/components/AttachmentPicker";
import { TUTOR_ACCEPT, TUTOR_MAX_FILES, safeName, uploadWithProgress, validateFile } from "@/lib/uploads";

export const Route = createFileRoute("/_authenticated/tutor")({
  component: Page,
  head: () => ({
    meta: [
      { title: "AI Tutor — CampusLink" },
      { name: "description", content: "Ask the CampusLink AI tutor about concepts, past papers, lecture notes and photos of problems." },
      { property: "og:title", content: "AI Tutor — CampusLink" },
      { property: "og:description", content: "Socratic AI tutoring that reads your attached notes, PDFs and photos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Conv = { id: string; title: string; created_at: string };
type Att = { path: string; name: string; type: string; size: number };
type Msg = { id?: string; role: string; content: string; attachments?: Att[] };

function Page() {
  const send = useServerFn(tutorSend);
  const list = useServerFn(tutorListConversations);
  const load = useServerFn(tutorLoadMessages);

  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { list().then((r) => setConvs(r as Conv[])); }, [list]);
  useEffect(() => {
    if (!activeId) { setMsgs([]); return; }
    load({ data: { conversationId: activeId } }).then((r) => setMsgs(r as Msg[]));
  }, [activeId, load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= TUTOR_MAX_FILES) { toast.error(`You can attach up to ${TUTOR_MAX_FILES} files per message.`); break; }
      const err = validateFile(f, "tutor");
      if (err) { toast.error(err); continue; }
      next.push({ id: crypto.randomUUID(), file: f, progress: 0 });
    }
    setFiles(next);
    if (fileRef.current) fileRef.current.value = "";
  };

  const openAttachment = async (path: string) => {
    const { data, error } = await supabase.storage.from("tutor-uploads").createSignedUrl(path, 60);
    if (error || !data) return toast.error(error?.message ?? "Could not open file");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && !files.length) || loading) return;
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Please sign in again.");
      const uploaded: Att[] = [];
      for (const pf of files) {
        const path = `${u.user.id}/${crypto.randomUUID()}-${safeName(pf.file.name)}`;
        await uploadWithProgress("tutor-uploads", path, pf.file, (p) =>
          setFiles((cur) => cur.map((x) => (x.id === pf.id ? { ...x, progress: p } : x))));
        uploaded.push({ path, name: pf.file.name, type: pf.file.type, size: pf.file.size });
      }
      const message = text.trim();
      setMsgs((m) => [...m, { role: "user", content: message || "Please help me with the attached file(s).", attachments: uploaded }]);
      setText("");
      setFiles([]);
      const res = await send({ data: { conversationId: activeId, message, attachments: uploaded } });
      setMsgs((m) => [...m, { role: "assistant", content: res.reply }]);
      if (!activeId) {
        setActiveId(res.conversationId);
        list().then((r) => setConvs(r as Conv[]));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setFiles((cur) => cur.map((x) => ({ ...x, progress: 0 })));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full">
      <div className="hidden w-64 shrink-0 flex-col border-r bg-muted/30 md:flex">
        <div className="flex items-center justify-between p-3">
          <div className="text-sm font-semibold">Conversations</div>
          <Button size="icon" variant="ghost" aria-label="New conversation" onClick={() => { setActiveId(undefined); setMsgs([]); }}><Plus className="h-4 w-4" /></Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-0.5 p-2">
            {convs.map((c) => (
              <button key={c.id} onClick={() => setActiveId(c.id)}
                className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${activeId === c.id ? "bg-accent font-medium" : ""}`}>
                {c.title}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <ScrollArea className="flex-1 p-4">
          {!msgs.length && (
            <div className="mx-auto mt-24 max-w-md text-center">
              <Sparkles className="mx-auto h-8 w-8 text-primary" />
              <h2 className="mt-3 text-xl font-semibold">Ask your AI Tutor</h2>
              <p className="mt-1 text-sm text-muted-foreground">Get Socratic guidance on any subject. Attach a past question paper, lecture notes or a photo of a problem and ask about it.</p>
            </div>
          )}
          <div className="mx-auto max-w-3xl space-y-4">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {m.attachments?.length ? (
                    <div className="mb-1 flex flex-wrap gap-1">
                      {m.attachments.map((a) => (
                        <button key={a.path} type="button" onClick={() => openAttachment(a.path)}
                          className="flex items-center gap-1 rounded border border-current/30 px-2 py-0.5 text-xs opacity-90 hover:opacity-100">
                          <FileText className="h-3 w-3" />{a.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {m.content}
                </div>
              </div>
            ))}
            {loading && <div className="text-sm text-muted-foreground">{files.some((f) => f.progress < 100 && f.progress > 0) ? "Uploading…" : "Thinking…"}</div>}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
        <form onSubmit={submit} className="border-t p-3">
          <div className="mx-auto max-w-3xl">
            <PendingAttachments items={files} disabled={loading} onRemove={(id) => setFiles((f) => f.filter((x) => x.id !== id))} />
            <div className="flex gap-2">
              <input ref={fileRef} type="file" multiple accept={TUTOR_ACCEPT} className="hidden" data-testid="tutor-file-input"
                onChange={(e) => addFiles(e.target.files)} />
              <Button type="button" variant="outline" size="icon" aria-label="Attach files" disabled={loading} onClick={() => fileRef.current?.click()}>
                <Paperclip className="h-4 w-4" />
              </Button>
              <Textarea value={text} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(e); } }}
                placeholder="Ask about a concept, formula, assignment… or attach a file" rows={2} />
              <Button type="submit" aria-label="Send" disabled={(!text.trim() && !files.length) || loading}><Send className="h-4 w-4" /></Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Images, PDF, Word (.docx) and text files · up to 3 files, 10 MB each</p>
          </div>
        </form>
      </div>
    </div>
  );
}
