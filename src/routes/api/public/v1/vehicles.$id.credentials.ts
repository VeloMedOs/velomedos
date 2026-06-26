import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/vehicles/$id/credentials")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireKey(request, "compliance:read");
        if (!auth.ok) return auth.res;
        const db = serviceClient();
        const [v, crew] = await Promise.all([
          db.from("credentials")
            .select("id,kind,reference,issuer,issued_on,expires_on,subject_user_id,subject_ambulance_id")
            .eq("subject_ambulance_id", params.id),
          db.from("ambulances").select("driver_id,paramedic_id").eq("id", params.id).maybeSingle(),
        ]);
        const crewIds = [crew.data?.driver_id, crew.data?.paramedic_id].filter(Boolean) as string[];
        const crewCreds = crewIds.length
          ? (await db.from("credentials")
              .select("id,kind,reference,issuer,issued_on,expires_on,subject_user_id,subject_ambulance_id")
              .in("subject_user_id", crewIds)).data ?? []
          : [];
        return json({ vehicle: v.data ?? [], crew: crewCreds });
      },
    },
  },
});