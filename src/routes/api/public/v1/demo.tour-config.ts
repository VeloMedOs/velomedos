import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, serviceClient } from "@/lib/api-server";
import { readDemoVideosEnabled } from "@/lib/platform-settings.functions";

/**
 * Public config for /demo-tour. Reads the `demo_videos_enabled` jsonb wrapper
 * shape `{ enabled: boolean }` from `platform_settings`. Always accessed via
 * `.value.enabled` (Batch2-W2), never as bare boolean.
 */
export const Route = createFileRoute("/api/public/v1/demo/tour-config")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (serviceClient() as any)
          .from("platform_settings")
          .select("value")
          .eq("key", "demo_videos_enabled")
          .maybeSingle();
        return json({ videos_enabled: readDemoVideosEnabled(data?.value) });
      },
    },
  },
});