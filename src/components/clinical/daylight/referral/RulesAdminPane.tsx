/**
 * Step 5 · Turn 1 — Rule Engine admin (Rules A–E, scope='referral' focus).
 * Thin CRUD over approval_rule / need_approval_rule / not_covered_rule /
 * pricing_rule via the admin facade. tenant_admin only.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rulesAdminApi, type RuleTable } from "@/lib/clinical-api";
import { DCard } from "@/components/clinical/daylight/Primitives";
import { toast } from "sonner";

const TABLES: RuleTable[] = ["approval_rule", "need_approval_rule", "not_covered_rule", "pricing_rule"];

export function RulesAdminPane() {
  const [table, setTable] = useState<RuleTable>("pricing_rule");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["rules-admin", table], queryFn: () => rulesAdminApi.list(table) });
  const rows: any[] = q.data?.data ?? [];

  const [draft, setDraft] = useState<string>('{\n  "name": "",\n  "scope": "referral",\n  "priority": 100,\n  "condition": {},\n  "action": {},\n  "active": true\n}');

  const create = useMutation({
    mutationFn: async () => {
      const body = JSON.parse(draft);
      return rulesAdminApi.create(table, body);
    },
    onSuccess: () => { toast.success("Rule created"); qc.invalidateQueries({ queryKey: ["rules-admin", table] }); },
    onError: (e: any) => toast.error(e?.message ?? "Create failed"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => rulesAdminApi.remove(table, id),
    onSuccess: () => { toast.success("Rule deleted"); qc.invalidateQueries({ queryKey: ["rules-admin", table] }); },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });
  const toggle = useMutation({
    mutationFn: (row: any) => rulesAdminApi.patch(table, row.id, { active: !row.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules-admin", table] }),
  });

  return (
    <div className="space-y-3" data-testid="rules-admin">
      <DCard title="Rule engine admin" caption="CRUD facade over approval / need-approval / not-covered / pricing rules (scope='referral' by convention)">
        <div className="flex items-center gap-2 text-xs">
          <label>Table</label>
          <select value={table} onChange={(e) => setTable(e.target.value as RuleTable)} className="border rounded px-2 py-1">
            {TABLES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="ml-auto text-slate-500">{rows.length} rows</div>
        </div>
      </DCard>

      <DCard title="Rows">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="rules-rows">
            <thead className="text-left text-xs text-slate-500 border-b">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Scope</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Loading…</td></tr>}
              {!q.isLoading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">No rules.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="px-3 py-2">{r.name ?? "—"}</td>
                  <td className="px-3 py-2">{r.scope ?? "—"}</td>
                  <td className="px-3 py-2">{r.priority ?? "—"}</td>
                  <td className="px-3 py-2">
                    <button className="text-xs underline" onClick={() => toggle.mutate(r)}>{r.active ? "yes" : "no"}</button>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs truncate max-w-[280px]">{JSON.stringify(r.action ?? {})}</td>
                  <td className="px-3 py-2 text-right">
                    <button className="text-xs text-rose-700 underline" onClick={() => { if (confirm("Delete rule?")) remove.mutate(r.id); }}>delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DCard>

      <DCard title="Create rule" caption="JSON body — tenant_id will be attached server-side">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full font-mono text-xs border rounded p-2 min-h-[160px]"
          data-testid="rule-draft"
        />
        <div className="mt-2 flex justify-end">
          <button
            className="px-3 py-1 rounded bg-slate-900 text-white text-xs"
            onClick={() => create.mutate()}
            disabled={create.isPending}
          >
            {create.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </DCard>
    </div>
  );
}