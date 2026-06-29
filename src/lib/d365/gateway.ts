/** Microsoft Dynamics 365 Finance sandbox stub. */
import { logInterface } from "@/lib/interface-log";

export type D365JournalInput = {
  tenantId: string;
  journalRef: string;
  totalSar: number;
  postingDate?: string;
};

export type D365JournalResult = {
  ok: true;
  sandbox: true;
  journal_id: string;
  batch_id: string;
  posted_at: string;
};

export async function postJournal(input: D365JournalInput): Promise<D365JournalResult> {
  const result: D365JournalResult = {
    ok: true,
    sandbox: true,
    journal_id: `D365-${input.journalRef}`,
    batch_id: `BATCH-${input.tenantId.slice(0, 6).toUpperCase()}`,
    posted_at: input.postingDate ?? new Date().toISOString(),
  };
  await logInterface({
    tenantId: input.tenantId,
    messageType: "d365.journal.post",
    subjectTable: "portal_invoices",
    subjectId: input.journalRef,
    idempotencyKey: `d365-${input.journalRef}`,
    sandbox: true,
    outcome: "ok",
    requestBody: input,
    responseBody: result,
  });
  return result;
}