import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminStatus, claimFirstAdmin, listUsers, setUserRole } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Admin — Manage Roles | CampusLink" },
      { name: "description", content: "Grant faculty and admin permissions to CampusLink members." },
      { property: "og:title", content: "Admin — Manage Roles | CampusLink" },
      { property: "og:description", content: "Grant faculty and admin permissions to CampusLink members." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = {
  id: string;
  full_name: string | null;
  department: string | null;
  email: string;
  created_at: string;
  roles: string[];
};

const ROLES = ["student", "faculty", "admin"] as const;

function Page() {
  const getStatus = useServerFn(adminStatus);
  const claim = useServerFn(claimFirstAdmin);
  const fetchUsers = useServerFn(listUsers);
  const mutateRole = useServerFn(setUserRole);

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminExists, setAdminExists] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const s = await getStatus({});
      setIsAdmin(s.isAdmin);
      setAdminExists(s.adminExists);
      if (s.isAdmin) setRows((await fetchUsers({})) as Row[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async (userId: string, role: (typeof ROLES)[number], grant: boolean) => {
    setBusy(`${userId}:${role}`);
    try {
      await mutateRole({ data: { userId, role, grant } });
      setRows((prev) =>
        prev.map((r) =>
          r.id === userId
            ? { ...r, roles: grant ? [...new Set([...r.roles, role])] : r.roles.filter((x) => x !== role) }
            : r,
        ),
      );
      toast.success(grant ? `Granted ${role}` : `Removed ${role}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  const onClaim = async () => {
    try {
      await claim({});
      toast.success("You are now an admin");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="grid h-full place-items-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Admin access required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>You need the admin role to manage permissions.</p>
            {!adminExists && (
              <>
                <p>No admin exists yet on this campus. You can claim the first admin account.</p>
                <Button onClick={onClaim}>
                  <ShieldCheck className="mr-2 h-4 w-4" />Claim admin
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const filtered = rows.filter((r) =>
    `${r.full_name ?? ""} ${r.email} ${r.department ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">Admin panel</h1>
        <p className="text-sm text-muted-foreground">Manage member roles and permissions.</p>
      </header>
      <Input
        placeholder="Search by name, email or department"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4 max-w-sm"
      />
      <div className="space-y-2">
        {filtered.map((u) => (
          <Card key={u.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="truncate font-medium">{u.full_name || u.email || u.id}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {u.email}
                  {u.department ? ` · ${u.department}` : ""}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {u.roles.length === 0 && <Badge variant="outline">no role</Badge>}
                  {u.roles.map((r) => (
                    <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((role) => {
                  const has = u.roles.includes(role);
                  return (
                    <Button
                      key={role}
                      size="sm"
                      variant={has ? "secondary" : "outline"}
                      disabled={busy === `${u.id}:${role}`}
                      onClick={() => toggle(u.id, role, !has)}
                    >
                      {has ? `Remove ${role}` : `Grant ${role}`}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">No members found.</p>}
      </div>
    </div>
  );
}