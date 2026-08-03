-- Announcements: any authenticated member can post
DROP POLICY IF EXISTS "faculty/admin post" ON public.announcements;
CREATE POLICY "authed post" ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "author delete" ON public.announcements;
CREATE POLICY "author or admin delete" ON public.announcements
  FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR private.has_role(auth.uid(), 'admin'::app_role));

-- Channels: creator or admin can delete
CREATE POLICY "creator or admin delete channel" ON public.channels
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR private.has_role(auth.uid(), 'admin'::app_role));

-- Cascade cleanup when a channel is removed
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_channel_id_fkey;
ALTER TABLE public.messages ADD CONSTRAINT messages_channel_id_fkey
  FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;

ALTER TABLE public.channel_members DROP CONSTRAINT IF EXISTS channel_members_channel_id_fkey;
ALTER TABLE public.channel_members ADD CONSTRAINT channel_members_channel_id_fkey
  FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;