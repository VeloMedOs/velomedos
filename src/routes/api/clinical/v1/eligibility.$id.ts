import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Route = createFileRoute("/api/clinical/v1/eligibility/$id")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility");
      if (!auth.ok) return auth.res;
      const owned = await loadOwned<any>("visit_eligibility", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      return jsonData({ data: owned.row });
    },
  } },
});

// Note: PATCH path is intentionally not exposed; lifecycle changes flow
// through eligibility.$id.transition + eligibility.$id.exception so the
// state machine is always the source of truth.
void envelope;