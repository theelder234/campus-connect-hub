import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { summarizeSource, listStudyNotes, deleteStudyNote } from "@/lib/summarize.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles, Trash2, Loader2, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/study-notes")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Study Notes & Flashcards | CampusLink" },
      { name: "description", content: "Turn lecture PDFs and transcripts into AI-generated study notes and flashcards." },
      { property: "og:title", content: "Study Notes & Flashcards | CampusLink" },
      { property: "og:description", content: "Turn lecture PDFs and transcripts into AI-generated study notes and flashcards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Card = { question: string; answer: string };
type Note = {
  id: string;
  title: string;
  summary: string;
  key_points: string[];
  flashcards: Card[];
  source_type: string;
  created_at: string;
};
type Res = { id: string; title: string };

function Page() {
  const generate = useServerFn(summarizeSource);
  const fetchNotes = useServerFn(listStudyNotes);
  const removeNote = useServerFn(deleteStudyNote);

  const [notes, setNotes] = useState<Note[]>([]);
  const [resources, setResources] = useState<Res[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"file" | "text">("file");
  const [resourceId, setResourceId] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    try {
      setNotes((await fetchNotes({})) as unknown as Note[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load notes");
    }
  };

  useEffect(() => {
    load();
    supabase
      .from("resources")
      .select("id, title")
      .order("created_at", { ascending: false })
      .then(({ data }) => setResources((data as Res[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async () => {
    if (mode === "file" && !resourceId) return toast.error("Pick an uploaded file");
    if (mode === "text" && text.trim().length < 50) return toast.error("Paste at least a few sentences");
    setBusy(true);
    try {
      const note = (await generate({
        data: {
          ...(mode === "file" ? { resourceId } : { text: text.trim() }),
          ...(title.trim() ? { title: title.trim() } : {}),
        },
      })) as unknown as Note;
      setNotes((p) => [note, ...p]);
      setExpanded(note.id);
      setOpen(false);
      setText("");
      setTitle("");
      setResourceId("");
      toast.success("Study notes ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Summarization failed");
    } finally {
      setBusy(false);
    }
  };

  const del = async (id: string) => {
    try {
      await removeNote({ data: { id } });
      setNotes((p) => p.filter((n) => n.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 overflow-y-auto p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Study notes</h1>
          <p className="text-sm text-muted-foreground">AI summaries and flashcards from PDFs or transcripts.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="ml-auto">
              <Sparkles className="mr-2 h-4 w-4" />Generate
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Generate study notes</DialogTitle></DialogHeader>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "file" | "text")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file">Uploaded file</TabsTrigger>
                <TabsTrigger value="text">Paste transcript</TabsTrigger>
              </TabsList>
              <TabsContent value="file" className="space-y-3 pt-3">
                <Label>Resource</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={resourceId}
                  onChange={(e) => setResourceId(e.target.value)}
                >
                  <option value="">Select a resource…</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>{r.title}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">PDFs, slides, images and text files up to 15MB.</p>
              </TabsContent>
              <TabsContent value="text" className="space-y-3 pt-3">
                <Label>Transcript or notes</Label>
                <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste lecture transcript here…" />
              </TabsContent>
            </Tabs>
            <div className="space-y-1">
              <Label>Title (optional)</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Week 5 — Graph algorithms" />
            </div>
            <DialogFooter>
              <Button onClick={run} disabled={busy}>
                {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Summarizing…</> : "Generate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {notes.map((n) => (
          <NoteCard key={n.id} note={n} open={expanded === n.id} onToggle={() => setExpanded(expanded === n.id ? null : n.id)} onDelete={() => del(n.id)} />
        ))}
        {!notes.length && <p className="text-sm text-muted-foreground">No study notes yet — generate your first set.</p>}
      </div>
    </div>
  );
}

function NoteCard({ note, open, onToggle, onDelete }: { note: Note; open: boolean; onToggle: () => void; onDelete: () => void }) {
  const [flipped, setFlipped] = useState<number | null>(null);
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          <button className="min-w-0 flex-1 text-left" onClick={onToggle}>
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{note.title}</span>
              <Badge variant="secondary">{note.source_type === "file" ? "File" : "Transcript"}</Badge>
              <Badge variant="outline">{note.flashcards?.length ?? 0} cards</Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{note.summary}</p>
          </button>
          <Button size="icon" variant="ghost" onClick={onToggle} aria-label="Toggle details">
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete notes">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {open && (
          <div className="mt-4 space-y-4 border-t pt-4">
            <div>
              <h2 className="mb-1 text-sm font-semibold">Summary</h2>
              <p className="text-sm text-muted-foreground">{note.summary}</p>
            </div>
            {!!note.key_points?.length && (
              <div>
                <h2 className="mb-1 text-sm font-semibold">Key points</h2>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {note.key_points.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}
            {!!note.flashcards?.length && (
              <div>
                <h2 className="mb-2 text-sm font-semibold">Flashcards</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {note.flashcards.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setFlipped(flipped === i ? null : i)}
                      className="rounded-lg border bg-muted/40 p-3 text-left text-sm transition hover:bg-muted"
                    >
                      <div className="font-medium">{c.question}</div>
                      <div className="mt-1 text-muted-foreground">
                        {flipped === i ? c.answer : "Tap to reveal answer"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}