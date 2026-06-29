# VeloMed Demo — Access Sheet

**Tenant:** VeloMed Demo Hospital · `slug = demo-hospital` · `is_demo = true`
**Shared password:** value of the project secret `DEMO_USER_PASSWORD`
(rotate via Superadmin → Demo environment → re-provision).

All sandbox gateways are forced ON for this tenant: NPHIES, ZATCA, D365 and
the AR-DRG grouper return deterministic stub responses and write a row to
`interface_log` so the R7 Interface Monitor screen lights up live.

| Email | Role | Lands on |
| --- | --- | --- |
| `superadmin@demo.velomedos.com` | Platform superadmin | `/superadmin` |
| `admin@demo.velomedos.com`      | Tenant admin       | `/clinical` |
| `doctor@demo.velomedos.com`     | Physician          | `/clinical` |
| `nurse@demo.velomedos.com`      | Nurse              | `/clinical` |
| `coder@demo.velomedos.com`      | Coder              | `/clinical` |
| `rcm@demo.velomedos.com`        | RCM                | `/clinical` |
| `approver@demo.velomedos.com`   | Approval officer   | `/clinical` |
| `cashier@demo.velomedos.com`    | Cashier            | `/clinical` |
| `biller@demo.velomedos.com`     | Biller             | `/clinical` |
| `claims@demo.velomedos.com`     | Claims officer     | `/clinical` |
| `finance@demo.velomedos.com`    | Finance            | `/clinical` |
| `readonly@demo.velomedos.com`   | Read-only          | `/clinical` (view-only) |
| `patient@demo.velomedos.com`    | Patient (linked to Insured-OP beneficiary) | `/patient` |

## URLs

- Public site            — `/`
- Patient app            — `/patient`
- Clinical workspace     — `/clinical`
- Superadmin control plane — `/superadmin`
- Demo environment pane  — `/superadmin` → **Settings → Demo environment**

## Operator actions

| Action | How | Notes |
| --- | --- | --- |
| Provision / refresh users | `POST /api/admin/v1/demo/seed { "step": "users" }` | Idempotent; resets all 13 passwords. |
| Seed beneficiaries        | `POST /api/admin/v1/demo/seed { "step": "data" }`  | Upsert by `(tenant_id, patient_file_no)`. |
| Reset transactional data  | `POST /api/admin/v1/demo/reset { "reseed": true }` | Scoped DELETE; guarded by `is_demo = true`. |

The reset endpoint **refuses to run** unless the resolved tenant has
`is_demo = true`. It never issues TRUNCATE — only `DELETE … WHERE tenant_id =
<demo>` in FK-child-first order across the transactional tables listed in
`src/lib/demo-seed.functions.ts`.