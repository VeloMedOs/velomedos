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
    interface: "sms_gateway",
    direction: "outbound",
    status: "stub_noop",
    payload: {
      kind: "preauth_update",
      lang: args.lang,
      status: args.status,
      masked_ref: args.masked_ref,
      phone_e164_present: !!args.phone_e164,
    },
  });
}