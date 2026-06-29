# VeloMed Demo — 10-step narrative

Run on the sandbox tenant (`demo-hospital`, `is_demo = true`). All external
gateways are stubbed; nothing leaves the sandbox.

1. **Sign in as `admin@demo.velomedos.com`** → `/clinical`. The persistent
   **DEMO / SANDBOX** banner confirms isolation.
2. **Front office** — open the **Insured OP** beneficiary `DEMO-OP-001`
   (Layla Al-Harbi). Run eligibility → NPHIES stub returns "active" within
   a second; an `interface_log` row appears under R7.
3. **Switch to `doctor@demo.velomedos.com`** — open the same encounter, add
   a principal Dx, sign vitals, place a CT order. The order triggers an
   authorization request which auto-approves through the stub.
4. **`nurse@demo.velomedos.com`** — administer the medication and complete
   nursing notes; encounter advances to `documented`.
5. **`coder@demo.velomedos.com`** — open the ready-to-code worklist, accept
   the suggested ICD-10-AM + ACHI/SBS combo, run the grouper. AR-DRG stub
   returns a DRG with weight + trim points.
6. **`biller@demo.velomedos.com`** — build the claim from the grouped
   encounter; Claim Completeness shows ✅ across MDS/RCM gates.
7. **`claims@demo.velomedos.com`** — submit. NPHIES stub returns a
   sandbox claim-response; the encounter is now `submitted`.
8. **Open the seeded denied claim** — work the denial → correct the
   missing pre-auth → resubmit; status flips to `accepted`.
9. **`cashier@demo.velomedos.com`** — close the patient bill via the POS
   stub; ZATCA stub issues a B2C receipt with a QR (base64) that renders in
   the patient app.
10. **`finance@demo.velomedos.com`** — post the daily remittance; D365 stub
    returns a journal id. Switch to `patient@demo.velomedos.com` to view
    the receipt + complete the seeded PROMIS-10 instrument (outcomes
    datapoint appears on the VBHC dashboard).

**Reset between demos** — Superadmin → Demo environment → **Reset tenant**.
Scoped delete + reseed in ~5 seconds. Real tenants are never touched.