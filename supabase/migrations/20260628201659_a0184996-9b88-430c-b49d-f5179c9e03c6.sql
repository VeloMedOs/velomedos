
CREATE TABLE public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  body_md text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  published boolean NOT NULL DEFAULT true,
  effective_date date,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.legal_documents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_documents TO authenticated;
GRANT ALL ON public.legal_documents TO service_role;

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published legal docs"
  ON public.legal_documents FOR SELECT
  USING (published = true);

CREATE POLICY "Portal staff can read all legal docs"
  ON public.legal_documents FOR SELECT
  TO authenticated
  USING (public.is_portal_staff(auth.uid()));

CREATE POLICY "Portal staff can manage legal docs"
  ON public.legal_documents FOR ALL
  TO authenticated
  USING (public.is_portal_staff(auth.uid()))
  WITH CHECK (public.is_portal_staff(auth.uid()));

CREATE TRIGGER legal_documents_touch
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed
INSERT INTO public.legal_documents (slug, title, subtitle, effective_date, body_md) VALUES
('home',
 'Privacy Policy',
 'How VeloMed Infrastructure Group collects, uses, and protects your personal and health information across the VeloMed OS platform.',
 CURRENT_DATE,
$$
## 1. Introduction
VeloMed Infrastructure Group ("**VeloMed**", "**we**", "**us**", "**our**") operates the VeloMed OS platform — an API-first emergency response, remote clinic, ambulance rental, and clinical training infrastructure serving the Kingdom of Saudi Arabia and the wider Gulf Cooperation Council (GCC) region. We are committed to protecting the privacy and confidentiality of patients, providers, paramedics, drivers, learners, call-center agents, and business administrators.

This Privacy Policy explains what personal data and protected health information ("**PHI**") we collect, how we use it, the legal bases on which we process it, who we share it with, and the rights you have. It is published under and aligned with:
- **KSA Personal Data Protection Law (PDPL)** issued by Royal Decree M/19 of 1443H and its Implementing Regulations administered by the Saudi Data & Artificial Intelligence Authority (**SDAIA**).
- **National Cybersecurity Authority (NCA)** Essential Cybersecurity Controls (**ECC-1**) and Cloud Cybersecurity Controls (**CCC-1**).
- **Council of Health Insurance (CHI)** and **Saudi Health Information Exchange (SHIE)** data-handling standards.
- **GCC** national data protection statutes including UAE PDPL (Federal Decree-Law 45/2021), Bahrain PDPL (Law 30/2018), Oman PDPL (Royal Decree 6/2022), Qatar PDPPL (Law 13/2016), and Kuwait CITRA Data Privacy Protection Regulation.
- **HIPAA** (U.S. Health Insurance Portability and Accountability Act, 45 CFR Parts 160 & 164) where VeloMed acts as a Business Associate to U.S.-regulated covered entities.

## 2. Who is the data controller
The data controller is **VeloMed Infrastructure Group**, registered in the Kingdom of Saudi Arabia. Our Data Protection Officer (DPO) is reachable at **dpo@velomedos.com**.

## 3. Information we collect
We collect only what is necessary to deliver, secure, and improve our services:

**3.1 Identity & contact data** — full name, national ID or Iqama (last four digits stored), passport number, date of birth, gender, nationality, mobile number, email address.

**3.2 Health & clinical data ("PHI")** — chief complaint, vitals captured by crews, allergies, chronic conditions, medications, immunisation status, blood type, medical history disclosed during triage, telehealth consultation notes, prescriptions, lab results, vaccination records, and ambulance run sheets.

**3.3 Insurance & eligibility data** — payer name, policy number, coverage class, CHI/Nphies eligibility responses.

**3.4 Location & telemetry data** — pickup and drop-off coordinates, live GPS of dispatched units, driver duty status, route polylines, ETA computations.

**3.5 Account & device data** — hashed credentials, session tokens, OAuth identifiers (Google), device model, OS, IP address, browser fingerprint, push tokens.

**3.6 Operational data** — call recordings (when explicitly disclosed), chat transcripts with agents, support tickets, satisfaction ratings.

**3.7 Training & certification data** — course enrolment, attendance, examination scores, issued certificates (BLS, ACLS, PHTLS, ITLS).

We do not knowingly collect data from children under 13 without verified parental consent.

## 4. Lawful bases for processing
We process personal data on the following bases recognised under KSA PDPL Article 6 and equivalent GCC instruments:
- **Vital interest** — to dispatch emergency care when life or health is at risk.
- **Performance of a contract** — to deliver subscribed services (rental, remote clinic, training).
- **Legal obligation** — to comply with MoH reporting, CHI claims, NCA logging, and tax requirements.
- **Explicit consent** — for marketing communications, optional telemetry, and secondary research.
- **Legitimate interest** — to secure the platform, prevent fraud, and improve service quality, balanced against your rights.

## 5. How we use your data
- Coordinate emergency response and route the nearest qualified unit.
- Conduct telehealth and remote-clinic encounters and issue prescriptions.
- Verify insurance eligibility and submit Nphies-compliant claims.
- Issue, deliver, and verify training certificates.
- Provide tenant administrators with operational dashboards and audit trails.
- Detect, investigate, and prevent security incidents and fraud.
- Comply with regulatory reporting obligations.

We do **not** sell personal data. We do **not** use PHI for behavioural advertising.

## 6. International transfers
Primary processing occurs inside the Kingdom of Saudi Arabia. Where data must transit to a sub-processor outside the GCC, we rely on (a) SDAIA-approved adequacy decisions, (b) Standard Contractual Clauses, and (c) explicit informed consent where required. A current list of sub-processors is maintained at **/Privacy/Subprocessors** (on request).

## 7. Data retention
- Active clinical encounter records: minimum 10 years from last service, per MoH archival standards.
- Ambulance run sheets and dispatch logs: minimum 10 years.
- Telemetry and GPS breadcrumbs: 90 days in hot storage, 24 months in cold archive.
- Account & authentication logs: 24 months.
- Marketing consent records: until withdrawn, then 36 months for evidentiary purposes.
- Pseudonymised analytics: indefinitely.

## 8. Security measures
We apply NCA ECC-1 and ISO/IEC 27001-aligned controls including AES-256 at-rest encryption, TLS 1.3 in transit, role-based access control, least-privilege service accounts, hardware-backed key management, immutable audit logging, 24×7 SOC monitoring, quarterly penetration testing, and continuous vulnerability scanning. PHI access is restricted by the minimum-necessary principle.

## 9. Your rights
Subject to applicable law you may at any time:
- Request access to a copy of your personal data and PHI.
- Request correction of inaccurate or incomplete data.
- Request erasure ("right to be forgotten") where no overriding legal obligation applies.
- Object to or restrict certain processing.
- Withdraw consent for processing based on consent.
- Request portability of data you provided.
- Lodge a complaint with SDAIA (KSA) or your national supervisory authority.

To exercise any of these rights, write to **privacy@velomedos.com**. We will respond within **30 days**.

## 10. Cookies & similar technologies
The marketing site uses strictly necessary cookies and, with consent, analytics cookies. The clinical applications use first-party session storage only.

## 11. Children's privacy
Care delivered to minors is provided under the consent of a parent or legal guardian recorded at intake.

## 12. Changes to this policy
We will notify subscribers and account administrators of material changes by email and in-app banner at least **30 days** before they take effect. The current version number and effective date appear at the top of this page.

## 13. Sub-section index
- [Terms of Service](/Privacy/TermsOfService)
- [HIPAA Notice of Privacy Practices](/Privacy/HIPAA)
- [Patient Rights & Responsibilities](/Privacy/PatientRights)

## 14. Contact
**Data Protection Officer** — dpo@velomedos.com
**General Privacy** — privacy@velomedos.com
**Security Incident Reporting** — security@velomedos.com
$$
),
('terms',
 'Terms of Service',
 'The legally binding contract governing your use of the VeloMed OS platform and any services offered by VeloMed Infrastructure Group.',
 CURRENT_DATE,
$$
## 1. Acceptance of these terms
By creating an account, signing a subscription order form, or otherwise accessing the VeloMed OS platform (the "**Platform**") you ("**Customer**", "**you**") agree to be bound by these Terms of Service (the "**Terms**"). If you are entering these Terms on behalf of an entity you represent that you have authority to bind that entity.

## 2. Definitions
- **Services** — the VeloMed OS subscription modules including Emergency Dispatch, Remote Clinics, Ambulance Rental, Training & Certification, Provider App, Patient App, Call-Center Console, and Superadmin Control Plane.
- **Subscriber** — the entity named on the order form.
- **End User** — any natural person authorised by Subscriber to use the Services.
- **Customer Data** — all data Subscriber or its End Users submit to the Platform.
- **PHI** — protected health information as defined in HIPAA and KSA MoH policies.

## 3. Eligibility & accounts
Use of the Platform is restricted to entities and individuals legally permitted to provide or receive healthcare and emergency-response services in their jurisdiction. You are responsible for the accuracy of account information, the confidentiality of credentials, and all activity under your account.

## 4. Subscription, fees & billing
- Subscription tiers, included quotas, and pricing are defined in the executed order form or, for self-service plans, at **/pricing**.
- Fees are invoiced in advance on a monthly or annual basis and are non-refundable except where required by mandatory law.
- Late payments accrue interest at the lower of 1.5% per month or the maximum rate permitted by Saudi commercial law.
- VeloMed may suspend Services for non-payment after 14 days' written notice.

## 5. Permitted use
You may use the Services solely for lawful business purposes consistent with the documentation. You may not:
- reverse engineer, decompile, or extract the source code of the Platform;
- resell, sublicense, or operate the Services as a service bureau without a written reseller agreement;
- use the Services to transmit malware, conduct intrusion testing without prior written authorisation, or attempt to bypass rate limits;
- input personal data of any person who has not consented in accordance with applicable law;
- use the Platform in violation of KSA, GCC, or applicable export-control sanctions (including OFAC, EU, and UN lists).

## 6. Clinical responsibility
VeloMed provides the technology infrastructure. **Clinical decisions, triage outcomes, prescriptions, and procedural care are the sole responsibility of the licensed clinicians and emergency-response personnel of the Subscriber.** VeloMed is not a healthcare provider and does not practise medicine.

## 7. Data protection & security
The processing of personal data and PHI is governed by the [Privacy Policy](/Privacy/Home), the [HIPAA Notice](/Privacy/HIPAA), and the Data Processing Addendum ("DPA") executed by the parties. The DPA forms an integral part of these Terms for Subscribers in regulated jurisdictions.

## 8. Service levels
VeloMed targets **99.9%** monthly uptime for production tenants on Growth, Scale, and Enterprise plans, measured excluding scheduled maintenance windows announced at least 72 hours in advance. Service credits, where applicable, are described in the order form.

## 9. Confidentiality
Each party will protect the other's Confidential Information with the same degree of care it uses for its own confidential information of like importance, and in no event less than reasonable care. PHI is treated as Confidential Information of the Subscriber.

## 10. Intellectual property
VeloMed retains all right, title, and interest in the Platform, the documentation, and any improvements, including derived analytics. Subscriber retains ownership of Customer Data. Subscriber grants VeloMed a non-exclusive, worldwide, royalty-free licence to host, process, and transmit Customer Data solely to provide and improve the Services and to produce de-identified aggregate analytics.

## 11. Third-party integrations
Where the Services interoperate with third-party systems (Nphies, CHI, payment processors, mapping providers, OAuth providers), Subscriber's use of those systems is governed by their respective terms.

## 12. Warranties & disclaimers
The Platform is provided **"as is"** and **"as available"**. VeloMed disclaims all implied warranties of merchantability, fitness for a particular purpose, and non-infringement to the maximum extent permitted by law. VeloMed does not warrant uninterrupted or error-free operation.

## 13. Limitation of liability
To the maximum extent permitted by law:
- Neither party shall be liable for indirect, incidental, special, consequential, or punitive damages;
- VeloMed's aggregate liability under these Terms shall not exceed the fees paid by Subscriber in the **twelve (12) months** preceding the event giving rise to the claim;
- The limitations above do not apply to (i) Subscriber's payment obligations, (ii) either party's indemnification obligations, (iii) breach of confidentiality, or (iv) gross negligence or wilful misconduct.

## 14. Indemnification
Each party will defend, indemnify, and hold the other harmless from third-party claims arising from the indemnifying party's (a) breach of these Terms, (b) violation of applicable law, or (c) infringement of third-party IP rights, subject to prompt notice and reasonable cooperation.

## 15. Term & termination
These Terms commence on the order-form effective date and continue for the subscription term. Either party may terminate for material breach uncured after 30 days' written notice. On termination Subscriber's access ceases; Customer Data is exported on request for 30 days, then deleted in line with the Privacy Policy retention schedule.

## 16. Governing law & jurisdiction
These Terms are governed by the laws of the Kingdom of Saudi Arabia. Disputes will be submitted to the exclusive jurisdiction of the competent commercial courts in Riyadh. For Subscribers based elsewhere in the GCC, the parties may elect arbitration under the **DIFC-LCIA** or **GCC Commercial Arbitration Centre** rules.

## 17. Force majeure
Neither party is liable for failures due to events beyond reasonable control including acts of God, war, terrorism, civil unrest, governmental action, network or power outages of public infrastructure, and pandemics.

## 18. Notices
Notices to VeloMed shall be sent to **legal@velomedos.com**. Notices to Subscriber shall be sent to the administrator email on the order form.

## 19. Entire agreement
These Terms, together with the order form, DPA, and any incorporated policies, constitute the entire agreement between the parties and supersede all prior agreements on the subject matter.
$$
),
('hipaa',
 'HIPAA Notice of Privacy Practices',
 'How VeloMed, as a Business Associate, safeguards Protected Health Information consistent with the HIPAA Privacy, Security, and Breach Notification Rules.',
 CURRENT_DATE,
$$
## Effective notice
**THIS NOTICE DESCRIBES HOW MEDICAL INFORMATION ABOUT YOU MAY BE USED AND DISCLOSED AND HOW YOU CAN GET ACCESS TO THIS INFORMATION. PLEASE REVIEW IT CAREFULLY.**

VeloMed Infrastructure Group acts as a **Business Associate** under 45 CFR § 160.103 to covered entities ("**Covered Entity**") that deploy the VeloMed OS Platform. This Notice describes VeloMed's privacy practices with respect to Protected Health Information ("**PHI**"). Where Covered Entity has issued its own Notice of Privacy Practices, that Notice governs the patient relationship; this document supplements it for VeloMed-operated infrastructure.

## 1. Our obligations
VeloMed is required by law to:
- Maintain the privacy and security of your PHI in accordance with the **HIPAA Privacy Rule (45 CFR Part 164, Subpart E)** and **Security Rule (Subpart C)**.
- Notify Covered Entity following a breach of unsecured PHI within the timelines mandated by **45 CFR § 164.410** (no later than **60 days** from discovery).
- Abide by the terms of the current Notice and any executed Business Associate Agreement ("**BAA**").

## 2. Permitted uses & disclosures
We may use or disclose PHI only as permitted by the BAA and HIPAA, including:

**2.1 Treatment** — to facilitate the delivery of emergency, remote-clinic, and follow-up care by credentialed clinicians.

**2.2 Payment** — to support Covered Entity in obtaining payment for services, including eligibility verification, claims submission, and remittance posting.

**2.3 Health-care operations** — for Covered Entity's quality assessment, accreditation, training, audit, and compliance activities.

**2.4 Required by law** — for public-health reporting, mandatory disease surveillance, and judicial or administrative proceedings.

**2.5 De-identification** — we may create de-identified data sets in accordance with the Safe Harbor method of **45 CFR § 164.514(b)(2)** or Expert Determination method.

We will **not** use or disclose PHI for marketing, fundraising, or sale without your written authorisation.

## 3. Minimum necessary
We apply the minimum-necessary standard (45 CFR § 164.502(b)) through role-based access control, attribute-based segmentation, and field-level masking inside the Platform.

## 4. Safeguards
Administrative, physical, and technical safeguards include:
- Workforce HIPAA training and confidentiality undertakings;
- AES-256 encryption at rest and TLS 1.3 in transit;
- Multi-factor authentication for all workforce accounts;
- Continuous audit logging with tamper-evident storage;
- Documented contingency, disaster recovery, and incident response plans;
- Annual risk analysis under **45 CFR § 164.308(a)(1)(ii)(A)**.

## 5. Your rights with respect to PHI
You generally have the rights set out in **45 CFR § 164.520–528**, exercisable through the Covered Entity:
- Right to **inspect and copy** PHI in the designated record set;
- Right to **amend** inaccurate or incomplete PHI;
- Right to an **accounting of disclosures**;
- Right to **request restrictions** on certain uses and disclosures;
- Right to **request confidential communications** through alternate means or locations;
- Right to a **paper copy** of this Notice;
- Right to be **notified of a breach** affecting your PHI.

## 6. Complaints
You may file a complaint with the Covered Entity, with VeloMed at **privacy@velomedos.com**, or with the U.S. Department of Health & Human Services Office for Civil Rights at **www.hhs.gov/ocr/privacy/hipaa/complaints**. We will not retaliate against you for filing a complaint.

## 7. Cross-border applicability
For patients receiving care inside the Kingdom of Saudi Arabia and the GCC, the rights and obligations in the [Privacy Policy](/Privacy/Home) and [Patient Rights](/Privacy/PatientRights) take precedence; this Notice applies where the Covered Entity is subject to HIPAA jurisdiction.

## 8. Subcontractors
Subcontractors that create, receive, maintain, or transmit PHI on our behalf are bound by written agreements imposing protections substantially the same as those in our BAA, consistent with **45 CFR § 164.502(e)(1)(ii)**.

## 9. Effective date & changes
This Notice is effective on the date shown above. We reserve the right to change this Notice and to make the revised Notice effective for PHI we already maintain. The current version will always be posted at **/Privacy/HIPAA**.

## 10. Contact
- HIPAA Privacy Officer — **privacy@velomedos.com**
- Security Officer — **security@velomedos.com**
- Postal — VeloMed Infrastructure Group, Riyadh, Kingdom of Saudi Arabia
$$
),
('patient-rights',
 'Patient Rights & Responsibilities',
 'The rights you can expect when receiving care through the VeloMed OS platform, and the responsibilities that help us deliver safe, dignified service.',
 CURRENT_DATE,
$$
## Preamble
VeloMed and its subscribed providers are committed to upholding the **Patient Bill of Rights** issued by the Saudi Ministry of Health and the **CHI Beneficiary Charter**, in alignment with World Health Organization guidance and the UN Universal Declaration of Human Rights. This charter applies wherever you interact with VeloMed-operated infrastructure across the GCC.

## Part A — Your rights

### 1. Right to respectful care
You have the right to receive considerate, dignified, and respectful care regardless of nationality, religion, gender, age, disability, social or economic status, or the source of payment for your care.

### 2. Right to information
You have the right to be informed, in a language you understand, of:
- the identity and professional status of those caring for you;
- your diagnosis, prognosis, treatment options, and expected outcomes;
- the costs of treatment before non-emergency procedures are performed.

### 3. Right to informed consent
You have the right to give or withhold informed consent for any non-emergency examination, procedure, or treatment, and to receive an explanation of risks, benefits, and alternatives. Emergency care necessary to preserve life or limb may be provided without explicit consent where you are unable to give it.

### 4. Right to refuse treatment
You may refuse treatment to the extent permitted by law and be informed of the medical consequences of your refusal.

### 5. Right to privacy & confidentiality
You have the right to confidentiality of all communications, clinical encounters, and records, consistent with the [Privacy Policy](/Privacy/Home) and the [HIPAA Notice](/Privacy/HIPAA). You may request that examinations and discussions be conducted discreetly and that observers be excluded.

### 6. Right to access your records
You have the right to request access to your medical records, an accounting of disclosures, and corrections of inaccuracies, in accordance with KSA MoH policy and applicable law.

### 7. Right to a second opinion
You have the right to seek a second medical opinion before consenting to a procedure or treatment plan, without prejudice to your ongoing care.

### 8. Right to advance directives
Where recognised by local law, you have the right to formulate advance directives concerning your care and to expect them to be respected to the extent permitted by law.

### 9. Right to safe environment & freedom from abuse
You have the right to receive care in a safe environment, free from any form of physical, emotional, sexual, or verbal abuse, neglect, or exploitation.

### 10. Right to pain management
You have the right to appropriate assessment and management of pain.

### 11. Right to spiritual care
You have the right to express your spiritual and cultural beliefs and to have them respected in your care plan to the extent clinically practicable.

### 12. Right to interpreter services
You have the right to qualified interpretation services, including for sign language, where available.

### 13. Right to complain & redress
You have the right to voice complaints regarding your care, to receive a timely response, and to be informed of the resolution process — through the Covered Entity, through VeloMed at **patient-relations@velomedos.com**, or through MoH / CHI complaint channels.

### 14. Right to be involved in your care plan
You have the right to participate in decisions about your care, including discharge planning, and to designate a family member or representative to receive information and act on your behalf.

### 15. Right to research participation choice
You have the right to consent to or decline participation in any research study, with no impact on your access to care.

## Part B — Your responsibilities
To enable safe and effective care, we ask that you:
- provide, to the best of your knowledge, accurate and complete information about your health, current medications, allergies, and past illnesses;
- follow the treatment plan recommended by the clinicians caring for you, or inform them when you cannot or do not wish to;
- keep scheduled appointments or notify the provider in advance when you cannot;
- treat staff, other patients, and property with respect and refrain from any abusive or threatening conduct;
- meet your financial obligations promptly or arrange acceptable payment terms;
- respect the confidentiality of other patients you may encounter during your care.

## Part C — How to raise a concern
1. Speak to a member of the care team or call-centre agent.
2. Contact the Covered Entity's Patient Relations department.
3. Email VeloMed at **patient-relations@velomedos.com**; we will acknowledge within **2 business days** and substantively respond within **15 business days**.
4. Escalate to the **MoH 937** service, **CHI** beneficiary line, or your national health regulator if you remain dissatisfied.

## Part D — Children & vulnerable adults
For minors, parental or guardian consent is required for non-emergency care. For adults lacking decision-making capacity, the legally authorised representative exercises these rights on their behalf, consistent with KSA MoH and GCC capacity-assessment frameworks.

## Contact
- Patient Relations — **patient-relations@velomedos.com**
- Privacy Office — **privacy@velomedos.com**
- 24/7 Operations — see in-app dispatch console
$$
);
