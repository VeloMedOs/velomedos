import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  getMyProfile, updateMyProfile,
  listConditions, addCondition, removeCondition,
  listAllergies, addAllergy, removeAllergy,
  listEmergencyContacts, upsertEmergencyContact, removeEmergencyContact,
  getInsuranceStatus, listConnections,
} from "@/lib/patient-profile.functions";
import { ShieldCheck, Copy, Trash2, Plus, Link2, Unlink, Mail, Phone as PhoneIcon, ChevronLeft, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/patient/profile")({
  head: () => ({ meta: [{ title: "Your profile · VeloMed" }] }),
  component: ProfilePage,
});

type Identity = { provider: string; identity_id?: string; email?: string | null; last_sign_in_at?: string | null };

function ProfilePage() {
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const updateFn = useServerFn(updateMyProfile);
  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });
  const conditionsQ = useQuery({ queryKey: ["my-conditions"], queryFn: useServerFn(listConditions) });
  const allergiesQ = useQuery({ queryKey: ["my-allergies"], queryFn: useServerFn(listAllergies) });
  const contactsQ = useQuery({ queryKey: ["my-contacts"], queryFn: useServerFn(listEmergencyContacts) });
  const insuranceQ = useQuery({ queryKey: ["my-insurance"], queryFn: useServerFn(getInsuranceStatus) });
  const connectionsQ = useQuery({ queryKey: ["my-connections"], queryFn: useServerFn(listConnections) });

  const [identities, setIdentities] = useState<Identity[]>([]);
  async function refreshIdentities() {
    const { data } = await (supabase.auth as unknown as { getUserIdentities: () => Promise<{ data: { identities: Identity[] } }> }).getUserIdentities();
    setIdentities(data?.identities ?? []);
  }
  useEffect(() => { refreshIdentities(); }, []);

  const profile = profileQ.data?.profile as any;
  const completeness = profileQ.data?.completeness ?? 0;
  const pct = Math.round((completeness / 9) * 100);

  /* ---- editable form ---- */
  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!profile) return;
    setForm({
      display_name: profile.display_name ?? profile.full_name ?? "",
      phone: profile.phone ?? "",
      dob: profile.dob ?? "",
      gender: profile.gender ?? "",
      nationality: profile.nationality ?? "",
      national_id_last4: profile.national_id_last4 ?? "",
      passport_number: profile.passport_number ?? "",
      blood_type: profile.blood_type ?? "",
    });
  }, [profile]);

  async function save() {
    try {
      await updateFn({ data: {
        display_name: form.display_name || undefined,
        phone: form.phone || undefined,
        dob: form.dob || null,
        gender: form.gender || undefined,
        nationality: form.nationality || undefined,
        national_id_last4: form.national_id_last4 || null,
        passport_number: form.passport_number || undefined,
        blood_type: form.blood_type || undefined,
      } as never });
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  const memberCode: string = profile?.member_code ?? "—";
  function copyMember() { navigator.clipboard.writeText(memberCode); toast.success("Member code copied"); }

  /* ---- identity linking (client SDK) ---- */
  async function linkProvider(provider: "google") {
    try {
      const { error } = await (supabase.auth as unknown as { linkIdentity: (a: { provider: string; options?: { redirectTo: string } }) => Promise<{ error: { message: string } | null }> }).linkIdentity({ provider, options: { redirectTo: `${window.location.origin}/patient/profile?linked=${provider}` } });
      if (error) throw error;
    } catch (e) { toast.error((e as Error).message); }
  }
  async function unlinkProvider(identity: Identity) {
    if (identities.length <= 1) { toast.error("Can't unlink your only sign-in method"); return; }
    try {
      const { error } = await (supabase.auth as unknown as { unlinkIdentity: (i: Identity) => Promise<{ error: { message: string } | null }> }).unlinkIdentity(identity);
      if (error) throw error;
      toast.success(`${identity.provider} disconnected`);
      refreshIdentities();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5 pb-24">
      <div className="flex items-center justify-between">
        <Link to="/patient" className="mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ChevronLeft className="size-3" /> My care</Link>
        <div className="mono text-[10px] uppercase tracking-widest text-stable inline-flex items-center gap-1"><ShieldCheck className="size-3" /> Verified · VeloMed member</div>
      </div>

      {/* Header */}
      <section className="rounded-xl border border-hairline bg-panel p-5">
        <div className="flex items-start gap-4">
          <div className="size-14 rounded-full bg-action/15 text-action grid place-items-center text-lg font-bold">{(form.display_name || "?").slice(0,1).toUpperCase()}</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{form.display_name || "Your profile"}</h1>
            <div className="text-[11px] text-muted-foreground mono mt-1 flex items-center gap-2">VeloMed ID · <span className="text-foreground">{memberCode}</span>
              <button onClick={copyMember} className="text-action hover:underline inline-flex items-center gap-1"><Copy className="size-3" /> Copy</button>
            </div>
          </div>
          <div className="text-right">
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Profile completeness</div>
            <div className="text-lg font-bold">{completeness}/9 · {pct}%</div>
            <div className="h-1.5 w-32 bg-panel-elevated rounded-full overflow-hidden mt-1"><div className="h-full bg-action" style={{ width: `${pct}%` }} /></div>
          </div>
        </div>
      </section>

      {/* Personal details */}
      <Section title="Personal details" sub="الخصائص الشخصية">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Name" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="+966 …" />
          <Field label="DOB" type="date" value={form.dob} onChange={(v) => setForm({ ...form, dob: v })} />
          <SelectField label="Gender" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} options={["", "Male", "Female", "Other"]} />
          <Field label="Nationality" value={form.nationality} onChange={(v) => setForm({ ...form, nationality: v })} />
          <Field label="National ID (last 4)" value={form.national_id_last4} onChange={(v) => setForm({ ...form, national_id_last4: v.replace(/\D/g,"").slice(0,4) })} />
          <Field label="Passport" value={form.passport_number} onChange={(v) => setForm({ ...form, passport_number: v })} />
          <SelectField label="Blood type" value={form.blood_type} onChange={(v) => setForm({ ...form, blood_type: v })} options={["","A+","A-","B+","B-","AB+","AB-","O+","O-"]} />
        </div>
        <div className="flex justify-end mt-3"><button onClick={save} className="h-9 px-4 rounded-md bg-action text-background mono text-[11px] uppercase tracking-widest font-bold hover:bg-action/90">Save changes</button></div>
      </Section>

      {/* Network */}
      <Section title="My network" sub="شبكتي">
        <div className="text-[12px] text-muted-foreground">{connectionsQ.data?.items?.length ?? 0} connections</div>
        {(connectionsQ.data?.items?.length ?? 0) === 0 && <div className="text-[12px] text-muted-foreground mt-2">No connections yet.</div>}
      </Section>

      {/* Medical */}
      <Section title="Medical" sub="طبي">
        <div className="text-[11px] text-muted-foreground mb-1">Blood type · فصيلة الدم</div>
        <div className="font-semibold">{form.blood_type || "Not set"}</div>

        <ItemList
          className="mt-4"
          title="Conditions · الحالات"
          items={(conditionsQ.data?.items ?? []) as { id: string; label: string }[]}
          onAdd={async (label) => { await useServerFnCall(addCondition, { label }); qc.invalidateQueries({ queryKey: ["my-conditions"] }); }}
          onRemove={async (id) => { await useServerFnCall(removeCondition, { id }); qc.invalidateQueries({ queryKey: ["my-conditions"] }); }}
        />
        <ItemList
          className="mt-4"
          title="Allergies · الحساسية"
          items={(allergiesQ.data?.items ?? []) as { id: string; label: string }[]}
          onAdd={async (label) => { await useServerFnCall(addAllergy, { label }); qc.invalidateQueries({ queryKey: ["my-allergies"] }); }}
          onRemove={async (id) => { await useServerFnCall(removeAllergy, { id }); qc.invalidateQueries({ queryKey: ["my-allergies"] }); }}
        />
      </Section>

      {/* Provider access */}
      <Section title="Provider access" sub="Insurance & RCM status">
        {(insuranceQ.data?.items?.length ?? 0) === 0
          ? <div className="text-[12px] text-muted-foreground">No insurance coverage on file yet. A provider will activate it during your visit.</div>
          : <ul className="space-y-2">{insuranceQ.data!.items.map((i: any) => (
              <li key={i.id} className="rounded-md border border-hairline bg-panel-elevated p-3 text-[12px] flex items-center justify-between">
                <div><div className="font-semibold">{i.payer}</div><div className="text-muted-foreground">Policy {i.policy_no ?? "—"}</div></div>
                <span className="mono text-[10px] uppercase tracking-widest text-action">{i.status}</span>
              </li>))}</ul>
        }
      </Section>

      {/* Emergency contacts */}
      <Section title="Emergency contacts" sub="جهات الطوارئ">
        <EmergencyContacts
          items={(contactsQ.data?.items ?? []) as any[]}
          onSave={async (row) => { await useServerFnCall(upsertEmergencyContact, row); qc.invalidateQueries({ queryKey: ["my-contacts"] }); }}
          onRemove={async (id) => { await useServerFnCall(removeEmergencyContact, { id }); qc.invalidateQueries({ queryKey: ["my-contacts"] }); }}
        />
      </Section>

      {/* Sign-in methods */}
      <Section title="Connected sign-in methods" sub="طرق تسجيل الدخول المرتبطة">
        <IdentityRow icon="google" label="Google" identity={identities.find((i) => i.provider === "google")} onLink={() => linkProvider("google")} onUnlink={(i) => unlinkProvider(i)} />
        <IdentityRow icon="apple" label="Apple" identity={identities.find((i) => i.provider === "apple")} disabled="Coming soon" onLink={() => {}} onUnlink={() => {}} />
        <IdentityRow icon="mail" label="Email & password" identity={identities.find((i) => i.provider === "email")} primary onLink={() => toast.message("Set a password from your account settings")} onUnlink={(i) => unlinkProvider(i)} />
        <IdentityRow icon="phone" label="Phone number" identity={identities.find((i) => i.provider === "phone")} primary onLink={() => toast.message("Phone sign-in requires SMS setup")} onUnlink={(i) => unlinkProvider(i)} />
        <p className="text-[11px] text-muted-foreground mt-3">Manage how you sign in to VeloMed · أدر طرق تسجيل دخولك</p>
      </Section>

      <div className="rounded-lg border border-hairline bg-panel-elevated p-3 text-[11px] text-muted-foreground flex gap-2"><AlertTriangle className="size-3.5 mt-0.5 text-warning shrink-0" /><div>VeloMed supports patients with logistics, records and guidance. It does not provide medical diagnosis, prescriptions, or replace your treating physician. In an emergency call 997 (KSA) or your local emergency services.</div></div>
    </div>
  );
}

/* ---- helpers ---- */
function useServerFnCall<T extends (...args: any) => any>(fn: T, data: any) {
  return (fn as any)({ data });
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-hairline bg-panel p-4">
      <div className="mb-3"><div className="font-semibold">{title}</div>{sub && <div className="text-[10px] text-muted-foreground mono uppercase tracking-widest">{sub}</div>}</div>
      {children}
    </section>
  );
}
function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (<label className="space-y-1 block"><div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div><input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full h-9 px-2.5 rounded-md bg-input border border-hairline text-sm focus:border-action outline-none" /></label>);
}
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (<label className="space-y-1 block"><div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div><select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full h-9 px-2.5 rounded-md bg-input border border-hairline text-sm focus:border-action outline-none">{options.map((o) => <option key={o} value={o}>{o || "—"}</option>)}</select></label>);
}
function ItemList({ title, items, onAdd, onRemove, className }: { title: string; items: { id: string; label: string }[]; onAdd: (label: string) => Promise<void>; onRemove: (id: string) => Promise<void>; className?: string }) {
  const [v, setV] = useState("");
  return (<div className={className}>
    <div className="flex items-center justify-between mb-2"><div className="text-[11px] text-muted-foreground">{title}</div><div className="mono text-[10px] text-muted-foreground">{items.length}</div></div>
    <div className="flex gap-2 mb-2">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Add new…" className="flex-1 h-8 px-2 rounded-md bg-input border border-hairline text-sm" />
      <button onClick={async () => { if (!v.trim()) return; await onAdd(v.trim()); setV(""); }} className="h-8 px-3 rounded-md bg-action text-background mono text-[10px] uppercase tracking-widest font-bold inline-flex items-center gap-1"><Plus className="size-3" /> Add</button>
    </div>
    {items.length === 0 ? <div className="text-[11px] text-muted-foreground">None recorded.</div>
      : <ul className="space-y-1">{items.map((i) => (<li key={i.id} className="flex items-center justify-between rounded-md bg-panel-elevated px-2.5 py-1.5 text-[12px]"><span>{i.label}</span><button onClick={() => onRemove(i.id)} className="text-emergency hover:text-emergency/80"><Trash2 className="size-3.5" /></button></li>))}</ul>}
  </div>);
}
function EmergencyContacts({ items, onSave, onRemove }: { items: any[]; onSave: (row: any) => Promise<void>; onRemove: (id: string) => Promise<void> }) {
  const [draft, setDraft] = useState({ name: "", relation: "", phone: "", is_primary: false });
  return (<div className="space-y-2">
    {items.length === 0 && <div className="text-[12px] text-muted-foreground">No emergency contact yet.</div>}
    <ul className="space-y-2">{items.map((c) => (
      <li key={c.id} className="rounded-md border border-hairline bg-panel-elevated p-3 flex items-center justify-between">
        <div><div className="font-semibold text-sm">{c.name} {c.is_primary && <span className="mono text-[9px] uppercase tracking-widest text-action ml-2">Primary</span>}</div><div className="text-[11px] text-muted-foreground">{c.relation} · {c.phone}</div></div>
        <button onClick={() => onRemove(c.id)} className="text-emergency"><Trash2 className="size-4" /></button>
      </li>))}</ul>
    <div className="grid grid-cols-2 gap-2">
      <input placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-9 px-2.5 rounded-md bg-input border border-hairline text-sm" />
      <input placeholder="Relation" value={draft.relation} onChange={(e) => setDraft({ ...draft, relation: e.target.value })} className="h-9 px-2.5 rounded-md bg-input border border-hairline text-sm" />
      <input placeholder="+966 …" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className="h-9 px-2.5 rounded-md bg-input border border-hairline text-sm col-span-2" />
      <label className="text-[11px] text-muted-foreground inline-flex items-center gap-2"><input type="checkbox" checked={draft.is_primary} onChange={(e) => setDraft({ ...draft, is_primary: e.target.checked })} /> Primary</label>
      <button onClick={async () => { if (!draft.name.trim() || !draft.phone.trim()) return; await onSave(draft); setDraft({ name: "", relation: "", phone: "", is_primary: false }); }} className="h-9 rounded-md bg-action text-background mono text-[10px] uppercase tracking-widest font-bold">Add contact</button>
    </div>
  </div>);
}
function IdentityRow({ icon, label, identity, primary, disabled, onLink, onUnlink }: { icon: "google" | "apple" | "mail" | "phone"; label: string; identity?: Identity; primary?: boolean; disabled?: string; onLink: () => void; onUnlink: (i: Identity) => void }) {
  const Icon = icon === "mail" ? Mail : icon === "phone" ? PhoneIcon : Link2;
  const connected = !!identity;
  return (<div className="flex items-center justify-between rounded-md border border-hairline bg-panel-elevated p-3 mb-2">
    <div className="flex items-center gap-3"><div className="size-9 rounded-md bg-panel grid place-items-center text-muted-foreground"><Icon className="size-4" /></div>
      <div><div className="font-semibold text-sm">{label}</div><div className="text-[11px] text-muted-foreground">{connected ? (identity?.email ?? "Connected") : disabled ?? "Not connected"}{primary && connected && <span className="ml-2 mono text-[9px] uppercase tracking-widest text-action">Primary</span>}</div></div>
    </div>
    {disabled ? <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{disabled}</span>
      : connected
        ? <button onClick={() => onUnlink(identity!)} className="h-8 px-3 rounded-md border border-hairline mono text-[10px] uppercase tracking-widest text-emergency inline-flex items-center gap-1"><Unlink className="size-3" /> Disconnect</button>
        : <button onClick={onLink} className="h-8 px-3 rounded-md bg-action text-background mono text-[10px] uppercase tracking-widest font-bold inline-flex items-center gap-1"><Link2 className="size-3" /> Connect</button>}
  </div>);
}