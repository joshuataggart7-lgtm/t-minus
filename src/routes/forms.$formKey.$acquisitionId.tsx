import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mappingsFor } from "@/lib/form-field-mappings";
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
import { sf30HonestBlanks } from "@/lib/sf30-blanks";
import { downloadDocxBytes, generateRfpCoverDocx } from "@/lib/rfp-cover-docx";

import { attachedKeys as keysFrom, savedDocKeys } from "@/lib/hold";
import { computeMetrics, holdSince } from "@/lib/metrics";
import { countdownText } from "@/components/launch-countdown";
import type { AcqRow } from "@/lib/launch-sequence";
import { deriveOverviewAcquisitionState, overviewCountdownView } from "@/components/mission-control/operational-state";
import { explainWorkReadiness } from "@/components/mission-control/readiness";
import { MissionNavigator, MissionNavSection, type MissionNavItem } from "@/components/mission-control/mission-navigator";
import { WorkShellHeader, WorkShellLayout, type SaveState } from "@/components/mission-control/work-surface-shell";
import { technicalRepresentative } from "@/lib/template-engine";
import { ensureClinScheduleFromIgce, loadClinSchedule } from "@/lib/clin-schedule";
import { signedInName } from "@/lib/account-name";
import { fileGeneratedExport } from "@/lib/attachments";
import { recordReadReceiptQuietly } from "@/lib/read-receipts";
import { DocReadCount } from "@/components/doc-read-count";
import { Nova } from "@/components/nova";
import { countLineage, lineageForFormSections } from "@/lib/field-lineage";
import {
  currentFormRevision,
  FORM_REVISION_KEY,
  pinnedRevisionFrom,
  resolveFormTemplate,
  routeKeyToFormId,
} from "@/lib/form-templates";

export const Route = createFileRoute("/forms/$formKey/$acquisitionId")({
  head: () => ({
    meta: [
      { title: "Generated form · T-Minus" },
      {
        name: "description",
        content: "NF 1787, NF 1787A, SF 1449, SF 30, SF 33, SF 26 and OF 347 filled from the acquisition record, previewed and exported.",
      },
      { property: "og:title", content: "Generated form · T-Minus" },
      {
        property: "og:description",
        content: "NF 1787, NF 1787A, SF 1449, SF 30, SF 33, SF 26 and OF 347 filled from the acquisition record, previewed and exported.",
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
      // P0-2: the modifications recorded on this file, so the SF 30 reads its
      // own mod number. No modification is invented when the table is empty.
      const mods = await supabase
        .from("contract_modifications")
        .select("mod_number,mod_type,authority_text,description,sf30_13a,sf30_13b,sf30_13c,sf30_13d,created_at")
        .eq("acquisition_id", acquisitionId)
        .order("created_at", { ascending: true });
      return {
        modifications: (mods.data ?? []) as Record<string, unknown>[],
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
        acq: (row ? { ...row, modifications: mods.data ?? [] } : row) as Record<string, unknown> | null,
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
        unitPrice:
          r.source === "igce_estimate" || r.unit_price === null || r.unit_price === undefined
            ? null
            : Number(r.unit_price),
        extendedPrice:
          r.source === "igce_estimate" || r.extended_price === null || r.extended_price === undefined
            ? null
            : Number(r.extended_price),
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

  // Summary countdown uses the shared Overview award rule: award only from a
  // recorded Launched audit; need_date never stands in as an award date.
  const countdownQ = useQuery({
    queryKey: ["form-countdown", acquisitionId],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const [acq, log, plan, rules, polls, thresholds, strategies] = await Promise.all([
        supabase.from("acquisition_facts").select("*").eq("acquisition_id", acquisitionId).maybeSingle(),
        supabase.from("audit_log").select("acquisition_id,action,logged_at").eq("acquisition_id", acquisitionId),
        supabase.from("phase_plan").select("acquisition_type,phase,planned_days,order,note"),
        supabase.from("review_rules").select("*"),
        supabase.from("polls").select("*").eq("acquisition_id", acquisitionId),
        supabase.from("thresholds").select("*"),
        supabase.from("enterprise_strategies").select("*"),
      ]);
      const [attachments, documents, templates] = await Promise.all([
        supabase.from("document_attachments").select("acquisition_id,doc_key").eq("acquisition_id", acquisitionId),
        supabase.from("documents").select("acquisition_id,template_id,saved_at,version").eq("acquisition_id", acquisitionId),
        supabase.from("templates").select("template_id,name"),
      ]);
      return {
        acq: acq.data as unknown as AcqRow | null,
        log: (log.data ?? []) as { acquisition_id: string | null; action: string | null; logged_at: string | null }[],
        plan: (plan.data ?? []) as never[],
        rules: (rules.data ?? []) as never[],
        polls: (polls.data ?? []) as never[],
        thresholds: (thresholds.data ?? []) as Record<string, unknown>[],
        strategies: (strategies.data ?? []) as Record<string, unknown>[],
        attachments: (attachments.data ?? []) as { acquisition_id: string | null; doc_key: string }[],
        documents: (documents.data ?? []) as { acquisition_id: string | null; template_id: string | null }[],
        templates: (templates.data ?? []) as { template_id: string; name: string }[],
      };
    },
  });
  const countdownState = useMemo(() => {
    const d = countdownQ.data;
    if (!d?.acq) return null;
    const operational = deriveOverviewAcquisitionState(d.acq, d.log);
    const metrics = computeMetrics(operational.acquisition, {
      plan: d.plan,
      rules: d.rules,
      polls: d.polls,
      ref: {
        thresholds: d.thresholds.map((t) => ({
          name: (t["name"] as string) ?? null,
          value: t["value"] == null ? null : Number(t["value"]),
          citation: (t["citation"] as string) ?? null,
          note: (t["note"] as string) ?? null,
        })),
        phasePlan: (d.plan as { acquisition_type: string | null; phase: string | null; planned_days: number | null }[]),
        strategies: d.strategies.map((s) => ({
          psl: String(s["psl"] ?? ""),
          name: (s["name"] as string) ?? null,
          buying_location: (s["buying_location"] as string) ?? null,
          mandatory_vehicles: (s["mandatory_vehicles"] as string) ?? null,
          required_coordination: (s["required_coordination"] as string) ?? null,
        })),
      },
      holdSince: holdSince(acquisitionId, d.log as never),
      awardDate: operational.actualAwardDate,
      attachedKeys: keysFrom(d.attachments, acquisitionId),
      savedKeys: savedDocKeys(d.documents, d.templates, acquisitionId),
    });
    return { metrics, view: overviewCountdownView(metrics) };
  }, [countdownQ.data, acquisitionId]);
  const countdown = countdownState?.view ?? null;
  const formReadiness = countdownState ? explainWorkReadiness(countdownState.metrics) : null;
  const headerLine = `${acquisitionId} · ${
    !countdown
      ? "Not recorded"
      : countdown.pastTarget
        ? countdownText(countdown)
        : countdown.days === null
          ? countdown.caption
          : countdown.mode === "hold"
            ? `${countdown.prefix}${countdown.days} HOLD`
            : `${countdown.prefix}${countdown.days}${countdown.badge ? ` ${countdown.badge}` : ""} (${countdown.caption})`
  }`;

  // P0 fold-in: an official export is only Ready when the blank itself loads.
  // Mapping rows alone are not enough: a missing blank exports nothing.
  const blankFormId = isFormKey(formKey) ? routeKeyToFormId(formKey) : null;
  const blankAvailable = useQuery({
    queryKey: ["official-blank", blankFormId],
    enabled: Boolean(blankFormId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const template = resolveFormTemplate(blankFormId!, null);
      try {
        const head = await fetch(template.storage_path, { method: "HEAD" });
        if (head.ok) return true;
        const get = await fetch(template.storage_path);
        return get.ok;
      } catch {
        return false;
      }
    },
  });


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
  // P0-4/P0-1: a blank with no mapping rows would export empty, so it reads
  // Planned rather than Ready. P0 fold-in: Ready also requires the blank
  // itself to load, so the badge never promises a file that is not there.
  const hasMappings = Boolean(
    formTemplateId && mappingsFor(formTemplateId, pinnedRevision ?? undefined).length > 0,
  );
  const officialExportStatus = !hasMappings
    ? "Planned"
    : blankAvailable.data === true
      ? "Ready"
      : blankAvailable.data === false
        ? "Planned, the blank form file is not available in this build"
        : "checking the blank form";

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
    const pdfHeaderLine = headerLine.replace(/\u2212/g, "-");
    const blocks: PdfBlock[] = [
      { text: form.name, bold: true, size: 14, gap: 4 },
      { text: `${pdfHeaderLine} · ${form.citation}`, size: 10, gap: 12 },
    ];
    for (const section of form.sections) {
      blocks.push({ text: section.title, bold: true, size: 12, gap: 2 });
      if (section.citation) blocks.push({ text: section.citation, size: 9, gap: 4 });
      for (const field of section.fields) {
        // An empty block reads as prose, never as a filled dash.
        const value =
          typeof field.value === "boolean" ? (field.value ? "Yes" : "No") : field.value || "Not recorded";
        blocks.push({ text: `${field.label}: ${value}`, size: 11, indent: 12, gap: 2 });
      }
      blocks.push({ text: "", gap: 8 });
    }
    await renderPdf(blocks, {
      fileName: `${form.key}-${acquisitionId}-flattened`,
      footer: [`${pdfHeaderLine} · ${form.citation}`, "Prototype. Not an official NASA system."],
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
   * Soft §10, P1-C: a generated draft is kept on the file, not only in the
   * reader's Downloads folder. This app made the bytes, so the record written
   * is a document row against the form's own template and the contract file
   * index reads it as Generated, never as an upload. A pack write that fails
   * never loses the download; it is reported as it happened. This is prototype
   * retention, not a write-back to NCMS.
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
      await fileGeneratedExport({
        acquisitionId,
        templateId: q.data?.templateId ?? null,
        key: input.key,
        label: input.label,
        file,
        actor: who,
        formRevision: pinnedRevision ?? null,
      });
      return " The draft is also filed on the contract file as a generated document.";
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
          "It is the official blank with the record's values written into its fields, so Adobe Reader, Chrome and Preview all show them. The fields stay editable, and signature blocks and the award date stay empty for the contracting officer.",
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
          "It is the official blank with the record's values written into its fields, so Adobe Reader, Chrome and Preview all show them. The fields stay editable, and signature blocks and the award date stay empty for the contracting officer." +
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
  const exportOfficialOther = async (formId: "of347" | "sf30" | "sf26" | "sf33") => {
    if (!formCtx) return;
    if (blankAvailable.data === false) {
      setMessage(
        "The official blank form file is not available in this build, so there is nothing to write into. Use the data file export instead.",
      );
      return;
    }
    try {
      const revision = pinnedRevision ?? currentFormRevision(formId);
      const bytes = await generateOfficialFormPdf(formId, formCtx, { formRevision: revision });
      const label =
        formId === "of347"
          ? "OF 347"
          : formId === "sf26"
            ? "SF 26"
            : formId === "sf33"
              ? "SF 33"
              : "SF 30";
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

  const formSaveState: SaveState = save.isPending
    ? { kind: "saving" }
    : save.isError
      ? {
          kind: "error",
          text: save.error instanceof Error ? `The save did not finish: ${save.error.message}` : "The save did not finish.",
        }
      : save.isSuccess
        ? { kind: "saved", version: save.data }
        : latest && latest.version !== null
          ? { kind: "saved", version: latest.version, at: latest.saved_at, by: latest.saved_by }
          : { kind: "none" };
  const formNavItems: MissionNavItem[] = useMemo(
    () => form
      ? [
          { id: "form-actions", label: "Actions" },
          { id: "form-about", label: "About this export" },
          ...(formKey === "sf-30" && formCtx ? [{ id: "form-empty-blocks", label: "Blocks left empty" }] : []),
          { id: "export-preview", label: "Export preview" },
          ...form.sections.map((section, index) => {
            const missing = section.fields.filter(
              (field) =>
                typeof field.value !== "boolean" &&
                !field.value &&
                !(formKey === "sf-30" && field.path === "topmostSubform.AmendmentNo"),
            ).length;
            return {
              id: `form-sec-${index}`,
              label: section.title,
              badge: missing ? { tone: "neutral" as const, text: `${missing} not recorded` } : null,
            };
          }),
        ]
      : [],
    [form, formCtx, formKey],
  );

  return (
    <AppShell>
      <PageHeader
        title={FORM_NAMES[formKey]}
        lead={`Filled from the record of ${acquisitionId}. Signatures and concurrence come from the Approvals step.`}
      />
      <WorkShellHeader
        acquisitionId={acquisitionId}
        title={String(q.data?.acq?.["title"] ?? "") || null}
        readiness={formReadiness}
        countdown={countdown}
        saveState={formSaveState}
      />
      <WorkShellLayout
        nav={<MissionNavigator items={formNavItems} label="In this form" ariaLabel="In this form" />}
      >
      <div className="mc-shell-form-content">
      <div className="mc-work-toolbar mb-4 flex flex-wrap items-center">
        <Nova acquisitionId={acquisitionId} documentLabel={FORM_NAMES[formKey]} />
        <p className="text-[13px] text-muted-foreground">
          <DocReadCount acquisitionId={acquisitionId} docKind="form" docKey={formKey} />
        </p>
      </div>
      <p className="mc-work-summary mb-6 max-w-[80ch] text-[13px] text-muted-foreground">
        {headerLine} · {form?.citation}
        {pinnedRevision ? ` · blank revision ${pinnedRevision}` : ""}
        {formTemplateId === "sf1449"
          ? " · official PDF export: Live"
          : formTemplateId
            ? ` · official PDF export: ${officialExportStatus}`
            : ""}

        {latest ? ` · saved version ${latest.version}${latest.saved_at ? `, ${String(latest.saved_at).slice(0, 10)}` : ""}${latest.saved_by ? `, by ${latest.saved_by}` : ""}` : " · no version saved yet"}
      </p>
      {/* Every filled export says what it is and what it is not. */}
      <p className="mc-work-form-section mb-6 max-w-[80ch] text-[13px] leading-[18px] text-muted-foreground">
        Prototype. Not an official NASA system.
        {/^A-2027-010[12]$/.test(acquisitionId) ? " Sample file." : ""} Filled from the T-Minus record for review and
        signature — not the NCMS document of record (NFS 1804.171). Signature blocks are left empty. Fields the record
        does not carry read “Not recorded on this file.”
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
          <div id="form-actions" className="mc-work-toolbar mb-6 flex flex-wrap">
            <button
              type="button"
               className="rounded-[var(--mc-radius-control)] px-3 py-2 text-[15px] text-primary-foreground"
              style={{ background: "var(--primary, #0B3D91)" }}
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? "Saving" : "Save version"}
            </button>
            <button
              type="button"
              className="rounded-[var(--mc-radius-control)] border border-primary px-3 py-2 text-[15px] text-primary"
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
              className="rounded-[var(--mc-radius-control)] border border-border px-3 py-2 text-[15px]"
              title="Outline the values on the preview that came from the shared acquisition record or from a recorded source."
              onClick={() => {
                const next = !showLineage;
                setShowLineage(next);
                if (next) void noteLineageViewed();
              }}
            >
              {showLineage ? "Hide where values came from" : "Show where values came from"}
            </button>
            {formTemplateId ? (
              <button
                type="button"
                className="rounded-[var(--mc-radius-control)] px-3 py-2 text-[15px] text-primary-foreground"
                style={{ background: "var(--primary, #0B3D91)" }}
                title="The official blank filled so the values show in Adobe Reader, Chrome and Preview. Signatures stay empty."
                onClick={() =>
                  void (formTemplateId === "sf1449"
                    ? exportOfficialAcroform()
                    : exportOfficialOther(formTemplateId))
                }
              >
                Export official PDF (AcroForm)
              </button>
            ) : null}
            {!formTemplateId ? (
              <>
                <button
                  type="button"
                  className="rounded-[var(--mc-radius-control)] border border-border px-3 py-2 text-[15px]"
                  title="Open in Adobe Acrobat or Reader on the desktop. Signatures stay empty."
                  onClick={() => void exportPopulated()}
                >
                  Export form PDF
                </button>
                <button
                  type="button"
                  className="rounded-[var(--mc-radius-control)] border border-border px-3 py-2 text-[15px]"
                  title="Open the blank form from this app, then Forms or Manage Form Data, Import Data, and pick this file."
                  onClick={exportData}
                >
                  Export data file for Import Data
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="rounded-[var(--mc-radius-control)] border border-border px-3 py-2 text-[15px]"
              onClick={() => void exportFlat()}
            >
              Export flattened PDF
            </button>
            <button
              type="button"
              className="rounded-[var(--mc-radius-control)] border border-border px-3 py-2 text-[15px]"
              title="The NASA RFP cover letter master, filled from this record. A prototype draft for the contracting officer to check and sign."
              onClick={() => void exportRfpCover()}
            >
              Export RFP cover (Word)
            </button>
          </div>

          {formTemplateId ? (
            <details className="mb-4 max-w-[80ch] text-[12px] leading-5 text-muted-foreground">
              <summary className="cursor-pointer text-[12px]">
                Legacy XFA and data file routes (not recommended)
              </summary>
              <p className="mt-2">
                Not for the walkthrough recording: these two produce the blank-face path.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-border px-2 py-1 text-[12px]"
                  onClick={() => void exportPopulated()}
                >
                  Export form PDF (legacy)
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-border px-2 py-1 text-[12px]"
                  onClick={exportData}
                >
                  Export data file for Import Data (legacy)
                </button>
              </div>
              <p className="mt-2">
                These two write the blank's dynamic layer instead of its fields, so they open only in
                desktop Adobe and show a blank face elsewhere. They stay here as a fallback.
              </p>
            </details>
          ) : null}
          <p className="mb-4 text-[13px] text-muted-foreground">
            Prefer the preview below in the browser; open the form PDF in Adobe desktop.
          </p>
          <MissionNavSection id="form-about" label="About this export" collapsible defaultOpen={false}>
          <div className="mb-6 max-w-[80ch] text-[13px] text-muted-foreground">
            {formTemplateId ? (
              <p className="mb-2">
                Export official PDF is the route to use. It is the official blank with its dynamic layer
                removed and the record's values written into the form's own fields, so Adobe Reader,
                Chrome and Preview all show them and the fields stay editable. Signature blocks and the
                award date stay empty for the contracting officer.
              </p>
            ) : (
              <>
                <p>
                  The recommended route in free Adobe Reader is the data file. Open the blank form from
                  this app{form?.pdf ? ` (${form.pdf})` : ""}, then choose Forms or Manage Form Data,
                  Import Data, and pick the exported data file. The blank keeps its own rights, so Reader
                  accepts it.
                </p>
                <p className="mt-2">
                  Chrome, Edge, and other built-in viewers often show a blank face for this kind of form.
                  That is expected, not a failed fill.
                </p>
              </>
            )}
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
              purpose.
            </p>
          </div>
          </MissionNavSection>

          {message ? (
            <p role="status" className="mb-6 text-[15px]">
              {message}
            </p>
          ) : null}

          {formKey === "sf-30" && formCtx ? (
            <section id="form-empty-blocks" className="mc-work-form-section mb-6 max-w-[80ch]">
              <h3 className="text-[18px] leading-6 font-medium">Blocks left empty, and why</h3>
              <p className="mb-3 text-[13px] text-muted-foreground">
                Nothing below is a fault. The record does not carry these values, so the official form prints
                them empty rather than showing a placeholder.
              </p>
              <dl>
                {sf30HonestBlanks(formCtx).map((row) => (
                  <div key={row.block} className="mb-2 grid grid-cols-[1fr_1.4fr] gap-3 text-[15px]">
                    <dt className="text-muted-foreground">{row.block}</dt>
                    <dd>{row.reason}</dd>
                  </div>
                ))}
              </dl>
            </section>
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
          {form.sections.map((section, index) => (
            <section id={`form-sec-${index}`} key={section.title} className="mc-work-form-section mb-6 max-w-[80ch]">
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
                        : field.value ||
                          (formKey === "sf-30" && field.path === "topmostSubform.AmendmentNo" ? null : (
                            <span className="text-muted-foreground">Not recorded</span>
                          ))}
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
      </div>
      </WorkShellLayout>
    </AppShell>
  );
}
