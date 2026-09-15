import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, PageHeader, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import { buildForm, FORM_NAMES, xfaDatasets, type FormCtx, type FormKey, type FormRespondent } from "@/lib/nf1787";
import type { FindingMap } from "@/lib/research-findings";
import { exportXdp, exportXfaIncremental, renderPdf, type PdfBlock } from "@/lib/pdf-out";
import { daysBetween, todayISO } from "@/lib/intake";

export const Route = createFileRoute("/forms/$formKey/$acquisitionId")({
  head: () => ({
    meta: [
      { title: "Generated form · T-Minus" },
      {
        name: "description",
        content: "NF 1787 and NF 1787A filled from the acquisition record, previewed and exported.",
      },
      { property: "og:title", content: "Generated form · T-Minus" },
      {
        property: "og:description",
        content: "NF 1787 and NF 1787A filled from the acquisition record, previewed and exported.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FormPage,
});

const isFormKey = (key: string): key is FormKey => key === "nf-1787" || key === "nf-1787a";

/** Respondents from the cached set-aside evidence search, when it has been run. */
function respondentsFromRaw(raw: unknown): FormRespondent[] {
  const record = (raw ?? {}) as Record<string, unknown>;
  const list = (record["entityData"] ?? record["entities"] ?? []) as unknown[];
  if (!Array.isArray(list)) return [];
  return list.slice(0, 12).map((entry) => {
    const e = (entry ?? {}) as Record<string, unknown>;
    const reg = (e["entityRegistration"] ?? e) as Record<string, unknown>;
    const types = ((e["assertions"] ?? {}) as Record<string, unknown>)["goodsAndServices"] as
      | Record<string, unknown>
      | undefined;
    const naicsList = (types?.["naicsList"] ?? []) as { sbaSmallBusiness?: string }[];
    const small = Array.isArray(naicsList) && naicsList.some((n) => n?.sbaSmallBusiness === "Y");
    return {
      uei: String(reg["ueiSAM"] ?? reg["uei"] ?? ""),
      name: String(reg["legalBusinessName"] ?? reg["legalName"] ?? ""),
      category: small ? "Small business" : "Not stated in SAM.gov",
      assessment: "Capable of performing the requirement, based on registered NAICS",
    };
  });
}

function FormPage() {
  const { formKey, acquisitionId } = Route.useParams();
  const { authState, user } = useRole();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");

  const q = useQuery({
    queryKey: ["generated-form", formKey, acquisitionId],
    enabled: authState === "signed-in" && isFormKey(formKey),
    queryFn: async () => {
      const acq = await supabase
        .from("acquisition_facts")
        .select("*")
        .eq("acquisition_id", acquisitionId)
        .maybeSingle();
      if (acq.error) throw new Error(acq.error.message);
      const row = acq.data as Record<string, unknown> | null;
      const missionId = String(row?.["mission_id"] ?? "");
      const mission = missionId
        ? await supabase.from("missions").select("name").eq("mission_id", missionId).maybeSingle()
        : { data: null };
      const evidence = await supabase
        .from("sam_checks")
        .select("check_type,response_json,checked_at")
        .eq("acquisition_id", acquisitionId)
        .like("check_type", "Set-aside entities%")
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const naics = String(row?.["naics_code"] ?? "");
      const size = naics
        ? await supabase.from("naics_size_standards").select("*").eq("naics_code", naics).maybeSingle()
        : { data: null };
      const sat = await supabase
        .from("thresholds")
        .select("value,citation,effective_date")
        .ilike("name", "%simplified acquisition%")
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      // Values drafted by the market research evidence engine, each carrying its
      // source and date until the contracting officer confirms it.
      const research = await supabase
        .from("research_findings")
        .select("target,label,value,source,source_date,confirmed,confirmed_by")
        .eq("acquisition_id", acquisitionId);
      // The library row for this form, and the versions already filed under it.
      const template = await supabase
        .from("templates")
        .select("template_id")
        .eq("name", FORM_NAMES[formKey as FormKey])
        .maybeSingle();
      const templateId = (template.data as { template_id?: string } | null)?.template_id ?? null;
      const versions = templateId
        ? await supabase
            .from("documents")
            .select("version,saved_at,saved_by")
            .eq("acquisition_id", acquisitionId)
            .eq("template_id", templateId)
            .order("version", { ascending: false })
        : { data: [] };
      return {
        templateId,
        versions: (versions.data ?? []) as { version: number | null; saved_at: string | null; saved_by: string | null }[],
        findings: Object.fromEntries(
          (research.data ?? []).map((f) => [
            f.target,
            {
              target: f.target,
              label: f.label,
              value: f.value,
              source: f.source,
              sourceDate: f.source_date,
              confirmed: f.confirmed,
              confirmedBy: f.confirmed_by,
            },
          ]),
        ) as FindingMap,
        acq: row,
        missionName: (mission.data as { name?: string } | null)?.name ?? missionId,
        evidence: evidence.data ?? null,
        size: (size.data ?? null) as Record<string, unknown> | null,
        sat: (sat.data ?? null) as { value?: number; citation?: string } | null,
      };
    },
  });

  const form = useMemo(() => {
    if (!q.data?.acq || !isFormKey(formKey)) return null;
    const acq = q.data.acq;
    const answers = (acq["nf1707_answers"] ?? {}) as Record<string, unknown>;
    const gate = (name: string): boolean | null => {
      const v = answers[`gate.${name}`];
      return v === "yes" ? true : v === "no" ? false : null;
    };
    const envelope = (q.data.evidence?.response_json ?? null) as Record<string, unknown> | null;
    const respondents = envelope ? respondentsFromRaw(envelope["raw"]) : [];
    const ctx: FormCtx = {
      acquisitionId,
      acq,
      missionName: q.data.missionName,
      coName: String(acq["co_name"] ?? ""),
      specialistName: String(acq["requester_name"] ?? ""),
      respondents,
      findings: q.data.findings,
      evidenceLabel: q.data.evidence?.checked_at
        ? `run ${String(q.data.evidence.checked_at).slice(0, 10)}`
        : null,
      gates: { services: gate("services"), it: gate("it"), hardware: gate("hardware") },
      sizeStandard: q.data.size
        ? {
            naicsCode: String(q.data.size["naics_code"] ?? ""),
            naicsTitle: String(q.data.size["naics_title"] ?? ""),
            standardType: q.data.size["standard_type"] === "employees" ? "employees" : "receipts",
            employees: q.data.size["employees"] === null ? null : Number(q.data.size["employees"]),
            receiptsUsd: q.data.size["receipts_usd"] === null ? null : Number(q.data.size["receipts_usd"]),
            citation: String(q.data.size["citation"] ?? ""),
            effectiveDate: String(q.data.size["effective_date"] ?? ""),
            note: String(q.data.size["note"] ?? ""),
          }
        : null,
      simplifiedAcquisition: q.data.sat?.value
        ? { value: Number(q.data.sat.value), citation: String(q.data.sat.citation ?? "") }
        : null,
    };
    return buildForm(formKey, ctx);
  }, [q.data, formKey, acquisitionId]);

  // The same fallback the file page uses: the forecast's anticipated award
  // date stands in when no target award date is entered.
  const targetDate = ((): string | null => {
    const pick = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    return pick(q.data?.acq?.["target_award_date"]) ?? pick(q.data?.acq?.["need_date"]);
  })();
  const daysToAward = targetDate ? daysBetween(todayISO(), targetDate) : null;
  const headerLine = `${acquisitionId} · ${daysToAward === null ? "no target award date" : `${daysToAward} days to award`}`;

  if (!isFormKey(formKey)) {
    return (
      <AppShell>
        <EmptyState sentence="This form is not generated by T-Minus. Open the file and pick a form from the roadmap." />
      </AppShell>
    );
  }

  const latest = q.data?.versions?.[0] ?? null;

  const save = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error("The form is still loading.");
      if (!q.data?.templateId) throw new Error("This form is not loaded in the document library.");
      const nextVersion = Number(latest?.version ?? 0) + 1;
      const savedAt = new Date().toISOString();
      const fieldValues: Record<string, string> = {};
      for (const section of form.sections) {
        for (const field of section.fields) {
          fieldValues[field.path] =
            typeof field.value === "boolean" ? (field.value ? "Yes" : "No") : field.value;
        }
      }
      const { error } = await supabase.from("documents").insert({
        acquisition_id: acquisitionId,
        template_id: q.data.templateId,
        field_values: fieldValues as never,
        version: nextVersion,
        saved_by: user.name,
        saved_at: savedAt,
        // Every value is drawn from the record and the research log, so the
        // provenance names the engine rather than a model.
        ai_model: "T-Minus form engine (record and research run, no model)",
        ai_generated_at: savedAt,
      });
      if (error) throw new Error(error.message);
      const { error: logError } = await supabase.from("audit_log").insert({
        acquisition_id: acquisitionId,
        actor: user.name,
        action: "Document saved",
        field: form.name,
        old_value: latest ? `version ${latest.version}` : null,
        new_value: `version ${nextVersion}`,
        reason: `${form.name} saved from the form engine`,
      });
      if (logError) throw new Error(logError.message);
      return nextVersion;
    },
    onSuccess: async (v) => {
      setMessage(`Saved as version ${v}. The version is in the contract file index and the launch sequence row now reads Saved.`);
      await queryClient.invalidateQueries({ queryKey: ["generated-form", formKey, acquisitionId] });
    },
    onError: (e: unknown) =>
      setMessage(e instanceof Error ? `The save did not finish: ${e.message}` : "The save did not finish."),
  });

  const exportFlat = async () => {
    if (!form) return;
    const blocks: PdfBlock[] = [
      { text: form.name, bold: true, size: 14, gap: 4 },
      { text: `${headerLine} · ${form.citation}`, size: 10, gap: 12 },
    ];
    for (const section of form.sections) {
      blocks.push({ text: section.title, bold: true, size: 12, gap: 2 });
      if (section.citation) blocks.push({ text: section.citation, size: 9, gap: 4 });
      for (const field of section.fields) {
        const value =
          typeof field.value === "boolean" ? (field.value ? "Yes" : "No") : field.value || "—";
        blocks.push({ text: `${field.label}: ${value}`, size: 11, indent: 12, gap: 2 });
      }
      blocks.push({ text: "", gap: 8 });
    }
    await renderPdf(blocks, {
      fileName: `${form.key}-${acquisitionId}-flattened`,
      footer: [`${headerLine} · ${form.citation}`, "Prototype. Not an official NASA system."],
    });
    setMessage("Flattened PDF exported.");
  };

  const exportPopulated = async () => {
    if (!form) return;
    try {
      await exportXfaIncremental(form.pdf, xfaDatasets(form), `${form.key}-${acquisitionId}`);
      setMessage(
        "Form PDF exported. Open it in Adobe Reader; the answers are already in the fields. If your reader will not open it, use the data file with Import Data on the blank form.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The form did not export.");
    }
  };

  const exportData = () => {
    if (!form) return;
    exportXdp(xfaDatasets(form), `${form.key}-${acquisitionId}`);
    setMessage("Data file exported. In Adobe Reader open the blank form, then choose Import Data and pick this file.");
  };

  return (
    <AppShell>
      <PageHeader
        title={FORM_NAMES[formKey]}
        lead={`Filled from the record of ${acquisitionId}. Signatures and concurrence come from the Approvals step.`}
      />
      <p className="mb-6 text-[13px] text-muted-foreground">
        {headerLine} · {form?.citation}
        {latest ? ` · saved version ${latest.version}${latest.saved_at ? `, ${String(latest.saved_at).slice(0, 10)}` : ""}${latest.saved_by ? `, by ${latest.saved_by}` : ""}` : " · no version saved yet"}
      </p>
      <p className="mb-6 text-[15px]">
        <Link to="/files/$acquisitionId" params={{ acquisitionId }} className="text-primary">
          Back to the file
        </Link>
      </p>

      {q.isLoading ? <LoadingNote what="the form" /> : null}
      {q.error ? <ErrorNote message={(q.error as Error).message} /> : null}
      {!q.isLoading && !q.error && !q.data?.acq ? (
        <EmptyState sentence="This file was not found. Open the work queue and pick a file." />
      ) : null}

      {form ? (
        <>
          <div className="mb-6 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-[15px] text-primary-foreground"
              style={{ background: "var(--primary, #0B3D91)" }}
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? "Saving" : "Save version"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-[15px]"
              onClick={() => void exportPopulated()}
            >
              Export form PDF
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-[15px]"
              onClick={() => void exportFlat()}
            >
              Export flattened PDF
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-[15px]"
              onClick={exportData}
            >
              Export data file for Import Data
            </button>
          </div>
          <p className="mb-6 max-w-[80ch] text-[13px] text-muted-foreground">
            The form PDF is the original form with only its data replaced, so Adobe Reader opens it as the
            form. The flattened PDF prints every answer as text for the contract file.
          </p>
          {message ? (
            <p role="status" className="mb-6 text-[15px]">
              {message}
            </p>
          ) : null}

          <h2 className="mb-3 text-[18px] leading-6 font-medium">Export preview</h2>
          {form.sections.map((section) => (
            <section key={section.title} className="mb-6 max-w-[80ch] border border-border bg-background p-4">
              <h3 className="text-[18px] leading-6 font-medium">{section.title}</h3>
              {section.citation ? (
                <p className="mb-3 text-[13px] text-muted-foreground">{section.citation}</p>
              ) : null}
              <dl>
                {section.fields.map((field) => (
                  <div key={field.path} className="mb-2 grid grid-cols-[1fr_1.4fr] gap-3 text-[15px]">
                    <dt className="text-muted-foreground">{field.label}</dt>
                    <dd className="tabular-nums">
                      {typeof field.value === "boolean"
                        ? field.value
                          ? "Checked"
                          : "Not checked"
                        : field.value || "—"}
                      {field.gap ? (
                        <span className="block text-[13px] text-muted-foreground">{field.gap}</span>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </>
      ) : null}
    </AppShell>
  );
}
