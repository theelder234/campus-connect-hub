CREATE TABLE public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text,
  attachment_name text,
  attachment_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT group_messages_content_check CHECK (body IS NOT NULL OR attachment_path IS NOT NULL)
);

GRANT SELECT, INSERT ON public.group_messages TO authenticated;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users read group messages" ON public.group_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own group messages" ON public.group_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
ALTER TABLE public.group_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;

INSERT INTO storage.buckets (id, name, public) VALUES ('group-chat-files', 'group-chat-files', false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "authenticated users upload group files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'group-chat-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "authenticated users read group files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'group-chat-files');
