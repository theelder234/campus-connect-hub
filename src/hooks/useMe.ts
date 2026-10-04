import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Me, Role } from "@/lib/permissions";

export function useMe(): Me & { loaded: boolean } {
  const [me, setMe] = useState<Me & { loaded: boolean }>({ userId: "", roles: [], loaded: false });
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return setMe({ userId: "", roles: [], loaded: true });
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      setMe({ userId: data.user.id, roles: (roles ?? []).map((r) => r.role as Role), loaded: true });
    });
  }, []);
  return me;
}
