## Goal

Convert the Superadmin tab bar from a horizontal strip into a **vertical left navigation rail** styled after RufayQ admin (narrow icon column + grouped label panel), keeping all existing tabs/badges and behavior intact.

## Reference (from your screenshots)

- **Icon rail** (~64px): brand mark on top, then icon-only buttons; active item has a teal-tinted square with brand glow.
- **Label panel** (~240px): section heading ("Platform control plane / Superadmin"), grouped list with section labels (e.g. REVENUE, ACCESS, DEVELOPER, OPS), active row pill-highlighted in teal.
- Collapsible: a chevron button on the divider collapses the label panel, leaving the icon rail visible.

## Plan

### 1. Layout shift in `src/routes/_authenticated/superadmin.tsx`

- Remove the horizontal `Tab bar` strip (lines 339–351).
- Wrap the page in a 2-column flex: left = `SuperadminSideNav`, right = the existing main content (header, KPI strip, active pane, identity panel, quick links). Keep `max-w-[1600px]` on the right column container.
- Right column scrolls independently (`min-h-screen` rail, sticky on `lg+`).

### 2. New component `src/components/superadmin/SideNav.tsx`

- Two stacked columns inside one `aside`:
  - **Rail** (`w-14`, full-height, `bg-panel`, hairline border-right): VeloMed shield mark, then one icon button per tab. Active = `bg-teal/15 text-teal` with a 2px left brand bar; hover = `bg-panel-elevated`.
  - **Panel** (`w-60`, hidden when collapsed): top block with eyebrow "VeloMed Superadmin", title "Control plane", subtitle. Below: grouped sections —
    - **Command Center** → Overview & Dashboard & VeloMed KPIs
    - **ACCOUNTS** → Tenants, Requests (badge)
    - **REVENUE** → Subscriptions (badge), Plans, Refund Management
    - **ACCESS** → Roles & access, Privileges, API keys (badge)
    - **DEVELOPER** → API docs, Debug
    - Support: filter, tickets, reviews management, push notifications
    - Website CMS [Marketing website & Content Management]: Structure section: Pages & Sections, SEO Manager, Editorial section: News & Articles, Blog Categories, Media Library [Media Library
      Upload images and files for use across the site. Copy the URL into any section.]
    - Quality Control: Test Runs, Audt Log, Smoke Reports, Bug Tracker, Releases & Fix Versions, Automated events
    - Settings: Workspace section [General ''Workspace defaults for your admin sessions. Stored on this device.
      Table density'' & Team & Roles], Security    

  - Active row: full-width rounded pill, `bg-teal/12 text-foreground` + small teal indicator dot; inactive: `text-muted-foreground hover:text-foreground hover:bg-panel-elevated`.
- Collapse toggle: small chevron button on the rail/panel seam; collapsed state persisted in `localStorage` (`velomed.superadmin.nav.collapsed`).
- Props: `tab`, `setTab`, `badges: { subs, requests, apiKeys }`.

### 3. Visual tokens (kept on-brand)

- Active fills/dots/brand bar: `teal` (#28D6B6).
- Badges: keep existing `bg-caution/20 text-caution` for counts.
- All chrome uses existing semantic tokens (`bg-panel`, `border-hairline`, `text-muted-foreground`) — no hex.

### 4. Responsiveness

- `lg` and up: side nav visible; main content uses remaining width.
- Below `lg`: rail-only (panel hidden); tapping an icon switches tab. No horizontal bar reintroduced.

### 5. No behavior changes

- All panes, data fetches, badges, and the IdentityPanel remain unchanged.
- No routing changes — still single-route with internal `tab` state.

- No changes to other admin surfaces (Tenants, Subscriptions, Plans panes).
- No new routes, no data model changes.