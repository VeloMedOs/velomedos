/**
 * Step 3 · Turn 2 — shared scheduler helpers.
 *
 * Single source of truth for:
 *  - the bounce/ok envelope shape scheduler routes emit;
 *  - the drop-validate business-check sequence codes (must match
 *    SCHEDULER_ERROR in ./validation.ts);
 *  - column-sort comparator used by the OPD SuiteConfig, exported so unit
 *    tests can call it directly.
 */
import { SCHEDULER_ERROR, type SchedulerErrorKey } from "./validation";

/** JSON envelope helpers shared across all seven scheduler routes. */
export function bounce(key: SchedulerErrorKey, extra?: Record<string, unknown>): Response {
  const { code, http } = SCHEDULER_ERROR[key];
  return new Response(
    JSON.stringify({ error: code, code, request_id: crypto.randomUUID(), ...(extra ?? {}) }),
    { status: http, headers: { "content-type": "application/json" } },
  );
}

export function ok<T>(data: T, extra?: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({ ok: true, data, request_id: crypto.randomUUID(), ...(extra ?? {}) }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

/**
 * HCA-0050 column-order comparator.
 * priority_rank ASC NULLS LAST, then providers.display_name ASC (locale-aware).
 * Exported for column-sort.test.ts.
 */
export type BoardColumn = {
  session_id: string;
  priority_rank: number | null;
  provider_display_name: string;
};

export function columnSort(a: BoardColumn, b: BoardColumn): number {
  const ar = a.priority_rank ?? Number.POSITIVE_INFINITY;
  const br = b.priority_rank ?? Number.POSITIVE_INFINITY;
  if (ar !== br) return ar - br;
  return a.provider_display_name.localeCompare(b.provider_display_name);
}

/** OPD duration lookup: service_master.approx_perform_minutes ?? slot_duration_min. Debt #19. */
export function opdVisitDurationMin(
  service: { approx_perform_minutes?: number | null } | null,
  schedule: { slot_duration_min: number },
): number {
  return service?.approx_perform_minutes ?? schedule.slot_duration_min;
}