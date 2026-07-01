import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { jsonData, loadOwned } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Route = createFileRoute("/api/clinical/v1/claims/$id/lifecycle")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance");
      if (!auth.ok) return auth.res;
      const owned = await loadOwned<any>("claim", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      const db = serviceClient() as any;
      const [events, scrubs, attempts] = await Promise.all([
        db.from("claim_lifecycle_event").select("*").eq("claim_id", params.id)
          .order("created_at", { ascending: false }).limit(200),
        db.from("claim_scrub_result").select("id, run_at, blocker_count, warning_count, hash")
          .eq("claim_id", params.id).order("run_at", { ascending: false }).limit(50),
        db.from("claim_submission_attempt").select("*").eq("claim_id", params.id)
          .order("created_at", { ascending: false }).limit(50),
      ]);
      return jsonData({ data: {
        events: events.data ?? [],
        scrubs: scrubs.data ?? [],
        submissions: attempts.data ?? [],
      } });
    },
  } },
});