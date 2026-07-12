// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handlePOST as fanOutPOST } from "../referral.fan-out";
import { handlePOST as interCoPOST } from "../referral.inter-company.create";
import { handlePOST as seriesPOST } from "../referral.series.create";
import { handlePOST as nutritionPOST } from "../nutrition.referrals.pending";
import { makeMockDb } from "@/test/db-mock";

/* eslint-disable @typescript-eslint/no-explicit-any */

const TENANT = "t1";
const CTX = { tenantId: TENANT, userId: "u1", clinicalRole: "physician" as const };

describe("Step 5 · Turn 2 UI contracts — referral dialogs", () => {
  it("FanOutDialog: external target result carries external_blocked code with debt #22 hint", async () => {
    const { client } = makeMockDb({
      tables: {
        referral: [{ id: "r1", tenant_id: TENANT, source_encounter_id: "e1", beneficiary_id: "b1", referral_class: "external", status: "draft" }],
        referral_target: [], pricing_rule: [],
      },
    });
    const res = await fanOutPOST({
      body: { referral_id: "r1", targets: [{ target_kind: "external_facility" }] } as any,
      ctx: CTX, db: client,
    });
    const j = await res.json();
    expect(j.data.targets[0].error.code).toBe("external_blocked");
    expect(j.data.targets[0].error.hint).toMatch(/#22/);
  });

  it("FanOutDialog: IPD banner precondition — admission_request_id + awaiting[4]", async () => {
    const { client } = makeMockDb({
      tables: {
        referral: [{ id: "r1", tenant_id: TENANT, source_encounter_id: "e1", beneficiary_id: "b1", referral_class: "cross_encounter", status: "draft" }],
        referral_target: [], pricing_rule: [], admission_request: [],
      },
    });
    const res = await fanOutPOST({
      body: { referral_id: "r1", targets: [{ target_kind: "encounter", target_encounter_type: "IPD" }] } as any,
      ctx: CTX, db: client,
    });
    const j = await res.json();
    const t = j.data.targets[0];
    expect(typeof t.admission_request_id).toBe("string");
    expect(t.awaiting).toEqual(["mrp", "payer", "coverage", "room_type"]);
  });

  it("FanOutDialog: multi-target renders per-target engine_decision + status", async () => {
    const { client } = makeMockDb({
      tables: {
        referral: [{ id: "r1", tenant_id: TENANT, source_encounter_id: "e1", beneficiary_id: "b1", source_specialty: "gp", referral_class: "intra", status: "draft" }],
        referral_target: [],
        pricing_rule: [
          { id: "p1", tenant_id: TENANT, active: true, priority: 10, scope: "referral",
            condition: { target_specialty_differs: true },
            action: { preauth_required: true, charge_mode: "new_consult" } },
        ],
      },
    });
    const res = await fanOutPOST({
      body: { referral_id: "r1", targets: [
        { target_kind: "specialty", target_specialty: "cardio" },
        { target_kind: "encounter", target_encounter_type: "OR" },
      ] } as any, ctx: CTX, db: client,
    });
    const j = await res.json();
    expect(j.data.targets[0].status).toBe("draft");
    expect(j.data.targets[0].engine_decision.preauth_required).toBe(true);
    expect(j.data.targets[1].error.code).toBe("target_kind_not_ready");
  });

  it("InterCompanyDialog: cross-cluster target rejected with cluster_mismatch", async () => {
    const { client } = makeMockDb({
      tables: {
        corporate_accounts: [
          { id: "t1", cluster_id: "c1" },
          { id: "t2", cluster_id: "c2" }, // different cluster
        ],
        referral: [{ id: "r1", tenant_id: TENANT, source_encounter_id: "e1", referral_class: "inter_company", status: "draft" }],
        referral_target: [],
      },
    });
    const res = await interCoPOST({
      body: { referral_id: "r1", target_entity_id: "t2", target_specialty: "cardio" } as any,
      ctx: CTX, db: client,
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const j = await res.json();
    expect(String(j.code ?? j.error ?? "")).toMatch(/cluster|mismatch|not_a_sibling|not_a_member/i);
  });

  it("SeriesBookingPane: non-series service returns 422 with debt #18 hint", async () => {
    const { client } = makeMockDb({
      tables: { service_master: [{ id: "svc-consult", tenant_id: TENANT, sub_category: "consult", specialty: "gp", name: "GP consult" }] },
    });
    const res = await seriesPOST({
      body: {
        origin_encounter_id: "00000000-0000-0000-0000-000000000001",
        service_id: "svc-consult", session_count: 6, cadence_days: 14,
      } as any, ctx: CTX, db: client,
    });
    expect(res.status).toBe(422);
    const j = await res.json();
    expect(j.code).toBe("not_a_series_specialty");
    expect(String(j.hint ?? "")).toMatch(/#18/);
  });

  it("Cockpit action: accept nutrition draft flips status → submitted and writes target", async () => {
    const { client, db } = makeMockDb({
      tables: {
        referral: [{
          id: "rn1", tenant_id: TENANT, status: "draft",
          source_key: "nutrition_screen:enc1",
          source_encounter_id: "enc1", source_specialty: "gp",
        }],
        referral_target: [], pricing_rule: [],
      },
    });
    const res = await nutritionPOST({
      body: { referral_id: "rn1", action: "accept" } as any, ctx: CTX, db: client,
    });
    const j = await res.json();
    expect(j.data.status).toBe("submitted");
    expect(db.tables.referral_target).toHaveLength(1);
    expect((db.tables.referral[0] as any).status).toBe("submitted");
  });

  it("Cockpit action: decline nutrition sets declined, writes no target", async () => {
    const { client, db } = makeMockDb({
      tables: {
        referral: [{
          id: "rn2", tenant_id: TENANT, status: "draft",
          source_key: "nutrition_screen:enc2",
        }],
        referral_target: [],
      },
    });
    const res = await nutritionPOST({
      body: { referral_id: "rn2", action: "decline", notes: "not indicated" } as any, ctx: CTX, db: client,
    });
    const j = await res.json();
    expect(j.data.status).toBe("declined");
    expect(db.tables.referral_target).toHaveLength(0);
  });

  it("Cockpit action: non-nutrition referral cannot be actioned via nutrition endpoint", async () => {
    const { client } = makeMockDb({
      tables: {
        referral: [{ id: "rx", tenant_id: TENANT, status: "draft", source_key: "manual:doctor" }],
        referral_target: [],
      },
    });
    const res = await nutritionPOST({
      body: { referral_id: "rx", action: "accept" } as any, ctx: CTX, db: client,
    });
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.code).toBe("not_a_nutrition_referral");
  });
});