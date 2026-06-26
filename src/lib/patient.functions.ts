import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CredentialBadge = {
  kind: string;
  reference: string | null;
  issuer: string | null;
  expires_on: string | null;
  valid_at_time: boolean;
};

export type ProviderInfo = {
  user_id: string;
  full_name: string | null;
  role: string | null;
  credentials: CredentialBadge[];
};

export type IncidentEpisode = {
  kind: "incident";
  id: string;
  code: string;
  severity: string;
  status: string;
  address: string | null;
  at: string;
  unit_code: string | null;
  events: { id: string; at: string; kind: string; payload: unknown }[];
  provider: ProviderInfo | null;
};

export type TelehealthEpisode = {
  kind: "telehealth";
  id: string;                 // booking id
  session_id: string | null;
  clinic_name: string | null;
  reason: string | null;
  at: string;                 // slot_at
  status: string;             // booking status
  session_status: string | null;
  room_id: string | null;
  notes: string | null;
  provider: ProviderInfo | null;
};

export type ScreeningEpisode = {
  kind: "screening";
  id: string;
  test: string;
  outcome: string | null;
  fitness_status: string;
  at: string;
  certificate_url: string | null;
  provider: ProviderInfo | null;
};

export type CertificateEpisode = {
  kind: "certificate";
  id: string;
  code: string;
  course_title: string | null;
  at: string;
};

export type CareEpisode = IncidentEpisode | TelehealthEpisode | ScreeningEpisode | CertificateEpisode;

function validAt(creds: { kind: string; reference: string | null; issuer: string | null; issued_on: string | null; expires_on: string | null }[] | null, at: string): CredentialBadge[] {
  if (!creds) return [];
  const t = new Date(at).getTime();
  return creds.map((c) => {
    const issued = c.issued_on ? new Date(c.issued_on).getTime() : -Infinity;
    const expires = c.expires_on ? new Date(c.expires_on).getTime() : Infinity;
    return {
      kind: c.kind,
      reference: c.reference,
      issuer: c.issuer,
      expires_on: c.expires_on,
      valid_at_time: t >= issued && t <= expires,
    };
  });
}

/**
 * Returns the signed-in patient's credentialed care history. Uses the admin
 * client to safely join provider profile/credentials (which are otherwise RLS-
 * restricted) only AFTER verifying the caller via requireSupabaseAuth and only
 * projecting safe display fields.
 */
export const getCareHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId as string;

    // Load the patient's own profile email for screening match.
    const { data: meRow } = await supabaseAdmin
      .from("profiles").select("email,full_name").eq("id", userId).maybeSingle();
    const myEmail = meRow?.email ?? null;

    // --- Incidents
    const { data: incs } = await supabaseAdmin
      .from("incidents")
      .select("id, code, severity, status, address, created_at, assigned_ambulance_id")
      .eq("requested_by", userId)
      .order("created_at", { ascending: false });

    const incIds = (incs ?? []).map((i) => i.id);
    const ambIds = Array.from(new Set((incs ?? []).map((i) => i.assigned_ambulance_id).filter(Boolean) as string[]));

    const [{ data: events }, { data: ambs }] = await Promise.all([
      incIds.length
        ? supabaseAdmin.from("incident_events").select("id, incident_id, kind, payload, created_at").in("incident_id", incIds).order("created_at")
        : Promise.resolve({ data: [] as any[] }),
      ambIds.length
        ? supabaseAdmin.from("ambulances").select("id, code, driver_id").in("id", ambIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const driverIds = Array.from(new Set(((ambs as any[]) ?? []).map((a) => a.driver_id).filter(Boolean) as string[]));

    // --- Telehealth (bookings the patient owns)
    const { data: bookings } = await supabaseAdmin
      .from("clinic_bookings")
      .select("id, clinic_id, slot_at, reason, status, kind, created_at")
      .eq("patient_id", userId)
      .order("slot_at", { ascending: false });

    const bookingIds = (bookings ?? []).map((b) => b.id);
    const clinicIds = Array.from(new Set((bookings ?? []).map((b) => b.clinic_id)));

    const [{ data: sessions }, { data: clinics }] = await Promise.all([
      bookingIds.length
        ? supabaseAdmin.from("telehealth_sessions").select("id, booking_id, room_id, status, started_at, ended_at, notes, provider_user_id").in("booking_id", bookingIds)
        : Promise.resolve({ data: [] as any[] }),
      clinicIds.length
        ? supabaseAdmin.from("clinics").select("id, name").in("id", clinicIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const providerIds = Array.from(new Set(((sessions as any[]) ?? []).map((s) => s.provider_user_id).filter(Boolean) as string[]));

    // --- Aggregate provider profile + credentials (drivers + telehealth providers)
    const allProviderIds = Array.from(new Set([...driverIds, ...providerIds]));
    const [{ data: profs }, { data: roles }, { data: creds }] = await Promise.all([
      allProviderIds.length
        ? supabaseAdmin.from("profiles").select("id, full_name, default_role").in("id", allProviderIds)
        : Promise.resolve({ data: [] as any[] }),
      allProviderIds.length
        ? supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", allProviderIds)
        : Promise.resolve({ data: [] as any[] }),
      allProviderIds.length
        ? supabaseAdmin.from("credentials").select("subject_user_id, kind, reference, issuer, issued_on, expires_on").in("subject_user_id", allProviderIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const profById = new Map(((profs as any[]) ?? []).map((p) => [p.id, p]));
    const rolesById = new Map<string, string>();
    for (const r of ((roles as any[]) ?? [])) {
      const prev = rolesById.get(r.user_id);
      // Prefer specialist roles over generic 'patient'
      const rank = (x: string) => (x === "admin" ? 4 : x === "doctor" ? 3 : x === "paramedic" ? 2 : x === "dispatcher" ? 1 : 0);
      if (!prev || rank(r.role) > rank(prev)) rolesById.set(r.user_id, r.role);
    }
    const credsById = new Map<string, any[]>();
    for (const c of ((creds as any[]) ?? [])) {
      const list = credsById.get(c.subject_user_id) ?? [];
      list.push(c);
      credsById.set(c.subject_user_id, list);
    }
    function makeProvider(providerId: string | null | undefined, at: string): ProviderInfo | null {
      if (!providerId) return null;
      const p = profById.get(providerId);
      const role = rolesById.get(providerId) ?? p?.default_role ?? null;
      return {
        user_id: providerId,
        full_name: p?.full_name ?? null,
        role,
        credentials: validAt(credsById.get(providerId) ?? null, at),
      };
    }

    const ambById = new Map(((ambs as any[]) ?? []).map((a) => [a.id, a]));
    const eventsByInc = new Map<string, any[]>();
    for (const e of ((events as any[]) ?? [])) {
      const list = eventsByInc.get(e.incident_id) ?? [];
      list.push(e);
      eventsByInc.set(e.incident_id, list);
    }

    const incidentEpisodes: IncidentEpisode[] = ((incs as any[]) ?? []).map((i) => {
      const amb = i.assigned_ambulance_id ? ambById.get(i.assigned_ambulance_id) : null;
      return {
        kind: "incident",
        id: i.id,
        code: i.code,
        severity: i.severity,
        status: i.status,
        address: i.address,
        at: i.created_at,
        unit_code: amb?.code ?? null,
        events: (eventsByInc.get(i.id) ?? []).map((e) => ({ id: e.id, at: e.created_at, kind: e.kind, payload: e.payload })),
        provider: makeProvider(amb?.driver_id ?? null, i.created_at),
      };
    });

    const clinicById = new Map(((clinics as any[]) ?? []).map((c) => [c.id, c]));
    const sessByBooking = new Map(((sessions as any[]) ?? []).map((s) => [s.booking_id, s]));
    const telehealthEpisodes: TelehealthEpisode[] = ((bookings as any[]) ?? [])
      .filter((b) => b.kind === "telehealth")
      .map((b) => {
        const s = sessByBooking.get(b.id);
        return {
          kind: "telehealth",
          id: b.id,
          session_id: s?.id ?? null,
          clinic_name: clinicById.get(b.clinic_id)?.name ?? null,
          reason: b.reason,
          at: b.slot_at,
          status: b.status,
          session_status: s?.status ?? null,
          room_id: s?.room_id ?? null,
          notes: s?.notes ?? null,
          provider: makeProvider(s?.provider_user_id ?? null, b.slot_at),
        };
      });

    // --- Screening results matched to this patient by candidate_id_ref = email
    let screeningEpisodes: ScreeningEpisode[] = [];
    if (myEmail) {
      const { data: orders } = await supabaseAdmin
        .from("screening_orders")
        .select("id, appointment_at, created_at")
        .eq("candidate_id_ref", myEmail);
      const orderIds = ((orders as any[]) ?? []).map((o) => o.id);
      const orderAt = new Map(((orders as any[]) ?? []).map((o) => [o.id, o.appointment_at ?? o.created_at]));
      if (orderIds.length) {
        const { data: results } = await supabaseAdmin
          .from("screening_results")
          .select("id, order_id, test, outcome, fitness_status, certificate_url, recorded_by, created_at")
          .in("order_id", orderIds);
        // ensure profiles/creds for recorded_by
        const recIds = Array.from(new Set(((results as any[]) ?? []).map((r) => r.recorded_by).filter(Boolean) as string[]));
        const newOnes = recIds.filter((id) => !profById.has(id));
        if (newOnes.length) {
          const [{ data: p2 }, { data: c2 }, { data: r2 }] = await Promise.all([
            supabaseAdmin.from("profiles").select("id, full_name, default_role").in("id", newOnes),
            supabaseAdmin.from("credentials").select("subject_user_id, kind, reference, issuer, issued_on, expires_on").in("subject_user_id", newOnes),
            supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", newOnes),
          ]);
          for (const p of ((p2 as any[]) ?? [])) profById.set(p.id, p);
          for (const c of ((c2 as any[]) ?? [])) {
            const l = credsById.get(c.subject_user_id) ?? [];
            l.push(c); credsById.set(c.subject_user_id, l);
          }
          for (const r of ((r2 as any[]) ?? [])) {
            const prev = rolesById.get(r.user_id);
            const rank = (x: string) => (x === "admin" ? 4 : x === "doctor" ? 3 : x === "paramedic" ? 2 : x === "dispatcher" ? 1 : 0);
            if (!prev || rank(r.role) > rank(prev)) rolesById.set(r.user_id, r.role);
          }
        }
        screeningEpisodes = ((results as any[]) ?? []).map((r) => ({
          kind: "screening",
          id: r.id,
          test: r.test,
          outcome: r.outcome,
          fitness_status: r.fitness_status,
          at: orderAt.get(r.order_id) ?? r.created_at,
          certificate_url: r.certificate_url,
          provider: makeProvider(r.recorded_by, orderAt.get(r.order_id) ?? r.created_at),
        }));
      }
    }

    // --- Certificates earned
    const { data: enrolls } = await supabaseAdmin
      .from("enrollments").select("id, course_id, completed_at").eq("user_id", userId);
    const enrollIds = ((enrolls as any[]) ?? []).map((e) => e.id);
    const courseIds = Array.from(new Set(((enrolls as any[]) ?? []).map((e) => e.course_id)));
    const [{ data: certs }, { data: courses }] = await Promise.all([
      enrollIds.length
        ? supabaseAdmin.from("certificates").select("id, enrollment_id, code, issued_at").in("enrollment_id", enrollIds)
        : Promise.resolve({ data: [] as any[] }),
      courseIds.length
        ? supabaseAdmin.from("courses").select("id, title").in("id", courseIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const enrollById = new Map(((enrolls as any[]) ?? []).map((e) => [e.id, e]));
    const courseById = new Map(((courses as any[]) ?? []).map((c) => [c.id, c]));
    const certificateEpisodes: CertificateEpisode[] = ((certs as any[]) ?? []).map((c) => {
      const e = enrollById.get(c.enrollment_id);
      return {
        kind: "certificate",
        id: c.id,
        code: c.code,
        course_title: e ? courseById.get(e.course_id)?.title ?? null : null,
        at: c.issued_at,
      };
    });

    return {
      patient: { full_name: meRow?.full_name ?? null, email: myEmail },
      episodes: [...incidentEpisodes, ...telehealthEpisodes, ...screeningEpisodes, ...certificateEpisodes]
        .sort((a, b) => +new Date(b.at) - +new Date(a.at)),
    };
  });

/** List remote clinics available for telehealth booking (safe read). */
export const listTelehealthClinics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("clinics").select("id, name, address, specialties").order("name");
    return (data ?? []) as { id: string; name: string; address: string | null; specialties: string[] | null }[];
  });