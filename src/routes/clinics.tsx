import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SiteHeader, SiteFooter, EmergencyBanner } from "@/components/SiteChrome";
import { Search, MapPin, Calendar, Stethoscope } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const listPublicClinics = createServerFn({ method: "GET" }).handler(async () => {
  const db = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.from("clinics_public").select("id,name,address,lat,lng,specialties").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({ ...c, specialties: c.specialties ?? [] }));
});

const clinicsQuery = queryOptions({ queryKey: ["public", "clinics"], queryFn: () => listPublicClinics() });

export const Route = createFileRoute("/clinics")({
  head: () => ({
    meta: [
      { title: "Clinics & availability — VeloMed OS" },
      { name: "description", content: "Browse our physical, mobile and remote clinics by city and specialty. See what's bookable before signing in." },
      { property: "og:title", content: "VeloMed clinics & availability" },
      { property: "og:description", content: "Find a clinic by city or specialty. Booking opens after sign-in." },
      { property: "og:url", content: "/clinics" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/clinics" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(clinicsQuery),
  errorComponent: ({ error }) => <div className="p-10 text-sm text-emergency">Unable to load clinics: {error.message}</div>,
  notFoundComponent: () => <div className="p-10 text-sm">No clinics found.</div>,
  component: Clinics,
});

function nextSlots(seed: string): string[] {
  // Deterministic mock availability per clinic (real bookings happen in the patient app)
  const out: string[] = [];
  const base = new Date(); base.setMinutes(0,0,0); base.setHours(9);
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = 0; i < 4; i++) {
    const slot = new Date(base.getTime() + ((h + i*3) % 7 + 1) * 86400000 + ((h >> (i*2)) % 8) * 3600000);
    out.push(slot.toISOString());
  }
  return out.sort();
}

function Clinics() {
  const { data: clinics } = useSuspenseQuery(clinicsQuery);
  const [q, setQ] = useState("");
  const [spec, setSpec] = useState<string>("");
  const specialties = useMemo(() => Array.from(new Set(clinics.flatMap((c) => c.specialties))).sort(), [clinics]);
  const filtered = useMemo(() => clinics.filter((c) => {
    const matchQ = !q || (c.name + " " + (c.address ?? "")).toLowerCase().includes(q.toLowerCase());
    const matchS = !spec || c.specialties.includes(spec);
    return matchQ && matchS;
  }), [clinics, q, spec]);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <EmergencyBanner />
      <section className="max-w-[1400px] mx-auto px-4 lg:px-8 pt-12 pb-6">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">Clinic directory</div>
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Find a clinic. See what's bookable.</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-sm">Physical, mobile and remote/telehealth clinics across our operating regions. Booking opens after sign-in inside the patient app.</p>
      </section>
      <section className="max-w-[1400px] mx-auto px-4 lg:px-8 pb-4 flex flex-wrap gap-2">
        <label className="flex-1 min-w-[220px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by clinic name or city" maxLength={120} className="w-full h-10 pl-9 pr-3 rounded-md bg-panel border border-hairline text-sm" />
        </label>
        <select value={spec} onChange={(e) => setSpec(e.target.value)} className="h-10 px-3 rounded-md bg-panel border border-hairline text-sm">
          <option value="">All specialties</option>
          {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </section>
      <section className="max-w-[1400px] mx-auto px-4 lg:px-8 pb-24">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-hairline bg-panel p-10 text-center text-sm text-muted-foreground">No clinics match those filters.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((c) => (
              <article key={c.id} className="rounded-xl border border-hairline bg-panel p-5 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold">{c.name}</h2>
                  <Stethoscope className="size-4 text-action shrink-0" />
                </div>
                {c.address && (
                  <div className="flex items-start gap-1.5 mt-2 text-xs text-muted-foreground">
                    <MapPin className="size-3.5 mt-0.5 shrink-0" />
                    <span>{c.address}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-1 mt-3">
                  {c.specialties.slice(0, 6).map((s) => (
                    <span key={s} className="mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-panel-elevated border border-hairline text-muted-foreground">{s}</span>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-hairline">
                  <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2"><Calendar className="size-3" /> Next available</div>
                  <div className="flex flex-wrap gap-1.5">
                  {nextSlots(c.id ?? c.name ?? "x").map((iso) => (
                      <Link key={iso} to="/auth" className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-action/30 text-action hover:bg-action/10">
                        {new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                      </Link>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}