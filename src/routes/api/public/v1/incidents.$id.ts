import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/incidents/$id")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireKey(request, "incidents:read");
        if (!auth.ok) return auth.res;
        const { data, error } = await serviceClient()
          .from("incidents")
          .select("*")
          .eq("id", params.id)
          .maybeSingle();
        if (error) return json({ error: error.message }, 500);
        if (!data) return json({ error: "Not found" }, 404);
        return json(data);
      },
    },
  },
});