import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { tutorSend, tutorListConversations, tutorLoadMessages } from "@/lib/tutor.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Plus, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tutor")({ component: Page, head: () => ({ meta: [{ title: "AI Tutor — CampusLink" }] }) });

type Conv = { id: string; title: string; created_at: string };
type Msg = { id?: string; role: string; content: string };

function Page() {
  const send = useServerFn(tutorSend);
  const list = useServerFn(tutorListConversations);
  const load = useServerFn(tutorLoadMessages);

  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { list().then((r) => setConvs(r as Conv[])); }, [list]);
  useEffect(() => {
    if (!activeId) { setMsgs([]); return; }
    load({ data: { conversationId: activeId } }).then((r) => setMsgs(r as Msg[]));
  }, [activeId, load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;
    const message = text.trim();
    setText("");
    setMsgs((m) => [...m, { role: "user", content: message }]);
    setLoading(true);
    try {
      const res = await send({ data: { conversationId: activeId, message } });
      setMsgs((m) => [...m, { role: "assistant", content: res.reply }]);
      if (!activeId) {
        setActiveId(res.conversationId);
        list().then((r) => setConvs(r as Conv[]));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full">
      <div className="hidden w-64 shrink-0 flex-col border-r bg-muted/30 md:flex">
        <div className="flex items-center justify-between p-3">
          <div className="text-sm font-semibold">Conversations</div>
          <Button size="icon" variant="ghost" onClick={() => { setActiveId(undefined); setMsgs([]); }}><Plus className="h-4 w-4" /></Button>
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
      <div className="flex flex-1 flex-col">
        <ScrollArea className="flex-1 p-4">
          {!msgs.length && (
            <div className="mx-auto mt-24 max-w-md text-center">
              <Sparkles className="mx-auto h-8 w-8 text-primary" />
              <h2 className="mt-3 text-xl font-semibold">Ask your AI Tutor</h2>
              <p className="mt-1 text-sm text-muted-foreground">Get Socratic guidance on any subject. It nudges you toward the answer instead of just handing it over.</p>
            </div>
          )}
          <div className="mx-auto max-w-3xl space-y-4">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && <div className="text-sm text-muted-foreground">Thinking…</div>}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
        <form onSubmit={submit} className="border-t p-3">
          <div className="mx-auto flex max-w-3xl gap-2">
            <Textarea value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(e); } }}
              placeholder="Ask about a concept, formula, assignment…" rows={2} />
            <Button type="submit" disabled={!text.trim() || loading}><Send className="h-4 w-4" /></Button>
          </div>
        </form>
      </div>
    </div>
  );
}