import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody } from "../_helpers";
import { validateMandatoryMeaning } from "@/lib/clinical/form-validation";

/* eslint-disable @typescript-eslint/no-explicit-any */
const PatchSchema = z.object({
  answers: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["draft","submitted","cosigned","cancelled"]).optional(),
  paste_ranges: z.unknown().optional(),
});
const parsePatch = parseBody((raw) => PatchSchema.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/forms/instances/$id")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    PATCH: async ({ request, params }) => {
      const parsed = await parsePatch(request);
      if (!parsed.ok) return parsed.res;
      const auth = parsed.data.status === "cosigned"
        ? await requireClinicalModule(request, "Clinical", { capId: "forms.instance.cosign" })
        : await requireTenant(request);
      if (!auth.ok) return auth.res;
      const owned = await loadOwned<any>("clinical_form_instance", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      const db = serviceClient() as any;
      const patch: Record<string, unknown> = { ...parsed.data };
      // Meaning validation on submit — DoD C6.
      if (parsed.data.status === "submitted") {
        const answers = (parsed.data.answers as Record<string, unknown> | undefined) ?? owned.row.answers ?? {};
        const { data: def } = await db.from("form_def").select("schema").eq("id", owned.row.form_def_id).maybeSingle();
        const fields = (def?.schema?.fields as any[]) ?? [];
        const issues = validateMandatoryMeaning(answers, fields);
        if (issues.length > 0) {
          return envelope("Fields require meaningful text", "MEANING_INVALID", 422, { issues });
        }
      }
      if (parsed.data.status === "submitted") {
        patch.submitted_by = auth.ctx.userId;
        patch.submitted_at = new Date().toISOString();
      }
      if (parsed.data.status === "cosigned") {
        patch.cosigned_by = auth.ctx.userId;
        patch.cosigned_at = new Date().toISOString();
      }
      const { data, error } = await db.from("clinical_form_instance").update(patch).eq("id", params.id).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "forms.instance.update", "clinical_form_instance", params.id, patch);
      return jsonData({ data });
    },
  } },
});