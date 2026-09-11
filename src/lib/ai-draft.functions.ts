/**
 * Drafting narrative JOFOC items from the record.
 *
 * Only the four narrative items are drafted: Item 5 rationale, Item 8 market
 * research, Item 9 other facts, Item 11 barriers. Items 1 through 4, 6, 7 and
 * 10 bind to the record and are never drafted.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { templateByKey } from "@/lib/template-engine";

/** The only fields a model may write. */
export const DRAFTABLE_JOFOC_FIELDS: Record<string, { item: string; sectionId: string }> = {
  authority_rationale: { item: "5. Demonstration that the authority cited applies", sectionId: "item5" },
  market_research: { item: "8. Market research conducted and the results", sectionId: "item8" },
  other_facts: { item: "9. Other facts supporting the use of other than full and open competition", sectionId: "item9" },
  barriers: { item: "11. Actions to remove barriers to competition", sectionId: "item11" },
};

export type DraftProvenance = {
  model: string;
  generatedAt: string;
  templateRevision: string;
  templateItem: string;
  templateText: string;
  draftText: string;
  intakeAnswersUsed: boolean;
  recordFields: { field: string; value: string }[];
  reviewed: boolean;
};

export type DraftResult = { text: string; provenance: DraftProvenance };

const inputSchema = z.object({
  acquisitionId: z.string().trim().min(1).max(40),
  fieldKey: z.string().trim().min(1).max(60),
});

const RECORD_FIELDS = [
  "acquisition_id",
  "title",
  "description_of_requirement",
  "mission_id",
  "center_code",
  "estimated_value",
  "naics_code",
  "psc_code",
  "contract_type",
  "acquisition_method",
  "competition",
  "set_aside",
  "jofoc_authority_citation",
  "vendor_legal_name",
  "period_of_performance_start",
  "period_of_performance_end",
  "place_of_performance",
  "need_date",
] as const;

/** Ask Anthropic which Sonnet model is current, rather than pinning a guess. */
async function currentSonnetModel(apiKey: string): Promise<string> {
  const fallback = "claude-sonnet-4-5";
  try {
    const response = await fetch("https://api.anthropic.com/v1/models?limit=50", {
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    });
    if (!response.ok) return fallback;
    const body = (await response.json()) as { data?: { id?: string; created_at?: string }[] };
    const sonnets = (body.data ?? [])
      .map((m) => ({ id: String(m.id ?? ""), created: String(m.created_at ?? "") }))
      .filter((m) => m.id.includes("sonnet"))
      .sort((a, b) => b.created.localeCompare(a.created));
    return sonnets[0]?.id ?? fallback;
  } catch {
    return fallback;
  }
}

export const draftJofocItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<DraftResult> => {
    const item = DRAFTABLE_JOFOC_FIELDS[data.fieldKey];
    if (!item) {
      throw new Error("Only Items 5, 8, 9 and 11 are drafted. The other items bind to the record.");
    }

    const { data: me, error: meError } = await context.supabase
      .from("users")
      .select("name,role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (meError) throw new Error(meError.message);
    if (!me || !["specialist", "hq"].includes(me.role)) {
      throw new Error("Drafting is available to the contracting specialist and HQ roles.");
    }

    const rawKey = process.env["ANTHROPIC_API_KEY"]?.trim();
    console.log(`[Claude] key present: ${Boolean(rawKey)}; length: ${rawKey?.length ?? 0}`);
    if (!rawKey) throw new Error("The Claude API key has not been configured. Enter it in the secret dialog.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: acq, error: acqError } = await supabaseAdmin
      .from("acquisition_facts")
      .select("*")
      .eq("acquisition_id", data.acquisitionId)
      .maybeSingle();
    if (acqError) throw new Error(acqError.message);
    if (!acq) throw new Error("That acquisition was not found.");

    const row = acq as Record<string, unknown>;
    const recordFields = RECORD_FIELDS.map((field) => ({
      field,
      value: row[field] === null || row[field] === undefined || row[field] === "" ? "—" : String(row[field]),
    }));
    const answers = (row["nf1707_answers"] ?? {}) as Record<string, unknown>;
    const answerLines = Object.entries(answers)
      .filter(([, v]) => v !== null && v !== "" && v !== false)
      .map(([k, v]) => `${k}: ${typeof v === "boolean" ? "Yes" : String(v)}`);

    const def = templateByKey("jofoc");
    const section = def?.sections.find((s) => s.id === item.sectionId);
    const field = section?.fields.find((f) => f.key === data.fieldKey);
    const templateText = [
      section?.title,
      section?.citation ? `Citation: ${section.citation}` : "",
      section?.standingText ?? "",
      field?.label ? `Field: ${field.label}` : "",
      field?.help ?? "",
    ]
      .filter(Boolean)
      .join("\n");

    const model = await currentSonnetModel(rawKey);
    const prompt = [
      "You are drafting one item of a NASA Justification for Other than Full and Open Competition (JOFOC).",
      "Write only the paragraph for the item named below. No headings, no preamble, no citations invented.",
      "Use plain, factual contracting language. Where the record does not support a statement, say what the",
      "contracting officer must confirm rather than inventing a fact.",
      "",
      "TEMPLATE INSTRUCTION FOR THIS ITEM:",
      templateText,
      "",
      "ACQUISITION RECORD:",
      ...recordFields.map((f) => `${f.field}: ${f.value}`),
      "",
      "INTAKE ANSWERS:",
      ...(answerLines.length ? answerLines : ["(none recorded)"]),
    ].join("\n");

    const promptWithoutAnswers = prompt.split("\nINTAKE ANSWERS:")[0] ?? prompt;

    const callClaude = async (content: string) => {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": rawKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4000,
          system:
            "You are a federal contracting writing assistant inside a NASA acquisition prototype. All records are fictional demonstration data. You draft ordinary procurement documentation paragraphs for a contracting officer to review and edit.",
          messages: [{ role: "user", content }],
        }),
      });
      if (!response.ok) {
        const body = (await response.text()).slice(0, 300);
        console.error(`[Claude] ${response.status} ${body}`);
        throw new Error(`Claude responded ${response.status}. ${body || "No detail was returned."}`);
      }
      const payload = (await response.json()) as {
        content?: { type?: string; text?: string }[];
        stop_reason?: string;
      };
      const value = (payload.content ?? [])
        .filter((c) => typeof c.text === "string" && c.type !== "thinking")
        .map((c) => c.text ?? "")
        .join("\n")
        .trim();
      if (!value) {
        console.error(
          `[Claude] empty text; stop_reason=${payload.stop_reason ?? "none"}; blocks=${(payload.content ?? []).map((c) => c.type).join(",")}`,
        );
      }
      return value;
    };

    // Some intake answers describe hazards; when the model declines that
    // context, draft again from the record alone rather than failing.
    let text = await callClaude(prompt);
    let usedAnswers = true;
    if (!text) {
      text = await callClaude(promptWithoutAnswers);
      usedAnswers = false;
    }
    if (!text) throw new Error("Claude returned no text for this item. Try again.");


    const generatedAt = new Date().toISOString();
    const { error: auditError } = await supabaseAdmin.from("audit_log").insert({
      acquisition_id: data.acquisitionId,
      actor: me.name,
      action: "AI draft generated",
      field: item.item,
      new_value: text.slice(0, 200),
      reason: `Drafted with ${model} from the record and the template instruction`,
      logged_at: generatedAt,
      phase: "Justification",
    });
    if (auditError) throw new Error(auditError.message);

    return {
      text,
      provenance: {
        model,
        generatedAt,
        templateRevision: def?.badge.revision ?? "—",
        templateItem: item.item,
        templateText,
        draftText: text,
        intakeAnswersUsed: usedAnswers,
        recordFields,
        reviewed: false,
      },
    };
  });
