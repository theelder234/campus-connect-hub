import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Download, FileText, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/resources")({ component: Page, head: () => ({ meta: [{ title: "Resources — CampusLink" }] }) });

type Res = { id: string; title: string; description: string | null; file_path: string; file_type: string | null; course_code: string | null; tags: string[]; is_official: boolean; uploaded_by: string; created_at: string };

function Page() {
  const [items, setItems] = useState<Res[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [course, setCourse] = useState("");
  const [tags, setTags] = useState("");
  const [userId, setUserId] = useState("");
  const [canOfficial, setCanOfficial] = useState(false);
  const [official, setOfficial] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      setCanOfficial(!!roles?.some((r) => r.role === "faculty" || r.role === "admin"));
    })();
    load();
  }, []);

  const load = async () => {
    const { data } = await supabase.from("resources").select("*").order("created_at", { ascending: false });
    setItems((data as Res[]) ?? []);
  };

  const upload = async () => {
    if (!file || !title.trim()) return toast.error("Title and file required");
    const path = `${userId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("resources").upload(path, file);
    if (upErr) return toast.error(upErr.message);
    const { error } = await supabase.from("resources").insert({
      title, description: desc || null, file_path: path, file_type: file.type,
      course_code: course || null, tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      is_official: official && canOfficial, uploaded_by: userId,
    });
    if (error) return toast.error(error.message);
    toast.success("Resource uploaded");
    setOpen(false); setFile(null); setTitle(""); setDesc(""); setCourse(""); setTags(""); setOfficial(false);
    load();
  };

  const download = async (r: Res) => {
    const { data, error } = await supabase.storage.from("resources").createSignedUrl(r.file_path, 60);
    if (error || !data) return toast.error("Download failed");
    window.open(data.signedUrl, "_blank");
  };

  const filtered = items.filter((r) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return r.title.toLowerCase().includes(s) || (r.course_code ?? "").toLowerCase().includes(s) || r.tags.some((t) => t.toLowerCase().includes(s));
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Resources</h1>
        <div className="relative ml-auto flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, course, tag" className="pl-8" />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Upload className="mr-2 h-4 w-4" />Upload</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload resource</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>File</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
              <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div><Label>Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Course code</Label><Input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="CS101" /></div>
                <div><Label>Tags (comma)</Label><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="notes, midterm" /></div>
              </div>
              {canOfficial && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={official} onChange={(e) => setOfficial(e.target.checked)} />
                  Mark as official (faculty)
                </label>
              )}
            </div>
            <DialogFooter><Button onClick={upload}>Upload</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <FileText className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-medium">{r.title}</div>
                    {r.is_official && <Badge>Official</Badge>}
                  </div>
                  {r.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.course_code && <Badge variant="outline">{r.course_code}</Badge>}
                    {r.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                  </div>
                  <Button size="sm" variant="ghost" className="mt-2" onClick={() => download(r)}>
                    <Download className="mr-1 h-3 w-3" />Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!filtered.length && <p className="col-span-full text-sm text-muted-foreground">No resources found.</p>}
      </div>
    </div>
  );
}