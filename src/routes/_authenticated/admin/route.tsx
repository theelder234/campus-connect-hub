import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminStatus, claimFirstAdmin } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
  head: () => ({
    meta: [
      { title: "Admin — CampusLink Control Center" },
      { name: "description", content: "Dashboard, analytics and user management for CampusLink administrators." },
      { property: "og:title", content: "Admin — CampusLink Control Center" },
      { property: "og:description", content: "Dashboard, analytics and user management for CampusLink administrators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const tabs = [
  { to: "/admin", label: "Dashboard", exact: true },
  { to: "/admin/analytics", label: "Analytics", exact: false },
  { to: "/admin/users", label: "User management", exact: false },
];

function AdminLayout() {
  const getStatus = useServerFn(adminStatus);
  const claim = useServerFn(claimFirstAdmin);
  const path = useRouterState({ select: (s) => s.location.pathname });

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminExists, setAdminExists] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const s = await getStatus({});
      setIsAdmin(s.isAdmin);
      setAdminExists(s.adminExists);
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
            <p>You need the admin role to open this area.</p>
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

  return (
    <div className="flex h-full flex-col">
      <header className="border-b p-4 md:px-6">
        <h1 className="text-xl font-semibold">Admin</h1>
        <nav className="mt-3 flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const active = t.exact ? path === t.to || path === `${t.to}/` : path.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent",
                  active && "bg-accent font-medium text-foreground",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}