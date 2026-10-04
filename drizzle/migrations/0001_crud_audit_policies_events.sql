
-- messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
GRANT UPDATE ON public.messages TO authenticated;
CREATE POLICY "own update" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin delete messages" ON public.messages FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'));

-- group messages
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
GRANT UPDATE, DELETE ON public.group_messages TO authenticated;
CREATE POLICY "own update group messages" ON public.group_messages FOR UPDATE TO authenticated USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());
CREATE POLICY "own or admin delete group messages" ON public.group_messages FOR DELETE TO authenticated USING (sender_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));

-- channels
GRANT UPDATE ON public.channels TO authenticated;
CREATE POLICY "creator or admin update channel" ON public.channels FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = created_by OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin removes members" ON public.channel_members FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'));

-- announcements: faculty/admin post; author/admin edit
DROP POLICY IF EXISTS "authed post" ON public.announcements;
CREATE POLICY "faculty or admin post" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND (private.has_role(auth.uid(), 'faculty') OR private.has_role(auth.uid(), 'admin')));
GRANT UPDATE ON public.announcements TO authenticated;
CREATE POLICY "author or admin update" ON public.announcements FOR UPDATE TO authenticated
  USING (auth.uid() = author_id OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = author_id OR private.has_role(auth.uid(), 'admin'));

-- resources
GRANT UPDATE ON public.resources TO authenticated;
CREATE POLICY "own or admin update" ON public.resources FOR UPDATE TO authenticated
  USING (auth.uid() = uploaded_by OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = uploaded_by OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete resources" ON public.resources FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete resource files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resources' AND private.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete chat files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('chat-attachments','group-chat-files') AND private.has_role(auth.uid(), 'admin'));
CREATE POLICY "group uploader deletes" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'group-chat-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- events / schedules
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or public events" ON public.events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_public OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "create own events" ON public.events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (NOT is_public OR private.has_role(auth.uid(), 'faculty') OR private.has_role(auth.uid(), 'admin')));
CREATE POLICY "update own events" ON public.events FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK ((user_id = auth.uid() AND (NOT is_public OR private.has_role(auth.uid(), 'faculty') OR private.has_role(auth.uid(), 'admin'))) OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete own events" ON public.events FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));
