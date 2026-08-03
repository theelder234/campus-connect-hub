import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminStats } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Hash, MessageSquare, Megaphone, FolderOpen, NotebookPen } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/")({ component: Page });

type Stats = Awaited<ReturnType<typeof adminStats>>;

function Page() {
  const fetchStats = useServerFn(adminStats);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetchStats({})
      .then(setStats)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load stats"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!stats) {
    return (
      <div className="grid h-full place-items-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cards = [
    { label: "Members", value: stats.totals.users, icon: Users },
    { label: "Channels", value: stats.totals.channels, icon: Hash },
    { label: "Messages", value: stats.totals.messages, icon: MessageSquare },
    { label: "Announcements", value: stats.totals.announcements, icon: Megaphone },
    { label: "Resources", value: stats.totals.resources, icon: FolderOpen },
    { label: "Study notes", value: stats.totals.notes, icon: NotebookPen },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent">
                <c.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-semibold">{c.value}</div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Role distribution</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(stats.roleCounts).map(([role, n]) => (
              <Badge key={role} variant={role === "admin" ? "default" : "secondary"}>
                {role}: {n}
              </Badge>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Newest channels</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {stats.recentChannels.map((c) => (
              <div key={c.id} className="flex justify-between gap-3">
                <span className="truncate">#{c.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
            {!stats.recentChannels.length && <p className="text-muted-foreground">No channels yet.</p>}
          </CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">
        Dig deeper in <Link to="/admin/analytics" className="underline">analytics</Link> or adjust roles in{" "}
        <Link to="/admin/users" className="underline">user management</Link>.
      </p>
    </div>
  );
}