import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Shield, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/members")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Members — Campus Directory | CampusLink" },
      { name: "description", content: "Browse students and faculty on your campus and find people by name or department." },
      { property: "og:title", content: "Members — Campus Directory | CampusLink" },
      { property: "og:description", content: "Browse students and faculty on your campus and find people by name or department." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Profile = { id: string; full_name: string | null; department: string | null; avatar_url: string | null };

function Page() {
  const [people, setPeople] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, department, avatar_url")
        .order("full_name");
      setPeople((data as Profile[]) ?? []);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      setIsAdmin(!!roles?.some((r) => r.role === "admin"));
    })();
  }, []);

  const filtered = people.filter((p) =>
    `${p.full_name ?? ""} ${p.department ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="mx-auto h-full max-w-5xl space-y-4 overflow-y-auto p-4 md:p-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold sm:text-2xl">Members</h1>
          <p className="text-sm text-muted-foreground">Everyone on your campus.</p>
        </div>
        {isAdmin && (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to="/admin"><Shield className="mr-2 h-4 w-4" />Manage roles</Link>
          </Button>
        )}
      </header>
      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or department" className="pl-8" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex items-center gap-3 p-4">
              <Avatar className="h-10 w-10 shrink-0">
                {p.avatar_url && <AvatarImage src={p.avatar_url} alt={p.full_name ?? "Member avatar"} />}
                <AvatarFallback>{(p.full_name ?? "U").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate font-medium">{p.full_name ?? "Unnamed member"}</div>
                <div className="truncate text-xs text-muted-foreground">{p.department ?? "No department"}</div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!filtered.length && <p className="col-span-full text-sm text-muted-foreground">No members found.</p>}
      </div>
    </div>
  );
}