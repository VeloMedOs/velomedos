import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/courses")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireKey(request, "courses:read");
        if (!auth.ok) return auth.res;
        const { data, error } = await serviceClient().from("courses").select("*").order("title");
        if (error) { console.error("public_api", error); return json({ error: "internal_error" }, 500); }
        return json(data);
      },
    },
  },
});