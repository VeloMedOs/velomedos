// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handlePOST as createPOST } from "../opd.referral.create";
import { handlePOST as fanOutPOST } from "../opd.referral.fan-out";
import { handlePOST as interCoPOST } from "../opd.referral.inter-company.create";
import { handlePOST as seriesPOST } from "../opd.referral.series.create";
import { handlePOST as nutritionPOST } from "../opd.nutrition.referrals.pending";
import { makeMockDb } from "@/test/db-mock";

const TENANT = "t1";
const CTX = { tenantId: TENANT, userId: "u1", clinicalRole: "physician" as const };

/* eslint-disable @typescript-eslint/no-explicit-any */

describe("Step 5 · Turn 2 — Referral writes (debt #45)", () => {
  it("create: Rule A (different specialty) yields preauth_required=true", async () => {
    const { client, db } = makeMockDb({
      tables: {
        pricing_rule: [
          { id: "p1", tenant_id: TENANT, active: true, priority: 10, scope: "referral",
            condition: { target_specialty_differs: true },
            action: { preauth_required: true, charge_mode: "new_consult" } },
        ],
        referral: [], referral_target: [],
      },
    });
    const res = await createPOST({
      body: {
        source_encounter_id: "00000000-0000-0000-0000-000000000001",
        target_kind: "specialty", target_specialty: "cardio",
        reason: "chest pain", same_specialty: false,
      } as any, ctx: CTX, db: client,
    });
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.data.engine_decision.preauth_required).toBe(true);
    expect(db.tables.referral).toHaveLength(1);
    expect(db.tables.referral_target).toHaveLength(1);
    expect((db.tables.referral[0] as any).status).toBe("draft");
  });

  it("create: idempotent — same source_encounter+specialty returns existing target", async () => {
    const { client, db } = makeMockDb({ tables: { pricing_rule: [], referral: [], referral_target: [] } });
    const body = {
      source_encounter_id: "00000000-0000-0000-0000-000000000002",
      target_kind: "specialty", target_specialty: "endo",
      reason: "diabetes", same_specialty: false,
    };
    const r1 = await createPOST({ body: body as any, ctx: CTX, db: client });
    const j1 = await r1.json();
    const r2 = await createPOST({ body: body as any, ctx: CTX, db: client });
    const j2 = await r2.json();
    expect(j2.data.target_id).toBe(j1.data.target_id);
    expect(j2.data.idempotent).toBe(true);
    expect(db.tables.referral_target).toHaveLength(1);
  });

  it("fan-out: ER creates encounter + encounter_emergency atomically", async () => {
    const { client, db } = makeMockDb({
      tables: {
        referral: [{ id: "r1", tenant_id: TENANT, source_encounter_id: "e1", beneficiary_id: "b1", referral_class: "cross_encounter", status: "draft" }],
        referral_target: [], pricing_rule: [],
        encounter: [], encounter_emergency: [],
      },
    });
    const res = await fanOutPOST({
      body: { referral_id: "r1", targets: [{ target_kind: "encounter", target_encounter_type: "ER" }] } as any,
      ctx: CTX, db: client,
    });
    const j = await res.json();
    expect(j.data.targets[0].sibling_write.table).toBe("encounter_emergency");
    expect(db.tables.encounter).toHaveLength(1);
    expect(db.tables.encounter_emergency).toHaveLength(1);
    expect((db.tables.encounter[0] as any).class).toBe("EMER");
  });

  it("fan-out: IPD creates admission_request; OR is rejected with debt #46", async () => {
    const { client, db } = makeMockDb({
      tables: {
        referral: [{ id: "r1", tenant_id: TENANT, source_encounter_id: "e1", beneficiary_id: "b1", referral_class: "cross_encounter", status: "draft" }],
        referral_target: [], pricing_rule: [],
        admission_request: [],
      },
    });
    const res = await fanOutPOST({
      body: { referral_id: "r1", targets: [
        { target_kind: "encounter", target_encounter_type: "IPD" },
        { target_kind: "encounter", target_encounter_type: "OR" },
      ] } as any, ctx: CTX, db: client,
    });
    const j = await res.json();
    expect(j.data.targets[0].sibling_write.table).toBe("admission_request");
    expect(db.tables.admission_request).toHaveLength(1);
    expect(j.data.targets[1].error.code).toBe("target_kind_not_ready");
    expect(j.data.targets[1].error.hint).toMatch(/#46/);
  });

  it("fan-out: idempotent replay reuses target rows", async () => {
    const { client, db } = makeMockDb({
      tables: {
        referral: [{ id: "r1", tenant_id: TENANT, source_encounter_id: "e1", beneficiary_id: "b1", referral_class: "cross_encounter", status: "draft" }],
        referral_target: [], pricing_rule: [], encounter: [], encounter_emergency: [],
      },
    });
    const body = { referral_id: "r1", targets: [{ target_kind: "encounter", target_encounter_type: "ER" }] };
    const r1 = await fanOutPOST({ body: body as any, ctx: CTX, db: client });
    const j1 = await r1.json();
    const r2 = await fanOutPOST({ body: body as any, ctx: CTX, db: client });
    const j2 = await r2.json();
    expect(j2.data.targets[0].target_id).toBe(j1.data.targets[0].target_id);
    expect(db.tables.referral_target).toHaveLength(1);
  });

  it("inter-company: same cluster success; cross-cluster 403", async () => {
    const { client } = makeMockDb({
      tables: {
        corporate_accounts: [
          { id: TENANT, cluster_id: "c1" },
          { id: "t2", cluster_id: "c1" },
          { id: "t3", cluster_id: "c2" },
        ],
        referral: [{ id: "r1", tenant_id: TENANT, referral_class: "inter_company", status: "draft" }],
        referral_target: [],
        interface_log: [],
      },
    });
    const ok = await interCoPOST({ body: { referral_id: "r1", target_entity_id: "t2" } as any, ctx: CTX, db: client });
    const okJ = await ok.json();
    expect(ok.status).toBe(201);
    expect(okJ.data.sibling_tenant_id).toBe("t2");

    const bad = await interCoPOST({ body: { referral_id: "r1", target_entity_id: "t3" } as any, ctx: CTX, db: client });
    const badJ = await bad.json();
    expect(bad.status).toBe(403);
    expect(badJ.code).toBe("cluster_mismatch");
  });

  it("series: creates N clinic_bookings sharing series_id", async () => {
    const { client, db } = makeMockDb({
      tables: {
        service_master: [{ id: "svc1", sub_category: "series_therapy", specialty: "physio", name: "Physio session" }],
        referral: [], referral_target: [], clinic_bookings: [],
      },
    });
    const res = await seriesPOST({
      body: {
        origin_encounter_id: "00000000-0000-0000-0000-0000000000aa",
        service_id: "svc1", session_count: 6, cadence_days: 14,
        first_session_at: "2026-08-01T09:00:00.000Z",
      } as any, ctx: CTX, db: client,
    });
    const j = await res.json();
    expect(j.data.booking_ids).toHaveLength(6);
    expect(db.tables.clinic_bookings).toHaveLength(6);
    const seriesIds = new Set(db.tables.clinic_bookings.map((r: any) => r.series_id));
    expect(seriesIds.size).toBe(1);
  });

  it("series: non-series specialty rejected with debt #18 hint", async () => {
    const { client } = makeMockDb({
      tables: { service_master: [{ id: "svc2", sub_category: "consult", specialty: "gp", name: "GP" }] },
    });
    const res = await seriesPOST({
      body: { origin_encounter_id: "00000000-0000-0000-0000-0000000000bb", service_id: "svc2", session_count: 3, cadence_days: 7 } as any,
      ctx: CTX, db: client,
    });
    const j = await res.json();
    expect(res.status).toBe(422);
    expect(j.code).toBe("not_a_series_specialty");
  });

  it("nutrition accept: draft → submitted + writes target row", async () => {
    const { client, db } = makeMockDb({
      tables: {
        referral: [{ id: "rn1", tenant_id: TENANT, status: "draft", source_key: "nutrition_screen:e1" }],
        referral_target: [], pricing_rule: [],
      },
    });
    const res = await nutritionPOST({
      body: { referral_id: "rn1", action: "accept" } as any,
      ctx: { ...CTX, clinicalRole: "physician" }, db: client,
    });
    const j = await res.json();
    expect(j.data.status).toBe("submitted");
    expect((db.tables.referral[0] as any).status).toBe("submitted");
    expect((db.tables.referral[0] as any).origin_source).toBe("auto_nutrition");
    expect(db.tables.referral_target).toHaveLength(1);
  });

  it("nutrition decline: sets status='declined', no target row", async () => {
    const { client, db } = makeMockDb({
      tables: {
        referral: [{ id: "rn2", tenant_id: TENANT, status: "draft", source_key: "nutrition_screen:e2" }],
        referral_target: [],
      },
    });
    const res = await nutritionPOST({
      body: { referral_id: "rn2", action: "decline", notes: "not indicated" } as any,
      ctx: CTX, db: client,
    });
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect((db.tables.referral[0] as any).status).toBe("declined");
    expect(db.tables.referral_target).toHaveLength(0);
  });
});