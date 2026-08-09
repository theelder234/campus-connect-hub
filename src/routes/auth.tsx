import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { sendSignupOtp, verifySignupOtp } from "@/lib/mail.functions";
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
  const [code, setCode] = useState("");

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
    await sendSignupOtp({ data: { email } });
    toast.success("We sent a 6-digit code to your email.");
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingEmail) return;
    setLoading(true);
    try {
      await verifySignupOtp({ data: { email: pendingEmail, code } });
      const { error } = await supabase.auth.signInWithPassword({ email: pendingEmail, password });
      if (error) {
        toast.success("Email verified — please sign in.");
        setPendingEmail(null);
        return;
      }
      toast.success("Account verified. Welcome to CampusLink!");
      navigate({ to: "/chat" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
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
                <form onSubmit={verify} className="space-y-3 pt-4 text-center">
                  <h3 className="text-base font-semibold">Enter your code</h3>
                  <p className="text-sm text-muted-foreground">
                    We sent a 6-digit verification code to{" "}
                    <span className="font-medium text-foreground">{pendingEmail}</span>.
                  </p>
                  <Input
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    className="text-center text-2xl tracking-[0.5em]"
                    required
                  />
                  <Button className="w-full" disabled={loading || code.length !== 6}>
                    {loading ? "…" : "Verify and continue"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                    onClick={async () => {
                      setLoading(true);
                      const { sent } = await sendSignupOtp({ data: { email: pendingEmail } });
                      setLoading(false);
                      if (!sent) return toast.error("Could not send the email. Try again shortly.");
                      toast.success("New code sent.");
                    }}
                  >
                    Resend code
                  </Button>
                </form>
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