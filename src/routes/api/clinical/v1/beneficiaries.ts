import { createFileRoute } from "@tanstack/react-router";
import {
  clinicalAudit,
  preflight,
  requireClinicalRole,
  requireTenant,
  serviceClient,
} from "@/lib/api-clinical";
import { BeneficiaryCreate } from "@/lib/mds/schema/registration";
import { envelope, parseBody } from "./_helpers";

const parseCreate = parseBody((raw) => BeneficiaryCreate.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/beneficiaries")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const q = url.searchParams.get("q")?.trim();
        const documentId = url.searchParams.get("document_id")?.trim();
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 25)));
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

        const db = serviceClient();
        let query = db
          .from("beneficiary")
          .select("*", { count: "exact" })
          .eq("tenant_id", auth.ctx.tenantId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (q) query = query.ilike("full_name", `%${q}%`);
        if (documentId) query = query.eq("document_id", documentId);

        const { data, count, error } = await query;
        if (error) return envelope(error.message, "db_error", 500);
        return new Response(
          JSON.stringify({ data: data ?? [], pagination: { limit, offset, total: count ?? 0 } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
      POST: async ({ request }) => {
        const auth = await requireClinicalRole(request, ["registrar"]);
        if (!auth.ok) return auth.res;
        const parsed = await parseCreate(request);
        if (!parsed.ok) return parsed.res;

        const db = serviceClient();
        const { data, error } = await db
          .from("beneficiary")
          .insert({
            ...parsed.data,
            tenant_id: auth.ctx.tenantId,
            created_by: auth.ctx.userId,
            updated_by: auth.ctx.userId,
            journey_state: "registered",
          })
          .select("*")
          .single();
        if (error) {
          const dup = error.code === "23505";
          return envelope(
            dup ? "Duplicate document_type + document_id for this tenant" : error.message,
            dup ? "duplicate_document" : "db_error",
            dup ? 409 : 500,
          );
        }
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "beneficiary.create", "beneficiary", data.id, {
          document_type: data.document_type,
        });
        return new Response(JSON.stringify({ data }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
