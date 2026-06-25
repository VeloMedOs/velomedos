import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/clinics")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireKey(request);
        if (!auth.ok) return auth.res;
        const { data, error } = await serviceClient().from("clinics").select("*").order("name");
        if (error) return json({ error: error.message }, 500);
        return json(data);
      },
    },
  },
});