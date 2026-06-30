## Goal

Add a **Light / Dark / Auto** theme across every surface of VeloMed OS — marketing site, Superadmin, Clinical/HIS, and auth/demo pages — without diluting the brand. Auto follows the OS setting; the manual choice persists per device (and per account when signed in).

## What the user will see

- A small **Theme** switcher (Sun / Moon / Monitor icons) in:
  - the marketing site header (next to the language / sandbox links)
  - the Superadmin top bar
  - the Clinical workspace header
  - the `/auth`, `/demo-login`, `/demo-credentials`, `/superadmin/login` pages
- First load picks **Auto** → matches the OS preference, then remembers any manual choice.
- No flash of wrong theme on hard refresh (inline script applies the saved class before React mounts).

## Light theme direction

Keep the brand (teal `#28D6B6`, blue `#4FB6F7`, coral `#FF6E5B`) but rebuild surfaces for clarity:

| Token | Dark (today) | Light (new) |
|---|---|---|
| `--background` | near-black navy | warm white `oklch(0.99 0.005 200)` |
| `--panel` | deep navy | soft cloud `oklch(0.975 0.008 210)` |
| `--panel-elevated` | raised navy | crisp white `oklch(1 0 0)` with subtle shadow |
| `--hairline` | translucent white | `oklch(0.9 0.01 220)` |
| `--foreground` | near-white | graphite `oklch(0.18 0.02 240)` |
| `--muted-foreground` | dim grey | slate `oklch(0.48 0.02 240)` |
| `--teal / --blue / --coral` | unchanged | slightly deepened for AA contrast on white |

Map cards (glass-on-map overlays — already in memory) stay glass; the underlying map tiles switch to a light Mapbox style when theme = light.

## How it's built

1. **Tokens** — `src/styles.css`: keep `:root` (dark, current) and add a `.light` variant block under `@theme inline` style so every existing utility (`bg-panel`, `text-foreground`, `border-hairline`, …) just works in both themes. No component changes required for token-driven surfaces.
2. **Theme provider** — new `src/lib/theme.tsx`:
   - exposes `useTheme()` returning `{ theme: 'light'|'dark'|'auto', resolved: 'light'|'dark', setTheme }`
   - writes `light`/`dark` class on `<html>`, persists to `localStorage` (`velomed.theme`), and (when signed in) mirrors to a new `profiles.theme_preference` column so the choice follows the user across devices
   - listens to `prefers-color-scheme` for Auto
3. **No-flash inline script** — add a tiny synchronous script in `src/routes/__root.tsx` head that reads `localStorage` + `matchMedia` and applies the class before the React shell mounts.
4. **Switcher component** — `src/components/ThemeSwitcher.tsx`: 3-segment pill (Sun / Moon / Monitor). Drop it into `SiteHeader`, `SuperadminLayout` top bar, Clinical header, and the auth pages.
5. **Hand-tuned spots** — a small list of components that hardcode dark-only values get token swaps (the CommandHero glow gradients, map overlay backgrounds, chart grid lines, code blocks in API docs, the Pipeline board column tint). These are listed in the technical details section.
6. **DB migration** — one column on `profiles`: `theme_preference text check (theme_preference in ('light','dark','auto')) default 'auto'`.

## Out of scope (call out for later)

- Reworking imagery (hero illustrations, OG images) for light mode — covered in a follow-up.
- High-contrast / accessibility presets beyond AA — separate pass.
- Email templates — they stay light as today.

## Technical details

- **Token strategy**: shadcn tokens (`--background`, `--foreground`, `--primary`, `--card`, `--border`, `--ring`, etc.) are defined twice — once under `:root` (dark) and once under `.light`. Project-specific tokens (`--panel`, `--panel-elevated`, `--hairline`, `--teal`, `--blue`, `--coral`, `--mono`, gradients) follow the same pattern. `@theme inline` already maps Tailwind utilities to these vars so no component CSS changes are needed where tokens are used correctly.
- **Hardcoded-color sweep**: ripgrep for `text-white`, `bg-black`, `bg-[#`, `text-[#`, `from-[#`, `border-white/`, `bg-white/` outside the marketing glass overlays. Replace with semantic tokens. Estimated ~25 occurrences (CommandHero, HeroCommandPanel, PartnerMarquee, CareRevenuePanel, a few Superadmin panes, Pipeline columns, NPHIES status chips).
- **Map tiles**: `CommandHero` map currently uses a dark tile style. When `resolved === 'light'`, swap to the light style URL; glass overlay cards already work on both (memory: `bg-white/40 backdrop-blur-2xl` looks good on light too — verified visually during build).
- **Provider wiring**: `ThemeProvider` mounted in `__root.tsx` above `<RouterProvider />`. The no-flash script runs from `head.scripts` in `__root` and is ~12 lines.
- **Persistence**:
  - anonymous → `localStorage` only
  - signed-in → `localStorage` + a debounced `PUT /api/admin/v1/me/preferences` (new tiny endpoint) writing `profiles.theme_preference`. On sign-in, server value beats local once.
- **Audit / analytics**: theme toggle fires a `nav_events` row (`kind: 'theme_change'`) so we can see adoption.
- **Tests**: a Playwright check that loads `/`, toggles to light, hard-refreshes, asserts the `<html>` class is `light` immediately (no flash), and runs the responsive overflow suite in both themes.
- **Build budget**: net code add ~6 KB (provider + switcher + tokens). No new runtime deps.

## Acceptance checklist

- [ ] Toggle visible on marketing, Superadmin, Clinical, and auth pages.
- [ ] Auto follows OS, manual choice overrides and persists.
- [ ] No flash of wrong theme on hard refresh.
- [ ] All pages legible in both themes — no white-on-white or near-invisible borders.
- [ ] Brand teal/blue/coral remain recognisable in both themes (AA contrast verified).
- [ ] Signed-in choice syncs across devices via `profiles.theme_preference`.