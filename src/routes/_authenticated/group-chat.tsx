import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FileText, Paperclip, Send, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/group-chat")({
  component: GroupChatPage,
  head: () => ({ meta: [{ title: "Group chat — CampusLink" }] }),
});

type Message = {
  id: string;
  body: string | null;
  sender_id: string;
  created_at: string;
  attachment_name: string | null;
  attachment_path: string | null;
};

function GroupChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null);
    });

    void supabase
      .from("group_messages")
      .select("id, body, sender_id, created_at, attachment_name, attachment_path")
      .order("created_at", { ascending: true })
      .limit(100)
      .then(({ data, error }) => {
        if (!active || error) return;
        setMessages((data ?? []) as Message[]);
      });

    const channel = supabase
      .channel("group-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages" },
        (payload) => {
          setMessages((current) => [...current, payload.new as Message]);
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!userId || (!body.trim() && !file)) return;
    setStatus(null);

    let attachmentPath: string | null = null;
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setStatus("Files must be 10 MB or smaller.");
        return;
      }

      attachmentPath = `${userId}/${crypto.randomUUID()}-${file.name}`;
      const upload = await supabase.storage.from("group-chat-files").upload(attachmentPath, file);
      if (upload.error) {
        setStatus(upload.error.message);
        return;
      }
    }

    const { error } = await supabase.from("group_messages").insert({
      body: body.trim() || null,
      sender_id: userId,
      attachment_name: file?.name ?? null,
      attachment_path: attachmentPath,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setBody("");
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function downloadFile(path: string) {
    const { data, error } = await supabase.storage.from("group-chat-files").createSignedUrl(path, 60);
    if (error) {
      setStatus(error.message);
      return;
    }

    window.open(data?.signedUrl ?? "", "_blank", "noopener,noreferrer");
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-8">
        <header className="flex items-center justify-between">
          <div>
            <Link to="/" className="text-sm font-semibold text-primary">
              ← CampusLink
            </Link>
            <h1 className="mt-3 flex items-center gap-2 text-2xl font-black">
              <Users className="h-6 w-6 text-primary" />
              Campus group chat
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Share updates, notes, and files with your community.
            </p>
          </div>
        </header>

        <Card className="mt-6 flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No messages yet. Start the conversation.
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.sender_id === userId
                      ? "ml-8 rounded-2xl rounded-br-md bg-primary/10 p-3"
                      : "mr-8 rounded-2xl rounded-bl-md bg-muted p-3"
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold">
                      {message.sender_id === userId ? "You" : "Community member"}
                    </span>
                    <time className="text-[10px] text-muted-foreground">
                      {new Date(message.created_at).toLocaleString()}
                    </time>
                  </div>

                  {message.body ? <p className="mt-1 whitespace-pre-wrap text-sm">{message.body}</p> : null}

                  {message.attachment_path && message.attachment_name ? (
                    <button
                      type="button"
                      onClick={() => void downloadFile(message.attachment_path!)}
                      className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-semibold hover:bg-accent"
                    >
                      <FileText className="h-4 w-4 text-primary" />
                      {message.attachment_name}
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <form className="border-t border-border p-4" onSubmit={sendMessage}>
            <div className="flex items-center gap-2">
              <Input
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Write a message…"
                className="flex-1"
              />
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.zip,.txt"
              />
              <Button type="button" variant="outline" size="icon" aria-label="Attach a file" onClick={() => inputRef.current?.click()}>
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button type="submit" size="icon" aria-label="Send message" disabled={!userId || (!body.trim() && !file)}>
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {file ? <p className="mt-2 text-xs text-primary">Attached: {file.name}</p> : null}
            {status ? (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {status}
              </p>
            ) : null}
          </form>
        </Card>
      </div>
    </main>
  );
}
