// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handleGET } from "../scheduler.booking-requests";
import { CTX_ADMIN, TENANT, readBody } from "./_seed";
import { makeMockDb } from "@/test/db-mock";

/**
 * DD3 four-clause union — asserts three populated clauses surface as rows
 * with a populated mrn field, and three exclusion controls stay filtered out.
 */
describe("scheduler.booking-requests — DD3 union + exclusion controls", () => {
  it("returns 3 populated rows (referral, rebook, portal); excludes 3 controls", async () => {
    const now = Date.now();
    const yesterday = new Date(now - 86400_000).toISOString();
    const longAgo = new Date(now - 45 * 86400_000).toISOString();

    const { client } = makeMockDb({
      tables: {
        // (a) referral clause
        referral_target: [{
          id: "rt1", tenant_id: TENANT, referral_id: "ref1",
          target_kind: "specialty", target_specialty: "OBS&GYN",
          status: "submitted", booked_appointment_id: null,
        }],
        referral: [{ id: "ref1", source_encounter_id: "enc1" }],
        encounter: [{ id: "enc1", beneficiary_id: "ben1" }],
        // (c) rebook (populated) + exclusions
        clinic_bookings: [
          { id: "bk_rebook", tenant_id: TENANT, status: "cancelled",
            no_show: false, rebook_request: true, cancelled_at: yesterday,
            schedule_id: "sch1", beneficiary_id: "ben2" },
          // exclusion: no_show=true
          { id: "bk_ns", tenant_id: TENANT, status: "cancelled",
            no_show: true, rebook_request: true, cancelled_at: yesterday,
            schedule_id: "sch1", beneficiary_id: "ben_ns" },
          // exclusion: rebook_request=false
          { id: "bk_nofr", tenant_id: TENANT, status: "cancelled",
            no_show: false, rebook_request: false, cancelled_at: yesterday,
            schedule_id: "sch1", beneficiary_id: "ben_nofr" },
          // exclusion: cancelled > 30 days
          { id: "bk_old", tenant_id: TENANT, status: "cancelled",
            no_show: false, rebook_request: true, cancelled_at: longAgo,
            schedule_id: "sch1", beneficiary_id: "ben_old" },
          // (d) portal (populated) — marketing + not confirmed
          { id: "bk_portal", tenant_id: TENANT, status: "requested",
            source: "marketing", confirmed_at: null,
            schedule_id: "sch1", beneficiary_id: "ben3", no_show: false,
            rebook_request: false },
        ],
        // aliased for `schedule:schedule_id ( specialty )` nested join
        schedule: [{ id: "sch1", specialty: "OBS&GYN" }],
        beneficiary: [
          { id: "ben1", patient_file_no: "MRN-001", full_name: "Referral One",
            contact_number: null, dob: null, gender: "female" },
          { id: "ben2", patient_file_no: "MRN-002", full_name: "Rebook Two",
            contact_number: null, dob: null, gender: "female" },
          { id: "ben3", patient_file_no: "MRN-003", full_name: "Portal Three",
            contact_number: null, dob: null, gender: "male" },
          { id: "ben_ns",   patient_file_no: "MRN-NS",   full_name: "No-show ctl", contact_number: null, dob: null, gender: "male" },
          { id: "ben_nofr", patient_file_no: "MRN-NOFR", full_name: "No-rebook ctl", contact_number: null, dob: null, gender: "male" },
          { id: "ben_old",  patient_file_no: "MRN-OLD",  full_name: "Old cancel ctl", contact_number: null, dob: null, gender: "male" },
        ],
      },
    });

    const res = await handleGET({ ctx: CTX_ADMIN, db: client });
    const j = await readBody(res);
    expect(j.ok).toBe(true);
    const rows: Array<{ mrn: string | null; kind: string }> = j.data.rows;
    expect(rows.length).toBe(3);
    const mrns = rows.map((r) => r.mrn).sort();
    expect(mrns).toEqual(["MRN-001", "MRN-002", "MRN-003"]);
    // No excluded MRN surfaces.
    expect(rows.some((r) => r.mrn === "MRN-NS")).toBe(false);
    expect(rows.some((r) => r.mrn === "MRN-NOFR")).toBe(false);
    expect(rows.some((r) => r.mrn === "MRN-OLD")).toBe(false);
    // Every row carries an mrn field.
    for (const r of rows) expect(r.mrn).toBeTruthy();
  });
});