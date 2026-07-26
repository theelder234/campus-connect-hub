
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) TO authenticated;

-- Storage policies for resources bucket
CREATE POLICY "authed read resources" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'resources');
CREATE POLICY "authed upload resources" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resources' AND owner = auth.uid());
CREATE POLICY "owner delete resources" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resources' AND owner = auth.uid());
