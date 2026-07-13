/**
 * Platform settings reader. `platform_settings` is a key/value jsonb store.
 * The `demo_videos_enabled` row stores `{ enabled: boolean }` (Round 1
 * Batch2-W2: always access `.value.enabled`, not `.value` directly).
 */
import { createServerFn } from "@tanstack/react-start";

export const getDemoVideosEnabled = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any)
    .from("platform_settings")
    .select("value")
    .eq("key", "demo_videos_enabled")
    .maybeSingle();
  const raw = data?.value as { enabled?: boolean } | boolean | null | undefined;
  const enabled =
    typeof raw === "object" && raw !== null
      ? Boolean((raw as { enabled?: boolean }).enabled)
      : Boolean(raw);
  return { enabled };
});

/** Pure helper — reads `.value.enabled` from the jsonb wrapper shape. Exported
 *  for unit tests so the jsonb access shape is asserted in isolation. */
export function readDemoVideosEnabled(value: unknown): boolean {
  if (value && typeof value === "object" && "enabled" in (value as object)) {
    return Boolean((value as { enabled?: unknown }).enabled);
  }
  return Boolean(value);
}