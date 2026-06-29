# VeloMed RCM — User Manual

This manual is generated from the HIS / RCM clinical role matrix
(`src/lib/clinical-role-matrix.ts`) and is the operational companion to the
HIS User Manual. Each section below maps to one module in the matrix and
lists the roles that hold action capabilities in that module, plus the user
journey for the role most likely to live there day-to-day.

> **Read access rule:** any authenticated clinical member of the tenant can
> *view* every module they work alongside. `read_only` is GET-only. Write
> actions require the explicit capability shown in the Privileges matrix
> (`/privileges` → HIS / RCM tab).

## Registration & Eligibility

**Roles:** Registrar · Front Office · RCM · Tenant Admin

1. Register the beneficiary and capture coverage (`Registration → New`).
2. Run eligibility; if the payer rejects, log the exception (referral /
   emergency / newborn / self-pay) and proceed.
3. Activate the policy class & membership from the activation worklist.

## Authorization

**Roles:** RCM · Approval Officer · Physician · Pharmacist · Tenant Admin

- Raise auth requests from the encounter when a service triggers it.
- Approval Officer decisions (approve / partial / reject) close the loop and
  drive the post-decision declaration workflow.

## Clinical

**Roles:** Physician · Nurse · Lab Tech · Radiologist · Pharmacist · Case
Manager · Tenant Admin

Encounter open → documentation → orders → admit/discharge. See the HIS User
Manual for the full clinical flow.

## Coding & DRG

**Roles:** Coder · Case Manager · Tenant Admin

Finalize ICD-10-AM and ACHI codes after discharge, run the AR-DRG grouper,
and confirm the inpatient bundle before billing.

## Billing — OP/ER

**Roles:** Cashier · Biller · RCM · Tenant Admin

Allocate executed-only items, collect the copay, apply governed self-pay
discounts. The bill cannot include unfinished orders.

## Billing — IP / Day-Case

**Roles:** RCM · Cashier · Case Manager · Tenant Admin

IP accounting follows the admission lounge → package → daily charges →
DRG-bundled bill sequence.

## Claims & Remittance

**Roles:** Biller · Claims Officer · RCM · Finance · Tenant Admin

- **Biller / Claims Officer:** assemble the FHIR claim, batch, submit via the
  NPHIES gateway, manage denials.
- **Finance:** post remittances; only Finance can release write-offs.

## Deposits & Refunds

**Roles:** Cashier · Biller · Finance · RCM · Tenant Admin

Collect deposits (including caution), issue credit notes and wallet credits.
Refund approval is permission-gated and rolls up to Finance.

## Cash & ZATCA

**Roles:** Cashier · Finance · Biller · Tenant Admin

Method-aware collections and refunds run through the cashbox session.
ZATCA B2B/B2C invoices, credit and debit notes are issued from Finance.

## Masters & Contracts

**Roles:** Tenant Admin · RCM

Service & drug masters, multi-coding (cash, payer-specific NPHIES), price
lists, bulk price changes and contract management live here.

## VBHC Outcomes

**Roles:** Case Manager · Physician · Tenant Admin

PROM / PREM assignment, response review and the NPHIES PRM MDS submission.

## Documentation

**Roles:** Tenant Admin

The HIS / RCM / Changelog manuals are bundled with the platform. The
overlay-edit path (DB-backed `his_doc` table) is on the roadmap; until then
manuals are read-only in production and updated via release.