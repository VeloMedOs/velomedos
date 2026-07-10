/**
 * Step 4 · Turn 3 — Bilingual SMS gateway stub (debt #42).
 *
 * No-op transport that logs to `interface_log`. Wire call sites at
 * `authorization_request.submitted_at` and `.decision_at` transitions.
 * Not called this turn (commented TODO hooks only).
 */
import { serviceClient } from "@/lib/api-server";

export type PreauthUpdateArgs = {
  tenant_id: string;
  phone_e164: string | null;
  lang: "en" | "ar";
  status: string;
  masked_ref: string | null;
};

export async function sendPreauthUpdate(args: PreauthUpdateArgs): Promise<void> {
  const sb = serviceClient();
  await sb.from("interface_log").insert({
    tenant_id: args.tenant_id,
    interface_name: "sms_gateway",
    direction: "outbound",
    trigger: "preauth_status_transition",
    status: "queued",
    payload: {
      kind: "preauth_update",
      transport: "stub_noop",
      lang: args.lang,
      status: args.status,
      masked_ref: args.masked_ref,
      phone_e164_present: !!args.phone_e164,
    },
  });
}

/** HCA-0062 — visit confirmation "sticker" replacement. Stub only; #42 wires gateway. */
export type VisitConfirmationArgs = {
  tenant_id: string;
  phone_e164: string | null;
  lang: "en" | "ar";
  mrn_masked: string;
  visit_at: string;
  token_number: string | null;
  clinic_name: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function sendVisitConfirmation(args: VisitConfirmationArgs, db?: any): Promise<void> {
  const sb: any = db ?? serviceClient();
  await sb.from("interface_log").insert({
    tenant_id: args.tenant_id,
    interface_name: "sms_gateway",
    direction: "outbound",
    trigger: "visit_confirmation",
    status: "queued",
    payload: {
      kind: "visit_confirmation",
      transport: "stub_noop",
      lang: args.lang,
      mrn_masked: args.mrn_masked,
      visit_at: args.visit_at,
      token_number: args.token_number,
      clinic_name: args.clinic_name,
      phone_e164_present: !!args.phone_e164,
    },
  });
}

/** HCA-0732 — bulk-cancel auto-notify. Stub only; #42 wires gateway. */
export type BulkCancelNotificationArgs = {
  tenant_id: string;
  phone_e164: string | null;
  lang: "en" | "ar";
  encounter_id: string | null;
  booking_id: string;
  reason: string;
  action: "cancel" | "reschedule" | "reassign";
  rebook_request: boolean;
};

export async function sendBulkCancelNotification(args: BulkCancelNotificationArgs, db?: any): Promise<void> {
  const sb: any = db ?? serviceClient();
  await sb.from("interface_log").insert({
    tenant_id: args.tenant_id,
    interface_name: "sms_gateway",
    direction: "outbound",
    trigger: "bulk_cancel_notification",
    status: "queued",
    payload: {
      kind: "bulk_cancel_notification",
      transport: "stub_noop",
      lang: args.lang,
      encounter_id: args.encounter_id,
      booking_id: args.booking_id,
      reason: args.reason,
      action: args.action,
      rebook_request: args.rebook_request,
      phone_e164_present: !!args.phone_e164,
    },
  });
}