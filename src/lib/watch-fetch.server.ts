/**
 * Server-only fetchers for the Watch feeds.
 *
 * fetchGaoDecisions   — GAO recent bid protest decisions (B-number, title, date,
 *                       outcome, link). The decision text is never stored.
 * fetchFederalRegister — Federal Register documents mentioning the Federal
 *                       Acquisition Regulation or the NASA FAR Supplement in the
 *                       last 90 days (title, type, publication date, link).
 *
 * Both write one audit entry per run and never store more than the summary line.
 */
import { partTags, toISODate } from "@/lib/watch";

export type FetchOutcome = {
  source: "GAO" | "Federal Register";
  fetched: number;
  inserted: number;
  note: string;
  providerError?: string;
};

type Row = {
  source: string;
  external_id: string;
  title: string;
  decided_or_published_date: string | null;
  outcome_or_type: string;
  agency: string;
  url: string;
  summary: string;
  tags: string[];
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

function gaoOutcome(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("sustained in part") || (t.includes("sustain") && t.includes("part"))) return "Sustained in part";
  if (t.includes("sustain")) return "Sustained";
  if (t.includes("denied in part")) return "Denied in part";
  if (t.includes("denied") || t.includes("deny")) return "Denied";
  if (t.includes("dismiss")) return "Dismissed";
  return "Decision issued";
}

function parseGao(html: string): Row[] {
  const rows = new Map<string, Row>();
  const anchor = /<a[^>]+href="(\/products\/(b-\d{6}(?:\.\d+)?)[^"]*)"[^>]*>([\s\S]{0,300}?)<\/a>/gi;
  for (const m of html.matchAll(anchor)) {
    const href = m[1]!;
    const bNumber = m[2]!.toUpperCase();
    const label = m[3]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!label) continue;
    const tail = html.slice(m.index! + m[0].length, m.index! + m[0].length + 600).replace(/<[^>]+>/g, " ");
    const dateText =
      tail.match(/\b([A-Z][a-z]+ \d{1,2}, \d{4})\b/)?.[1] ?? label.match(/\b([A-Z][a-z]+ \d{1,2}, \d{4})\b/)?.[1] ?? null;
    const title = label.replace(/\s*\|\s*U\.S\. GAO\s*$/i, "");
    rows.set(bNumber, {
      source: "GAO",
      external_id: bNumber,
      title: `${bNumber}: ${title}`.slice(0, 300),
      decided_or_published_date: toISODate(dateText),
      outcome_or_type: gaoOutcome(`${label} ${tail}`),
      agency: "Government Accountability Office",
      url: `https://www.gao.gov${href}`,
      summary: `Bid protest decision ${bNumber}. Read the decision on gao.gov.`,
      tags: ["Bid protest", ...partTags(title, tail)],
    });
  }
  return [...rows.values()].slice(0, 25);
}

/** Clearly labelled stand-in rows so the demo never depends on gao.gov being reachable. */
function gaoSample(): Row[] {
  const today = new Date();
  const back = (days: number) => new Date(today.getTime() - days * 86400000).toISOString().slice(0, 10);
  return [
    {
      source: "GAO",
      external_id: "SAMPLE-B-000001",
      title: "B-000001: Sample protest of a commercial services award (sample data)",
      decided_or_published_date: back(3),
      outcome_or_type: "Denied",
      agency: "Government Accountability Office",
      url: "https://www.gao.gov/legal/bid-protests/recent",
      summary: "Sample data, GAO not reachable from this environment. Evaluation of quotations under FAR 13.5.",
      tags: ["Bid protest", "Sample", "FAR 13"],
    },
    {
      source: "GAO",
      external_id: "SAMPLE-B-000002",
      title: "B-000002: Sample protest of a sole-source justification (sample data)",
      decided_or_published_date: back(9),
      outcome_or_type: "Sustained in part",
      agency: "Government Accountability Office",
      url: "https://www.gao.gov/legal/bid-protests/recent",
      summary: "Sample data, GAO not reachable from this environment. Justification under FAR 6.303.",
      tags: ["Bid protest", "Sample", "FAR 6"],
    },
    {
      source: "GAO",
      external_id: "SAMPLE-B-000003",
      title: "B-000003: Sample protest of a small business set-aside (sample data)",
      decided_or_published_date: back(16),
      outcome_or_type: "Dismissed",
      agency: "Government Accountability Office",
      url: "https://www.gao.gov/legal/bid-protests/recent",
      summary: "Sample data, GAO not reachable from this environment. Set-aside decision under FAR 19.502.",
      tags: ["Bid protest", "Sample", "FAR 19"],
    },
  ];
}

async function store(rows: Row[], source: string, actor: string, note: string, providerError?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const existing = await supabaseAdmin.from("watch_items").select("item_id,external_id").eq("source", source);
  if (existing.error) throw new Error(existing.error.message);
  const known = new Set((existing.data ?? []).map((r) => r.external_id));
  const fresh = rows.filter((r) => !known.has(r.external_id));
  if (fresh.length > 0) {
    const insert = await supabaseAdmin
      .from("watch_items")
      .insert(fresh.map((r) => ({ ...r, fetched_at: new Date().toISOString() })));
    if (insert.error) throw new Error(insert.error.message);
  }
  await supabaseAdmin.from("audit_log").insert({
    acquisition_id: null,
    actor,
    action: `${source} fetch`,
    field: "watch_items",
    old_value: String(known.size),
    new_value: String(known.size + fresh.length),
    reason: providerError ? `${note} Provider error: ${providerError}` : note,
    logged_at: new Date().toISOString(),
  });
  return fresh.length;
}

export async function fetchGaoDecisions(actor: string): Promise<FetchOutcome> {
  let rows: Row[] = [];
  let providerError: string | undefined;
  try {
    const url = "https://www.gao.gov/legal/bid-protests/recent";
    const response = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 300);
      throw new Error(`gao.gov responded ${response.status}. Response body (first 300 characters): ${body || "(empty)"}`);
    }
    rows = parseGao(await response.text());
    if (rows.length === 0) throw new Error("No decisions were found on the recent decisions page.");
  } catch (error) {
    providerError = error instanceof Error ? error.message : "GAO fetch failed.";
    console.error(`[GAO] ${providerError}`);
    rows = gaoSample();
  }
  const note = providerError
    ? "GAO could not be reached; labelled sample decisions were loaded."
    : `Parsed ${rows.length} recent decisions; decision text not stored.`;
  const inserted = await store(rows, "GAO", actor, note, providerError);
  return { source: "GAO", fetched: rows.length, inserted, note, ...(providerError ? { providerError } : {}) };
}

export async function fetchFederalRegister(actor: string): Promise<FetchOutcome> {
  const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const rows = new Map<string, Row>();
  let providerError: string | undefined;

  for (const term of ['"Federal Acquisition Regulation"', '"NASA FAR Supplement"']) {
    try {
      const url = new URL("https://www.federalregister.gov/api/v1/documents.json");
      url.searchParams.set("conditions[term]", term);
      url.searchParams.set("conditions[publication_date][gte]", since);
      url.searchParams.set("per_page", "20");
      url.searchParams.set("order", "newest");
      for (const field of ["title", "document_number", "type", "publication_date", "html_url", "abstract", "agencies"]) {
        url.searchParams.append("fields[]", field);
      }
      const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
      if (!response.ok) {
        const body = (await response.text()).slice(0, 300);
        throw new Error(
          `federalregister.gov responded ${response.status}. Response body (first 300 characters): ${body || "(empty)"}`,
        );
      }
      const payload = (await response.json()) as {
        results?: {
          title?: string;
          document_number?: string;
          type?: string;
          publication_date?: string;
          html_url?: string;
          abstract?: string;
          agencies?: { name?: string }[];
        }[];
      };
      for (const doc of payload.results ?? []) {
        const id = doc.document_number ?? doc.html_url ?? doc.title;
        if (!id) continue;
        rows.set(id, {
          source: "Federal Register",
          external_id: id,
          title: (doc.title ?? "Untitled document").slice(0, 300),
          decided_or_published_date: toISODate(doc.publication_date ?? null),
          outcome_or_type: doc.type ?? "Document",
          agency: (doc.agencies ?? []).map((a) => a.name).filter(Boolean).join(", ") || "—",
          url: doc.html_url ?? "https://www.federalregister.gov",
          summary: (doc.abstract ?? doc.title ?? "").slice(0, 400),
          tags: [
            term.includes("NASA") ? "NASA FAR Supplement" : "Federal Acquisition Regulation",
            ...partTags(doc.title, doc.abstract),
          ],
        });
      }
    } catch (error) {
      providerError = error instanceof Error ? error.message : "Federal Register fetch failed.";
      console.error(`[Federal Register] ${providerError}`);
    }
  }

  const list = [...rows.values()];
  const note = providerError
    ? "Some Federal Register queries failed; the documents that returned were stored."
    : `Retrieved ${list.length} documents published since ${since}.`;
  const inserted = await store(list, "Federal Register", actor, note, providerError);
  return {
    source: "Federal Register",
    fetched: list.length,
    inserted,
    note,
    ...(providerError ? { providerError } : {}),
  };
}
