// Plain-language determination helpers (Parts 10 / 12 / 13 / 15).
//
// Every citation below is one already carried by a live template badge or the
// phase citation map in T-Minus; nothing new is coined here. Every value is
// read from the acquisition record, and where the record is silent the helper
// says "Not recorded" rather than drafting a determination.

export type DeterminationHelper = {
  key: "commerciality" | "competition" | "price-reasonableness";
  title: string;
  /** Plain language: what the record says today. */
  plain: string;
  /** Citations already used on the matching template or phase map. */
  citation: string;
  /** Template key on this file to open, when one is live. */
  templateKey: string | null;
  templateLabel: string | null;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isSimplifiedOrCommercial(acq: Record<string, unknown>): boolean {
  const method = str(acq["acquisition_method"]).toLowerCase();
  const format = str(acq["contract_format"]).toLowerCase();
  return (
    /simplified|commercial|13\.5|part 13|part 12/.test(method) ||
    /1449|commercial/.test(format)
  );
}

export function determinationHelpers(acq: Record<string, unknown> | null | undefined): DeterminationHelper[] {
  if (!acq) return [];
  const commercial = str(acq["commercial_determination"]);
  const method = str(acq["acquisition_method"]);
  const competition = str(acq["competition"]);
  const jofoc = str(acq["jofoc_authority_citation"]);
  const soleSource = /sole|non-?competitive|other than full/i.test(`${competition} ${method}`);
  const simplified = isSimplifiedOrCommercial(acq);

  return [
    {
      key: "commerciality",
      title: "Commerciality",
      plain: commercial
        ? `The record states the commercial determination as: ${commercial}.${
            method ? ` Acquisition method on the record: ${method}.` : ""
          }`
        : "No commercial determination is recorded on this file. The determination itself is written by the contracting officer; T-Minus does not draft it.",
      citation: "FAR 2.101; FAR 10.002(e); FAR 12.102",
      templateKey: "commerciality",
      templateLabel: "Commerciality Determination and Findings",
    },
    {
      key: "competition",
      title: "Competition",
      plain: soleSource
        ? `The record reads as other than full and open competition${competition ? ` (${competition})` : ""}. Statutory authority recorded on the file: ${jofoc || "Not recorded"}.`
        : competition || method
          ? `The record reads as competed${competition ? ` (${competition})` : ""}${method ? `, method ${method}` : ""}.`
          : "No competition or acquisition method is recorded on this file.",
      citation: soleSource
        ? `FAR 6.303 justification${jofoc ? `; authority on the record: ${jofoc}` : ""}`
        : simplified
          ? "FAR 13.106-2 (evaluation of quotations)"
          : "FAR 15.305 (proposal evaluation)",
      templateKey: soleSource ? "jofoc" : null,
      templateLabel: soleSource ? "Justification for other than full and open competition" : null,
    },
    {
      key: "price-reasonableness",
      title: "Price reasonableness",
      plain:
        "The price negotiation memorandum is the price reasonableness determination of record on this file. T-Minus never performs or invents a price analysis; the contracting officer writes the finding.",
      citation: simplified ? "RFO FAR 12.204(a); FAR 13.106-3(b)(3)" : "FAR 15.406-3",
      templateKey: "pnm",
      templateLabel: "Price negotiation memorandum",
    },
  ];
}
