import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ProfilePatch = z.object({
  display_name: z.string().max(120).optional(),
  full_name: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  gender: z.string().max(20).optional(),
  nationality: z.string().max(80).optional(),
  national_id_last4: z.string().regex(/^\d{4}$/).nullable().optional(),
  passport_number: z.string().max(40).optional(),
  blood_type: z.string().max(8).optional(),
}).strict();

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: completeness }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.rpc("profile_completeness", { _user_id: userId }),
    ]);
    return { profile, completeness: (completeness as number | null) ?? 0 };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProfilePatch.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles").update(data).eq("id", userId);
    if (error) throw error;
    return { ok: true };
  });

/* ---- conditions ---- */
export const listConditions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("patient_conditions").select("*").eq("user_id", context.userId).order("created_at", { ascending: false });
    if (error) throw error; return { items: data ?? [] };
  });

export const addCondition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ label: z.string().min(1).max(120), severity: z.string().max(20).optional(), notes: z.string().max(500).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("patient_conditions").insert({ ...data, user_id: context.userId });
    if (error) throw error; return { ok: true };
  });

export const removeCondition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("patient_conditions").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw error; return { ok: true };
  });

/* ---- allergies ---- */
export const listAllergies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("patient_allergies").select("*").eq("user_id", context.userId).order("created_at", { ascending: false });
    if (error) throw error; return { items: data ?? [] };
  });

export const addAllergy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ label: z.string().min(1).max(120), reaction: z.string().max(200).optional(), severity: z.string().max(20).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("patient_allergies").insert({ ...data, user_id: context.userId });
    if (error) throw error; return { ok: true };
  });

export const removeAllergy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("patient_allergies").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw error; return { ok: true };
  });

/* ---- emergency contacts ---- */
export const listEmergencyContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("patient_emergency_contacts").select("*").eq("user_id", context.userId).order("is_primary", { ascending: false });
    if (error) throw error; return { items: data ?? [] };
  });

export const upsertEmergencyContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(120),
    relation: z.string().max(60).optional(),
    phone: z.string().min(3).max(40),
    is_primary: z.boolean().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const row = { ...data, user_id: context.userId };
    const { error } = data.id
      ? await context.supabase.from("patient_emergency_contacts").update(row).eq("id", data.id).eq("user_id", context.userId)
      : await context.supabase.from("patient_emergency_contacts").insert(row);
    if (error) throw error; return { ok: true };
  });

export const removeEmergencyContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("patient_emergency_contacts").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw error; return { ok: true };
  });

/* ---- insurance & connections ---- */
export const getInsuranceStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("patient_insurance").select("*").eq("user_id", context.userId).order("created_at", { ascending: false });
    if (error) throw error; return { items: data ?? [] };
  });

export const listConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("patient_connections").select("*").eq("owner_id", context.userId).order("created_at", { ascending: false });
    if (error) throw error; return { items: data ?? [] };
  });