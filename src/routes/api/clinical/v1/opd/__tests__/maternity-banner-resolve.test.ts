// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handleGET } from "../opd.maternity.banner";
import { makeMockDb } from "@/test/db-mock";

const T = "t1";
const CTX = { tenantId: T, userId: "u1", clinicalRole: "tenant_admin" as const };

function seed(opts: { protocol?: string | null; episode?: boolean; eocId?: string | null } = {}) {
  const tables: Record<string, Record<string, unknown>[]> = {
    encounter: [{ id: "e1", tenant_id: T, beneficiary_id: "b1", episode_of_care_id: opts.eocId ?? null, period_start: "2026-07-01" }],
    v_pregnancy_episode_active: opts.episode === false ? [] : [{
      episode_id: "ep1", tenant_id: T, beneficiary_id: "b1",
      start_date: "2026-01-01", edd_computed: "2026-10-08", weeks_gestation: 26, cadence_band: "Q4W",
    }],
    maternity_protocol: opts.protocol ? [{ id: opts.protocol, name: "Gold ANC" }] : [],
  };
  return makeMockDb({ tables, rpc: (_n, _a) => opts.protocol ?? null });
}

async function j(r: Response) { return await r.json(); }

describe("opd/maternity/banner — resolver + episode readout", () => {
  it("resolves protocol when payer+policy match", async () => {
    const { client } = seed({ protocol: "mp1" });
    const res = await handleGET({ query: { encounter_id: "e1" }, ctx: CTX, db: client });
    const r = await j(res);
    expect(r.ok).toBe(true);
    expect(r.data.pregnancy_active).toBe(true);
    expect(r.data.protocol_id).toBe("mp1");
    expect(r.data.protocol_summary).toBe("Gold ANC");
    expect(r.data.cadence_band).toBe("Q4W");
  });

  it("null protocol when no match", async () => {
    const { client } = seed({ protocol: null });
    const res = await handleGET({ query: { encounter_id: "e1" }, ctx: CTX, db: client });
    const r = await j(res);
    expect(r.data.protocol_id).toBeNull();
    expect(r.data.protocol_summary).toBeNull();
  });

  it("no active pregnancy → banner shows inactive", async () => {
    const { client } = seed({ episode: false });
    const res = await handleGET({ query: { encounter_id: "e1" }, ctx: CTX, db: client });
    const r = await j(res);
    expect(r.data.pregnancy_active).toBe(false);
    expect(r.data.cadence_band).toBeNull();
  });
});