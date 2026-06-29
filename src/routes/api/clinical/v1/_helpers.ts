/**
 * Phase-1 helper utilities for clinical routes.
 */
import { json } from "@/lib/api-clinical";
import { ZodError } from "zod";

export function envelope(error: string, code: string, status: number, extra?: Record<string, unknown>): Response {
  return json({ error, code, request_id: crypto.randomUUID(), ...(extra ?? {}) }, status);
}

export function zodError(e: ZodError): Response {
  return envelope("Validation failed", "validation_failed", 400, {
    issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message, code: i.code })),
  });
}

export function parseBody<T>(parser: (raw: unknown) => T) {
  return async (request: Request): Promise<{ ok: true; data: T } | { ok: false; res: Response }> => {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return { ok: false, res: envelope("Invalid JSON body", "bad_json", 400) };
    }
    try {
      return { ok: true, data: parser(raw) };
    } catch (e) {
      if (e instanceof ZodError) return { ok: false, res: zodError(e) };
      return { ok: false, res: envelope("Validation failed", "validation_failed", 400) };
    }
  };
}
