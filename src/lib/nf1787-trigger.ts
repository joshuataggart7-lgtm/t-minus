// NF 1787 small business coordination: when the package is required.
//
// Source: NFS Companion Guide 1819.11(a), CG updated September 11, 2026. The
// Companion Guide is NASA guidance, not regulation. Old NFS 1819.202-70 was
// struck by PCD 25-48A, and the interim NFS carries no NF 1787 requirement.
//
// Required (CG 1819.11(a)(1)) when any of these is true:
//   (i)   the acquisition, including an order under a MAC, GWAC, BPA, BOA or
//         FSS, exceeds $2,000,000 and is not set aside under FAR Part 19;
//   (ii)  a modification adds new work outside the scope of the contract;
//   (iii) bundling or consolidation is contemplated.
// Not required (CG 1819.11(a)(2)) for orders under a single-award IDV, BOA or
// BPA; SBIR and STTR, including Phase III; mandatory sources under FAR 8.101;
// broad agency announcements; and sole-source awards to small business.
// Anything else is offered as Center practice.

import { scenarioOf } from "@/lib/scenario";
import { MICRO_PURCHASE_THRESHOLD } from "@/lib/micro-purchase";

export const NF1787_CITATION = "NFS CG 1819.11(a) (Companion Guide)";
export const NF1787_THRESHOLD = 2_000_000;

export type Nf1787Trigger = {
  required: boolean;
  /** Plain sentence: why it is required, or why it is not. */
  reason: string;
  /** The CG 1819.11(a)(2) exception that applies, when one does. */
  exception: string | null;
  /** RFO FAR 19.104-1(b)(1) advisory: above the MPT and not set aside. */
  advisory: string | null;
  /** RFO FAR 19.102(e)(1) case: package to the SBA PCR 30 days before the solicitation. */
  pcr: { citation: string; text: string } | null;
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const SB_PROGRAM = /small business|8\(a\)|hubzone|sdvosb|service-disabled|wosb|edwosb|women-owned/i;

/** True where the record carries a FAR Part 19 small business set-aside. */
export function isSmallBusinessSetAside(acq: Record<string, unknown>): boolean {
  const text = `${str(acq["set_aside"])} ${str(scenarioOf(acq).set_aside_type)}`.trim();
  if (!text || /^none\b/i.test(text)) return false;
  return SB_PROGRAM.test(text);
}

export function nf1787Trigger(
  acq: Record<string, unknown>,
  opts: { micro?: number; outOfScopeMod?: boolean } = {},
): Nf1787Trigger {
  const s = scenarioOf(acq);
  const value = Number(acq["estimated_value"] ?? 0) || 0;
  const micro = opts.micro ?? MICRO_PURCHASE_THRESHOLD;
  const setAside = isSmallBusinessSetAside(acq);
  const text = `${str(acq["acquisition_method"])} ${str(acq["competition"])} ${str(acq["set_aside"])} ${str(acq["contract_format"])} ${str(acq["title"])}`;
  const bundling = Boolean(s.combines_requirements);
  const outOfScope = Boolean(opts.outOfScopeMod);

  const exception =
    (s.vehicle === "idiq_order" || s.vehicle === "bpa") && s.idiq_single_award
      ? "an order under a single-award IDV, BOA or BPA (NFS CG 1819.11(a)(2)(i))"
      : /\bSBIR\b|\bSTTR\b/i.test(text)
        ? "an SBIR or STTR award, including Phase III (NFS CG 1819.11(a)(2)(ii))"
        : /mandatory source|\b8\.101\b|abilityone|federal prison industries|\bunicor\b/i.test(text)
          ? "a mandatory source under FAR 8.101 (NFS CG 1819.11(a)(2)(iii))"
          : /\bBAA\b|broad agency announcement|\bpart\s*35\b|\bFAR\s*35\b/i.test(text)
            ? "a broad agency announcement (NFS CG 1819.11(a)(2)(iv))"
            : /sole/i.test(str(acq["competition"])) && SB_PROGRAM.test(`${str(acq["set_aside"])} ${str(acq["competition"])}`)
              ? "a sole-source award to a small business (NFS CG 1819.11(a)(2)(v))"
              : null;

  const triggers: string[] = [];
  if (value > NF1787_THRESHOLD && !setAside)
    triggers.push(`over ${money(NF1787_THRESHOLD)} and not set aside under FAR Part 19 (NFS CG 1819.11(a)(1)(i))`);
  if (outOfScope) triggers.push("a modification adding out-of-scope work (NFS CG 1819.11(a)(1)(ii))");
  if (bundling) triggers.push("bundling or consolidation is contemplated (NFS CG 1819.11(a)(1)(iii))");

  const required = triggers.length > 0 && !exception;
  const notReason = setAside
    ? `${value > NF1787_THRESHOLD ? "the file is" : `the value is ${money(NF1787_THRESHOLD)} or less and the file is`} set aside for small business, with no out-of-scope modification and no bundling or consolidation`
    : `the value is ${money(NF1787_THRESHOLD)} or less, with no out-of-scope modification and no bundling or consolidation`;
  const reason = required
    ? `Required: ${triggers.join("; ")}.`
    : exception
      ? `Not required: ${exception}. Offered (Center practice).`
      : `Not required by NFS CG 1819.11(a): ${notReason}. Offered (Center practice).`;

  const advisory =
    value > micro && !setAside && !/mandatory source|\b8\.101\b|abilityone/i.test(text)
      ? "Above the micro-purchase threshold and not set aside: the contracting officer must document the reason it is not set aside (RFO FAR 19.104-1(b)(1))."
      : null;

  const pcr = bundling
    ? s.deliverable === "construction"
      ? {
          citation: "RFO FAR 19.102(e)(1)(ii) and (iii)",
          text: "Packaged or consolidated requirement: give the SBA procurement center representative the proposed acquisition package at least 30 days before the solicitation is issued.",
        }
      : {
          citation: "RFO FAR 19.102(e)(1)(iii)",
          text: "Consolidated or bundled requirement: give the SBA procurement center representative the proposed acquisition package and the justification at least 30 days before the solicitation is issued.",
        }
    : null;

  return { required, reason, exception, advisory, pcr };
}
