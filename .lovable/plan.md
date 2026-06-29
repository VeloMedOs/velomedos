# Phase 3 Addendum v2 — Price List Builder + Bulk Pricing + Insights & Comparison

Revises Lovable's addendum plan and adds the three you asked for: **bulk pricing actions**, **enhanced copy/replicate UX**, and an **RCM insights & comparison layer**. Keeps Lovable's core (scope generalization, duplicate-with-factor, catalog feed, payer-wise SBS) — those are correct.

> Tags: **[KEEP]** Lovable's, **[FIX]** corrections, **[NEW]** the additions.

## A. Corrections to Lovable's plan [FIX]

1. `cost` **list distinguishable** — backfilling `list_type='cost'` → `scope_level='cash'` loses it. Add `is_cost_basis bool DEFAULT false` and set it for cost lists; the Phase-4 resolver uses cost lists only for `drg_bundled` cost-only pricing, never as a patient/payer cash list.
2. `service_code` **unique** — drop the redundant `is_primary_billing` column from the key: `UNIQUE (service_id, payer_id) WHERE is_primary_billing` (one primary per service+payer; `payer_id IS NULL` = global). Functionally what Lovable meant, cleaner.
3. Everything else in Lovable's §1–§4 ships as written.

## B. Bulk pricing actions [NEW] (from the Contract-Management mind-map: add/copy/export/import,

update-at-date, AM↔PM, referral pricing) `POST /price-lists/{id}/items:bulk-update` — body `{ filter?{service_type|category|code_system|ids}, op: 'pct'|'amount'|'set'|'factor', value, effective_date?, time_band?('am'|'pm'|null), referral_status?('referral'|'non_referral'|null), dry_run?:bool }`.

- Applies to matched lines: percentage change, absolute delta, set value, or factor.
- **Effective-dated**: when `effective_date` is set, writes a `price_list_item_version` row (future-dated) rather than mutating now — supports "update prices at a certain date".
- **Time band (AM/PM)** + **referral-status** pricing variants stored on the line (`time_band`, `referral_status` columns) — from the mind-map's "AM-PM" and "consultation price by referral status".
- `dry_run` returns the would-be changes (powers the preview in §D). `POST /price-lists/{id}/items:bulk-activate` / `:bulk-deactivate` (by filter/ids). `POST /price-lists/{id}/export` (CSV/XLSX of items+codes) · `POST …/import` (upsert from CSV/XLSX, validated against catalog + payer-wise codes, returns row-level errors). Export/import the mind-map calls for. `price_list_item_version` [NEW table] — `price_list_item_id`, `unit_price_minor`, `factor`, `effective_from`, `effective_to`, `change_reason`, `changed_by` — the **price-change log** (mind-map "Update prices log") + effective-dated future prices. Resolver picks the version effective on service date.

## C. Copy / replicate UX [NEW] — beyond single duplicate

`POST /price-lists/{id}/replicate` — replicate **one source to many targets** in a single action: `{ targets:[{ scope_level, scope_ref_id, name?, factor? }], copy_items:bool }`.

- Creates N derived lists (each with its own `parent_price_list_id` + `derive_factor`), e.g. clone "Standard" to every Class in a policy at ×0.9, or to five payers at different factors at once.
- Parallels Contract Management's **"Create and Copy Profile"** (benefit-profile clone) — same UX pattern for price lists. **UI** (masters price-list pane):
- **Replicate wizard**: pick source → multi-select targets (payer/TPA/policy/class/network tree) → per-target factor (or one factor for all) → preview deltas → commit.
- **Duplicate-with-factor** modal (Lovable's) retained for the single-target case.
- **Bulk-edit toolbar** on the items grid: select lines → apply pct/amount/set/factor, set effective date, AM/PM, referral variant, activate/deactivate, export selection.
- **Import** drawer with validation summary.

## D. Insights & comparison layer [NEW] — the RCM analytics you asked for

`GET /price-lists/compare?left={id}&right={id}` — line-by-line diff of two lists (or derived vs `parent_price_list_id`): per service/drug → left price, right price, Δ, Δ%, missing-on-one-side flag. Powers "this payer vs that payer", "derived vs parent", "our list vs contractual tariff". `GET /price-lists/{id}/insights` — for one list:

- **Catalog coverage**: % of active `service_master`/`drug_master` priced vs unpriced (gaps to fill).
- **Payer-wise code coverage**: services missing a payer-specific SBS where the list is payer-scoped.
- **Margin view (RCM)**: for each line, cash price vs payer price vs **cost list** (`is_cost_basis`) → margin %; for IP, surface the **DRG bundle vs cost** signal by linking `drg_base_rate × relative_weight` against the cost-list sum (the revenue-vs-cost picture R4 produces).
- **Outliers**: lines priced far from the tenant median / from the parent (possible data errors).
- **Effective-date timeline**: upcoming scheduled price changes from `price_list_item_version`. `GET /pricing/insights/summary` — cross-list KPIs: count of lists by scope, derived-from-parent chains, payers with no active list (coverage gap), services unpriced across all lists. **UI** — an **Insights tab** on the price-list pane: coverage donut, margin table (cash/payer/cost/ DRG), comparison view (pick two lists), upcoming-changes timeline. Read-mostly; links into bulk-edit to fix gaps.

## E. Phase 4 resolver [KEEP + small]

Precedence `class → policy → tpa → payer → network(tier) → cash`; prefer payer-specific `service_code`; **pick the** `price_list_item_version` **effective on the service date** (so future-dated bulk updates apply automatically).

## F. Phase 10 validation contributions (declared)

- Bulk/effective-dated changes are versioned + audited (no silent mass price mutation).
- Import validates every row against catalog + payer-wise codes before commit.
- Cost lists (`is_cost_basis`) never used as a patient/payer cash list.

## G. Verification

- Bulk pct −10% on a filter → only matched lines change; `dry_run` matches the committed result; versions written; effective-dated change not applied before its date.
- Replicate "Standard" to 3 classes at ×0.9 → 3 derived lists, each parent-linked, items 10% lower.
- Compare derived vs parent → all Δ = −10%; compare two payer lists → variance table.
- Insights: coverage donut correct; an unpriced service shows as a gap; margin table shows cash/payer/ cost/DRG; payer-wise code gap flagged.
- Export → edit → import round-trips with row-level validation.

## H. Docs (DoD)

- `docs/his-technical-manual.md`: bulk-update/versioning model, replicate API, insights/comparison contracts, effective-dated resolution.
- `docs/his-rcm-user-manual.md` (tenant_admin): "Bulk-update prices (by %/amount/date/AM-PM/referral)", "Replicate a list to many payers/classes", "Compare two price lists", "Read pricing insights & margin", "Export / import a price list".

Net-new tables: `price_list_item_version`. Net-new columns: `price_list.is_cost_basis`, `price_list_item.time_band/referral_status`. New endpoints: bulk-update/activate/export/import, replicate, compare, insights ×3.  
