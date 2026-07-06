import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
const PatchSchema = z.object({
  title: z.string().min(1).max(200).nullish(),
  schema_json: z.unknown().optional(),
  active: z.boolean().optional(),
  publish: z.boolean().optional(),
});
const parsePatch = parseBody((raw) => PatchSchema.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/forms/defs/$id")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    PATCH: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "forms.def.publish" });
      if (!auth.ok) return auth.res;
      const owned = await loadOwned<any>("form_def", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      const parsed = await parsePatch(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const patch: Record<string, unknown> = { ...parsed.data };
      if (parsed.data.publish) {
        patch.version = ((owned.row as any).version ?? 1) + 1;
        delete patch.publish;
      }
      const { data, error } = await db.from("form_def").update(patch).eq("id", params.id).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "forms.def.update", "form_def", params.id, patch);
      return jsonData({ data });
    },
  } },
});