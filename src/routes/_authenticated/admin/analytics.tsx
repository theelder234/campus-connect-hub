import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminStats } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/admin/analytics")({ component: Page });

type Stats = Awaited<ReturnType<typeof adminStats>>;

function Page() {
  const fetchStats = useServerFn(adminStats);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetchStats({})
      .then(setStats)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load analytics"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!stats) {
    return (
      <div className="grid h-full place-items-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const roleData = Object.entries(stats.roleCounts).map(([role, count]) => ({ role, count }));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Messages sent (last 14 days)</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Area type="monotone" dataKey="messages" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">New members (last 14 days)</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Bar dataKey="signups" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Roles</CardTitle></CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={roleData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" allowDecimals={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="role" width={80} fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}