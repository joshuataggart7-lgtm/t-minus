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
import { requireRole } from "@/lib/actor";
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

/** Lovable AI Gateway model used for drafting. */
const DRAFT_MODEL = "openai/gpt-6-astra";

export const draftJofocItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<DraftResult> => {
    const item = DRAFTABLE_JOFOC_FIELDS[data.fieldKey];
    if (!item) {
      throw new Error("Only Items 5, 8, 9 and 11 are drafted. The other items bind to the record.");
    }

    const me = await requireRole(context, ["specialist", "hq"], "Drafting is available to the contracting specialist and HQ roles.");
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("The drafting service is not configured yet.");

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

    const model = DRAFT_MODEL;
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

    const callModel = async (content: string) => {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model,
          stream: true,
          store: false,
          reasoning: { effort: "low" },
          instructions:
            "You are a federal contracting writing assistant inside a NASA acquisition prototype. All records are fictional demonstration data. You draft ordinary procurement documentation paragraphs for a contracting officer to review and edit.",
          input: [{ role: "user", content }],
        }),
      });
      if (response.status === 429) throw new Error("The drafting service is busy right now. Try again in a moment.");
      if (response.status === 402) throw new Error("The workspace is out of AI credits. Add credits, then try again.");
      if (!response.ok || !response.body) {
        const body = (await response.text()).slice(0, 300);
        console.error(`[AI draft] ${response.status} ${body}`);
        throw new Error(`The drafting service responded ${response.status}. Try again.`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let value = "";
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          for (const line of frame.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json || json === "[DONE]") continue;
            try {
              const evt = JSON.parse(json) as { type?: string; delta?: string };
              if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") value += evt.delta;
              if (evt.type === "response.failed" || evt.type === "error") {
                throw new Error("The drafting service could not finish this item. Try again.");
              }
            } catch (e) {
              if (e instanceof Error && e.message.startsWith("The drafting")) throw e;
            }
          }
        }
      }
      return value.trim();
    };

    // Some intake answers describe hazards; when the model declines that
    // context, draft again from the record alone rather than failing.
    let text = await callModel(prompt);
    let usedAnswers = true;
    if (!text) {
      text = await callModel(promptWithoutAnswers);
      usedAnswers = false;
    }
    if (!text) throw new Error("The drafting service returned no text for this item. Try again.");


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
