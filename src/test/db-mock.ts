/**
 * Step 3 · Turn 4 — DB-mock harness for route-handler fixtures.
 *
 * A minimal PostgREST-compatible chain-builder that lets tests declare
 * table contents and per-call RPC results, then assert on the calls made.
 * NOT a real Postgres — just enough surface for scheduler route handlers.
 *
 * Supported chain methods (grep-confirmed against scheduler routes):
 *   .select, .eq, .neq, .gt, .gte, .lt, .lte, .in, .is, .or,
 *   .maybeSingle, .single, .update, .insert, .delete, .order, .limit
 *
 * Atomicity contract: `.update(patch).eq(...).select(...)` reads
 * `tables[t]` at call time and mutates in place. Two Promise.all UPDATEs
 * against the same row with a status='open' predicate: the first flips
 * status, the second re-reads and matches 0 rows.
 *
 * Nested PostgREST joins parsed from the select string
 * `id, fk:fk_col ( a, b, nested:nested_fk ( c ) )` — resolved by scanning
 * tables[referenced_table] for matching id. FK naming convention:
 * `<local>_id` references table `<local>`.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

type Row = Record<string, unknown>;
export type MockTable = Row[];

export type CallRecord = {
  table: string;
  op: "select" | "update" | "insert" | "delete" | "rpc";
  args: Record<string, unknown>;
};

export type MockDb = {
  tables: Record<string, MockTable>;
  rpc?: (name: string, args: Record<string, unknown>) => unknown;
  calls: CallRecord[];
};

export type MockClient = {
  from: (table: string) => ChainBuilder;
  rpc: (name: string, args?: unknown) => Promise<{ data: unknown; error: null }>;
};

type Filter =
  | { op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"; col: string; val: unknown }
  | { op: "in"; col: string; vals: unknown[] }
  | { op: "is"; col: string; val: null | boolean }
  | { op: "or"; expr: string };

function passesFilter(row: Row, f: Filter): boolean {
  if (f.op === "or") {
    // Parse `a.eq.x,b.is.null` style. Any clause pass = pass.
    for (const clause of f.expr.split(",")) {
      const parts = clause.trim().split(".");
      if (parts.length < 2) continue;
      const col = parts[0];
      const op = parts[1];
      const rest = parts.slice(2).join(".");
      const v = row[col];
      if (op === "eq" && String(v) === rest) return true;
      if (op === "is" && rest === "null" && (v === null || v === undefined)) return true;
      if (op === "is" && rest === "true" && v === true) return true;
      if (op === "is" && rest === "false" && v === false) return true;
    }
    return false;
  }
  const cell = row[f.col];
  switch (f.op) {
    case "eq":  return cell === f.val;
    case "neq": return cell !== f.val;
    case "gt":  return (cell as any) >  (f.val as any);
    case "gte": return (cell as any) >= (f.val as any);
    case "lt":  return (cell as any) <  (f.val as any);
    case "lte": return (cell as any) <= (f.val as any);
    case "in":  return f.vals.includes(cell);
    case "is":  return cell === f.val;
  }
}

/** Parse `id, fk:fk_col ( a, b, nested:nested_fk ( c ) )` into a tree. */
type SelectNode = {
  cols: string[];                    // leaf columns
  joins: Record<string, SelectNode & { fkCol: string; refTable: string }>;
};

function parseSelect(sel: string): SelectNode {
  const node: SelectNode = { cols: [], joins: {} };
  if (!sel || sel === "*") { node.cols.push("*"); return node; }
  // Tokenise by top-level commas, respecting paren depth.
  const tokens: string[] = [];
  let depth = 0, buf = "";
  for (const ch of sel) {
    if (ch === "(") { depth++; buf += ch; }
    else if (ch === ")") { depth--; buf += ch; }
    else if (ch === "," && depth === 0) { tokens.push(buf.trim()); buf = ""; }
    else buf += ch;
  }
  if (buf.trim()) tokens.push(buf.trim());

  for (const tok of tokens) {
    const parenIdx = tok.indexOf("(");
    if (parenIdx === -1) {
      // plain column
      node.cols.push(tok);
      continue;
    }
    const head = tok.slice(0, parenIdx).trim();
    const inner = tok.slice(parenIdx + 1, tok.lastIndexOf(")")).trim();
    // head: `alias:fkCol` or `table` (implicit fkCol=table+"_id")
    let alias: string, fkCol: string, refTable: string;
    if (head.includes(":")) {
      const [a, fk] = head.split(":").map((s) => s.trim());
      alias = a; fkCol = fk;
      // PostgREST convention: `alias:fk_col` joins table `<alias>` via `<fk_col>`.
      refTable = alias;
    } else {
      alias = head; fkCol = `${head}_id`; refTable = head;
    }
    const child = parseSelect(inner);
    node.joins[alias] = { ...child, fkCol, refTable };
  }
  return node;
}

function project(row: Row, node: SelectNode, tables: Record<string, MockTable>): Row {
  const out: Row = {};
  if (node.cols.includes("*")) {
    for (const k of Object.keys(row)) out[k] = row[k];
  } else {
    for (const c of node.cols) out[c] = row[c];
  }
  for (const [alias, join] of Object.entries(node.joins)) {
    const fkVal = row[join.fkCol];
    const refRows = tables[join.refTable] ?? [];
    const hit = refRows.find((r) => r.id === fkVal);
    out[alias] = hit ? project(hit, join, tables) : null;
  }
  return out;
}

class ChainBuilder implements PromiseLike<{ data: unknown; error: null | { message: string } }> {
  private op: "select" | "update" | "insert" | "delete" = "select";
  private filters: Filter[] = [];
  private selectStr = "*";
  private payload: unknown = undefined;
  private orderBy?: { col: string; asc: boolean };
  private limitN?: number;

  constructor(private db: MockDb, private table: string) {}

  select(str = "*"): this { this.selectStr = str; return this; }
  eq(col: string, val: unknown): this  { this.filters.push({ op: "eq",  col, val }); return this; }
  neq(col: string, val: unknown): this { this.filters.push({ op: "neq", col, val }); return this; }
  gt(col: string, val: unknown): this  { this.filters.push({ op: "gt",  col, val }); return this; }
  gte(col: string, val: unknown): this { this.filters.push({ op: "gte", col, val }); return this; }
  lt(col: string, val: unknown): this  { this.filters.push({ op: "lt",  col, val }); return this; }
  lte(col: string, val: unknown): this { this.filters.push({ op: "lte", col, val }); return this; }
  in(col: string, vals: unknown[]): this { this.filters.push({ op: "in", col, vals }); return this; }
  is(col: string, val: null | boolean): this { this.filters.push({ op: "is", col, val }); return this; }
  or(expr: string): this { this.filters.push({ op: "or", expr }); return this; }
  order(col: string, opts?: { ascending?: boolean }): this {
    this.orderBy = { col, asc: opts?.ascending ?? true }; return this;
  }
  limit(n: number): this { this.limitN = n; return this; }

  update(patch: Row): this { this.op = "update"; this.payload = patch; return this; }
  insert(rows: Row | Row[]): this { this.op = "insert"; this.payload = rows; return this; }
  delete(): this { this.op = "delete"; return this; }

  private matched(): Row[] {
    const t = this.db.tables[this.table] ?? [];
    return t.filter((r) => this.filters.every((f) => passesFilter(r, f)));
  }

  private execute(): { data: unknown; error: null | { message: string } } {
    const t = (this.db.tables[this.table] ||= []);
    let rows: Row[] = [];
    if (this.op === "select") {
      rows = this.matched();
    } else if (this.op === "update") {
      // Mutate in place to preserve atomicity across concurrent chains.
      const matched = this.matched();
      const patch = this.payload as Row;
      for (const r of matched) Object.assign(r, patch);
      rows = matched;
    } else if (this.op === "insert") {
      const arr = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      // Assign id if missing.
      for (const r of arr) {
        if (!r.id) r.id = crypto.randomUUID();
        t.push(r);
      }
      rows = arr;
    } else if (this.op === "delete") {
      const matched = this.matched();
      const keep = t.filter((r) => !matched.includes(r));
      this.db.tables[this.table] = keep;
      rows = matched;
    }

    // Project via select string (with nested joins).
    const node = parseSelect(this.selectStr);
    let out = rows.map((r) => project(r, node, this.db.tables));

    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      out = [...out].sort((a, b) => {
        const av = a[col] as any, bv = b[col] as any;
        if (av === bv) return 0;
        return (av < bv ? -1 : 1) * (asc ? 1 : -1);
      });
    }
    if (this.limitN != null) out = out.slice(0, this.limitN);

    this.db.calls.push({
      table: this.table,
      op: this.op,
      args: {
        filters: this.filters,
        select: this.selectStr,
        payload: this.payload,
      },
    });

    return { data: out, error: null };
  }

  async maybeSingle(): Promise<{ data: Row | null; error: null }> {
    const res = this.execute();
    const data = (res.data as Row[])[0] ?? null;
    return { data, error: null };
  }

  async single(): Promise<{ data: Row | null; error: null | { message: string } }> {
    const res = this.execute();
    const arr = res.data as Row[];
    if (arr.length !== 1) {
      return { data: null, error: { message: `expected single row, got ${arr.length}` } };
    }
    return { data: arr[0], error: null };
  }

  // PromiseLike so `await builder` returns { data, error }.
  then<TResult1 = { data: unknown; error: null | { message: string } }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null | { message: string } }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

export function makeMockDb(initial: {
  tables?: Record<string, MockTable>;
  rpc?: (name: string, args: Record<string, unknown>) => unknown;
}): { db: MockDb; client: MockClient } {
  const tables = initial.tables ?? {};
  // Deep-clone rows so fixtures can seed with plain objects safely.
  const cloned: Record<string, MockTable> = {};
  for (const [k, v] of Object.entries(tables)) cloned[k] = v.map((r) => ({ ...r }));

  const db: MockDb = { tables: cloned, rpc: initial.rpc, calls: [] };
  const client: MockClient = {
    from: (table: string) => new ChainBuilder(db, table),
    rpc: async (name: string, args?: unknown) => {
      db.calls.push({ table: "_rpc", op: "rpc", args: { name, args: args ?? {} } });
      const val = db.rpc ? db.rpc(name, (args ?? {}) as Record<string, unknown>) : null;
      return { data: val, error: null };
    },
  };
  return { db, client };
}