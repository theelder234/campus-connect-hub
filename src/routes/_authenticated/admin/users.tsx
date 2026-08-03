import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listUsers, setUserRole } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({ component: Page });

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
  const fetchUsers = useServerFn(listUsers);
  const mutateRole = useServerFn(setUserRole);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers({})
      .then((r) => setRows(r as Row[]))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load members"))
      .finally(() => setLoading(false));
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

  if (loading) {
    return (
      <div className="grid h-full place-items-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filtered = rows.filter((r) =>
    `${r.full_name ?? ""} ${r.email} ${r.department ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="p-4 md:p-6">
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