import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

/** POST /api/admin/v1/legal-documents/:id/publish  { change_note }
 *  Sets status=published (trigger snapshots a new version) then stamps the change_note onto that snapshot. */
export const Route = createFileRoute("/api/admin/v1/legal-documents/$id/publish")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireAdmin(request, "config:write");
      if (!auth.ok) return auth.res;
      const id = (params as { id: string }).id;
      const body = await request.json().catch(() => ({} as any));
      const change_note: string | null = typeof body?.change_note === "string" ? body.change_note.slice(0, 2000) : null;

      const db = adminDb();
      // Effective date defaults to today if missing.
      const effective = typeof body?.effective_date === "string" ? body.effective_date : new Date().toISOString().slice(0, 10);
      const { data: updated, error } = await db.from("legal_documents")
        .update({ status: "published", effective_date: effective, updated_by: auth.userId } as never)
        .eq("id", id).select("id, slug, locale, version").single();
      if (error || !updated) return json({ error: error?.message ?? "publish_failed" }, 400);

      // Stamp change_note onto the version row the trigger just inserted.
      if (change_note) {
        await db.from("legal_document_versions")
          .update({ change_note } as never)
          .eq("slug", updated.slug).eq("locale", updated.locale).eq("version", updated.version);
      }
      await adminAudit(auth.userId, "legal_documents.publish", "legal_documents", id, { change_note, version: updated.version });
      return json({ ok: true, version: updated.version });
    },
  } },
});