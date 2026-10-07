/** Split a citation string into plain text and acquisition.gov links, in order.
 *  Joining every part's text gives back the original string exactly. */

export type CitationPart = { text: string; href: string | null };

const NFS_SLUGS: Record<string, string> = {
  "1801": "part-1801%E2%80%94federal-acquisition-regulations-system",
  "1803": "part-1803%E2%80%94improper-business-practices-and-personal-conflicts-interest",
  "1804": "part-1804%E2%80%94administrative-matters",
  "1805": "part-1805%E2%80%94publicizing-contract-actions",
  "1806": "part-1806%E2%80%94competition-requirements",
  "1807": "part-1807%E2%80%94acquisition-planning",
  "1808": "part-1808%E2%80%94required-sources-supplies-and-services",
  "1809": "part-1809%E2%80%94contractor-qualifications",
  "1811": "part-1811%E2%80%94describing-agency-needs",
  "1812": "part-1812%E2%80%94acquisition-commercial-products-and-commercial-services",
  "1813": "part-1813%E2%80%94simplified-acquisition-procedures",
  "1814": "part-1814%E2%80%94sealed-bidding",
  "1815": "part-1815%E2%80%94contracting-negotiation",
  "1816": "part-1816%E2%80%94types-contracts",
  "1817": "part-1817%E2%80%94special-contracting-methods",
  "1819": "part-1819%E2%80%94small-business-programs",
  "1822": "part-1822%E2%80%94application-labor-laws-government-acquisitions",
  "1823": "part-1823%E2%80%94environment-energy-and-water-efficiency-renewable-energy-technologies-occupational-safety-and-drug-free-workplace",
  "1824": "part-1824%E2%80%94protection-privacy-and-freedom-information",
  "1825": "part-1825%E2%80%94foreign-acquisition",
  "1827": "part-1827%E2%80%94patents-data-and-copyrights",
  "1828": "part-1828%E2%80%94bonds-and-insurance",
  "1830": "part-1830%E2%80%94cost-accounting-standards-administration",
  "1831": "part-1831%E2%80%94contract-cost-principles-and-procedures",
  "1832": "part-1832%E2%80%94contract-financing",
  "1833": "part-1833%E2%80%94protests-disputes-and-appeals",
  "1834": "part-1834%E2%80%94major-system-acquisition",
  "1835": "part-1835%E2%80%94research-and-development-contracting",
  "1836": "part-1836%E2%80%94construction-and-architect-engineer-contracts",
  "1837": "part-1837%E2%80%94service-contracting",
  "1839": "part-1839%E2%80%94acquisition-information-technology",
  "1841": "part-1841%E2%80%94acquisition-utility-services",
  "1842": "part-1842%E2%80%94contract-administration-and-audit-services",
  "1843": "part-1843%E2%80%94contract-modifications",
  "1844": "part-1844%E2%80%94subcontracting-policies-and-procedures",
  "1845": "part-1845%E2%80%94government-property",
  "1846": "part-1846%E2%80%94quality-assurance",
  "1847": "part-1847%E2%80%94transportation",
  "1849": "part-1849%E2%80%94termination-contracts",
  "1850": "part-1850%E2%80%94extraordinary-contractual-actions-and-safety-act",
  "1851": "part-1851%E2%80%94use-government-sources-contractors",
  "1852": "part-1852%E2%80%94solicitation-provisions-and-contract-clauses",
};

// RFO FAR first, then FAR (not after RFO), then NFS (not NFS CG).
const TOKEN =
  /(RFO FAR (?:Part (\d+)|(\d+)(?:\.[\d.-]*\d)?(?:\([a-z0-9]+\))*))|(\bFAR (?:Part (\d+)|(\d+\.[\d.-]*\d|\d+)(?:\([a-z0-9]+\))*))|(\bNFS (?!CG)(18\d\d)(?:\.[\d.-]*\d)?(?:\([a-z0-9]+\))*)/g;

function rfoHref(n: string): string | null {
  const num = Number(n);
  if (!Number.isInteger(num) || num < 1 || num > 53 || num === 20 || num === 21) return null;
  return `https://www.acquisition.gov/far-overhaul/far-part-deviation-guide/far-overhaul-part-${num}`;
}

export function citationParts(citation: string): CitationPart[] {
  const parts: CitationPart[] = [];
  let last = 0;
  const push = (text: string, href: string | null) => {
    if (!text) return;
    const prev = parts[parts.length - 1];
    if (!href && prev && !prev.href) prev.text += text;
    else parts.push({ text, href });
  };
  for (const m of citation.matchAll(TOKEN)) {
    const start = m.index ?? 0;
    // A bare "FAR" match directly after "RFO " is handled by the RFO branch.
    if (m[4] && /RFO $/.test(citation.slice(0, start))) continue;
    push(citation.slice(last, start), null);
    let href: string | null = null;
    if (m[1]) href = rfoHref(m[2] ?? m[3] ?? "");
    else if (m[4]) href = m[5] ? `https://www.acquisition.gov/far/part-${m[5]}` : `https://www.acquisition.gov/far/${m[6]}`;
    else if (m[7]) {
      const slug = NFS_SLUGS[m[8] ?? ""];
      href = slug ? `https://www.acquisition.gov/nfs/${slug}` : null;
    }
    push(m[0], href);
    last = start + m[0].length;
  }
  push(citation.slice(last), null);
  return parts;
}
