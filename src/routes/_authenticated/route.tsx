import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { MessageSquare, Megaphone, FolderOpen, Sparkles, LogOut, Shield, NotebookPen, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sendWelcomeEmail } from "@/lib/mail.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Shell,
});

const nav = [
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/members", label: "Members", icon: Users },
  { to: "/announcements", label: "Announcements", icon: Megaphone },
  { to: "/resources", label: "Resources", icon: FolderOpen },
  { to: "/study-notes", label: "Study Notes", icon: NotebookPen },
  { to: "/tutor", label: "AI Tutor", icon: Sparkles },
];

const navItems = (isAdmin: boolean) =>
  isAdmin ? [...nav, { to: "/admin", label: "Admin", icon: Shield }] : nav;

function Shell() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setEmail(data.user?.email ?? "");
      if (!data.user) return;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      setIsAdmin(!!roles?.some((r) => r.role === "admin"));
      // Fires once per account; the server no-ops if it was already sent.
      sendWelcomeEmail({ data: { appUrl: window.location.origin } }).catch(() => {});
    });
  }, []);
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 font-semibold">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">C</div>
          CampusLink
        </div>
        <nav className="flex flex-col gap-1">
          {navItems(isAdmin).map((n) => (
            <Link key={n.to} to={n.to} className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent",
              path.startsWith(n.to) && "bg-accent font-medium"
            )}>
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-2">
          <div className="truncate text-xs text-muted-foreground">{email}</div>
          <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />Sign out
          </Button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-1 overflow-x-auto border-b p-2 md:hidden">
          {navItems(isAdmin).map((n) => (
            <Link key={n.to} to={n.to} className={cn(
              "min-w-[64px] flex-1 shrink-0 rounded-md p-2 text-center text-[11px]",
              path.startsWith(n.to) ? "bg-accent font-medium" : "text-muted-foreground"
            )}>
              <n.icon className="mx-auto h-4 w-4" />
              {n.label}
            </Link>
          ))}
        </div>
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}