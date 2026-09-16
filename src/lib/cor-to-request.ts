/**
 * COR / task order request — a small local scaffold on awarded and IDIQ files.
 *
 * Every value is read from the record: the requester, the appointed COR, and
 * the dates already held in post_award. Blanks read "Not recorded"; nothing is
 * invented. The memo is a copyable local aid. NCMS remains the system of
 * record (NFS 1804.171); nothing here is written back to it, and nothing here
 * holds a phase exit.
 */

import { postAward } from "@/lib/post-award";

export type CorToRequestType = "COR" | "TO";

export type CorToRequest = {
  requester?: string;
  cor_or_to?: string;
  request_type?: CorToRequestType;
  what_asking?: string;
  narrative?: string;
  updated_at?: string;
};

export const COR_TO_NOTE =
  "Local memo and handoff aid. Advisory only — it never places a hold or changes the phase. NCMS is the system of record (NFS 1804.171).";

export const NOT_RECORDED = "Not recorded";

type Acq = Record<string, unknown> | null | undefined;

const str = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : null;
};

/** Read the saved request off the record, if one has been saved. */
export function corToRequest(acq: Acq): CorToRequest {
  const raw = (postAward(acq as never) as Record<string, unknown>)["cor_to_request"];
  return raw && typeof raw === "object" ? (raw as CorToRequest) : {};
}

/**
 * The path shows on awarded files (a contract number is recorded), on IDIQ
 * vehicles and orders, and on launched files in Administration.
 */
export function corToRequestApplies(acq: Acq, profile?: string | null): boolean {
  if (!acq) return false;
  if (str(acq["contract_number"])) return true;
  if (profile === "idiq_parent" || profile === "order_under_idiq") return true;
  const launched = String(acq["clock_state"] ?? "").toLowerCase() === "launched";
  return launched && String(acq["current_phase"] ?? "") === "Administration";
}

/** Defaults read from the record: requester and appointed COR where present. */
export function corToDefaults(acq: Acq): { requester: string | null; corOrTo: string | null; appointedOn: string | null } {
  const pa = postAward(acq as never);
  return {
    requester: str(acq?.["requester_name"]),
    corOrTo: str(pa.cor_appointed_name) ?? str(acq?.["cor_name"]),
    appointedOn: str(pa.cor_appointed_date),
  };
}

/** A copyable memo to file, summarising only what the record holds. */
export function corToMemo(acq: Acq, request: CorToRequest): string {
  const d = corToDefaults(acq);
  const id = str(acq?.["acquisition_id"]) ?? NOT_RECORDED;
  const kind = request.request_type === "TO" ? "Task order request" : "COR request";
  const lines = [
    `Memorandum to file — ${kind}`,
    `Acquisition: ${id}`,
    `Contract number: ${str(acq?.["contract_number"]) ?? NOT_RECORDED}`,
    `Requester: ${request.requester ?? d.requester ?? NOT_RECORDED}`,
    `COR or task order manager: ${request.cor_or_to ?? d.corOrTo ?? NOT_RECORDED}`,
    `COR appointed on: ${d.appointedOn ?? NOT_RECORDED}`,
    "",
    "What is being asked:",
    request.what_asking?.trim() || NOT_RECORDED,
    "",
    "Narrative:",
    request.narrative?.trim() || NOT_RECORDED,
    "",
    COR_TO_NOTE,
  ];
  return lines.join("\n");
}
