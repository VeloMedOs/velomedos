/**
 * POST /api/clinical/v1/forms/instances/$id/addendum
 *
 * Appends an addendum row to a submitted/cosigned form instance — Dev Spec
 * §5 "addendum-not-amend". The original answers stay untouched; only the
 * `addenda` jsonb array grows.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
const Body = z.object({ body: z.string().min(1).max(4000) });
const parseAddendum = parseBody((raw) => Body.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/forms/instances/$id/addendum")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireTenant(request);
      if (!auth.ok) return auth.res;
      const parsed = await parseAddendum(request);
      if (!parsed.ok) return parsed.res;
      const owned = await loadOwned<any>("clinical_form_instance", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      if (owned.row.status !== "submitted" && owned.row.status !== "cosigned") {
        return envelope("addendum only allowed on submitted forms", "invalid_state", 409);
      }
      const db = serviceClient() as any;
      const now = new Date().toISOString();
      const addendum = {
        id: crypto.randomUUID(),
        author_id: auth.ctx.userId,
        author_label: null,
        body: parsed.data.body,
        created_at: now,
      };
      const nextAddenda = [...((owned.row.addenda as any[]) ?? []), addendum];
      const { data, error } = await db.from("clinical_form_instance")
        .update({ addenda: nextAddenda })
        .eq("id", params.id).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "forms.instance.addendum", "clinical_form_instance", params.id, { addendum_id: addendum.id });
      return jsonData({ data });
    },
  } },
});