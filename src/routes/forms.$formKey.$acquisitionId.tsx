import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageHeader, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import { buildForm, FORM_NAMES, xfaDatasets, type FormCtx, type FormKey, type FormRespondent } from "@/lib/nf1787";
import { blankPagePaths, withPagePaths } from "@/lib/form-page-map";
import { blankXfaPaths } from "@/lib/xfa-blank-paths";
import { withNf1707Answers } from "@/lib/nf1707-form";
import { answerKey, fieldLabel, type Nf1707Field } from "@/lib/nf1707";
import type { FindingMap } from "@/lib/research-findings";
import { exportXdp, exportXfaIncremental, renderPdf, type PdfBlock } from "@/lib/pdf-out";
import {
  downloadPdfBytes,
  generateOfficialSf1449Pdf,
  sf1449CtxToRogerData,
  validateSf1449ClinReconciliation,
} from "@/lib/official-acroform-sf1449";
import { generateOfficialFormPdf } from "@/lib/official-acroform-forms";
import { downloadDocxBytes, generateRfpCoverDocx } from "@/lib/rfp-cover-docx";

import { daysBetween, todayISO } from "@/lib/intake";
import { technicalRepresentative } from "@/lib/template-engine";
import { ensureClinScheduleFromIgce, loadClinSchedule } from "@/lib/clin-schedule";
import { signedInName } from "@/lib/account-name";
import { uploadAttachment } from "@/lib/attachments";
import { recordReadReceiptQuietly } from "@/lib/read-receipts";
import { DocReadCount } from "@/components/doc-read-count";
import { countLineage, lineageForFormSections } from "@/lib/field-lineage";
import {
  currentFormRevision,
  FORM_REVISION_KEY,
  pinnedRevisionFrom,
  routeKeyToFormId,
} from "@/lib/form-templates";

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

const isFormKey = (key: string): key is FormKey =>
  key === "nf-1707" ||
  key === "nf-1787" ||
  key === "nf-1787a" ||
  key === "sf-1449" ||
  key === "sf-30" ||
  key === "sf-33" ||
  key === "sf-26" ||
  key === "of-347";

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
    // Business types read as a short list of words, never as the stored record.
    const core = (e["coreData"] ?? {}) as Record<string, unknown>;
    const typeBlock = (core["businessTypes"] ?? {}) as Record<string, unknown>;
    const typeList = (typeBlock["businessTypeList"] ?? []) as { businessTypeDesc?: string }[];
    const descriptions = Array.isArray(typeList)
      ? [...new Set(typeList.map((t) => String(t?.businessTypeDesc ?? "").trim()).filter(Boolean))].slice(0, 3)
      : [];
    const category = [small ? "Small business" : "", ...descriptions].filter(Boolean).join(", ");
    return {
      uei: String(reg["ueiSAM"] ?? reg["uei"] ?? ""),
      name: String(reg["legalBusinessName"] ?? reg["legalName"] ?? ""),
      category: category || "Not stated in SAM.gov",
      assessment: "Capable of performing the requirement, based on registered NAICS",
    };
  });
}

function FormPage() {
  const { formKey, acquisitionId } = Route.useParams();
  const { authState, user } = useRole();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  // Soft §8: the lineage overlay is off until the reader turns it on, so the
  // preview reads exactly as before by default.
  const [showLineage, setShowLineage] = useState(false);

  // A read receipt for this visit. Soft tracking only; a failure is silent and
  // nothing on the file is held by it.
  useEffect(() => {
    if (authState !== "signed-in" || !acquisitionId || !isFormKey(formKey)) return;
    let cancelled = false;
    void (async () => {
      const who = await signedInName(user.name);
      if (cancelled) return;
      recordReadReceiptQuietly({
        acquisitionId,
        docKind: "form",
        docKey: formKey,
        docLabel: FORM_NAMES[formKey],
        openedBy: who,
        source: "form-route",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [authState, acquisitionId, formKey, user.name]);


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
            .select("version,saved_at,saved_by,field_values")
            .eq("acquisition_id", acquisitionId)
            .eq("template_id", templateId)
            .order("version", { ascending: false })
        : { data: [] };
      // The schedule on the file. Seeded once from the estimate when the file
      // has one and no schedule yet; figures are never invented.
      const clins = await ensureClinScheduleFromIgce(acquisitionId);
      return {
        clins,
        templateId,
        versions: (versions.data ?? []) as { version: number | null; saved_at: string | null; saved_by: string | null; field_values?: unknown }[],
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

  const formCtx = useMemo<FormCtx | null>(() => {
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
      // One technical representative from the record, the same name the
      // documents print.
      specialistName: technicalRepresentative(acq),
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
      clins: (q.data.clins ?? []).map((r) => ({
        clinNumber: String(r.clin_number ?? ""),
        description: String(r.description ?? ""),
        quantity: r.quantity === null || r.quantity === undefined ? null : Number(r.quantity),
        unit: r.unit_of_issue ?? null,
        unitPrice: r.unit_price === null || r.unit_price === undefined ? null : Number(r.unit_price),
        extendedPrice:
          r.extended_price === null || r.extended_price === undefined ? null : Number(r.extended_price),
        source: String(r.source ?? ""),
      })),
    };
    return ctx;
  }, [q.data, formKey, acquisitionId]);

  const baseForm = useMemo(
    () => (formCtx && isFormKey(formKey) ? buildForm(formKey, formCtx) : null),
    [formCtx, formKey],
  );

  /**
   * NF 1707 is a pure XFA blank, so its paths are read from the blank's own
   * packets rather than from an AcroForm layer. The questions are labelled
   * from the seeded field export.
   */
  const nf1707Blank = useQuery({
    queryKey: ["nf1707-blank"],
    enabled: formKey === "nf-1707",
    staleTime: Infinity,
    queryFn: async () => {
      const [paths, rows] = await Promise.all([
        blankXfaPaths("/forms/NF1707.pdf"),
        supabase.from("nf1707_fields").select("*"),
      ]);
      const labels = new Map<string, string>();
      for (const row of (rows.data ?? []) as Nf1707Field[]) labels.set(answerKey(row), fieldLabel(row));
      return { paths, labels };
    },
  });

  const form = useMemo(() => {
    if (!baseForm || formKey !== "nf-1707" || !nf1707Blank.data) return baseForm;
    const answers = (q.data?.acq?.["nf1707_answers"] ?? {}) as Record<string, unknown>;
    return withNf1707Answers(baseForm, answers, nf1707Blank.data.labels, nf1707Blank.data.paths);
  }, [baseForm, formKey, nf1707Blank.data, q.data]);

  /** Where each filled preview value came from. Preview only; exports unchanged. */
  const lineage = useMemo(
    () => (form ? lineageForFormSections(formKey, form.sections, q.data?.findings) : {}),
    [form, formKey, q.data?.findings],
  );
  const lineageCounts = useMemo(() => countLineage(lineage), [lineage]);

  /** One audit row when the overlay is opened. A failure is silent. */
  const noteLineageViewed = async () => {
    try {
      const who = await signedInName(user.name);
      await supabase.from("audit_log").insert({
        acquisition_id: acquisitionId,
        actor: who,
        action: "Lineage overlay viewed",
        field: formKey,
        old_value: null,
        new_value: `${lineageCounts.inherited} inherited, ${lineageCounts.overridden} overridden, ${lineageCounts.manual} entered for this document`,
        reason: "Reader opened the overlay showing where the values on this form came from",
      } as never);
    } catch {
      // Soft: the overlay never holds the file.
    }
  };

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

  // Soft §9: the blank this form is written against. A saved version keeps the
  // revision recorded on it; a new one uses the current builtin.
  const formTemplateId = routeKeyToFormId(formKey);
  const pinnedRevision = formTemplateId
    ? pinnedRevisionFrom(latest?.field_values) ?? currentFormRevision(formTemplateId)
    : null;

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
      // Soft §9: an official blank is pinned at the moment the version is
      // saved, so regenerating this version later reads the same blank.
      const pinFormId = routeKeyToFormId(formKey);
      if (pinFormId) fieldValues[FORM_REVISION_KEY] = currentFormRevision(pinFormId);
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
        reason: `${form.name} was saved as version ${nextVersion}`,
      });
      if (logError) throw new Error(logError.message);
      return nextVersion;
    },
    onSuccess: async (v) => {
      setMessage(`Saved as version ${v}.${pinnedRevision ? ` Blank revision ${pinnedRevision} is recorded on it.` : ""} The version is in the contract file index and the launch sequence row now reads Saved.`);
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

  // The data written out uses the field paths of the blank itself, page
  // subform included, so Import Data binds every value.
  const boundDatasets = async () => {
    if (!form) return "";
    const map = await blankPagePaths(form.pdf);
    return xfaDatasets(withPagePaths(form, map));
  };

  const exportPopulated = async () => {
    if (!form) return;
    try {
      const withCompanion = await exportXfaIncremental(
        form.pdf,
        await boundDatasets(),
        `${form.key}-${acquisitionId}`,
      );
      setMessage(
        withCompanion
          ? "Form PDF exported, with a data file alongside it. The blank carried usage rights, so this export leaves them off and free Adobe Reader can open it to view and print. If Reader still refuses it, open the blank form from this app and use Import Data with the data file."
          : "Form PDF exported. Open it in Adobe Acrobat or Adobe Reader on the desktop; a blank face in Chrome or Edge is expected. If desktop Reader will not open it, use the data file with Import Data on the blank form.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The form did not export.");
    }
  };


  /**
   * Soft §10: a generated draft is kept on the file, not only in the reader's
   * Downloads folder. The bytes already downloaded are written into the
   * evidence pack as an attachment. A pack write that fails never loses the
   * download; it is reported as it happened. This is prototype retention, not
   * a write-back to NCMS.
   */
  const fileIntoPack = async (input: {
    bytes: Uint8Array;
    fileName: string;
    contentType: string;
    key: string;
    label: string;
    note?: string;
  }): Promise<string> => {
    try {
      const who = await signedInName(user.name);
      const file = new File([input.bytes as unknown as BlobPart], input.fileName, {
        type: input.contentType,
      });
      await uploadAttachment({
        acquisitionId,
        key: input.key,
        label: input.label,
        file,
        actor: who,
      });
      try {
        await supabase.from("audit_log").insert({
          acquisition_id: acquisitionId,
          actor: who,
          action: "Official form draft filed",
          field: input.label,
          old_value: null,
          new_value: input.note ?? input.fileName,
          reason: "A generated draft was filed on the contract file for the evidence pack",
        } as never);
      } catch {
        // Soft: the audit note never holds the file.
      }
      return " The draft is also filed on the contract file, in the evidence pack.";
    } catch (error) {
      const why = error instanceof Error ? error.message : "the pack write did not finish";
      return ` The download is on your machine, but filing it on the contract file did not finish: ${why}`;
    }
  };

  /**
   * SF 1449 on the official blank, written into the blank's own fields so the
   * values show in Adobe Reader, Chrome and Preview alike.
   */
  const exportOfficialAcroform = async () => {
    if (!formCtx) return;
    try {
      // The schedule is checked against the total before anything is written.
      // A draft may still be needed, so the reader is asked rather than stopped.
      const check = validateSf1449ClinReconciliation(sf1449CtxToRogerData(formCtx));
      if (!check.ok) {
        const goOn = window.confirm(`${check.message}\n\nGenerate the draft anyway?`);
        if (!goOn) {
          setMessage(`${check.message} Nothing was exported.`);
          return;
        }
      }
      const revision = pinnedRevision ?? currentFormRevision("sf1449");
      const bytes = await generateOfficialSf1449Pdf(formCtx, { formRevision: revision });
      const fileName = `sf-1449-${acquisitionId}-official-rev-${revision.replace("/", "-")}.pdf`;
      downloadPdfBytes(bytes, fileName);
      setMessage(
        `Official PDF exported on blank revision ${revision}. ` +
          "It is the official blank with the record's values written into its fields, so Adobe Reader, Chrome and Preview all show them. The fields stay editable. This is a prototype export, not an Adobe-verified form, and signature blocks stay empty for the contracting officer.",
      );
      const filed = await fileIntoPack({
        bytes,
        fileName,
        contentType: "application/pdf",
        key: "sf-1449-official",
        label: "SF 1449 official draft (prototype)",
        note: `Blank revision ${revision}`,
      });
      setMessage(
        `Official PDF exported on blank revision ${revision}. ` +
          "It is the official blank with the record's values written into its fields, so Adobe Reader, Chrome and Preview all show them. The fields stay editable. This is a prototype export, not an Adobe-verified form, and signature blocks stay empty for the contracting officer." +
          filed,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The form did not export.");
    }
  };

  /**
   * OF 347 and SF 30 on their official blanks, the same AcroForm route the
   * SF 1449 takes. Signature blocks stay empty for the contracting officer.
   */
  const exportOfficialOther = async (formId: "of347" | "sf30") => {
    if (!formCtx) return;
    try {
      const revision = pinnedRevision ?? currentFormRevision(formId);
      const bytes = await generateOfficialFormPdf(formId, formCtx, { formRevision: revision });
      const label = formId === "of347" ? "OF 347" : "SF 30";
      const fileName = `${formKey}-${acquisitionId}-official-rev-${revision.replace("/", "-")}.pdf`;
      downloadPdfBytes(bytes, fileName);
      const base =
        `${label} official PDF exported on blank revision ${revision}. ` +
        "It is the official blank with the record's values written into its own fields, so Adobe Reader, Chrome and Preview all show them and the fields stay editable. Signature blocks stay empty for the contracting officer.";
      setMessage(base);
      const filed = await fileIntoPack({
        bytes,
        fileName,
        contentType: "application/pdf",
        key: `${formKey}-official`,
        label: `${label} official draft`,
        note: `Blank revision ${revision}`,
      });
      setMessage(base + filed);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The form did not export.");
    }
  };


  /** The RFP cover letter in Word, written into the NASA master. */
  const exportRfpCover = async () => {
    if (!formCtx) return;
    try {
      const bytes = await generateRfpCoverDocx(formCtx);
      const fileName = `rfp-cover-${acquisitionId}.docx`;
      downloadDocxBytes(bytes, fileName);
      const base =
        "RFP cover letter exported in Word. It is the NASA master with the record's wording filled in; passages the record does not carry are left out. It is a prototype draft for the contracting officer to check and sign.";
      setMessage(base);
      const filed = await fileIntoPack({
        bytes,
        fileName,
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        key: "rfp-cover",
        label: "RFP cover letter draft (prototype)",
      });
      setMessage(base + filed);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The letter did not export.");
    }
  };

  const exportData = async () => {
    if (!form) return;
    exportXdp(await boundDatasets(), `${form.key}-${acquisitionId}`);
    setMessage(
      `Data file exported. In free Adobe Reader open the blank form from this app (${form.pdf}), then choose Forms or Manage Form Data, Import Data, and pick this file.`,
    );
  };

  return (
    <AppShell>
      <PageHeader
        title={FORM_NAMES[formKey]}
        lead={`Filled from the record of ${acquisitionId}. Signatures and concurrence come from the Approvals step.`}
      />
      <p className="mb-2 text-[13px] text-muted-foreground">
        <DocReadCount acquisitionId={acquisitionId} docKind="form" docKey={formKey} />
      </p>
      <p className="mb-6 text-[13px] text-muted-foreground">
        {headerLine} · {form?.citation}
        {pinnedRevision ? ` · blank revision ${pinnedRevision}` : ""}
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
              className="rounded-lg border border-primary px-3 py-2 text-[15px] text-primary"
              onClick={() => {
                const el = document.getElementById("export-preview");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                  el.focus({ preventScroll: true });
                }
              }}
            >
              View filled preview
            </button>
            <button
              type="button"
              aria-pressed={showLineage}
              className="rounded-lg border border-border px-3 py-2 text-[15px]"
              title="Outline the values on the preview that came from the shared acquisition record or from a recorded source."
              onClick={() => {
                const next = !showLineage;
                setShowLineage(next);
                if (next) void noteLineageViewed();
              }}
            >
              {showLineage ? "Hide where values came from" : "Show where values came from"}
            </button>
            {formKey === "sf-1449" ? (
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-[15px] text-primary-foreground"
                style={{ background: "var(--primary, #0B3D91)" }}
                title="The official blank filled so the values show in Adobe Reader, Chrome and Preview. Signatures stay empty."
                onClick={() => void exportOfficialAcroform()}
              >
                Export official PDF (AcroForm)
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-[15px]"
              title="Legacy Import Data route. Open in Adobe Acrobat or Reader on the desktop. Free Reader used to close this kind of fill; this build leaves the blank's usage rights off the export so Reader can open it to view and print. Signatures stay empty."
              onClick={() => void exportPopulated()}
            >
              Export form PDF{formKey === "sf-1449" ? " (legacy)" : ""}
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
              title="Recommended route for free Adobe Reader: open the blank form from this app, then Forms or Manage Form Data, Import Data, and pick this file. The blank keeps its own rights."
              onClick={exportData}
            >
              Export data file for Import Data{formKey === "sf-1449" ? " (legacy)" : ""}
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-[15px]"
              title="The NASA RFP cover letter master, filled from this record. A prototype draft for the contracting officer to check and sign."
              onClick={() => void exportRfpCover()}
            >
              Export RFP cover (Word)
            </button>
          </div>
          <p className="mb-4 text-[13px] text-muted-foreground">
            Prefer the preview below in the browser; open the form PDF in Adobe desktop.
          </p>
          <div className="mb-6 max-w-[80ch] text-[13px] text-muted-foreground">
            {formKey === "sf-1449" ? (
              <p className="mb-2">
                Export official PDF is the first route to try. It is the official blank with its dynamic
                layer removed and the record's values written into the form's own fields, so Adobe
                Reader, Chrome and Preview all show them and the fields stay editable. It is still a
                prototype export, not an Adobe-verified form, and signature blocks stay empty for the
                contracting officer. The two exports below are the older Import Data route and stay here
                as a fallback.
              </p>
            ) : null}
            <p>
              The recommended route in free Adobe Reader is the data file. Open the blank form from this
              app{form?.pdf ? ` (${form.pdf})` : ""}, then choose Forms or Manage Form Data, Import Data,
              and pick the exported data file. The blank keeps its own rights, so Reader accepts it.
            </p>
            <p className="mt-2">
              Export form PDF writes the official blank with its data replaced. Free Reader used to close
              this kind of fill because the blank is rights-enabled; this build leaves those usage rights
              off the export so Reader can open it to view and print. Signatures stay empty either way.
            </p>
            <p className="mt-2">
              Chrome, Edge, and other built-in viewers often show a blank face for this kind of form. That
              is expected, not a failed fill.
            </p>
            {formKey === "nf-1707" ? (
              <p className="mt-2">
                NF 1707 fills from the record: the requisition header and each Intake answer the blank
                has a field for are written; an answer with no field on the blank stays on Intake, not
                under a guessed name. Signature, concurrence and approval blocks stay blank for the
                Approvals step. The filled preview is for a person to check the fields in desktop
                Reader; it is not an Adobe verification, and nothing here holds a phase.
              </p>
            ) : null}
            <p className="mt-2">
              The flattened PDF prints every answer as text for the contract file. Signatures stay empty on
              purpose. Field-by-field checking in Adobe has not been done in this prototype.
            </p>
          </div>
          {message ? (
            <p role="status" className="mb-6 text-[15px]">
              {message}
            </p>
          ) : null}

          <h2
            id="export-preview"
            tabIndex={-1}
            className="mb-3 scroll-mt-4 text-[18px] leading-6 font-medium outline-none"
          >
            Export preview
          </h2>
          {showLineage ? (
            <p className="mb-3 max-w-[80ch] text-[13px] text-muted-foreground">
              <span
                className="mr-2 inline-block rounded px-2 py-[2px]"
                style={{ outline: "2px solid #1976d2", background: "#eaf4ff", color: "#1D1D1F" }}
              >
                Inherited
              </span>
              <span
                className="mr-2 inline-block rounded px-2 py-[2px]"
                style={{ outline: "2px dashed #1976d2", background: "#eaf4ff", color: "#1D1D1F" }}
              >
                Overridden
              </span>
              <span className="mr-2">Everything else was entered for this document.</span>
              {lineageCounts.inherited} inherited, {lineageCounts.overridden} overridden,{" "}
              {lineageCounts.manual} entered here. Hover a value to read where it came from.
            </p>
          ) : null}
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
                    <dd
                      className="tabular-nums"
                      title={showLineage ? lineage[field.path]?.tooltip : undefined}
                      style={
                        showLineage &&
                        lineage[field.path] &&
                        lineage[field.path]?.status !== "manual"
                          ? {
                              outline: `2px ${lineage[field.path]?.status === "overridden" ? "dashed" : "solid"} #1976d2`,
                              background: "#eaf4ff",
                              borderRadius: 4,
                              padding: "0 4px",
                            }
                          : undefined
                      }
                    >
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
