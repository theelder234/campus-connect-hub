import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — CampusLink" }, { name: "description", content: "Sign in or create your CampusLink account." }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/chat" });
    });
  }, [navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/chat" });
  };
  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data.session) {
      toast.success("Account created.");
      navigate({ to: "/chat" });
      return;
    }
    setPendingEmail(email);
    toast.success("Confirmation email sent — check your inbox to activate your account.");
  };
  const google = async () => {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) toast.error("Google sign-in failed");
  };

  return (
    <div className="grid min-h-screen place-items-center bg-muted px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to CampusLink</CardTitle>
          <CardDescription>Your campus chat, resources, and AI tutor.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
          <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" />
          </div>
          <Tabs defaultValue="in">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="in">Sign in</TabsTrigger>
              <TabsTrigger value="up">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value="in">
              <form onSubmit={signIn} className="space-y-3 pt-4">
                <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
                <Button className="w-full" disabled={loading}>{loading ? "…" : "Sign in"}</Button>
              </form>
            </TabsContent>
            <TabsContent value="up">
              {pendingEmail ? (
                <div className="space-y-3 pt-4 text-center">
                  <h3 className="text-base font-semibold">Check your email</h3>
                  <p className="text-sm text-muted-foreground">
                    We sent a confirmation link to <span className="font-medium text-foreground">{pendingEmail}</span>.
                    Click it to activate your CampusLink account, then sign in.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                    onClick={async () => {
                      setLoading(true);
                      const { error } = await supabase.auth.resend({
                        type: "signup",
                        email: pendingEmail,
                        options: { emailRedirectTo: window.location.origin },
                      });
                      setLoading(false);
                      if (error) return toast.error(error.message);
                      toast.success("Confirmation email resent.");
                    }}
                  >
                    Resend confirmation email
                  </Button>
                </div>
              ) : (
              <form onSubmit={signUp} className="space-y-3 pt-4">
                <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
                <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
                <Button className="w-full" disabled={loading}>{loading ? "…" : "Create account"}</Button>
              </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}