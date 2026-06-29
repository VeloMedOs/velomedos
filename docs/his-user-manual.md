# VeloMed Mini-HIS — User Manual

## Coder workflow (Phase 6)

### 1. Finalize coding

After an inpatient encounter is **discharged**:
1. Confirm the principal diagnosis (ICD-10-AM) and that all additional diagnoses include a Present-On-Admission (POA) flag.
2. Open the encounter → **Coding** → **Finalize**.
3. The system records the coder, sets status `coded`, and advances the encounter to `coded`.
4. Editing later flips the status to `amended` while preserving the audit trail.

### 2. Run the DRG grouper

1. With the encounter in `coded`, open **Coding → Run grouper**.
2. The system assembles the MDS (Dx + POA, ACHI procedures from charges, LOS, age at admission, ventilation hours, separation mode, birth weight) and sends it to the configured external AR-DRG grouper.
3. The returned DRG (code + version + MDC/ADRG + complexity) is stored as the active assignment; the encounter advances to `grouped`.

### 3. Re-group an amended episode

- Running the grouper again without changes is a no-op (returns the existing assignment).
- Pass `force: true` to record a new assignment. The previous one is marked `superseded` automatically.

### Why discharge is required

AR-DRG codes a completed episode of care: length of stay, mechanical-ventilation hours, and separation mode must be final. Attempting to code before discharge returns `not_discharged`.

### What `superseded` means

Each grouper run is preserved. Only one row per encounter is `assigned` (current); historical runs become `superseded` but remain available via `GET /encounters/:id/drg`.