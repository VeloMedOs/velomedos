// @ts-expect-error — bun-types conflict shared with billed-gate.test.ts
import { describe, expect, it } from "bun:test";
import type { DoctorWorklistRow, FormsWorklistRow } from "@/lib/clinical-api";
import {
  coderFilter, mrdCosignFilter, frontOfficeFilter, admissionFilter,
  floorManagerFilter, transferDischargeFilter, emsFilter, pharmacistFilter,
  urgencyMatches,
} from "./module-filters";

function d(overrides: Partial<DoctorWorklistRow>): DoctorWorklistRow {
  return {
    tenant_id: "t", encounter_id: "e", class: "AMB",
    encounter_number: null, status: "in_progress", journey_state: "encounter_open",
    period_start: new Date().toISOString(), waiting_seconds: 100,
    beneficiary_id: "b", mrn: null, name: null, age: null, gender: null,
    token: null, is_vip: false,
    dnr_flag: null, isolation_precaution: null, discharge_disposition: null, ems_status: null,
    billed_orders: 0, released_orders: 0, locked_orders: 0,
    pending_authorizations: 0, unread_rcm_comms: 0,
    attending_physician: null,
    ...overrides,
  } as DoctorWorklistRow;
}
function f(overrides: Partial<FormsWorklistRow>): FormsWorklistRow {
  return {
    tenant_id: "t", instance_id: "i", encounter_id: "e", class: "AMB",
    form_def_id: "fd", code: "x", title: "T",
    trigger_type: "post", gate_type: "post_order",
    classification: "nurse", assigned_role: "nurse",
    status: "pending", due_at: null, is_overdue: false, overdue_days: 0,
    mandatory: false, cosign_required: false,
    submitted_at: null, cosigned_at: null, created_at: new Date().toISOString(),
    ...overrides,
  } as FormsWorklistRow;
}

describe("urgencyMatches", () => {
  it("stat = ≥60min", () => expect(urgencyMatches(d({ waiting_seconds: 3700 }), "stat")).toBe(true));
  it("urgent = 30..60min", () => expect(urgencyMatches(d({ waiting_seconds: 2000 }), "urgent")).toBe(true));
  it("routine = <30min", () => expect(urgencyMatches(d({ waiting_seconds: 100 }), "routine")).toBe(true));
  it("all = pass", () => expect(urgencyMatches(d({}), "all")).toBe(true));
});

describe("coderFilter", () => {
  it("keeps finished+discharged", () => expect(coderFilter([d({ status: "finished", journey_state: "discharged" })])).toHaveLength(1));
  it("drops in_progress", () => expect(coderFilter([d({ status: "in_progress", journey_state: "discharged" })])).toHaveLength(0));
  it("drops finished without discharged journey", () => expect(coderFilter([d({ status: "finished", journey_state: "encounter_open" })])).toHaveLength(0));
});

describe("mrdCosignFilter", () => {
  it("keeps overdue rows", () => expect(mrdCosignFilter([f({ is_overdue: true })])).toHaveLength(1));
  it("keeps submitted cosign backlog", () => expect(mrdCosignFilter([f({ status: "submitted", cosign_required: true, cosigned_at: null })])).toHaveLength(1));
  it("drops submitted cosigned", () => expect(mrdCosignFilter([f({ status: "submitted", cosign_required: true, cosigned_at: new Date().toISOString() })])).toHaveLength(0));
  it("drops pending non-overdue", () => expect(mrdCosignFilter([f({ status: "pending", cosign_required: true })])).toHaveLength(0));
});

describe("frontOfficeFilter", () => {
  it("keeps registered", () => expect(frontOfficeFilter([d({ journey_state: "registered" })])).toHaveLength(1));
  it("keeps encounter_open", () => expect(frontOfficeFilter([d({ journey_state: "encounter_open" })])).toHaveLength(1));
  it("drops admitted", () => expect(frontOfficeFilter([d({ journey_state: "admitted" })])).toHaveLength(0));
});

describe("admissionFilter", () => {
  it("keeps IMP pre-admission", () => expect(admissionFilter([d({ class: "IMP", journey_state: "clinically_documented" })])).toHaveLength(1));
  it("drops AMB", () => expect(admissionFilter([d({ class: "AMB", journey_state: "encounter_open" })])).toHaveLength(0));
  it("drops IMP admitted", () => expect(admissionFilter([d({ class: "IMP", journey_state: "admitted" })])).toHaveLength(0));
});

describe("floorManagerFilter", () => {
  it("keeps IMP admitted", () => expect(floorManagerFilter([d({ class: "IMP", journey_state: "admitted" })])).toHaveLength(1));
  it("drops IMP discharged", () => expect(floorManagerFilter([d({ class: "IMP", journey_state: "discharged" })])).toHaveLength(0));
  it("drops EMER admitted (wrong class)", () => expect(floorManagerFilter([d({ class: "EMER", journey_state: "admitted" })])).toHaveLength(0));
});

describe("transferDischargeFilter", () => {
  it("keeps IMP admitted", () => expect(transferDischargeFilter([d({ class: "IMP", journey_state: "admitted" })])).toHaveLength(1));
  it("keeps IMP discharged", () => expect(transferDischargeFilter([d({ class: "IMP", journey_state: "discharged" })])).toHaveLength(1));
  it("drops IMP registered", () => expect(transferDischargeFilter([d({ class: "IMP", journey_state: "registered" })])).toHaveLength(0));
});

describe("emsFilter", () => {
  it("keeps EMER", () => expect(emsFilter([d({ class: "EMER" })])).toHaveLength(1));
  it("drops AMB", () => expect(emsFilter([d({ class: "AMB" })])).toHaveLength(0));
  it("drops IMP", () => expect(emsFilter([d({ class: "IMP" })])).toHaveLength(0));
});

describe("pharmacistFilter", () => {
  it("keeps rows with released_orders", () => expect(pharmacistFilter([d({ released_orders: 2 })])).toHaveLength(1));
  it("keeps rows with locked_orders", () => expect(pharmacistFilter([d({ locked_orders: 1 })])).toHaveLength(1));
  it("keeps rows with pending_authorizations", () => expect(pharmacistFilter([d({ pending_authorizations: 1 })])).toHaveLength(1));
  it("drops empty rows", () => expect(pharmacistFilter([d({})])).toHaveLength(0));
});