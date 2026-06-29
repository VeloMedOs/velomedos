/**
 * Phase 6 — AR-DRG grouper integration.
 *
 * We DO NOT implement grouping logic — AR-DRG/ICD-10-AM/ACHI are licensed
 * code systems and the grouper is external CHI-approved software. This module
 * only assembles the MDS input from existing tables and calls the configured
 * grouper endpoint (or returns a deterministic stub when unset).
 */
import { serviceClient } from "@/lib/api-clinical";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type DiagnosisMds = {
  code: string;
  code_system: string;
  display: string | null;
  role: string;
  rank: number | null;
  present_on_admission: string | null;
};

export type ProcedureMds = {
  achi_code: string;
  display: string | null;
};

export type GrouperMds = {
  encounter_id: string;
  age_years: number | null;
  age_days: number | null;
  sex: string | null;
  admitted_at: string | null;
  discharged_at: string | null;
  los_days: number | null;
  same_day: boolean | null;
  mechanical_ventilation_hours: number | null;
  separation_mode: string | null;
  birth_weight_grams: number | null;
  principal_diagnosis: DiagnosisMds | null;
  additional_diagnoses: DiagnosisMds[];
  procedures: ProcedureMds[];
};

export type GrouperResult = {
  drg_code: string;
  drg_version: string;
  mdc: string | null;
  adrg: string | null;
  partition: string | null;
  complexity_score: number | null;
  grouper_name: string;
  grouper_version: string;
  raw: unknown;
};

function diffYears(from: Date, to: Date): number {
  let years = to.getUTCFullYear() - from.getUTCFullYear();
  const m = to.getUTCMonth() - from.getUTCMonth();
  if (m < 0 || (m === 0 && to.getUTCDate() < from.getUTCDate())) years -= 1;
  return years;
}

function diffDays(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

export async function buildGrouperMds(encounterId: string): Promise<GrouperMds> {
  const db = serviceClient() as any;

  const { data: enc } = await db.from("encounter")
    .select("id, beneficiary_id, same_day, mechanical_ventilation_hours, separation_mode")
    .eq("id", encounterId).single();

  const { data: hosp } = await db.from("encounter_hospitalization")
    .select("admitted_at, discharged_at, length_of_stay_days")
    .eq("encounter_id", encounterId).maybeSingle();

  const { data: ben } = await db.from("beneficiary")
    .select("dob, gender, birth_weight_grams").eq("id", enc.beneficiary_id).maybeSingle();

  const { data: dx } = await db.from("encounter_diagnosis")
    .select("code, code_system, display, role, rank, present_on_admission")
    .eq("encounter_id", encounterId);

  const diagnoses = (dx ?? []) as DiagnosisMds[];
  const principal = diagnoses.find((d) => d.role === "principal") ?? null;
  const additional = diagnoses.filter((d) => d.role !== "principal");

  const { data: charges } = await db.from("charge_item")
    .select("achi_code, display")
    .eq("encounter_id", encounterId)
    .not("achi_code", "is", null);

  const seen = new Set<string>();
  const procedures: ProcedureMds[] = [];
  for (const c of (charges ?? []) as Array<{ achi_code: string | null; display: string | null }>) {
    if (!c.achi_code || seen.has(c.achi_code)) continue;
    seen.add(c.achi_code);
    procedures.push({ achi_code: c.achi_code, display: c.display ?? null });
  }

  let ageYears: number | null = null;
  let ageDays: number | null = null;
  if (ben?.dob && hosp?.admitted_at) {
    const dob = new Date(ben.dob as string);
    const adm = new Date(hosp.admitted_at as string);
    ageYears = diffYears(dob, adm);
    ageDays = diffDays(dob, adm);
  }

  return {
    encounter_id: encounterId,
    age_years: ageYears,
    age_days: ageDays,
    sex: ben?.gender ?? null,
    admitted_at: hosp?.admitted_at ?? null,
    discharged_at: hosp?.discharged_at ?? null,
    los_days: hosp?.length_of_stay_days ?? null,
    same_day: enc.same_day ?? null,
    mechanical_ventilation_hours: enc.mechanical_ventilation_hours ?? null,
    separation_mode: enc.separation_mode ?? null,
    birth_weight_grams: ben?.birth_weight_grams ?? null,
    principal_diagnosis: principal,
    additional_diagnoses: additional,
    procedures,
  };
}

const STUB_RESULT: GrouperResult = {
  drg_code: "F62B",
  drg_version: "AR-DRG v9.0",
  mdc: "05",
  adrg: "F62",
  partition: "M",
  complexity_score: 1.0,
  grouper_name: "stub",
  grouper_version: "0",
  raw: { stub: true },
};

export async function callGrouper(mds: GrouperMds): Promise<GrouperResult> {
  const endpoint = process.env.GROUPER_ENDPOINT;
  const apiKey = process.env.GROUPER_API_KEY;
  if (!endpoint) return STUB_RESULT;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(mds),
  });
  if (!res.ok) {
    throw new Error(`grouper_http_${res.status}`);
  }
  const raw = (await res.json()) as Record<string, unknown>;
  return {
    drg_code: String(raw.drg_code ?? raw.code ?? ""),
    drg_version: String(raw.drg_version ?? raw.version ?? "unknown"),
    mdc: (raw.mdc as string | null) ?? null,
    adrg: (raw.adrg as string | null) ?? null,
    partition: (raw.partition as string | null) ?? null,
    complexity_score: typeof raw.complexity_score === "number" ? raw.complexity_score : null,
    grouper_name: String(raw.grouper_name ?? "external"),
    grouper_version: String(raw.grouper_version ?? "unknown"),
    raw,
  };
}