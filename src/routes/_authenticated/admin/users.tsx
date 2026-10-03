import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listUsers, setUserRole, createUser, updateUser, deleteUser } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

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
type Role = (typeof ROLES)[number];
const msg = (e: unknown, f: string) => (e instanceof Error ? e.message : f);

function Page() {
  const fetchUsers = useServerFn(listUsers);
  const mutateRole = useServerFn(setUserRole);
  const doCreate = useServerFn(createUser);
  const doUpdate = useServerFn(updateUser);
  const doDelete = useServerFn(deleteUser);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [removing, setRemoving] = useState<Row | null>(null);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", department: "", role: "student" as Role });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    return fetchUsers({})
      .then((r) => setRows(r as Row[]))
      .catch((e) => toast.error(msg(e, "Failed to load members")))
      .finally(() => setLoading(false));
  }, [fetchUsers]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setForm({ email: "", password: "", full_name: "", department: "", role: "student" });
    setEditing("new");
  };
  const openEdit = (u: Row) => {
    setForm({ email: u.email, password: "", full_name: u.full_name ?? "", department: u.department ?? "", role: "student" });
    setEditing(u);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing === "new") {
        await doCreate({ data: { ...form, department: form.department || undefined } });
        toast.success("Member created");
      } else if (editing) {
        await doUpdate({
          data: {
            userId: editing.id,
            full_name: form.full_name,
            department: form.department || undefined,
            email: form.email && form.email !== editing.email ? form.email : undefined,
          },
        });
        toast.success("Member updated");
      }
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(msg(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!removing) return;
    try {
      await doDelete({ data: { userId: removing.id } });
      setRows((prev) => prev.filter((r) => r.id !== removing.id));
      toast.success("Member deleted");
    } catch (e) {
      toast.error(msg(e, "Delete failed"));
    } finally {
      setRemoving(null);
    }
  };

  const toggle = async (userId: string, role: Role, grant: boolean) => {
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
      toast.error(msg(e, "Update failed"));
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
  const isNew = editing === "new";

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search by name, email or department"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <Button size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" />Add member</Button>
      </div>
      <div className="space-y-2">
        {filtered.map((u) => (
          <Card key={u.id}>
            <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="truncate font-medium">{u.full_name || u.email || u.id}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {u.email}
                  {u.department ? ` · ${u.department}` : ""}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {u.roles.length === 0 && <Badge variant="outline">no role</Badge>}
                  {u.roles.map((r) => (
                    <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>{r}</Badge>
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
                <Button size="sm" variant="ghost" aria-label="Edit member" onClick={() => openEdit(u)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Delete member" onClick={() => setRemoving(u)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">No members found.</p>}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isNew ? "Add member" : "Edit member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="fn">Full name</Label>
              <Input id="fn" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="em">Email</Label>
              <Input id="em" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dp">Department</Label>
              <Input id="dp" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            {isNew && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="pw">Temporary password (min 8)</Label>
                  <Input id="pw" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Role</Label>
                  <div className="flex gap-2">
                    {ROLES.map((r) => (
                      <Button key={r} type="button" size="sm" variant={form.role === r ? "default" : "outline"} onClick={() => setForm({ ...form, role: r })}>
                        {r}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.full_name || !form.email || (isNew && form.password.length < 8)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {removing?.full_name || removing?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the account along with their messages, uploads and roles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
