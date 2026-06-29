import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Public staff/provider deep-link. Authed users bounce to the launcher;
 * unauthed users go to /auth with ?next=/launch so post-login lands them
 * on the role-aware launcher rather than the marketing landing.
 */
export const Route = createFileRoute("/his")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/launch" });
    throw redirect({ to: "/auth", search: { next: "/launch" } });
  },
  component: () => null,
});