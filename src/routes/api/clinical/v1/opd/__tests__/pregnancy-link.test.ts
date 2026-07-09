// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handlePOST } from "../opd.pregnancy-episode.link";
import { makeMockDb } from "@/test/db-mock";

const TENANT = "t1";
const CTX = { tenantId: TENANT, userId: "u1", clinicalRole: "tenant_admin" as const };

function seed(opts: { episode?: Record<string, unknown> | null; episode_of_care_id?: string | null } = {}) {
  const tables: Record<string, Record<string, unknown>[]> = {
    encounter: [{ id: "e1", tenant_id: TENANT, beneficiary_id: "b1", episode_of_care_id: opts.episode_of_care_id ?? null }],
    episode_of_care: opts.episode === null ? [] : [{
      id: "ep1", tenant_id: TENANT, beneficiary_id: "b1",
      care_type: "pregnancy", status: "active", end_date: "2026-12-01",
      ...(opts.episode ?? {}),
    }],
  };
  return makeMockDb({ tables });
}

async function body(res: Response) { return await res.json(); }

describe("opd/pregnancy-episode/link — care_type='pregnancy'", () => {
  it("active pregnancy + OBS&GYN specialty → linked", async () => {
    const { db, client } = seed();
    const res = await handlePOST({ body: { encounter_id: "e1", specialty: "OBS&GYN" }, ctx: CTX, db: client });
    const j = await body(res);
    expect(j.ok).toBe(true);
    expect(j.data.linked).toBe(true);
    expect((db.tables.encounter[0] as { episode_of_care_id?: string }).episode_of_care_id).toBe("ep1");
  });

  it("active pregnancy + non-OBS specialty → not linked", async () => {
    const { client } = seed();
    const res = await handlePOST({ body: { encounter_id: "e1", specialty: "cardiology" }, ctx: CTX, db: client });
    const j = await body(res);
    expect(j.data.linked).toBe(false);
    expect(j.data.reason).toBe("non_obs_specialty");
  });

  it("no active pregnancy → not linked", async () => {
    const { client } = seed({ episode: null });
    const res = await handlePOST({ body: { encounter_id: "e1", specialty: "OBS&GYN" }, ctx: CTX, db: client });
    const j = await body(res);
    expect(j.data.linked).toBe(false);
    expect(j.data.reason).toBe("no_active_pregnancy");
  });

  it("already-linked encounter → no-op idempotent", async () => {
    const { client } = seed({ episode_of_care_id: "ep-existing" });
    const res = await handlePOST({ body: { encounter_id: "e1", specialty: "obs" }, ctx: CTX, db: client });
    const j = await body(res);
    expect(j.data.linked).toBe(false);
    expect(j.data.reason).toBe("already_linked");
  });
});