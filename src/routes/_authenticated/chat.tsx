import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Send, Hash, Menu } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat")({ component: ChatPage, head: () => ({ meta: [{ title: "Chat — CampusLink" }] }) });

type Channel = { id: string; name: string; description: string | null; type: string };
type Msg = { id: string; content: string; user_id: string; created_at: string };

function ChatPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [memberOf, setMemberOf] = useState<string[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState<string>("");
  const [openNew, setOpenNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ""));
    loadChannels();
  }, []);

  const loadChannels = async () => {
    const { data } = await supabase.from("channels").select("*").order("created_at", { ascending: true });
    setChannels((data as Channel[]) ?? []);
    if (!activeId && data && data.length) setActiveId(data[0].id);
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      const { data: mem } = await supabase.from("channel_members").select("channel_id").eq("user_id", u.user.id);
      setMemberOf((mem ?? []).map((m) => m.channel_id));
    }
  };

  useEffect(() => {
    if (!activeId) return;
    supabase.from("messages").select("*").eq("channel_id", activeId).order("created_at").then(({ data }) => {
      setMessages((data as Msg[]) ?? []);
    });
    const channel = supabase.channel(`messages:${activeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${activeId}` },
        (payload) => setMessages((m) => [...m, payload.new as Msg]))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeId]);

  useEffect(() => {
    const ids = [...new Set(messages.map((m) => m.user_id))].filter((id) => !profiles[id]);
    if (!ids.length) return;
    supabase.from("profiles").select("id, full_name").in("id", ids).then(({ data }) => {
      if (!data) return;
      setProfiles((p) => ({ ...p, ...Object.fromEntries(data.map((r) => [r.id, r.full_name ?? "User"])) }));
    });
  }, [messages, profiles]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeId) return;
    const content = text.trim();
    setText("");
    const { error } = await supabase.from("messages").insert({ channel_id: activeId, user_id: userId, content });
    if (error) toast.error(error.message);
  };

  const create = async () => {
    if (!newName.trim()) return;
    if (!userId) return toast.error("Not signed in");
    // Generate the id client-side: the channels SELECT policy requires membership,
    // so `.select()` right after insert would return no rows.
    const id = crypto.randomUUID();
    const { error } = await supabase.from("channels").insert({
      id, name: newName.trim(), description: newDesc.trim() || null, type: "group", created_by: userId,
    });
    if (error) return toast.error(error.message);
    const { error: memberError } = await supabase.from("channel_members").insert({ channel_id: id, user_id: userId });
    if (memberError) return toast.error(memberError.message);
    setOpenNew(false); setNewName(""); setNewDesc("");
    await loadChannels();
    setActiveId(id);
    toast.success("Channel created");
  };

  const join = async (id: string) => {
    setActiveId(id);
    setMobileOpen(false);
    if (!userId || memberOf.includes(id)) return;
    const { error } = await supabase.from("channel_members").insert({ channel_id: id, user_id: userId });
    if (error) return toast.error(error.message);
    setMemberOf((m) => [...m, id]);
  };

  const newChannelButton = (
    <Button size="icon" variant="ghost" aria-label="New channel" onClick={() => { setMobileOpen(false); setOpenNew(true); }}>
      <Plus className="h-4 w-4" />
    </Button>
  );

  const newChannelDialog = (
    <Dialog open={openNew} onOpenChange={setOpenNew}>
      <DialogContent>
        <DialogHeader><DialogTitle>New channel</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="cs101-study-group" /></div>
          <div><Label>Description</Label><Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const channelList = (
    <div className="space-y-0.5 p-2">
      {channels.map((c) => (
        <button key={c.id} onClick={() => join(c.id)}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${activeId === c.id ? "bg-accent font-medium" : ""}`}>
          <Hash className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{c.name}</span>
          {!memberOf.includes(c.id) && <span className="shrink-0 text-[10px] text-muted-foreground">join</span>}
        </button>
      ))}
      {!channels.length && <div className="p-3 text-xs text-muted-foreground">No channels yet — create one.</div>}
    </div>
  );

  return (
    <div className="flex h-full">
      {newChannelDialog}
      <div className="hidden w-64 shrink-0 flex-col border-r bg-muted/30 md:flex">
        <div className="flex items-center justify-between p-3">
          <div className="text-sm font-semibold">Channels</div>
          {newChannelButton}
        </div>
        <ScrollArea className="flex-1">{channelList}</ScrollArea>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-2 border-b p-2 md:p-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="md:hidden" aria-label="Browse channels">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="flex-row items-center justify-between space-y-0 p-3">
                <SheetTitle className="text-sm">Channels</SheetTitle>
                {newChannelButton}
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-4rem)]">{channelList}</ScrollArea>
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1 truncate text-sm font-medium">
            {channels.find((c) => c.id === activeId)?.name ?? "Select a channel"}
          </div>
          <div className="md:hidden">{newChannelButton}</div>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.user_id === userId ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.user_id === userId ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <div className="mb-0.5 text-xs opacity-70">{profiles[m.user_id] ?? "…"}</div>
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
        <form onSubmit={send} className="flex gap-2 border-t p-3">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={activeId ? "Message" : "Join or create a channel"} disabled={!activeId} />
          <Button type="submit" disabled={!activeId || !text.trim()}><Send className="h-4 w-4" /></Button>
        </form>
      </div>
    </div>
  );
}