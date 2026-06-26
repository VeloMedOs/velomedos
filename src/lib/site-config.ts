// Central marketing-site configuration. Edit these values to localise the public site.
export const SITE = {
  brand: "VeloMed OS",
  legal: "VeloMed Infrastructure Group",
  tagline: "API-first medical mobility platform",
  description:
    "VeloMed OS is the API-first operating system for medical mobility: emergency ambulance dispatch with live tracking, fleet compliance, remote and mobile clinics, pre-employment screening, EMS training and a public REST API.",
  region: "the Middle East & Africa",
  country: "Middle East & Africa",
  // Marketing-site canonical/og:url should be self-referencing per route.
  // Domain left as relative paths until a real domain is connected.
  contact: {
    phone: "+971 4 000 0000",
    phoneHref: "tel:+97140000000",
    email: "hello@velomed.health",
    emailHref: "mailto:hello@velomed.health",
    address: {
      streetAddress: "Office 14, Mobility Tower",
      addressLocality: "Dubai",
      addressRegion: "Dubai",
      postalCode: "00000",
      addressCountry: "AE",
    },
  },
  social: {
    linkedin: "https://www.linkedin.com/company/velomed-os",
    x: "https://x.com/velomed_os",
    github: "https://github.com/velomed",
  },
  cities: [
    { slug: "dubai", name: "Dubai", country: "United Arab Emirates" },
    { slug: "abu-dhabi", name: "Abu Dhabi", country: "United Arab Emirates" },
    { slug: "riyadh", name: "Riyadh", country: "Saudi Arabia" },
    { slug: "jeddah", name: "Jeddah", country: "Saudi Arabia" },
    { slug: "doha", name: "Doha", country: "Qatar" },
    { slug: "manama", name: "Manama", country: "Bahrain" },
    { slug: "kuwait-city", name: "Kuwait City", country: "Kuwait" },
    { slug: "muscat", name: "Muscat", country: "Oman" },
  ],
} as const;

export type City = (typeof SITE.cities)[number];

export const SERVICES = [
  {
    slug: "emergency-dispatch",
    title: "Emergency ambulance dispatch & live tracking",
    short: "Sub-second dispatch with road-based ETA and 5-second GPS from every unit on shift.",
    keyword: "emergency ambulance dispatch & live tracking",
    benefits: [
      "24/7 call-centre console with SLA timers, intake triage and one-tap reassignment.",
      "Road-based ETA calculated against live traffic, not straight-line distance.",
      "5-second GPS upstream from every ambulance, paramedic and on-shift doctor.",
      "Shareable patient tracking link with no account required.",
    ],
    how: [
      "Calls and web requests land in a unified queue with severity-driven SLA timers.",
      "Dispatchers see the nearest compliant units on a live map and assign in one tap.",
      "Crews accept on their phone; status syncs the lifecycle automatically.",
      "Patients and partners track ETA in real time on a public link.",
    ],
    faqs: [
      { q: "How fast is your dispatch?", a: "Our median time from call-pickup to en-route across operating cities is under six minutes." },
      { q: "Can patients track the ambulance?", a: "Yes — every dispatched trip generates a public, tokenised tracking link with live position and road-based ETA." },
      { q: "Do you integrate with our own systems?", a: "Yes — every surface in the platform is exposed through our documented public REST API." },
    ],
  },
  {
    slug: "fleet-compliance",
    title: "Ambulance fleet compliance & maintenance software",
    short: "Vehicle credentials, defect intake and work orders that gate dispatch automatically.",
    keyword: "ambulance fleet compliance and maintenance software",
    benefits: [
      "Track every vehicle credential (registration, insurance, inspection) with expiry alerts.",
      "Field crews file defects in seconds; severity drives an out-of-service rule.",
      "Work orders link parts, labour and downtime back to the unit's lifecycle.",
      "Dispatch can only assign units that are compliant — enforced by the database view.",
    ],
    how: [
      "Credentials are stored per vehicle with expiry dates and alert thresholds.",
      "Defects raised from the Provider app trigger workflow and alert maintenance.",
      "A `dispatchable_ambulances` view filters out non-roadworthy units.",
    ],
    faqs: [
      { q: "What stops a non-compliant unit from being dispatched?", a: "A database view gates the assignment pool; the dispatch console only sees units with valid credentials and no critical open defects." },
      { q: "Can we export compliance evidence?", a: "Yes — the public API exposes credentials, defects and work orders per vehicle for auditors and regulators." },
    ],
  },
  {
    slug: "remote-clinics",
    title: "Remote clinics and telehealth consultations",
    short: "Bookable physical, mobile and telehealth clinics across our operating regions.",
    keyword: "telehealth and remote clinic consultation",
    benefits: [
      "Unified directory of physical, mobile and telehealth clinics with live availability.",
      "Patients book in-person or telehealth from one flow.",
      "Clinician credentials are verified at the exact time of care.",
      "Telehealth sessions launch from the patient app 10 minutes before start.",
    ],
    how: [
      "Clinics publish slots; patients book in the app or directly from the website.",
      "Telehealth bookings create a session linked to the clinic booking.",
      "Care episodes appear in the patient's verified care history.",
    ],
    faqs: [
      { q: "Is telehealth available in all your cities?", a: "Yes — telehealth is available platform-wide; in-person clinics depend on which city you choose." },
      { q: "Are clinicians verified?", a: "Every consultation is bound to a credentialed clinician; the verification badge is shown in the patient's care history." },
    ],
  },
  {
    slug: "mobile-screening",
    title: "Mobile pre-employment medical screening",
    short: "On-site corporate medicals, bloods, vitals, drug & alcohol and occupational health.",
    keyword: "mobile pre-employment medical screening",
    benefits: [
      "Mobile screening units delivered to your site — no employee travel.",
      "Configurable packages per role (general, drivers, food handlers, safety-critical).",
      "Results delivered through the corporate portal with audit trail.",
      "Bulk scheduling and reporting through the REST API.",
    ],
    how: [
      "Corporate account is created; HR uploads roster and selects packages.",
      "Mobile unit visits on the agreed day; results are filed against each employee.",
      "Outcomes feed back into the corporate dashboard and the public API.",
    ],
    faqs: [
      { q: "How many people can you screen per visit?", a: "Throughput depends on the package, but a standard mobile unit handles up to 60 employees per day." },
      { q: "Do you serve remote sites?", a: "Yes — mobile screening is built for remote, industrial and worksite locations." },
    ],
  },
  {
    slug: "training-certification",
    title: "EMS, paramedic training and certification",
    short: "Accredited ALS, EMT-Basic, Tactical Paramedic and refresher pathways.",
    keyword: "EMS paramedic training and certification",
    benefits: [
      "Accredited curricula with verifiable certificates on completion.",
      "Blended online + on-site practical sessions across operating cities.",
      "Corporate cohorts and refresher pathways supported.",
      "Certificates expose verification endpoints on the public API.",
    ],
    how: [
      "Enrol online; complete modules and assessments at your pace.",
      "Attend the practical session at the nearest training centre.",
      "Receive a verifiable certificate signed by the issuing instructor.",
    ],
    faqs: [
      { q: "Are your certificates recognised?", a: "Our programmes are aligned with internationally recognised EMS curricula; certificates are independently verifiable." },
      { q: "Can we book a corporate cohort?", a: "Yes — request a cohort from the contact form and our training lead will respond within one business day." },
    ],
  },
  {
    slug: "developer-api",
    title: "Public medical dispatch and fleet tracking API",
    short: "Documented OpenAPI 3.1 surface for fleet, incidents, clinics, courses, compliance and ETA.",
    keyword: "medical dispatch and fleet tracking API",
    benefits: [
      "Same REST endpoints power our own dispatch, provider and patient surfaces.",
      "Scoped API keys with per-minute rate limits and audit log.",
      "OpenAPI 3.1 spec with Swagger UI — generate clients in any language.",
      "Webhook subscriptions for incident lifecycle events.",
    ],
    how: [
      "Generate a scoped API key from the Developer console.",
      "Read the OpenAPI spec and try endpoints from Swagger UI.",
      "Subscribe to webhooks for incident, trip and compliance events.",
    ],
    faqs: [
      { q: "Is there a sandbox?", a: "Yes — every account starts in a sandbox tenant; promote to live once your integration is signed off." },
      { q: "Which auth model do you use?", a: "API keys with scopes for fleet, incidents, clinics and compliance — passed as the `x-api-key` header." },
    ],
  },
] as const;

export type Service = (typeof SERVICES)[number];
export const getService = (slug: string) => SERVICES.find((s) => s.slug === slug);

export const RESOURCES = [
  {
    slug: "what-is-medical-mobility",
    title: "What is medical mobility? A primer for operators in 2026",
    description: "Medical mobility unifies ambulance dispatch, remote clinics, screening and EMS training on one platform. Here's what it means for operators.",
    date: "2026-04-12",
    readMinutes: 7,
    excerpt: "Medical mobility is the operational layer that lets a single team run ambulances, clinics and field screening from one system of record.",
    body: [
      "For decades, ambulance services, clinics and corporate health screening have operated as separate businesses with separate systems. Medical mobility is the shift toward unifying them — clinically, commercially, and on a single API.",
      "An operator running medical mobility serves emergency dispatch, scheduled telehealth, on-site corporate screening and EMS training from one roster, one fleet and one set of clinical credentials.",
      "The economics change too: a paramedic certified through your training school can be the same paramedic on shift, on a mobile screening unit on Tuesday, and back on an ALS truck on Wednesday.",
      "This is why API-first matters. If every surface — dispatch console, provider app, patient app, partner integrations — reads and writes through the same documented endpoints, you can compose new revenue lines without rebuilding your stack.",
    ],
  },
  {
    slug: "ambulance-dispatch-sla-design",
    title: "Designing ambulance dispatch SLAs that hold up in the field",
    description: "How to set ambulance dispatch SLAs by severity, how to measure them honestly, and the failure modes that quietly inflate compliance scores.",
    date: "2026-03-22",
    readMinutes: 9,
    excerpt: "Most ambulance SLAs look great on paper and fall apart on a hot afternoon. Here's a model that survives reality.",
    body: [
      "A useful SLA isn't a target you can hit on a quiet Sunday — it's one you can defend on a hot Thursday afternoon with three open code-reds.",
      "The cleanest design we've found is severity-banded: Code Red gets an 8-minute on-scene SLA, Code Yellow 20, Routine 60. The clock starts at call-pickup, not at unit-assignment — because the patient doesn't care when your dispatcher clicked Assign.",
      "Measure it from the same timestamp the patient experienced. If your queue auto-prioritises by severity but your reporting starts the clock at acceptance, you'll quietly look better than you are.",
      "Finally, treat SLA breaches as audit-grade events, not as KPIs to tune. Every breach should have a chain of incident events explaining exactly where the minute went.",
    ],
  },
  {
    slug: "fleet-compliance-as-a-gate",
    title: "Fleet compliance shouldn't be a dashboard — it should be a gate",
    description: "Compliance dashboards don't stop a non-roadworthy ambulance from being dispatched. A database-level gate does.",
    date: "2026-02-08",
    readMinutes: 6,
    excerpt: "If your compliance system tells you about non-compliant units after the fact, it's a report, not a control.",
    body: [
      "We've audited operators where the compliance dashboard glowed green while a unit with an expired insurance certificate was on the road. The system knew. The dispatcher didn't.",
      "The fix is structural: the assignable pool of units should be a database view that filters out anything with an expired credential or a critical open defect. Dispatchers never see non-compliant units, so they can't assign them.",
      "This trades a small amount of dispatcher autonomy for a hard guarantee that the business cannot accidentally do something it isn't legally allowed to do.",
    ],
  },
] as const;

export type Resource = (typeof RESOURCES)[number];
export const getResource = (slug: string) => RESOURCES.find((r) => r.slug === slug);