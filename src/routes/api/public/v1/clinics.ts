import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/clinics")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireKey(request, "clinics:read");
        if (!auth.ok) return auth.res;
        const { data, error } = await serviceClient()
          .from("clinics_public")
          .select("*")
          .order("name");
        if (error) { console.error("public_api", error); return json({ error: "internal_error" }, 500); }
        return json(data);
      },
    },
  },
});