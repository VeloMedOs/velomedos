/**
 * Step 4 · Turn 3 — Pre-Auth MID public board (HCA-0978 / 0791).
 *
 * Anonymous, no-PHI kiosk feed. Returns only the 9 safe fields defined by
 * `v_preauth_mid` via the SECURITY DEFINER accessor `preauth_mid_board`.
 *
 * Anti-enumeration: unknown tenant → empty rows list. No beneficiary,
 * encounter, or full pre-auth reference is ever returned. Ref numbers are
 * masked as `***-XXX` inside the view.
 */
import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, serviceClient } from "@/lib/api-server";

/* eslint-disable @typescript-eslint/no-explicit-any */

const ALLOWED_FIELDS = new Set([
  "id",
  "tenant_id",
  "masked_ref",
  "status",
  "status_color",
  "decision_at",
  "valid_to",
  "priority",
  "updated_at",
]);

function scrub(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(row)) if (ALLOWED_FIELDS.has(k)) out[k] = row[k];
  return out;
}

/** Resolve `tenant` param (UUID or slug) → tenant UUID or null. */
async function resolveTenant(db: any, raw: string): Promise<string | null> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return raw;
  const { data } = await db.from("corporate_accounts").select("id").eq("slug", raw).maybeSingle();
  return (data as any)?.id ?? null;
}

export async function handleGET(args: { query: { tenant: string | null }; db?: any }): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const raw = (args.query.tenant ?? "").trim();
  if (!raw) return json({ rows: [], generated_at: new Date().toISOString() });
  const tenantId = await resolveTenant(db, raw);
  if (!tenantId) return json({ rows: [], generated_at: new Date().toISOString() });

  const { data, error } = await db.rpc("preauth_mid_board", { _tenant: tenantId });
  if (error) return json({ rows: [], generated_at: new Date().toISOString() });

  const rows = ((data as any[]) ?? []).map(scrub);
  return json({ rows, generated_at: new Date().toISOString() });
}

export const Route = createFileRoute("/api/public/v1/preauth-mid/board")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const tenant = url.searchParams.get("tenant");
        return handleGET({ query: { tenant } });
      },
    },
  },
});