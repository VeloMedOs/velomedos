## Goal
Move the **Operations / Care & Revenue** toggle out of the hero and elevate it into the top navigation bar, replacing the standalone **Platform** link — as an elegant, segmented control that sits inline with the other nav items.

## Why
Today the toggle lives just under the hero (`HeroCommandPanel`) and `Platform` sits in the header (`SiteChrome`). They compete for the same intent ("which lens am I viewing the product through?"). Consolidating them removes redundancy and makes the mode switch a first-class, persistent control.

## Behaviour
- Header shows a single segmented pill: **Operations | Care & Revenue** where `Platform` used to be.
- Selecting a segment:
  - On `/` — swaps the hero lens in place (no navigation, smooth crossfade).
  - On any other route — navigates to `/?mode=care` or `/?mode=operations` and the homepage opens in that lens.
- Default = Operations. Selection persists in `localStorage` (`velomed.heroMode`) and via `?mode=` query for shareable links.
- Active segment uses the brand teal pill treatment already used in `ThemeSwitcher` (`bg-teal/15 text-teal`) so it harmonises with the existing header controls.
- Mobile (<768px): collapses to a compact two-letter segmented control (`OPS | C&R`) to fit the existing nav row; falls back into the mobile menu if/when one is added.

## Changes
1. **New `src/lib/hero-mode.ts`** — tiny context + hook (`useHeroMode`) holding `"operations" | "care"`, hydrated from `?mode=` then `localStorage`, with a setter that updates both. Provider mounted in `__root.tsx` so header and hero share state.
2. **`src/components/SiteChrome.tsx`** — remove the `["Platform","/platform"]` entry; insert a new `<HeroModeSegmented />` control in its place inside the same nav cluster, styled to match the existing pill treatment (border-hairline, mono uppercase, teal active). Keep the underline indicator removed for the segmented control so it reads as a control, not a link.
3. **`src/components/marketing/HeroCommandPanel.tsx`** — delete the local toggle row; read `mode` from `useHeroMode()` instead. Keep the live dot. Animate the lens swap with a short opacity/translate transition.
4. **`src/routes/__root.tsx`** — wrap the app in `HeroModeProvider`.
5. **`/platform` route** — leave the file in place (still reachable directly and from footer "Network → Region → Team"), just not surfaced in the top nav anymore. No redirect needed.

## Out of scope
- No copy/visual changes to the hero panels themselves.
- No changes to `/platform` page content or the footer link.
- No new analytics events beyond what already exists.
