ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_size integer;

ALTER TABLE public.ai_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Chat attachments: path = {channel_id}/{user_id}/{file}
CREATE POLICY "chat members upload attachments" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND private.is_channel_member(((storage.foldername(name))[1])::uuid, auth.uid())
);
CREATE POLICY "chat members read attachments" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (
    private.is_channel_member(((storage.foldername(name))[1])::uuid, auth.uid())
    OR private.has_role(auth.uid(), 'admin')
  )
);
CREATE POLICY "chat uploader deletes attachments" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[2] = auth.uid()::text);

-- Tutor uploads: path = {user_id}/{file}, private to the owner
CREATE POLICY "tutor owner uploads" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tutor-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "tutor owner reads" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'tutor-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "tutor owner deletes" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tutor-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);