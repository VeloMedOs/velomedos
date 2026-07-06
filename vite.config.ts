// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { visualizer } from "rollup-plugin-visualizer";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

const ANALYZE = process.env.ANALYZE === "true" || process.env.ANALYZE === "1";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // NOTE: prerender intentionally disabled. TanStack Start's prerender preview-server
    // looks for `dist/server/server.js`, but our Nitro/Cloudflare build emits
    // `dist/server/index.mjs`, which breaks the build. SSR already returns complete
    // HTML on first byte for our public routes, so crawlers still get full markup.
  },
  vite: {
    plugins: [mcpPlugin()],
    build: {
      rollupOptions: {
        plugins: ANALYZE
          ? [
              visualizer({
                filename: "dist/bundle-report.html",
                template: "treemap",
                gzipSize: true,
                brotliSize: true,
                open: false,
              }) as unknown as never,
            ]
          : [],
      },
    },
  },
});
