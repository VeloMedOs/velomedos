import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export type CrudConfig = {
  table: string;
  readScope: string;
  writeScope: string;
  /** Optional column whitelist on insert/update. */
  allowed?: string[];
  /** Order column for list. */
  orderBy?: string;
  /** Limit for list. */
  limit?: number;
  /** Map querystring keys to eq filters. */
  filters?: string[];
  /** Hook to stamp values on insert. */
  stamp?: (userId: string | null) => Record<string, unknown>;
};

function pick(body: Record<string, unknown>, allowed?: string[]) {
  if (!allowed) return body;
  const out: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) out[k] = body[k];
  return out;
}

/**
 * Returns a TanStack-Start `server.handlers` object implementing standard CRUD:
 *   GET    /            list with filters
 *   POST   /            create
 *   PATCH  /            update by body.id
 *   DELETE /?id=…       soft remove (real DELETE)
 */
export function crudHandlers(cfg: CrudConfig) {
  return {
    OPTIONS: () => preflight(),

    GET: async ({ request }: { request: Request }) => {
      const auth = await requireAdmin(request, cfg.readScope);
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      let q = adminDb().from(cfg.table).select("*").order(cfg.orderBy ?? "created_at", { ascending: false }).limit(cfg.limit ?? 200);
      for (const f of cfg.filters ?? []) {
        const v = url.searchParams.get(f);
        if (v) q = q.eq(f, v);
      }
      const { data, error } = await q;
      if (error) return json({ error: error.message, code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
      return json({ rows: data ?? [] });
    },

    POST: async ({ request }: { request: Request }) => {
      const auth = await requireAdmin(request, cfg.writeScope);
      if (!auth.ok) return auth.res;
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body) return json({ error: "missing_body", code: "validation", request_id: crypto.randomUUID() }, 400);
      const stamp = cfg.stamp ? cfg.stamp(auth.userId) : {};
      const insert = { ...pick(body, cfg.allowed), ...stamp };
      const { data, error } = await adminDb().from(cfg.table).insert(insert as never).select().single();
      if (error) return json({ error: error.message, code: "db/insert_failed", request_id: crypto.randomUUID() }, 400);
      await adminAudit(auth.userId, `${cfg.table}.create`, cfg.table, (data as { id?: string } | null)?.id ?? null, insert);
      return json(data, 201);
    },

    PATCH: async ({ request }: { request: Request }) => {
      const auth = await requireAdmin(request, cfg.writeScope);
      if (!auth.ok) return auth.res;
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      const id = body?.id as string | undefined;
      if (!body || !id) return json({ error: "missing_id", code: "validation", request_id: crypto.randomUUID() }, 400);
      const { id: _omit, ...rest } = body;
      const patch = pick(rest as Record<string, unknown>, cfg.allowed);
      const { data, error } = await adminDb().from(cfg.table).update(patch as never).eq("id", id).select().single();
      if (error) return json({ error: error.message, code: "db/update_failed", request_id: crypto.randomUUID() }, 400);
      await adminAudit(auth.userId, `${cfg.table}.update`, cfg.table, id, patch);
      return json(data);
    },

    DELETE: async ({ request }: { request: Request }) => {
      const auth = await requireAdmin(request, cfg.writeScope);
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "missing_id", code: "validation", request_id: crypto.randomUUID() }, 400);
      const { error } = await adminDb().from(cfg.table).delete().eq("id", id);
      if (error) return json({ error: error.message, code: "db/delete_failed", request_id: crypto.randomUUID() }, 400);
      await adminAudit(auth.userId, `${cfg.table}.delete`, cfg.table, id, null);
      return json({ ok: true });
    },
  };
}