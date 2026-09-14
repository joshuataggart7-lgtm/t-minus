import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sourceSchema = z.object({
  id: z.string().max(80),
  kind: z.enum(["PR", "NF 1707", "SOW/PWS", "IGCE"]),
  name: z.string().max(180),
  mimeType: z.string().max(100),
  text: z.string().max(500_000).default(""),
  pdfData: z.string().max(28_000_000).nullable().default(null),
});

const inputSchema = z.object({
  sources: z.array(sourceSchema).min(1).max(4),
  missions: z.array(z.object({ id: z.string(), name: z.string(), directorateCode: z.string().nullable() })).max(100),
});

export type PackageSuggestion = {
  key: string;
  label: string;
  value: string;
  sourceId: string;
  sourceName: string;
  excerpt: string;
  rationale: string;
  origin: "AI-suggested" | "from requester's 1707";
};

export type PackageClin = {
  clinNumber: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  extendedPrice: string;
  periodStart: string;
  periodEnd: string;
  sourceId: string;
  excerpt: string;
};

export type PackageDraft = {
  suggestions: PackageSuggestion[];
  clins: PackageClin[];
  warnings: string[];
};

const allowedKeys = new Set([
  "title", "description_of_requirement", "requester_name", "requester_org_code",
  "mission_directorate_code", "mission_id", "naics_code", "naics_alternate_1",
  "naics_alternate_2", "psc_code", "estimated_value", "period_of_performance_start",
  "period_of_performance_end", "place_of_performance", "need_date", "contract_type",
  "commercial_item_indication", "competition", "igce_attached", "sow_attached",
  "gate.services", "gate.it", "gate.hardware", "gate.space", "gate.aviation", "gate.hazards",
  "s1_strategy", "s2_authorization", "s2_citr_number", "s2_orca_number", "s2_no_authorization",
  "s2_no_authorization_reason", "s3_gpc", "s3_biobased", "s3_energy", "s3_smartway", "s3_epa",
  "s3_epeat", "s3_recovered", "s3_snap", "s3_epeat_verified", "s3_recovered_verified", "s3_nepa",
  "s3_catex", "s4_not_personal", "s4_not_governmental", "s4_not_employees", "s5_space_standards",
  "s5_scan", "s5_rf", "s5_evms", "s5_communications", "s5_aviation", "s5_software",
  "s5_software_class", "s5_scv", "s5_scv_under_20m", "s5_scv_not_ampl", "s5_scv_modification",
  "s6_exempt_it_infra", "s6_exempt_it_services", "s6_exempt_software", "s6_exempt_facilities",
  "s6_exempt_agreement", "s6_commercial", "s6_critical", "s6_complex", "s6_standard",
  "s6_acceptance_days", "s6_conformance", "s6_chemical", "s6_chemical_spec", "s6_gsi",
  "s6_first_article", "s6_gidep", "s7_hazards", "s8_capital", "s9_required", "s9_which",
  "s10_foreign_travel", "s11_extraneous", "s12_fee",
]);

function extractJson(raw: string) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  return JSON.parse(candidate) as Record<string, unknown>;
}

async function streamedResponse(body: Record<string, unknown>, apiKey: string) {
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      let message = errorBody;
      try {
        const parsed = JSON.parse(errorBody) as { error?: { message?: string }; message?: string };
        message = parsed.error?.message ?? parsed.message ?? errorBody;
      } catch {
        // Preserve the response body when it is not JSON.
      }
      lastError = message || `Lovable AI returned ${response.status}.`;
      if (response.status !== 429 && response.status < 500) throw new Error(lastError);
      if (attempt === 2) throw new Error(lastError);
      const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
      await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 700 * 2 ** attempt)));
      continue;
    }
    if (!response.body) throw new Error("Lovable AI returned an empty response.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    let answer = "";
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      pending += decoder.decode(part.value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
        try {
          const event = JSON.parse(line.slice(6)) as { type?: string; delta?: string; response?: { output_text?: string } };
          if (event.type === "response.output_text.delta") answer += event.delta ?? "";
          if (!answer && event.type === "response.completed") answer = event.response?.output_text ?? "";
        } catch {
          // Ignore keepalive and partial SSE lines.
        }
      }
    }
    return answer;
  }
  throw new Error(lastError || "Lovable AI could not read the requester package.");
}

export const draftFromRequesterPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<PackageDraft> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Lovable AI is not configured for this workspace.");

    const sourceText = data.sources.map((source) => ({
      id: source.id,
      name: source.name,
      text: source.text,
    }));
    const prompt = [
      "Read only the requester-package sources attached to this message. Return JSON only.",
      "Do not infer a fact without a verbatim source excerpt. Use an empty array rather than guessing.",
      "Each suggestion is {key,label,value,sourceId,excerpt,rationale,origin}. Extract every completed NF 1707 answer that maps to an allowed key.",
      "origin is \"from requester's 1707\" only for answers read from the NF 1707 source; otherwise \"AI-suggested\".",
      `Allowed keys: ${[...allowedKeys].join(", ")}. Gate values must be yes or no. igce_attached and sow_attached use true or false.`,
      "The brief description is 2–3 sentences. NAICS needs one rationale and up to two alternate suggestion rows.",
      "Flag sole-source or brand-name language through competition. Commercial item indication includes reasoning in rationale.",
      "CLIN rows are {clinNumber,description,quantity,unit,unitPrice,extendedPrice,periodStart,periodEnd,sourceId,excerpt}.",
      "If no IGCE exists, derive CLIN skeleton rows only from explicit SOW/PWS deliverables and leave all prices blank.",
      `Existing missions: ${JSON.stringify(data.missions)}. Match mission_id and mission_directorate_code only when supported.`,
      `Source text index: ${JSON.stringify(sourceText)}`,
      'Output shape: {"suggestions":[],"clins":[],"warnings":[]}.',
    ].join("\n");
    const content: Record<string, unknown>[] = [{ type: "input_text", text: prompt }];
    for (const source of data.sources) {
      if (source.pdfData) {
        content.push({ type: "input_file", filename: source.name, file_data: source.pdfData });
      }
    }
    const raw = await streamedResponse({
      model: "openai/gpt-6-astra",
      stream: true,
      reasoning: { effort: "medium", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      store: false,
      input: [{ role: "user", content }],
    }, apiKey);
    const parsed = extractJson(raw);
    const rows = Array.isArray(parsed["suggestions"]) ? parsed["suggestions"] : [];
    const suggestions: PackageSuggestion[] = [];
    for (const candidate of rows) {
      if (!candidate || typeof candidate !== "object") continue;
      const row = candidate as Record<string, unknown>;
      const key = String(row["key"] ?? "");
      const sourceId = String(row["sourceId"] ?? "");
      const excerpt = String(row["excerpt"] ?? "").trim();
      const source = data.sources.find((item) => item.id === sourceId);
      if (!allowedKeys.has(key) || !source || !excerpt) continue;
      const searchable = source.text || "";
      if (searchable && !searchable.toLocaleLowerCase().includes(excerpt.toLocaleLowerCase())) continue;
      suggestions.push({
        key,
        label: String(row["label"] ?? key.replaceAll("_", " ")),
        value: String(row["value"] ?? ""),
        sourceId,
        sourceName: source.name,
        excerpt,
        rationale: String(row["rationale"] ?? ""),
        origin: source.kind === "NF 1707" ? "from requester's 1707" : "AI-suggested",
      });
    }
    const igceSource = data.sources.find((source) => source.kind === "IGCE");
    if (!igceSource && !suggestions.some((item) => item.key === "igce_attached")) {
      const source = data.sources.find((item) => item.kind === "SOW/PWS") ?? data.sources[0];
      if (source) suggestions.push({
        key: "igce_attached",
        label: "IGCE attached",
        value: "false",
        sourceId: source.id,
        sourceName: source.name,
        excerpt: "No IGCE was uploaded in this session.",
        rationale: "The CLIN skeleton keeps dollar cells blank until an IGCE is attached.",
        origin: "AI-suggested",
      });
    }
    const clinRows = Array.isArray(parsed["clins"]) ? parsed["clins"] : [];
    const clins: PackageClin[] = clinRows.flatMap((candidate, index) => {
      if (!candidate || typeof candidate !== "object") return [];
      const row = candidate as Record<string, unknown>;
      const sourceId = String(row["sourceId"] ?? "");
      const source = data.sources.find((item) => item.id === sourceId);
      const excerpt = String(row["excerpt"] ?? "").trim();
      if (!source || !excerpt || (source.text && !source.text.toLocaleLowerCase().includes(excerpt.toLocaleLowerCase()))) return [];
      return [{
        clinNumber: String(row["clinNumber"] ?? String(index + 1).padStart(4, "0")),
        description: String(row["description"] ?? ""), quantity: String(row["quantity"] ?? ""),
        unit: String(row["unit"] ?? ""), unitPrice: String(row["unitPrice"] ?? ""),
        extendedPrice: String(row["extendedPrice"] ?? ""), periodStart: String(row["periodStart"] ?? ""),
        periodEnd: String(row["periodEnd"] ?? ""), sourceId, excerpt,
      }];
    });
    return { suggestions, clins, warnings: Array.isArray(parsed["warnings"]) ? parsed["warnings"].map(String) : [] };
  });

const naicsInput = z.object({ naics: z.string().regex(/^\d{6}$/) });
export type NaicsSizeView = { naics: string; sizeStandard: string; sourceLabel: string };

export const lookupNaicsSizeStandard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => naicsInput.parse(input))
  .handler(async ({ data }): Promise<NaicsSizeView> => {
    const apiKey = process.env["SAM_GOV_API_KEY"]?.trim();
    if (!apiKey) return { naics: data.naics, sizeStandard: "Not reported", sourceLabel: "SAM.gov key is not configured" };
    const url = new URL("https://api.sam.gov/entity-information/v3/entities");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("naicsCode", data.naics);
    url.searchParams.set("registrationStatus", "A");
    url.searchParams.set("includeSections", "assertions");
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return { naics: data.naics, sizeStandard: "Not reported", sourceLabel: `SAM.gov returned ${response.status}` };
    const body = await response.json() as { entityData?: { assertions?: { goodsAndServices?: { naicsList?: Record<string, unknown>[] } } }[] };
    const rows = body.entityData?.flatMap((entity) => entity.assertions?.goodsAndServices?.naicsList ?? []) ?? [];
    const row = rows.find((item) => String(item["naicsCode"] ?? "") === data.naics);
    const value = row?.["sizeStandard"] ?? row?.["sbaSizeStandard"] ?? row?.["sizeStandardValue"];
    return { naics: data.naics, sizeStandard: value ? String(value) : "Not reported", sourceLabel: "Live SAM.gov entity data" };
  });