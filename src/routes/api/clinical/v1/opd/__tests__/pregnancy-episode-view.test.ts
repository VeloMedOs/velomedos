// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handleGET } from "../maternity.banner";
import { makeMockDb } from "@/test/db-mock";

const T = "t1";
const CTX = { tenantId: T, userId: "u1", clinicalRole: "tenant_admin" as const };

function seedBand(band: "Q4W" | "Q2W" | "Q1W", weeks: number) {
  return makeMockDb({
    tables: {
      encounter: [{ id: "e1", tenant_id: T, beneficiary_id: "b1", episode_of_care_id: null, period_start: "2026-07-01" }],
      v_pregnancy_episode_active: [{
        episode_id: "ep1", tenant_id: T, beneficiary_id: "b1",
        start_date: "2026-01-01", edd_computed: "2026-10-08",
        weeks_gestation: weeks, cadence_band: band,
      }],
    },
    rpc: () => null,
  });
}

async function j(r: Response) { return await r.json(); }

describe("v_pregnancy_episode_active — banner projection", () => {
  it("Q4W band → next ANC in ~28d", async () => {
    const { client } = seedBand("Q4W", 20);
    const r = await j(await handleGET({ query: { encounter_id: "e1" }, ctx: CTX, db: client }));
    expect(r.data.cadence_band).toBe("Q4W");
    const next = new Date(r.data.next_anc_suggested_at);
    const diffDays = Math.round((next.getTime() - Date.now()) / 86_400_000);
    expect(diffDays).toBeGreaterThanOrEqual(27);
    expect(diffDays).toBeLessThanOrEqual(29);
  });

  it("Q2W band → next ANC in ~14d", async () => {
    const { client } = seedBand("Q2W", 30);
    const r = await j(await handleGET({ query: { encounter_id: "e1" }, ctx: CTX, db: client }));
    const next = new Date(r.data.next_anc_suggested_at);
    const diffDays = Math.round((next.getTime() - Date.now()) / 86_400_000);
    expect(diffDays).toBeGreaterThanOrEqual(13);
    expect(diffDays).toBeLessThanOrEqual(15);
  });

  it("Q1W band → next ANC in ~7d", async () => {
    const { client } = seedBand("Q1W", 38);
    const r = await j(await handleGET({ query: { encounter_id: "e1" }, ctx: CTX, db: client }));
    const next = new Date(r.data.next_anc_suggested_at);
    const diffDays = Math.round((next.getTime() - Date.now()) / 86_400_000);
    expect(diffDays).toBeGreaterThanOrEqual(6);
    expect(diffDays).toBeLessThanOrEqual(8);
  });
});