DROP POLICY IF EXISTS "profiles visible to self, channel peers, admins" ON public.profiles;
CREATE POLICY "profiles visible to authenticated members"
ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "members see channels" ON public.channels;
CREATE POLICY "authenticated can browse channels"
ON public.channels FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "member reads members" ON public.channel_members;
CREATE POLICY "authenticated read channel members"
ON public.channel_members FOR SELECT TO authenticated USING (true);