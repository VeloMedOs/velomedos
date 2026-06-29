/**
 * RCM Phase R1 — pure-function state machine for visit eligibility.
 *
 * Drives the 19-step lifecycle from `3_1`:
 *   new → checking → eligible | not_eligible | error
 *   not_eligible → exception_review → exception_approved → activation_pending → activated → insured
 *   eligible → insured
 *   any → self_pay | cancelled (with the appropriate reason)
 *
 * The state machine is intentionally side-effect-free: it returns the next
 * status + a reason code. Persistence + audit live in `eligibility-engine.ts`.
 */

export type EligibilityStatus =
  | "new"
  | "checking"
  | "eligible"
  | "not_eligible"
  | "error"
  | "exception_review"
  | "exception_approved"
  | "activation_pending"
  | "activated"
  | "insured"
  | "self_pay"
  | "cancelled";

export type EligibilityEvent =
  | { kind: "check.start" }
  | { kind: "check.success"; inforce: boolean }
  | { kind: "check.error"; reason: string }
  | { kind: "exception.raise"; exception_type: "referral" | "emergency" | "newborn" }
  | { kind: "exception.approve" }
  | { kind: "exception.reject"; reason: string }
  | { kind: "activation.request" }
  | { kind: "activation.complete" }
  | { kind: "activation.reject"; reason: string }
  | { kind: "select.self_pay"; reason: string }
  | { kind: "cancel"; reason: string };

export type Transition = {
  ok: true;
  next: EligibilityStatus;
  reason?: string;
  /** Side-effects the engine should perform after persisting. */
  effects: Array<
    | { kind: "notify"; topic: string }
    | { kind: "lock_financial_type"; value: "insurance" | "self_pay" }
  >;
} | {
  ok: false;
  error: string;
  code: string;
};

const TERMINAL: ReadonlySet<EligibilityStatus> = new Set(["insured", "self_pay", "cancelled"]);

/** Pure transition function. Mirrors §3.1 step diagram. */
export function transition(
  current: EligibilityStatus,
  event: EligibilityEvent,
): Transition {
  if (TERMINAL.has(current) && event.kind !== "cancel") {
    return { ok: false, error: `Eligibility is terminal (${current})`, code: "eligibility_terminal" };
  }

  switch (event.kind) {
    case "check.start":
      if (current !== "new" && current !== "error" && current !== "not_eligible") {
        return { ok: false, error: `Cannot re-check from ${current}`, code: "eligibility_invalid_transition" };
      }
      return { ok: true, next: "checking", effects: [] };

    case "check.success":
      if (current !== "checking") {
        return { ok: false, error: `check.success requires checking (got ${current})`, code: "eligibility_invalid_transition" };
      }
      if (event.inforce) {
        return {
          ok: true,
          next: "insured",
          effects: [
            { kind: "lock_financial_type", value: "insurance" },
            { kind: "notify", topic: "eligibility.activated" },
          ],
        };
      }
      return { ok: true, next: "not_eligible", reason: "payer_not_inforce", effects: [] };

    case "check.error":
      if (current !== "checking") {
        return { ok: false, error: `check.error requires checking (got ${current})`, code: "eligibility_invalid_transition" };
      }
      return { ok: true, next: "error", reason: event.reason, effects: [] };

    case "exception.raise":
      if (current !== "not_eligible" && current !== "error") {
        return { ok: false, error: `Exception requires not_eligible/error (got ${current})`, code: "eligibility_invalid_transition" };
      }
      return {
        ok: true,
        next: "exception_review",
        reason: `exception:${event.exception_type}`,
        effects: [{ kind: "notify", topic: "eligibility.exception_review" }],
      };

    case "exception.approve":
      if (current !== "exception_review") {
        return { ok: false, error: `Approve requires exception_review (got ${current})`, code: "eligibility_invalid_transition" };
      }
      return { ok: true, next: "exception_approved", effects: [] };

    case "exception.reject":
      if (current !== "exception_review") {
        return { ok: false, error: `Reject requires exception_review (got ${current})`, code: "eligibility_invalid_transition" };
      }
      return { ok: true, next: "not_eligible", reason: event.reason, effects: [] };

    case "activation.request":
      if (current !== "exception_approved" && current !== "not_eligible") {
        return { ok: false, error: `Activation requires exception_approved/not_eligible (got ${current})`, code: "eligibility_invalid_transition" };
      }
      return {
        ok: true,
        next: "activation_pending",
        effects: [{ kind: "notify", topic: "eligibility.activation_request" }],
      };

    case "activation.complete":
      if (current !== "activation_pending") {
        return { ok: false, error: `Activate requires activation_pending (got ${current})`, code: "eligibility_invalid_transition" };
      }
      return {
        ok: true,
        next: "insured",
        effects: [
          { kind: "lock_financial_type", value: "insurance" },
          { kind: "notify", topic: "eligibility.activated" },
        ],
      };

    case "activation.reject":
      if (current !== "activation_pending") {
        return { ok: false, error: `Activation reject requires activation_pending (got ${current})`, code: "eligibility_invalid_transition" };
      }
      return { ok: true, next: "not_eligible", reason: event.reason, effects: [] };

    case "select.self_pay":
      return {
        ok: true,
        next: "self_pay",
        reason: event.reason,
        effects: [{ kind: "lock_financial_type", value: "self_pay" }],
      };

    case "cancel":
      return { ok: true, next: "cancelled", reason: event.reason, effects: [] };
  }
}

export const isTerminal = (s: EligibilityStatus): boolean => TERMINAL.has(s);