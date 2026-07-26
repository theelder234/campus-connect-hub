import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/announcements")({ component: Page, head: () => ({ meta: [{ title: "Announcements — CampusLink" }] }) });

type Ann = { id: string; title: string; body: string; priority: string; author_id: string; created_at: string };

function Page() {
  const [items, setItems] = useState<Ann[]>([]);
  const [canPost, setCanPost] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("normal");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      setCanPost(!!roles?.some((r) => r.role === "faculty" || r.role === "admin"));
    })();
    load();
    const ch = supabase.channel("announcements")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "announcements" },
        (p) => setItems((x) => [p.new as Ann, ...x]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const load = async () => {
    const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
    setItems((data as Ann[]) ?? []);
  };

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("announcements").insert({ title, body, priority, author_id: userId });
    if (error) return toast.error(error.message);
    setTitle(""); setBody(""); toast.success("Announcement posted");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Campus Announcements</h1>
      {canPost && (
        <Card>
          <CardHeader><CardTitle className="text-base">Broadcast an update</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={post} className="space-y-3">
              <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <Textarea placeholder="Message" value={body} onChange={(e) => setBody(e.target.value)} required />
              <div className="flex gap-2">
                {["normal", "urgent"].map((p) => (
                  <Button key={p} type="button" variant={priority === p ? "default" : "outline"} size="sm" onClick={() => setPriority(p)}>{p}</Button>
                ))}
                <Button type="submit" className="ml-auto">Post</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      {!canPost && (
        <p className="text-sm text-muted-foreground">Only faculty and administrators can post announcements.</p>
      )}
      <div className="space-y-3">
        {items.map((a) => (
          <Card key={a.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-base">{a.title}</CardTitle>
              {a.priority === "urgent" && <Badge variant="destructive">Urgent</Badge>}
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{a.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
        {!items.length && <p className="text-sm text-muted-foreground">No announcements yet.</p>}
      </div>
    </div>
  );
}