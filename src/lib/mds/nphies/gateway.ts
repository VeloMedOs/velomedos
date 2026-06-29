/**
 * Phase 9 — NPHIES gateway client.
 *
 * Message-agnostic transport for FHIR Bundles posted to the NPHIES
 * `$process-message` endpoint. Used by claim submission, eligibility
 * checks, and future preauth/payment-reconciliation flows.
 *
 * When NPHIES_BASE_URL is not configured the client returns a deterministic
 * sandbox Bundle so end-to-end flows remain demoable without real CHI
 * credentials. The downstream persistence + reconciliation paths are
 * identical for sandbox and live responses.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { isDemoTenant } from "@/lib/demo-mode";
import { logInterface } from "@/lib/interface-log";

type TokenCache = { token: string; expires_at: number } | null;
let tokenCache: TokenCache = null;

export type GatewayResult = {
  ok: boolean;
  http_status: number;
  sandbox: boolean;
  bundle: any;
  error?: string;
};

function envConfig() {
  return {
    baseUrl: process.env.NPHIES_BASE_URL,
    clientId: process.env.NPHIES_CLIENT_ID,
    clientSecret: process.env.NPHIES_CLIENT_SECRET,
    scopes: process.env.NPHIES_SCOPES ?? "system/*.write",
    tokenUrl: process.env.NPHIES_TOKEN_URL,
  };
}

async function getToken(): Promise<string | null> {
  const cfg = envConfig();
  if (!cfg.tokenUrl || !cfg.clientId || !cfg.clientSecret) return null;
  const now = Date.now();
  if (tokenCache && tokenCache.expires_at - 60_000 > now) return tokenCache.token;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: cfg.scopes,
  });
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`nphies_token_failed: ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in?: number };
  tokenCache = {
    token: j.access_token,
    expires_at: now + (j.expires_in ?? 3000) * 1000,
  };
  return tokenCache.token;
}

/**
 * Generic message envelope. All NPHIES messages (claim, eligibility, preauth,
 * payment) ride this single transport.
 */
export async function sendBundle(
  bundle: any,
  opts: { idempotencyKey: string; messageType: string; timeoutMs?: number; tenantId?: string | null },
): Promise<GatewayResult> {
  const cfg = envConfig();
  // Demo tenants are forced to sandbox even when credentials are present.
  if (opts.tenantId && (await isDemoTenant(opts.tenantId))) {
    const stub = stubResponse(bundle, opts.messageType);
    await logInterface({
      tenantId: opts.tenantId,
      messageType: `nphies.${opts.messageType}`,
      idempotencyKey: opts.idempotencyKey,
      sandbox: true,
      httpStatus: stub.http_status,
      outcome: stub.ok ? "ok" : "error",
      requestBody: bundle,
      responseBody: stub.bundle,
    });
    return stub;
  }
  if (!cfg.baseUrl) return stubResponse(bundle, opts.messageType);

  const timeout = opts.timeoutMs ?? 30_000;
  const url = `${cfg.baseUrl.replace(/\/$/, "")}/$process-message`;
  const headers: Record<string, string> = {
    "content-type": "application/fhir+json",
    accept: "application/fhir+json",
    "x-idempotency-key": opts.idempotencyKey,
    "x-message-type": opts.messageType,
  };
  try {
    const tok = await getToken();
    if (tok) headers["authorization"] = `Bearer ${tok}`;
  } catch (e: any) {
    return { ok: false, http_status: 0, sandbox: false, bundle: null, error: e?.message ?? "token_error" };
  }

  const attempt = async (): Promise<GatewayResult> => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(bundle),
        signal: controller.signal,
      });
      const text = await res.text();
      let parsed: any = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
      return {
        ok: res.ok,
        http_status: res.status,
        sandbox: false,
        bundle: parsed,
        error: res.ok ? undefined : `http_${res.status}`,
      };
    } catch (e: any) {
      return { ok: false, http_status: 0, sandbox: false, bundle: null, error: e?.message ?? "network_error" };
    } finally {
      clearTimeout(t);
    }
  };

  const first = await attempt();
  if (first.ok || (first.http_status > 0 && first.http_status < 500)) return first;
  // single retry on 5xx / network
  return attempt();
}

/* -------------- typed helpers -------------- */

export function submitClaim(bundle: any, idempotencyKey: string, tenantId?: string | null): Promise<GatewayResult> {
  return sendBundle(bundle, { idempotencyKey, messageType: "claim-request", tenantId });
}

export function submitEligibility(bundle: any, idempotencyKey: string, tenantId?: string | null): Promise<GatewayResult> {
  return sendBundle(bundle, { idempotencyKey, messageType: "eligibility-request", tenantId });
}

/* -------------- sandbox stub -------------- */

function stubResponse(requestBundle: any, messageType: string): GatewayResult {
  if (messageType === "eligibility-request") {
    return {
      ok: true,
      http_status: 200,
      sandbox: true,
      bundle: {
        resourceType: "Bundle",
        type: "message",
        sandbox: true,
        entry: [
          {
            resource: {
              resourceType: "CoverageEligibilityResponse",
              status: "active",
              outcome: "complete",
              insurance: [{ inforce: true, item: [] }],
            },
          },
        ],
      },
    };
  }
  // claim — mirror the Claim's totals back as an "accepted" ClaimResponse
  const claimEntry = (requestBundle?.entry ?? []).find(
    (e: any) => e?.resource?.resourceType === "Claim",
  );
  const claim = claimEntry?.resource ?? {};
  const items = (claim.item ?? []).map((i: any) => ({
    itemSequence: i.sequence,
    adjudication: [
      {
        category: { coding: [{ code: "benefit" }] },
        amount: i.net,
      },
      {
        category: { coding: [{ code: "eligible" }] },
        amount: i.net,
      },
    ],
  }));
  const total = claim.total ?? { value: 0, currency: "SAR" };
  return {
    ok: true,
    http_status: 200,
    sandbox: true,
    bundle: {
      resourceType: "Bundle",
      type: "message",
      sandbox: true,
      timestamp: new Date().toISOString(),
      entry: [
        {
          resource: {
            resourceType: "ClaimResponse",
            status: "active",
            outcome: "complete",
            disposition: "Sandbox auto-adjudication",
            identifier: [
              { system: "urn:sandbox:nphies:claim", value: `SBX-${crypto.randomUUID()}` },
            ],
            item: items,
            total: [
              { category: { coding: [{ code: "submitted" }] }, amount: total },
              { category: { coding: [{ code: "benefit" }] }, amount: total },
            ],
            payment: { amount: total },
          },
        },
      ],
    },
  };
}