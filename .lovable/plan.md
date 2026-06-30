## Diagnosis

Re-ran the exact failing command and a full `bun run build` locally — both succeed:

- `node scripts/audit-sitemap.mjs` → `✓ sitemap audit: 18 public routes present`
- `bun run build` → `✓ built` with full Nitro output

The previous fix (adding `his.tsx` to the audit's exclude list in `scripts/audit-sitemap.mjs:38`) is in place. There is no current build error in the codebase.

The "Publishing failed… audit-sitem…" banner you're seeing is the **cached log from the earlier failed deploy** that the publish dialog keeps showing until a new deploy runs and overwrites it. No code change will clear it — only a fresh publish attempt will.

## Plan

1. Re-trigger publish from the Publish dialog. The new build will run cleanly and replace the stale error log.
2. If it still fails, capture the **new** full log (everything after `$ node scripts/audit-sitemap.mjs`) so we can see whether it's a different route now missing, a Nitro/Wrangler step, or an infra timeout — the truncated banner alone isn't enough to act on.

No file edits are needed right now. Approve this plan and I'll switch to build mode only if step 2 surfaces a real failure.