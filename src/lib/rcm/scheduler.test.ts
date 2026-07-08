/**
 * Step 3 · Turn 3 — Scheduler pure-helper fixtures.
 *
 * Runs under `bun test`. Covers the pieces that don't require a live DB:
 *   - column-sort HCA-0050 ordering
 *   - opdVisitDurationMin fallback (Debt #19)
 *   - bounce/ok envelope shape
 *   - SCHEDULER_ERROR keys used by Turn 3 routes exist
 */
// @ts-expect-error — bun-types conflicts with @supabase/supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { columnSort, opdVisitDurationMin, bounce, ok } from "./scheduler";
import { SCHEDULER_ERROR } from "./validation";

describe("scheduler.columnSort — HCA-0050", () => {
  it("priority_rank ASC NULLS LAST, then display_name ASC", () => {
    const cols = [
      { session_id: "d", priority_rank: null, provider_display_name: "Ahmad" },
      { session_id: "a", priority_rank: 1,    provider_display_name: "Zara" },
      { session_id: "b", priority_rank: 3,    provider_display_name: "Bilal" },
      { session_id: "c", priority_rank: 1,    provider_display_name: "Ali" },
    ];
    const sorted = [...cols].sort(columnSort).map((c) => c.session_id);
    // rank 1 first (Ali < Zara), then rank 3, then null.
    expect(sorted).toEqual(["c", "a", "b", "d"]);
  });
});

describe("scheduler.opdVisitDurationMin — Debt #19", () => {
  it("uses service.approx_perform_minutes when set", () => {
    expect(opdVisitDurationMin({ approx_perform_minutes: 45 }, { slot_duration_min: 20 })).toBe(45);
  });
  it("falls back to schedule.slot_duration_min when null", () => {
    expect(opdVisitDurationMin(null, { slot_duration_min: 20 })).toBe(20);
    expect(opdVisitDurationMin({ approx_perform_minutes: null }, { slot_duration_min: 15 })).toBe(15);
  });
});

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return JSON.parse(await res.text()) as Record<string, unknown>;
}

describe("scheduler.bounce / ok envelopes", () => {
  it("bounce emits {error, code, request_id} with mapped http status", async () => {
    const res = bounce("SLOT_CAPACITY_FULL");
    expect(res.status).toBe(422);
    const body = await readJson(res);
    expect(body.code).toBe("slot_capacity_full");
    expect(body.error).toBe("slot_capacity_full");
    expect(typeof body.request_id).toBe("string");
  });

  it("ok wraps payload as {ok:true, data, request_id}", async () => {
    const res = ok({ booking_id: "b1" });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.ok).toBe(true);
    expect((body.data as { booking_id: string }).booking_id).toBe("b1");
  });
});

describe("SCHEDULER_ERROR — Turn 3 additions", () => {
  it("includes the 3 new codes required by Turn-3 routes", () => {
    expect(SCHEDULER_ERROR.NOT_FOUND.http).toBe(404);
    expect(SCHEDULER_ERROR.INVALID_BLOCK_REASON.http).toBe(422);
    expect(SCHEDULER_ERROR.INVALID_STATUS_TRANSITION.http).toBe(409);
  });

  it("keeps BOOKING_CONFIRM_ELIGIBILITY_PENDING as 409", () => {
    expect(SCHEDULER_ERROR.BOOKING_CONFIRM_ELIGIBILITY_PENDING.http).toBe(409);
    expect(SCHEDULER_ERROR.NO_COVERAGE_FOR_ELIGIBILITY.http).toBe(422);
  });

  it("SLOT_REPEAT_BLOCK_14D is intentionally absent — Rule B/C is DISPLAY-only", () => {
    expect((SCHEDULER_ERROR as Record<string, unknown>).SLOT_REPEAT_BLOCK_14D).toBeUndefined();
  });
});