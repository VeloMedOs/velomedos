
-- ── Enums ──
do $$ begin
  create type public.care_plan_type as enum (
    'general_nursing','wound_care','chronic_disease','post_op','palliative',
    'elderly_care','maternal_newborn','medication_mgmt','physiotherapy'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.visit_frequency as enum (
    'one_off','daily','weekly','biweekly','monthly','custom'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.care_visit_status as enum (
    'scheduled','en_route','checked_in','in_progress','completed','missed','cancelled'
  );
exception when duplicate_object then null; end $$;

-- Extend app_role with homecare-specific field roles.
do $$ begin
  alter type public.app_role add value if not exists 'home_nurse';
exception when others then null; end $$;
do $$ begin
  alter type public.app_role add value if not exists 'caregiver';
exception when others then null; end $$;

-- ── Tables ──
create table if not exists public.care_recipients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  patient_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  phone text,
  address text,
  lat double precision,
  lng double precision,
  geofence_radius_m integer not null default 150,
  dob date,
  gender text,
  medical_summary text,
  emergency_contact text,
  created_at timestamptz not null default now()
);
create index if not exists idx_care_recipients_tenant on public.care_recipients(tenant_id);
create index if not exists idx_care_recipients_patient on public.care_recipients(patient_id);
grant select, insert, update, delete on public.care_recipients to authenticated;
grant all on public.care_recipients to service_role;
alter table public.care_recipients enable row level security;

create table if not exists public.care_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  recipient_id uuid not null references public.care_recipients(id) on delete cascade,
  plan_type public.care_plan_type not null,
  frequency public.visit_frequency not null,
  start_date date not null,
  end_date date,
  assigned_team_id uuid,
  required_skills text[] not null default '{}',
  status text not null default 'active',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_care_plans_tenant on public.care_plans(tenant_id);
create index if not exists idx_care_plans_recipient on public.care_plans(recipient_id);
grant select, insert, update, delete on public.care_plans to authenticated;
grant all on public.care_plans to service_role;
alter table public.care_plans enable row level security;

create table if not exists public.care_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  care_plan_id uuid not null references public.care_plans(id) on delete cascade,
  title text not null,
  instructions text,
  requires_vitals boolean not null default false
);
grant select, insert, update, delete on public.care_plan_tasks to authenticated;
grant all on public.care_plan_tasks to service_role;
alter table public.care_plan_tasks enable row level security;

create table if not exists public.care_visits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  care_plan_id uuid not null references public.care_plans(id) on delete cascade,
  recipient_id uuid not null references public.care_recipients(id) on delete cascade,
  caregiver_id uuid references auth.users(id) on delete set null,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  status public.care_visit_status not null default 'scheduled',
  check_in_at timestamptz,
  check_in_lat double precision,
  check_in_lng double precision,
  check_in_distance_m integer,
  check_out_at timestamptz,
  check_out_lat double precision,
  check_out_lng double precision,
  evv_verified boolean not null default false,
  evv_exception text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_care_visits_tenant on public.care_visits(tenant_id);
create index if not exists idx_care_visits_caregiver on public.care_visits(caregiver_id, scheduled_start);
create index if not exists idx_care_visits_recipient on public.care_visits(recipient_id, scheduled_start);
create index if not exists idx_care_visits_status on public.care_visits(status, scheduled_start);
grant select, insert, update, delete on public.care_visits to authenticated;
grant all on public.care_visits to service_role;
alter table public.care_visits enable row level security;

create table if not exists public.care_visit_tasks (
  id uuid primary key default gen_random_uuid(),
  care_visit_id uuid not null references public.care_visits(id) on delete cascade,
  plan_task_id uuid references public.care_plan_tasks(id) on delete set null,
  title text not null,
  completed boolean not null default false,
  completed_at timestamptz
);
grant select, insert, update, delete on public.care_visit_tasks to authenticated;
grant all on public.care_visit_tasks to service_role;
alter table public.care_visit_tasks enable row level security;

create table if not exists public.care_visit_vitals (
  id uuid primary key default gen_random_uuid(),
  care_visit_id uuid not null references public.care_visits(id) on delete cascade,
  type text not null,
  value text not null,
  unit text,
  recorded_at timestamptz not null default now()
);
grant select, insert, update, delete on public.care_visit_vitals to authenticated;
grant all on public.care_visit_vitals to service_role;
alter table public.care_visit_vitals enable row level security;

create table if not exists public.medication_administrations (
  id uuid primary key default gen_random_uuid(),
  care_visit_id uuid not null references public.care_visits(id) on delete cascade,
  drug_name text not null,
  dose text,
  route text,
  scheduled_at timestamptz,
  administered_at timestamptz,
  administered_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
);
grant select, insert, update, delete on public.medication_administrations to authenticated;
grant all on public.medication_administrations to service_role;
alter table public.medication_administrations enable row level security;

-- ── EVV helpers ──
create or replace function public.haversine_m(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision
language sql immutable set search_path = public as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians((lat2 - lat1) / 2)), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians((lng2 - lng1) / 2)), 2)
  ));
$$;

create or replace function public.care_visits_compute_evv()
returns trigger language plpgsql set search_path = public as $$
declare
  r record;
  tol_minutes integer := 30;
begin
  select cr.lat, cr.lng, cr.geofence_radius_m into r
  from public.care_recipients cr
  where cr.id = new.recipient_id;

  if new.check_in_lat is not null and new.check_in_lng is not null and r.lat is not null then
    new.check_in_distance_m := round(public.haversine_m(r.lat, r.lng, new.check_in_lat, new.check_in_lng))::int;
  end if;

  if new.check_in_at is not null and new.check_out_at is not null then
    if new.check_in_distance_m is not null
       and new.check_in_distance_m <= coalesce(r.geofence_radius_m, 150)
       and new.check_in_at between (new.scheduled_start - make_interval(mins => tol_minutes))
                              and  (new.scheduled_end   + make_interval(mins => tol_minutes))
    then
      new.evv_verified := true;
      new.evv_exception := null;
    else
      new.evv_verified := false;
      if new.evv_exception is null then
        new.evv_exception := case
          when new.check_in_distance_m is null then 'no_location'
          when new.check_in_distance_m > coalesce(r.geofence_radius_m, 150) then 'out_of_geofence'
          else 'out_of_time_window'
        end;
      end if;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_care_visits_evv on public.care_visits;
create trigger trg_care_visits_evv
  before insert or update on public.care_visits
  for each row execute function public.care_visits_compute_evv();

-- ── Realtime ──
alter table public.care_visits replica identity full;
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='care_visits'
  ) then
    execute 'alter publication supabase_realtime add table public.care_visits';
  end if;
end $$;

-- ── RLS ──
create policy "homecare admins manage recipients"
  on public.care_recipients for all to authenticated
  using (public.has_role(auth.uid(),'admin'::app_role) or public.has_role(auth.uid(),'dispatcher'::app_role))
  with check (public.has_role(auth.uid(),'admin'::app_role) or public.has_role(auth.uid(),'dispatcher'::app_role));

create policy "homecare admins manage plans"
  on public.care_plans for all to authenticated
  using (public.has_role(auth.uid(),'admin'::app_role) or public.has_role(auth.uid(),'dispatcher'::app_role))
  with check (public.has_role(auth.uid(),'admin'::app_role) or public.has_role(auth.uid(),'dispatcher'::app_role));

create policy "homecare admins manage plan tasks"
  on public.care_plan_tasks for all to authenticated
  using (public.has_role(auth.uid(),'admin'::app_role) or public.has_role(auth.uid(),'dispatcher'::app_role))
  with check (public.has_role(auth.uid(),'admin'::app_role) or public.has_role(auth.uid(),'dispatcher'::app_role));

create policy "homecare admins manage visits"
  on public.care_visits for all to authenticated
  using (public.has_role(auth.uid(),'admin'::app_role) or public.has_role(auth.uid(),'dispatcher'::app_role))
  with check (public.has_role(auth.uid(),'admin'::app_role) or public.has_role(auth.uid(),'dispatcher'::app_role));

create policy "caregiver reads own visits"
  on public.care_visits for select to authenticated
  using (caregiver_id = auth.uid());
create policy "caregiver updates own visits"
  on public.care_visits for update to authenticated
  using (caregiver_id = auth.uid())
  with check (caregiver_id = auth.uid());

create policy "caregiver reads assigned recipients"
  on public.care_recipients for select to authenticated
  using (exists (
    select 1 from public.care_visits v
    where v.recipient_id = care_recipients.id and v.caregiver_id = auth.uid()
  ));
create policy "caregiver reads assigned plans"
  on public.care_plans for select to authenticated
  using (exists (
    select 1 from public.care_visits v
    where v.care_plan_id = care_plans.id and v.caregiver_id = auth.uid()
  ));
create policy "caregiver reads assigned plan tasks"
  on public.care_plan_tasks for select to authenticated
  using (exists (
    select 1 from public.care_visits v
    where v.care_plan_id = care_plan_tasks.care_plan_id and v.caregiver_id = auth.uid()
  ));
create policy "caregiver writes visit tasks"
  on public.care_visit_tasks for all to authenticated
  using (exists (select 1 from public.care_visits v where v.id = care_visit_tasks.care_visit_id and v.caregiver_id = auth.uid()))
  with check (exists (select 1 from public.care_visits v where v.id = care_visit_tasks.care_visit_id and v.caregiver_id = auth.uid()));
create policy "caregiver writes visit vitals"
  on public.care_visit_vitals for all to authenticated
  using (exists (select 1 from public.care_visits v where v.id = care_visit_vitals.care_visit_id and v.caregiver_id = auth.uid()))
  with check (exists (select 1 from public.care_visits v where v.id = care_visit_vitals.care_visit_id and v.caregiver_id = auth.uid()));
create policy "caregiver writes mar"
  on public.medication_administrations for all to authenticated
  using (exists (select 1 from public.care_visits v where v.id = medication_administrations.care_visit_id and v.caregiver_id = auth.uid()))
  with check (exists (select 1 from public.care_visits v where v.id = medication_administrations.care_visit_id and v.caregiver_id = auth.uid()));

create policy "admin reads visit tasks"
  on public.care_visit_tasks for select to authenticated
  using (public.has_role(auth.uid(),'admin'::app_role) or public.has_role(auth.uid(),'dispatcher'::app_role));
create policy "admin reads visit vitals"
  on public.care_visit_vitals for select to authenticated
  using (public.has_role(auth.uid(),'admin'::app_role) or public.has_role(auth.uid(),'dispatcher'::app_role));
create policy "admin reads mar"
  on public.medication_administrations for select to authenticated
  using (public.has_role(auth.uid(),'admin'::app_role) or public.has_role(auth.uid(),'dispatcher'::app_role));

create policy "patient reads own recipient"
  on public.care_recipients for select to authenticated
  using (patient_id = auth.uid());
create policy "patient reads own visits"
  on public.care_visits for select to authenticated
  using (exists (
    select 1 from public.care_recipients cr
    where cr.id = care_visits.recipient_id and cr.patient_id = auth.uid()
  ));
create policy "patient reads own plans"
  on public.care_plans for select to authenticated
  using (exists (
    select 1 from public.care_recipients cr
    where cr.id = care_plans.recipient_id and cr.patient_id = auth.uid()
  ));

-- ── Demo seed ──
do $$
declare
  t uuid := '11111111-2222-3333-4444-555555555555';
  r1 uuid; r2 uuid; r3 uuid;
  p1 uuid; p2 uuid;
begin
  if not exists (select 1 from public.care_recipients where tenant_id = t) then
    insert into public.care_recipients (tenant_id, full_name, phone, address, lat, lng, dob, gender, medical_summary, emergency_contact)
      values (t,'Aisha Al-Mutairi','+966500000001','Al Olaya, Riyadh',24.6877,46.6857,'1948-03-12','F','Type 2 diabetes, stage-2 pressure injury','Son · +966500000010') returning id into r1;
    insert into public.care_recipients (tenant_id, full_name, phone, address, lat, lng, dob, gender, medical_summary, emergency_contact)
      values (t,'Mohammed Al-Harbi','+966500000002','Al Malaz, Riyadh',24.6760,46.7400,'1955-11-02','M','Post-CABG, chronic heart failure','Daughter · +966500000020') returning id into r2;
    insert into public.care_recipients (tenant_id, full_name, phone, address, lat, lng, dob, gender, medical_summary, emergency_contact)
      values (t,'Noura Al-Qahtani','+966500000003','Al Nakheel, Riyadh',24.7741,46.6347,'1962-07-21','F','COPD, on bronchodilator therapy','Husband · +966500000030') returning id into r3;

    insert into public.care_plans (tenant_id, recipient_id, plan_type, frequency, start_date, required_skills, notes)
      values (t, r1, 'wound_care'::care_plan_type, 'daily'::visit_frequency, current_date, array['wound_dressing','diabetic_care'], 'Daily dressing change, glucose check.') returning id into p1;
    insert into public.care_plan_tasks (care_plan_id, title, requires_vitals) values
      (p1,'Wound assessment and dressing change', true),
      (p1,'Blood glucose check', true);

    insert into public.care_plans (tenant_id, recipient_id, plan_type, frequency, start_date, required_skills, notes)
      values (t, r2, 'chronic_disease'::care_plan_type, 'weekly'::visit_frequency, current_date, array['cardiac_assessment'], 'Weekly vitals + medication reconciliation.') returning id into p2;
    insert into public.care_plan_tasks (care_plan_id, title, requires_vitals) values
      (p2,'Vitals (BP, HR, SpO2, weight)', true),
      (p2,'Medication reconciliation', false);

    insert into public.care_visits (tenant_id, care_plan_id, recipient_id, scheduled_start, scheduled_end)
    select t, p1, r1,
           (current_date + i) + time '09:00',
           (current_date + i) + time '09:45'
      from generate_series(0,6) as i;

    insert into public.care_visits (tenant_id, care_plan_id, recipient_id, scheduled_start, scheduled_end)
    values (t, p2, r2, (current_date + 2) + time '11:00', (current_date + 2) + time '12:00');
  end if;
end $$;
