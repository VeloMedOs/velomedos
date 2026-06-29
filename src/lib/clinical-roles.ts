/**
 * useClinicalRole — UI gating only.
 *
 * IMPORTANT: Server routes enforce authorization via requireClinicalRole.
 * Hiding a button here is UX polish, not security.
 */
import { useEffect, useState } from "react";
import { ClinicalAPI, ClinicalApiError } from "./clinical-api";

export type ClinicalRole =
  | "registrar" | "physician" | "nurse" | "lab_tech" | "radiologist"
  | "pharmacist" | "coder" | "biller" | "case_manager" | "cashier"
  | "tenant_admin" | "read_only";

export type ClinicalMe = {
  userId: string;
  tenantId: string;
  role: string;
  clinicalRole: ClinicalRole | null;
};

export function useClinicalMe() {
  const [me, setMe] = useState<ClinicalMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await ClinicalAPI.me();
        if (cancelled) return;
        setMe({
          userId: res.data.user_id,
          tenantId: res.data.tenant_id,
          role: res.data.role,
          clinicalRole: (res.data.clinical_role as ClinicalRole | null) ?? null,
        });
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof ClinicalApiError ? e.message : "Failed to load identity");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return { me, loading, error };
}

/** Cosmetic role-gate helper. Server still enforces. */
export function canAct(me: ClinicalMe | null, allowed: ClinicalRole[]): boolean {
  if (!me?.clinicalRole) return false;
  if (me.clinicalRole === "tenant_admin") return true;
  return allowed.includes(me.clinicalRole);
}