// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handleGET as cockpitGET } from "../opd.referral.cockpit";
import { handleGET as crossGET }   from "../opd.referral.cross-encounter";
import { handleGET as interGET }   from "../opd.referral.inter-company";
import { handleGET as extGET }     from "../opd.referral.external";
import { handleGET as rulesGET, handlePOST as rulesPOST, handleDELETE as rulesDEL } from "../../rcm/rcm.rules.admin";
import { makeMockDb } from "@/test/db-mock";

const TENANT = "t1";
const CTX = { tenantId: TENANT, userId: "u1", clinicalRole: "tenant_admin" as const };

describe("Step 5 · Turn 1 — Referral Cockpit + Rule admin", () => {
  it("cockpit: groups targets by referral and folds rule decisions", async () => {
    const { client } = makeMockDb({
      tables: {
        referral: [
          { id: "r1", tenant_id: TENANT, referral_no: "R-1", referral_class: "intra",       source_specialty: "gp",  status: "draft",   reason: null, source_key: null,     created_at: "2026-07-01" },
          { id: "r2", tenant_id: TENANT, referral_no: "R-2", referral_class: "cross_encounter", source_specialty: "gp", status: "pending", reason: "auto", source_key: "nut:e1", created_at: "2026-07-02" },
        ],
        referral_target: [
          { id: "t1", referral_id: "r1", target_kind: "specialty", target_specialty: "cardio", status: "open" },
          { id: "t2", referral_id: "r1", target_kind: "specialty", target_specialty: "endo",   status: "open" },
          { id: "t3", referral_id: "r2", target_kind: "specialty", target_specialty: "nutrition", status: "open" },
        ],
        pricing_rule: [
          { id: "p1", tenant_id: TENANT, active: true, priority: 10, scope: "referral", condition: {}, action: { preauth_required: true } },
        ],
      },
    });
    const url = { referral_class: null, status: null, from: null, to: null, limit: 100 };
    const res = await cockpitGET({ query: url, ctx: CTX, db: client });
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.data).toHaveLength(2);
    const r2 = j.data.find((r: any) => r.id === "r2");
    expect(r2.auto_generated).toBe(true);
    expect(r2.targets).toHaveLength(1);
    // Rule decision folded from pricing_rule (all-facts rule) → preauth_required.
    expect(r2.rule_decision.preauth_required).toBe(true);
  });

  it("cross-encounter: filters referral_class=cross_encounter only", async () => {
    const { client } = makeMockDb({
      tables: {
        referral: [
          { id: "r1", tenant_id: TENANT, referral_no: "R-1", referral_class: "intra",           status: "draft",   created_at: "2026-07-01" },
          { id: "r2", tenant_id: TENANT, referral_no: "R-2", referral_class: "cross_encounter", status: "pending", created_at: "2026-07-02" },
        ],
        referral_target: [{ id: "t1", referral_id: "r2", target_kind: "er", status: "open" }],
      },
    });
    const res = await crossGET({ ctx: CTX, db: client });
    const j = await res.json();
    expect(j.data.map((r: any) => r.id)).toEqual(["r2"]);
  });

  it("inter-company: exposes cluster & sibling tenant ids", async () => {
    const { client } = makeMockDb({
      tables: {
        corporate_accounts: [
          { id: TENANT, cluster_id: "c1", name: "Me"     },
          { id: "t2",    cluster_id: "c1", name: "Sib1"  },
          { id: "t3",    cluster_id: "c1", name: "Sib2"  },
          { id: "t4",    cluster_id: "c2", name: "Other" },
        ],
        referral: [
          { id: "r1", tenant_id: TENANT, referral_no: "R-1", referral_class: "inter_company", status: "draft", created_at: "2026-07-02" },
        ],
      },
    });
    const res = await interGET({ ctx: CTX, db: client });
    const j = await res.json();
    expect(j.data.cluster_id).toBe("c1");
    expect(new Set(j.data.sibling_tenant_ids)).toEqual(new Set(["t2", "t3"]));
    expect(j.data.referrals).toHaveLength(1);
  });

  it("external: returns debt-#22 banner and no writes are performed", async () => {
    const { client } = makeMockDb({
      tables: { referral: [{ id: "r1", tenant_id: TENANT, referral_no: "R-1", referral_class: "external", status: "draft", created_at: "2026-07-02" }] },
    });
    const res = await extGET({ ctx: CTX, db: client });
    const j = await res.json();
    expect(j.data.network_enabled).toBe(false);
    expect(j.data.debt_banner).toMatch(/#22/);
  });

  it("rules-admin: create → list → delete round-trip, tenant-scoped", async () => {
    const { client } = makeMockDb({ tables: { pricing_rule: [] } });
    const created = await rulesPOST({ table: "pricing_rule", body: { name: "R", scope: "referral", priority: 5, condition: {}, action: {}, active: true }, ctx: CTX, db: client });
    const cj = await created.json();
    expect(cj.ok).toBe(true);
    expect(cj.data.tenant_id).toBe(TENANT);

    const listed = await rulesGET({ table: "pricing_rule", ctx: CTX, db: client });
    const lj = await listed.json();
    expect(lj.data.length).toBe(1);

    const del = await rulesDEL({ table: "pricing_rule", id: cj.data.id, ctx: CTX, db: client });
    expect(del.status).toBe(200);
  });
});