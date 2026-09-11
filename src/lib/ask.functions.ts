/**
 * E9. Ask T-Minus.
 *
 * A question box that answers only from what is loaded in the tables: the
 * regulatory references (FAR, NFS, PCDs, the NFS Companion Guide, PICs and
 * PNs), the thresholds, the review rules and the templates list. Every answer
 * carries its sources with their tier, and an answer without a citation is not
 * returned at all.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** The gateway model this project is required to use. */
export const ASK_MODEL = "openai/gpt-6-astra";

export type AskSource = {
  citation: string;
  title: string;
  tier: string;
  source: string;
  effectiveDate: string;
  url: string | null;
  kind: "Regulatory reference" | "Threshold" | "Review rule" | "Template";
};

export type AskAnswer = {
  ok: true;
  answer: string;
  sources: AskSource[];
  model: string;
  answeredAt: string;
};

export type AskRefusal = { ok: false; message: string };

const inputSchema = z.object({ question: z.string().trim().min(3).max(500) });

function tierLabel(tier: string | null | undefined) {
  const t = (tier ?? "").toLowerCase();
  if (t.includes("bind")) return "binding";
  if (t.includes("guid")) return "guidance";
  return t ? t : "tier not recorded";
}

/** Thresholds hold both dollar figures and day counts; label each correctly. */
function amount(name: string, value: number | null) {
  if (value === null || value === undefined) return "";
  const n = Number(value).toLocaleString("en-US");
  return /\bdays?\b|\bmonths?\b|\byears?\b/i.test(name) ? n : `$${n}`;
}

export const askTMinus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { question: string }) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<AskAnswer | AskRefusal> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { ok: false, message: "The answering service is not configured, so no answer can be given here yet." };
    }

    const { supabase } = context;
    const [refs, thresholds, rules, templates] = await Promise.all([
      supabase
        .from("regulatory_refs")
        .select("citation, title, tier, source, effective_date, url, applies_to_phase")
        .order("effective_date", { ascending: false })
        .limit(400),
      supabase.from("thresholds").select("name, value, citation, tier, effective_date, superseded_date, note").limit(200),
      supabase.from("review_rules").select("reviewer_role, trigger, citation, planned_days, note").limit(200),
      supabase
        .from("templates")
        .select("name, nf_1098_tab, governing_citation, citation_tier, hq_revision_date, status")
        .limit(300),
    ]);

    const sources: AskSource[] = [];
    const lines: string[] = [];

    for (const r of refs.data ?? []) {
      const s: AskSource = {
        citation: r.citation,
        title: r.title ?? "",
        tier: tierLabel(r.tier),
        source: r.source ?? "",
        effectiveDate: r.effective_date ?? "",
        url: r.url ?? null,
        kind: "Regulatory reference",
      };
      sources.push(s);
      lines.push(
        `[${s.citation}] ${s.title} — ${s.tier}; source ${s.source}; effective ${s.effectiveDate}; applies to phase ${r.applies_to_phase ?? "any"}`,
      );
    }

    for (const t of thresholds.data ?? []) {
      if (t.superseded_date) continue;
      const s: AskSource = {
        citation: t.citation ?? t.name,
        title: `${t.name}${t.value !== null ? ` — ${amount(t.name, t.value)}` : ""}`,
        tier: tierLabel(t.tier),
        source: "thresholds",
        effectiveDate: t.effective_date ?? "",
        url: null,
        kind: "Threshold",
      };
      sources.push(s);
      lines.push(`[${s.citation}] Threshold: ${s.title} — ${s.tier}${t.note ? `; ${t.note}` : ""}`);
    }

    for (const r of rules.data ?? []) {
      if (!r.citation) continue;
      const s: AskSource = {
        citation: r.citation,
        title: `${r.reviewer_role} review — ${r.trigger ?? "trigger not recorded"}`,
        tier: "binding",
        source: "review rules",
        effectiveDate: "",
        url: null,
        kind: "Review rule",
      };
      sources.push(s);
      lines.push(
        `[${s.citation}] Review routing: ${s.title}; planned ${r.planned_days ?? "?"} days${r.note ? `; ${r.note}` : ""}`,
      );
    }

    for (const t of templates.data ?? []) {
      if (!t.governing_citation) continue;
      const s: AskSource = {
        citation: t.governing_citation,
        title: `${t.name}${t.nf_1098_tab ? ` (NF 1098 tab ${t.nf_1098_tab})` : ""}`,
        tier: tierLabel(t.citation_tier),
        source: "templates",
        effectiveDate: t.hq_revision_date ?? "",
        url: null,
        kind: "Template",
      };
      sources.push(s);
      lines.push(`[${s.citation}] Template: ${s.title} — ${s.tier}; HQ revision ${s.effectiveDate}; ${t.status ?? ""}`);
    }

    if (!lines.length) {
      return { ok: false, message: "No references are loaded yet, so nothing can be answered from the record." };
    }

    const system = [
      "You answer questions about United States federal acquisition for NASA staff, using ONLY the reference lines given to you.",
      "Never use knowledge from outside those lines. Never invent a citation, a date, or a dollar figure.",
      "Every claim must rest on a citation that appears in the reference lines, copied exactly as written inside the square brackets.",
      "If the references do not answer the question, say so plainly and return an empty citations list.",
      "Answer in at most 120 words, plain sentences, no headings, no markdown.",
      'Reply with JSON only: {"answer": string, "citations": string[]}.',
    ].join(" ");

    let raw = "";
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ASK_MODEL,
          messages: [
            { role: "system", content: system },
            {
              role: "user",
              content: `Question: ${data.question}\n\nReference lines:\n${lines.join("\n")}`,
            },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (response.status === 429) {
        return { ok: false, message: "The answering service is busy right now. Try the question again in a moment." };
      }
      if (response.status === 402) {
        return { ok: false, message: "The workspace is out of AI credits, so questions cannot be answered until they are topped up." };
      }
      if (!response.ok) {
        return { ok: false, message: "The answering service did not respond. Try again, or read the references directly." };
      }
      const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      raw = body.choices?.[0]?.message?.content ?? "";
    } catch {
      return { ok: false, message: "The answering service could not be reached. Try again in a moment." };
    }

    let parsed: { answer?: string; citations?: string[] } = {};
    try {
      parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, "").trim());
    } catch {
      return { ok: false, message: "The answer came back unreadable. Ask the question again." };
    }

    const answer = (parsed.answer ?? "").trim();
    const wanted = (parsed.citations ?? []).map((c) => String(c).trim()).filter(Boolean);

    // Only sources actually loaded from the tables may appear, and there is no
    // answer without at least one of them.
    const seen = new Set<string>();
    const matched: AskSource[] = [];
    for (const c of wanted) {
      const hit =
        sources.find((s) => s.citation.toLowerCase() === c.toLowerCase()) ??
        sources.find((s) => s.citation.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(s.citation.toLowerCase()));
      if (hit && !seen.has(hit.citation + hit.kind)) {
        seen.add(hit.citation + hit.kind);
        matched.push(hit);
      }
    }

    if (!answer || !matched.length) {
      return {
        ok: false,
        message:
          "The loaded references do not answer that, so no answer is given. Nothing is answered here without a citation.",
      };
    }

    return { ok: true, answer, sources: matched, model: ASK_MODEL, answeredAt: new Date().toISOString() };
  });
