/**
 * VeloMed OS · visual regression for live + offline map states across viewports.
 *
 * Run with: `bunx playwright test tests/visual/map-overlays.spec.ts`
 *
 * Findings are POSTed to /api/public/v1/debug/events (scope: debug:write) so the
 * Superadmin → Debug pane classifies every snapshot per business.
 */
import { test, expect, devices, type Page } from "@playwright/test";

const BASE = process.env.VELOMED_BASE_URL ?? "http://localhost:5173";
const API_KEY = process.env.VELOMED_DEBUG_API_KEY ?? "";
const TENANT  = process.env.VELOMED_TENANT_ID ?? null;

const BREAKPOINTS = [
  { id: "mobile",  viewport: { width: 390,  height: 844  } }, // iPhone 14
  { id: "tablet",  viewport: { width: 834,  height: 1112 } }, // iPad
  { id: "desktop", viewport: { width: 1440, height: 900  } },
] as const;

const STATES = [
  { id: "live",    query: "?lens=team" },
  { id: "offline", query: "?lens=team&forceOffline=1" },
] as const;

async function report(page: Page, payload: Record<string, unknown>) {
  if (!API_KEY) return;
  await page.request.post(`${BASE}/api/public/v1/debug/events`, {
    headers: { "x-api-key": API_KEY, "content-type": "application/json" },
    data: { ...payload, tenant_id: TENANT, source: "playwright" },
  }).catch(() => {});
}

for (const bp of BREAKPOINTS) {
  test.describe(`map overlays · ${bp.id}`, () => {
    test.use({ viewport: bp.viewport });
    for (const state of STATES) {
      test(`hero ${state.id}`, async ({ page }) => {
        await page.goto(`${BASE}/${state.query}`);
        await page.waitForSelector("[data-debug-id]", { timeout: 10_000 });
        await page.waitForTimeout(1200); // settle animations

        // Bounding-box overlap scan (banners vs ETA bubbles vs destination markers)
        const overlaps = await page.evaluate(() => {
          const els = Array.from(document.querySelectorAll<HTMLElement>("[data-debug-id]"));
          const rects = els.map((el) => ({ id: el.dataset.debugId!, r: el.getBoundingClientRect(), z: getComputedStyle(el).zIndex }));
          const hits: Array<{ a: string; b: string; overlapPx: number }> = [];
          for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
            const A = rects[i].r, B = rects[j].r;
            const ox = Math.max(0, Math.min(A.right, B.right) - Math.max(A.left, B.left));
            const oy = Math.max(0, Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top));
            const area = ox * oy;
            if (area > 16) hits.push({ a: rects[i].id, b: rects[j].id, overlapPx: Math.round(area) });
          }
          return { rects, hits };
        });

        await report(page, {
          kind: "snapshot",
          severity: overlaps.hits.length ? "warn" : "info",
          route: "/",
          viewport: bp.id,
          message: `${state.id} · ${overlaps.hits.length} overlap(s)`,
          payload: { state: state.id, breakpoint: bp.id, ...overlaps },
        });

        expect(overlaps.hits, `Overlay stacking glitches: ${JSON.stringify(overlaps.hits)}`).toEqual([]);
        await expect(page).toHaveScreenshot(`hero-${state.id}-${bp.id}.png`, {
          fullPage: false,
          maxDiffPixelRatio: 0.02,
        });
      });
    }
  });
}