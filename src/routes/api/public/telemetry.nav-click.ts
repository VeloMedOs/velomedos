import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

const ALLOWED_SURFACES = new Set(["header", "footer", "sidebar", "inline", "mobile"]);

export const Route = createFileRoute("/api/public/telemetry/nav-click")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: any;
        try { payload = await request.json(); } catch { return new Response("invalid json", { status: 400 }); }

        const event_name  = String(payload?.event_name ?? "").slice(0, 64);
        const target_path = String(payload?.target_path ?? "").slice(0, 256);
        const surface     = String(payload?.surface ?? "").slice(0, 32);
        const referrer    = payload?.referrer ? String(payload.referrer).slice(0, 512) : null;
        const locale      = payload?.locale   ? String(payload.locale).slice(0, 8)     : null;

        if (!event_name || !target_path || !ALLOWED_SURFACES.has(surface)) {
          return new Response("invalid payload", { status: 400 });
        }

        const ua = request.headers.get("user-agent") ?? "";
        const user_agent_hash = ua ? createHash("sha256").update(ua).digest("hex").slice(0, 32) : null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("nav_events").insert({
          event_name, target_path, surface, referrer, locale, user_agent_hash,
        });
        if (error) return new Response("insert failed", { status: 500 });
        return new Response(null, { status: 204 });
      },
    },
  },
});