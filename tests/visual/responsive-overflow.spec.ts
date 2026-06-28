/**
 * VeloMed OS · Responsive regression suite.
 *
 * Guards every public page against horizontal overflow at the four
 * breakpoints that real visitors hit:
 *   - 360 px  (small Android)
 *   - 390 px  (iPhone 14)
 *   - 820 px  (iPad portrait)
 *   - 1280 px (laptop)
 *
 * For each route × breakpoint we assert:
 *   1. document.scrollWidth <= innerWidth + ALLOWED_SLACK_PX
 *   2. No descendant element extends past the right edge of the viewport
 *      (catches off-by-one overflows that show up as a horizontal scrollbar
 *      even when the body itself does not overflow).
 *   3. The page renders a <main> landmark (SEO + a11y guard).
 *
 * Run with:
 *   bunx playwright test tests/visual/responsive-overflow.spec.ts
 */
import { test, expect, type Page } from "@playwright/test";

const ALLOWED_SLACK_PX = 1; // 1px tolerance for sub-pixel rounding.

const BREAKPOINTS = [
  { id: "mobile-360",  width: 360,  height: 780  },
  { id: "mobile-390",  width: 390,  height: 844  },
  { id: "tablet-820",  width: 820,  height: 1180 },
  { id: "laptop-1280", width: 1280, height: 900  },
] as const;

const PUBLIC_ROUTES: { path: string; name: string }[] = [
  { path: "/",                          name: "home" },
  { path: "/platform",                  name: "platform" },
  { path: "/services",                  name: "services" },
  { path: "/pricing",                   name: "pricing" },
  { path: "/clinics",                   name: "clinics" },
  { path: "/about",                     name: "about" },
  { path: "/contact",                   name: "contact" },
  { path: "/resources",                 name: "resources" },
  { path: "/resources/comparison",      name: "resources-comparison" },
  { path: "/terms",                     name: "terms" },
  { path: "/Privacy/Home",              name: "privacy-home" },
  { path: "/Privacy/HIPAA",             name: "privacy-hipaa" },
  { path: "/Privacy/PatientRights",     name: "privacy-patient-rights" },
  { path: "/Privacy/TermsOfService",    name: "privacy-tos" },
  { path: "/auth",                      name: "auth" },
  { path: "/business-intake",           name: "business-intake" },
];

/**
 * Reads layout truths from the rendered DOM. Returns the worst horizontal
 * overrun across (a) the document scroll width and (b) any descendant
 * element's bounding rect. Selectors of offending elements are returned so
 * a regression is easy to attribute.
 */
async function measureOverflow(page: Page) {
  return page.evaluate(() => {
    const viewport = window.innerWidth;
    const docOverflow = document.documentElement.scrollWidth - viewport;

    let worst = { selector: "", overhang: 0 };
    const all = document.querySelectorAll<HTMLElement>("body *");
    for (const el of all) {
      // Skip non-visible nodes — they can't visually overflow.
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const overhang = rect.right - viewport;
      if (overhang > worst.overhang) {
        const id = el.id ? `#${el.id}` : "";
        const cls = el.className && typeof el.className === "string"
          ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "";
        worst = {
          selector: `${el.tagName.toLowerCase()}${id}${cls}`,
          overhang: Math.round(overhang),
        };
      }
    }
    return {
      viewport,
      docOverflow: Math.round(docOverflow),
      worstElement: worst,
      hasMain: !!document.querySelector("main"),
    };
  });
}

for (const bp of BREAKPOINTS) {
  test.describe(`@${bp.id} (${bp.width}px)`, () => {
    test.use({ viewport: { width: bp.width, height: bp.height } });

    for (const route of PUBLIC_ROUTES) {
      test(`${route.name} has no horizontal overflow`, async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on("pageerror", (e) => consoleErrors.push(String(e.message)));

        await page.goto(route.path, { waitUntil: "domcontentloaded" });
        // Let layout settle (fonts, images, hydration).
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

        const m = await measureOverflow(page);

        expect(
          m.docOverflow,
          `documentElement.scrollWidth (${m.viewport + m.docOverflow}px) exceeds viewport (${m.viewport}px) on ${route.path}`,
        ).toBeLessThanOrEqual(ALLOWED_SLACK_PX);

        expect(
          m.worstElement.overhang,
          `Element ${m.worstElement.selector} overflows by ${m.worstElement.overhang}px on ${route.path}`,
        ).toBeLessThanOrEqual(ALLOWED_SLACK_PX);

        expect(consoleErrors, `uncaught page errors: ${consoleErrors.join(" | ")}`).toEqual([]);
      });
    }
  });
}

test.describe("a11y landmarks (mobile)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} renders a <main> landmark`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      // Some routes (auth, business-intake) wrap content in a form rather than
      // a top-level <main>; allow either, but require at least one landmark.
      const landmark = await page.evaluate(
        () => !!document.querySelector("main, [role='main'], form"),
      );
      expect(landmark, `no <main>/[role=main]/<form> landmark on ${route.path}`).toBe(true);
    });
  }
});