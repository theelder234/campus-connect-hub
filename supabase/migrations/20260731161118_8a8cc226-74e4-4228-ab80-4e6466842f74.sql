CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION private.is_channel_member(_channel_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.channel_members WHERE channel_id=_channel_id AND user_id=_user_id);
$$;

CREATE OR REPLACE FUNCTION private.shares_channel(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.channel_members m1
    JOIN public.channel_members m2 ON m1.channel_id = m2.channel_id
    WHERE m1.user_id = _a AND m2.user_id = _b
  );
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_channel_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.shares_channel(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_channel_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.shares_channel(uuid, uuid) TO authenticated, service_role;

-- Recreate policies against the private helpers
DROP POLICY IF EXISTS "faculty/admin post" ON public.announcements;
CREATE POLICY "faculty/admin post" ON public.announcements FOR INSERT TO authenticated
WITH CHECK (auth.uid() = author_id AND (private.has_role(auth.uid(),'faculty') OR private.has_role(auth.uid(),'admin')));

DROP POLICY IF EXISTS "authed upload" ON public.resources;
CREATE POLICY "authed upload" ON public.resources FOR INSERT TO authenticated
WITH CHECK (auth.uid() = uploaded_by AND (is_official = false OR private.has_role(auth.uid(),'faculty') OR private.has_role(auth.uid(),'admin')));

DROP POLICY IF EXISTS "members see channels" ON public.channels;
CREATE POLICY "members see channels" ON public.channels FOR SELECT TO authenticated
USING (private.is_channel_member(id, auth.uid()));

DROP POLICY IF EXISTS "member reads members" ON public.channel_members;
CREATE POLICY "member reads members" ON public.channel_members FOR SELECT TO authenticated
USING (private.is_channel_member(channel_id, auth.uid()));

DROP POLICY IF EXISTS "members read" ON public.messages;
CREATE POLICY "members read" ON public.messages FOR SELECT TO authenticated
USING (private.is_channel_member(channel_id, auth.uid()));

DROP POLICY IF EXISTS "members write" ON public.messages;
CREATE POLICY "members write" ON public.messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND private.is_channel_member(channel_id, auth.uid()));

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_channel_member(uuid, uuid);

-- profiles: only self, people sharing a channel, or admins
DROP POLICY IF EXISTS "profiles readable to authed" ON public.profiles;
CREATE POLICY "profiles visible to self, channel peers, admins" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR private.shares_channel(auth.uid(), id) OR private.has_role(auth.uid(),'admin'));

-- user_roles: only own roles, or admins
DROP POLICY IF EXISTS "roles readable to authed" ON public.user_roles;
CREATE POLICY "own roles or admin" ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR private.has_role(auth.uid(),'admin'));

-- storage: scope reads to owner or files registered in the shared resources library; owner-only updates
DROP POLICY IF EXISTS "authed read resources" ON storage.objects;
CREATE POLICY "read own or shared resources" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'resources' AND (owner = auth.uid() OR EXISTS (
  SELECT 1 FROM public.resources r WHERE r.file_path = storage.objects.name
)));

DROP POLICY IF EXISTS "owner update resources" ON storage.objects;
CREATE POLICY "owner update resources" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'resources' AND owner = auth.uid())
WITH CHECK (bucket_id = 'resources' AND owner = auth.uid());