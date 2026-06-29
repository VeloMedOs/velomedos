import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "./_helpers";
import { EligibilityTransitionRequest } from "@/lib/mds/schema/rcm";
import { applyEvent } from "@/lib/rcm/eligibility-engine";
import type { EligibilityEvent } from "@/lib/rcm/eligibility-sm";

const parse = parseBody((raw) => EligibilityTransitionRequest.parse(raw));

/**
 * POST /api/clinical/v1/eligibility/:id/transition
 * Drives manual SM events: exception.approve|reject, activation.request|
 * complete|reject, select.self_pay, cancel.
 */
export const Route = createFileRoute("/api/clinical/v1/eligibility/$id/transition")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility", { capId: "reg.activation" });
      if (!auth.ok) return auth.res;
      const parsed = await parse(request);
      if (!parsed.ok) return parsed.res;
      const ev = parsed.data;
      const reason = ev.reason ?? "unspecified";
      let event: EligibilityEvent;
      switch (ev.event) {
        case "exception.approve":   event = { kind: "exception.approve" }; break;
        case "exception.reject":    event = { kind: "exception.reject", reason }; break;
        case "activation.request":  event = { kind: "activation.request" }; break;
        case "activation.complete": event = { kind: "activation.complete" }; break;
        case "activation.reject":   event = { kind: "activation.reject", reason }; break;
        case "select.self_pay":     event = { kind: "select.self_pay", reason }; break;
        case "cancel":              event = { kind: "cancel", reason }; break;
      }
      const r = await applyEvent(params.id, event, { userId: auth.ctx.userId, tenantId: auth.ctx.tenantId });
      if (!r.ok) return envelope(r.error, r.code, r.status ?? 409);
      return jsonData({ data: r.row });
    },
  } },
});