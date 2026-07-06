import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned } from "../_helpers";
import { canTransition, type AuthStatus } from "@/lib/rcm/auth-sm";
import { submitPreauth } from "@/lib/mds/nphies/gateway";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Route = createFileRoute("/api/clinical/v1/auth/requests/$id/submit")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Authorization", { capId: "auth.request" });
      if (!auth.ok) return auth.res;
      const owned = await loadOwned<any>("authorization_request", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      if (!canTransition(owned.row.status as AuthStatus, "submitted")) {
        return envelope(`Cannot submit from status ${owned.row.status}`, "invalid_state", 409);
      }
      const db = serviceClient() as any;
      const { data: items } = await db.from("authorization_item").select("*")
        .eq("authorization_request_id", params.id);

      const bundle = {
        resourceType: "Bundle",
        type: "message",
        entry: [{
          resource: {
            resourceType: "Claim",
            use: "preauthorization",
            id: owned.row.id,
            item: (items ?? []).map((it: any, idx: number) => ({
              sequence: idx + 1,
              productOrService: { coding: [{ system: it.source === "drug" ? "drug" : "service", code: it.drug_id ?? it.service_id }] },
              quantity: { value: it.quantity ?? 1 },
              net: { value: 0, currency: it.currency ?? "SAR" },
            })),
          },
        }],
      };

      const gw = await submitPreauth(bundle, `auth-${owned.row.id}`, auth.ctx.tenantId);
      const resp = gw.bundle?.entry?.[0]?.resource ?? {};
      const preauthRef: string | null = resp.preAuthRef ?? null;
      const validFrom: string | null = resp.preAuthPeriod?.start ?? null;
      const validTo: string | null = resp.preAuthPeriod?.end ?? null;
      const outcomeApproved = gw.ok && resp.outcome === "complete";
      const nextStatus: AuthStatus = outcomeApproved
        ? (gw.sandbox ? "approved" : "queued_at_payer")
        : "submitted";

      const { data, error } = await db.from("authorization_request").update({
        status: nextStatus,
        submitted_at: new Date().toISOString(),
        preauth_ref: preauthRef,
        valid_from: validFrom,
        valid_to: validTo,
        gateway_response: gw.bundle,
        updated_by: auth.ctx.userId,
      }).eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);

      // On sandbox auto-approvals, mark every item approved so downstream
      // AUTH_MISSING coverage checks pass immediately in demo tenants.
      if (outcomeApproved && gw.sandbox) {
        await db.from("authorization_item").update({
          decision: "approved",
          updated_by: auth.ctx.userId,
        }).eq("authorization_request_id", params.id);
      }

      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "auth_request.submit",
        "authorization_request", params.id, { sandbox: gw.sandbox, next: nextStatus, preauth_ref: preauthRef });
      return jsonData({ data, sandbox: gw.sandbox, http_status: gw.http_status });
    },
  } },
});