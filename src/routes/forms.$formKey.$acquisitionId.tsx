import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, PageHeader, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import { buildForm, FORM_NAMES, xfaDatasets, type FormCtx, type FormKey, type FormRespondent } from "@/lib/nf1787";
import { exportPopulatedXfa, renderPdf, type PdfBlock } from "@/lib/pdf-out";
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
  const { authState } = useRole();
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
      return {
        acq: row,
        missionName: (mission.data as { name?: string } | null)?.name ?? missionId,
        evidence: evidence.data ?? null,
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
      evidenceLabel: q.data.evidence?.checked_at
        ? `run ${String(q.data.evidence.checked_at).slice(0, 10)}`
        : null,
      gates: { services: gate("services"), it: gate("it"), hardware: gate("hardware") },
    };
    return buildForm(formKey, ctx);
  }, [q.data, formKey, acquisitionId]);

  const targetDate = q.data?.acq?.["target_award_date"] as string | null | undefined;
  const daysToAward = targetDate ? daysBetween(todayISO(), targetDate) : null;
  const headerLine = `${acquisitionId} · ${daysToAward === null ? "no target award date" : `${daysToAward} days to award`}`;

  if (!isFormKey(formKey)) {
    return (
      <AppShell>
        <EmptyState title="This form is not generated by T-Minus" body="Open the file and pick a form from the roadmap." />
      </AppShell>
    );
  }

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
      await exportPopulatedXfa(form.pdf, xfaDatasets(form), `${form.key}-${acquisitionId}`);
      setMessage("Form exported with its fields populated. Open it in Adobe Acrobat to see the filled form.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The form did not export.");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title={FORM_NAMES[formKey]}
        lead={`Filled from the record of ${acquisitionId}. Signatures and concurrence come from the Approvals step.`}
      />
      <p className="mb-6 text-[13px] text-muted-foreground">
        {headerLine} · {form?.citation}
      </p>
      <p className="mb-6 text-[15px]">
        <Link to="/files/$acquisitionId" params={{ acquisitionId }} className="text-primary">
          Back to the file
        </Link>
      </p>

      {q.isLoading ? <LoadingNote /> : null}
      {q.error ? <ErrorNote message={(q.error as Error).message} /> : null}
      {!q.isLoading && !q.error && !q.data?.acq ? (
        <EmptyState title="This file was not found" body="Open the work queue and pick a file." />
      ) : null}

      {form ? (
        <>
          <div className="mb-6 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-[15px] text-primary-foreground"
              style={{ background: "var(--primary, #0B3D91)" }}
              onClick={() => void exportPopulated()}
            >
              Export PDF with fields filled
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-[15px]"
              onClick={() => void exportFlat()}
            >
              Export flattened PDF
            </button>
          </div>
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
