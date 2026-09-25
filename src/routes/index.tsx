import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquare, FolderOpen, Sparkles, Megaphone } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "CampusLink — Connect, Share, Learn" },
      { name: "description", content: "A smart campus platform for real-time chat, resource sharing, and AI-powered academic support." },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">C</div>
            CampusLink
          </div>
          <div className="flex gap-2">
            <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
            <Link to="/auth"><Button>Get started</Button></Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-20">
        <section className="text-center">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">Your campus, connected.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Real-time messaging, shared study resources, and an AI tutor that helps you learn — one platform for students, faculty, and administration.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/auth"><Button size="lg">Create your account</Button></Link>
            <Link to="/chat"><Button size="lg" variant="outline">Enter the app</Button></Link>
          </div>
        </section>

        <section className="mt-24 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: MessageSquare, title: "Real-time chat", body: "Direct messages, study groups, and course channels powered by realtime." },
            { icon: Megaphone, title: "Announcements", body: "Faculty and admins broadcast urgent updates to the whole campus." },
            { icon: FolderOpen, title: "Resource hub", body: "Upload lecture notes, past papers, and slides. Search by course and tag." },
            { icon: Sparkles, title: "AI tutor", body: "A Socratic assistant that explains concepts without giving away answers." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-6">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-24 rounded-2xl border bg-card p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Community hub</p>
              <h2 className="mt-1 text-2xl font-black">Connect, share and collaborate</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Join the campus group chat, distribute study materials, and keep everyone aligned in one place.
              </p>
            </div>
            <Link to="/group-chat"><Button size="lg">Open community chat</Button></Link>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">Name: Francis Chinedu Ezugu</p>
        <p className="mt-1">Matric No: CSC/19U/20U/3611 </p>
      
      </footer>
    </div>
  );
}
