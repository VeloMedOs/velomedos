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

/** HCA-0979 — inter-company referral notification. Stub only; #42 wires gateway.
 * Restores Convention #27 parity: inter-company route no longer writes
 * `interface_log` inline — it calls this stub. */
export type InterCompanyReferralNotificationArgs = {
  tenant_id: string;
  sibling_tenant_id: string;
  referral_id: string;
  target_id: string;
  lang?: "en" | "ar";
};

export async function sendInterCompanyReferralNotification(
  args: InterCompanyReferralNotificationArgs,
  db?: any,
): Promise<void> {
  const sb: any = db ?? serviceClient();
  await sb.from("interface_log").insert({
    tenant_id: args.tenant_id,
    interface_name: "sms_gateway",
    direction: "outbound",
    trigger: "inter_company_referral_notification",
    status: "queued",
    payload: {
      kind: "inter_company_referral_notification",
      transport: "stub_noop",
      lang: args.lang ?? "en",
      referral_id: args.referral_id,
      target_id: args.target_id,
      sibling_tenant_id: args.sibling_tenant_id,
    },
  });
}

/** Platform Governance Round 1 — Business intake acknowledgment. Stub only. */
export type BusinessIntakeAcknowledgmentArgs = {
  contact_phone: string | null;
  contact_email: string;
  company_name: string;
  request_id: string;
  lang?: "en" | "ar";
};

export async function sendBusinessIntakeAcknowledgment(
  args: BusinessIntakeAcknowledgmentArgs,
  db?: any,
): Promise<void> {
  const sb: any = db ?? serviceClient();
  // No tenant_id yet — this is a platform-level event. Store under a NULL
  // tenant. If interface_log requires tenant_id, log to console and skip.
  try {
    await sb.from("interface_log").insert({
      tenant_id: null,
      interface_name: "sms_gateway",
      direction: "outbound",
      trigger: "business_intake_ack",
      status: "queued",
      payload: {
        kind: "business_intake_ack",
        transport: "stub_noop",
        lang: args.lang ?? "en",
        request_id: args.request_id,
        company_name: args.company_name,
        contact_email_present: !!args.contact_email,
        contact_phone_present: !!args.contact_phone,
      },
    });
  } catch {
    // best-effort — platform-level log surface pending
  }
}