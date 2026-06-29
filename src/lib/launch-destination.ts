/**
 * Single source of truth for post-auth routing in VeloMed OS.
 *
 * - `safeNext(value)` rejects open-redirect bait (absolute URLs, protocol-
 *   relative `//evil`, backslash bait `/\evil`); only accepts a single-slash
 *   absolute path on this origin.
 * - `roleAllowSet(roles, hasClinical)` returns the destinations a user is
 *   actually authorised to reach, in priority order.
 * - `resolveDestination(...)` honours `next` only when it points into the
 *   allow-set; otherwise falls back to the role's default home.
 */

export type AppRoleLite = string;

/** Allowed only if it starts with a single `/` not followed by `/` or `\`. */
export function safeNext(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length < 1) return undefined;
  if (!/^\/(?![\/\\])/.test(value)) return undefined;
  return value;
}

export type Destination = {
  path: string;
  label: string;
  blurb: string;
};

/** Returns every destination the user is allowed to reach, ranked by priority. */
export function roleAllowSet(
  roles: AppRoleLite[],
  hasClinical: boolean,
): Destination[] {
  const set: Destination[] = [];
  const has = (r: string) => roles.includes(r);
  if (has("superadmin")) {
    set.push({ path: "/superadmin", label: "Superadmin", blurb: "Tenants, billing & access control" });
  }
  if (hasClinical) {
    set.push({ path: "/clinical", label: "Clinical Workspace", blurb: "HIS · NPHIES · RCM" });
  }
  if (has("business_admin")) {
    set.push({ path: "/business", label: "Business", blurb: "Your organisation control panel" });
  }
  if (has("call_center")) {
    set.push({ path: "/call-center", label: "Call Center", blurb: "Inbound triage & dispatch" });
  }
  if (has("dispatcher") || has("admin")) {
    set.push({ path: "/dispatch", label: "Dispatch", blurb: "Live trips & resourcing" });
  }
  if (has("fleet")) {
    set.push({ path: "/fleet", label: "Fleet", blurb: "Vehicles, compliance & defects" });
  }
  if (has("paramedic") || has("driver") || has("provider")) {
    set.push({ path: "/provider", label: "Provider", blurb: "On-shift runsheet" });
  }
  if (has("patient") || set.length === 0) {
    set.push({ path: "/patient", label: "Patient", blurb: "Your care record" });
  }
  // de-dupe by path
  const seen = new Set<string>();
  return set.filter((d) => (seen.has(d.path) ? false : (seen.add(d.path), true)));
}

/** Resolves the final destination after sign-in. */
export function resolveDestination(
  roles: AppRoleLite[],
  hasClinical: boolean,
  rawNext?: string | null,
): { dest: string; allow: Destination[]; usedNext: boolean } {
  const allow = roleAllowSet(roles, hasClinical);
  const next = safeNext(rawNext);
  if (next) {
    const okExact = allow.some((d) => d.path === next || next.startsWith(d.path + "/") || next.startsWith(d.path + "?"));
    if (okExact) return { dest: next, allow, usedNext: true };
  }
  return { dest: allow[0]?.path ?? "/patient", allow, usedNext: false };
}