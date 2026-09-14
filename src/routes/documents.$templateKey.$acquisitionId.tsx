import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageHeader, StatusMark, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { RegulationSidebar } from "@/components/regulation-sidebar";
import { DefectReport } from "@/components/defect-report";
import { ShareDocument } from "@/components/share-document";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { samContractAwards, type ComparablesView } from "@/lib/sam-contract-awards.functions";
import { draftJofocItem, DRAFTABLE_JOFOC_FIELDS, type DraftProvenance } from "@/lib/ai-draft.functions";
import {
  checkoutTime,
  claimCheckout,
  loadCheckout,
  releaseCheckout,
  type Checkout,
} from "@/lib/document-checkout";
import {
  itemsFromRefs,
  itemsFromWatchRows,
  loadRegRefs,
  loadWatchRows,
  newerGuidance,
} from "@/lib/watch";
import { daysBetween, formatMoney, todayISO, type RefData } from "@/lib/intake";
import {
  phaseForTemplate,
  pollBoard,
  type AcqRow,
  type PollRow,
  type ReviewRuleRow,
} from "@/lib/launch-sequence";
import {
  exportDocx,
  exportPdf,
  money,
  prefill,
  renderDocument,
  templateByKey,
  validate,
  visibleFields,
  visibleSections,
  type ThresholdRow,
  type Values,
} from "@/lib/template-engine";
import { applyMemoDraft, draftMemoBody } from "@/lib/memo-draft";
import {
  buildMemoDoc,
  buildMemoHeader,
  exportMemoDocx,
  exportMemoPdf,
  memoDefaultFor,
  type MemoHeader,
  type MemoRoutingRow,
} from "@/lib/nf1858";

export const Route = createFileRoute("/documents/$templateKey/$acquisitionId")({
  head: () => ({
    meta: [
      { title: "Document — T-Minus" },
      {
        name: "description",
        content: "A versioned template filled from the acquisition record, with its citation and tier.",
      },
      { property: "og:title", content: "Document — T-Minus" },
      {
        property: "og:description",
        content: "A versioned template filled from the acquisition record, with its citation and tier.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => (
    <AppShell>
      <PageHeader title="This document could not be loaded" lead="Go back to Templates and open it again." />
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <PageHeader title="Document not found" lead="Go back to Templates and choose a live template." />
    </AppShell>
  ),
  component: DocumentPage,
});

/** Plain-language summary of the answers stored on the intake record. */
function answersSummary(answers: unknown): string {
  if (!answers || typeof answers !== "object") return "";
  const entries = Object.entries(answers as Record<string, unknown>).filter(
    ([, v]) => v !== null && v !== "" && v !== false,
  );
  if (!entries.length) return "";
  return entries.map(([k, v]) => `${k}: ${typeof v === "boolean" ? "Yes" : String(v)}`).join("\n");
}

function DocumentPage() {
  const { templateKey, acquisitionId } = Route.useParams();
  const { authState, role, user } = useRole();
  const queryClient = useQueryClient();
  const def = templateByKey(templateKey);
  const canWrite = role === "specialist" || role === "hq";

  const [values, setValues] = useState<Values>({});
  const [touched, setTouched] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [voteReason, setVoteReason] = useState("");
  const [comparables, setComparables] = useState<ComparablesView | null>(null);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [myCheckoutId, setMyCheckoutId] = useState<string | null>(null);
  // Provenance for each drafted paragraph, carried in the saved version.
  const [aiMeta, setAiMeta] = useState<Record<string, DraftProvenance>>({});
  const [sourcePanel, setSourcePanel] = useState<{ title: string; lines: string[] } | null>(null);
  const [draftingKey, setDraftingKey] = useState<string | null>(null);
  // NF 1858: whether this document is issued as a memorandum, and its header.
  const [memoOn, setMemoOn] = useState<boolean | null>(null);
  const [memoHeader, setMemoHeader] = useState<MemoHeader | null>(null);

  const phase = phaseForTemplate(templateKey);
  const runComparablesFn = useServerFn(samContractAwards);
  const draftItemFn = useServerFn(draftJofocItem);

  // Check-out: the first person to open the document holds it; everyone else
  // sees who and since when, and reads it until that person saves or closes,
  // or thirty minutes pass.
  const heldByOther = !!checkout && checkout.checkout_id !== myCheckoutId;
  const canEdit = canWrite && !heldByOther;

  useEffect(() => {
    if (authState !== "signed-in" || !def) return;
    let cancelled = false;
    let mine: string | null = null;
    const args = {
      acquisitionId,
      templateKey,
      documentName: def.name,
      phase,
      userName: user.name,
    };
    void (async () => {
      try {
        const held = canWrite ? await claimCheckout(args) : await loadCheckout(acquisitionId, templateKey);
        if (cancelled) return;
        setCheckout(held);
        const { data } = await supabase.auth.getUser();
        if (held && data.user?.id === held.user_id) {
          mine = held.checkout_id;
          if (!cancelled) setMyCheckoutId(held.checkout_id);
        }
      } catch {
        // A check-out that cannot be recorded never blocks the document.
      }
    })();
    const release = (reason: string) => {
      if (!mine) return;
      void releaseCheckout({
        checkoutId: mine,
        acquisitionId,
        documentName: def.name,
        phase,
        userName: user.name,
        reason,
      });
      mine = null;
    };
    const onUnload = () => release("Document closed");
    window.addEventListener("beforeunload", onUnload);
    return () => {
      cancelled = true;
      window.removeEventListener("beforeunload", onUnload);
      release("Document closed");
    };
  }, [authState, def, acquisitionId, templateKey, phase, user.name, canWrite]);

  // Keep the label current for the people who are only reading.
  useEffect(() => {
    if (authState !== "signed-in" || !def || myCheckoutId) return;
    const tick = () => {
      void loadCheckout(acquisitionId, templateKey)
        .then(setCheckout)
        .catch(() => undefined);
    };
    const timer = window.setInterval(tick, 10_000);
    return () => window.clearInterval(timer);
  }, [authState, def, acquisitionId, templateKey, myCheckoutId]);


  const q = useQuery({
    queryKey: ["document-context", templateKey, acquisitionId],
    enabled: authState === "signed-in" && !!def,
    // Votes and comments from other reviewers appear without a reload.
    refetchInterval: 5000,
    queryFn: async () => {
      const [acq, thr, tpl, polls, rules, watchRows, refs, routing, approvals, fileDocs] = await Promise.all([
        supabase.from("acquisition_facts").select("*").eq("acquisition_id", acquisitionId).maybeSingle(),
        supabase.from("thresholds").select("name,value,citation,tier,effective_date,note"),
        supabase.from("templates").select("template_id,name,hq_revision_date,status").eq("name", def!.name).maybeSingle(),
        supabase.from("polls").select("*").eq("acquisition_id", acquisitionId).eq("phase", phase),
        supabase.from("review_rules").select("*"),
        loadWatchRows(),
        loadRegRefs(),
        supabase.from("memo_routing").select("*").eq("document_key", templateKey),
        supabase
          .from("nf1707_approvals")
          .select("approval_role,owner_name,status")
          .eq("acquisition_id", acquisitionId),
        supabase
          .from("documents")
          .select("template_id,saved_at,templates(name)")
          .eq("acquisition_id", acquisitionId)
          .order("saved_at", { ascending: true }),
      ]);
      if (acq.error) throw new Error(acq.error.message);
      const templateId = tpl.data?.template_id ?? null;
      const versions = templateId
        ? await supabase
            .from("documents")
            .select(
              "document_id,version,saved_by,saved_at,field_values,ai_model,ai_generated_at,reviewed_by,reviewed_at,issue_on_nf1858,memo_header",
            )
            .eq("acquisition_id", acquisitionId)
            .eq("template_id", templateId)
            .order("version", { ascending: false })
        : { data: [], error: null };
      const latestId = versions.data?.[0]?.document_id ?? null;
      const comments = latestId
        ? await supabase
            .from("comments")
            .select("*")
            .eq("document_id", latestId)
            .order("created_at", { ascending: true })
        : { data: [] };
      // The nonresponsibility memo reads the vendor facts from the entity
      // check stored on this acquisition, never from typing.
      const samCheck = await supabase
        .from("sam_checks")
        .select("response_json,checked_at")
        .eq("acquisition_id", acquisitionId)
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const missionId = String((acq.data as Record<string, unknown> | null)?.["mission_id"] ?? "");
      const mission = missionId
        ? await supabase.from("missions").select("name").eq("mission_id", missionId).maybeSingle()
        : { data: null };
      // The set-aside evidence search, when it has been run, is what the
      // market research memorandum reports.
      const evidence = await supabase
        .from("sam_checks")
        .select("response_json,checked_at")
        .eq("acquisition_id", acquisitionId)
        .like("check_type", "Set-aside entities%")
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const centerCode = String((acq.data as Record<string, unknown> | null)?.["center_code"] ?? "");
      const center = centerCode
        ? await supabase
            .from("centers")
            .select("center_code,center_name,address_line")
            .eq("center_code", centerCode)
            .maybeSingle()
        : { data: null };
      return {
        missionName: (mission.data as { name?: string } | null)?.name ?? missionId,
        evidence: evidence.data ?? null,
        center: center.data as { center_name: string; address_line: string | null } | null,
        routing:
          ((routing.data ?? []) as MemoRoutingRow[]).find((r) => r.center_code === centerCode) ?? undefined,
        approvals: (approvals.data ?? []) as { approval_role: string; owner_name: string | null; status: string }[],
        fileDocuments: [
          ...new Set(
            ((fileDocs.data ?? []) as { templates: { name: string } | null }[])
              .map((d) => d.templates?.name ?? "")
              .filter(Boolean),
          ),
        ],
        acq: acq.data as Record<string, unknown> | null,
        thresholds: (thr.data ?? []) as ThresholdRow[],
        templateId,
        samCheck: samCheck.data ?? null,
        hqRevision: tpl.data?.hq_revision_date ?? null,
        watchItems: [...itemsFromWatchRows(watchRows), ...itemsFromRefs(refs)],
        polls: (polls.data ?? []) as PollRow[],
        rules: (rules.data ?? []) as ReviewRuleRow[],
        comments: (comments.data ?? []) as {
          comment_id: string;
          author: string | null;
          body: string | null;
          created_at: string;
        }[],
        versions: (versions.data ?? []) as {
          document_id: string;
          version: number;
          saved_by: string | null;
          saved_at: string | null;
          field_values: unknown;
          ai_model: string | null;
          ai_generated_at: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          issue_on_nf1858?: boolean | null;
          memo_header?: unknown;
        }[],
      };
    },
  });

  const latest = q.data?.versions[0] ?? null;

  const board = useMemo(() => {
    if (!q.data?.acq) return [];
    const ref: RefData = {
      thresholds: (q.data.thresholds ?? []).map((t) => ({
        name: t.name,
        value: t.value === null ? null : Number(t.value),
        citation: t.citation,
        note: t.note,
      })),
      phasePlan: [],
      strategies: [],
    };
    return pollBoard(
      q.data.acq as AcqRow,
      q.data.rules ?? [],
      q.data.polls ?? [],
      ref,
      null,
      phase,
    );
  }, [q.data, phase]);

  const mySeat = board.find((b) => b.reviewer_name === user.name) ?? null;

  const vote = useMutation({
    mutationFn: async ({ choice, reason }: { choice: "go" | "no-go"; reason: string | null }) => {
      if (!mySeat?.poll_id) throw new Error("The poll for this phase is not open yet.");
      const { error } = await supabase
        .from("polls")
        .update({ vote: choice, reason, voted_at: new Date().toISOString() })
        .eq("poll_id", mySeat.poll_id);
      if (error) throw new Error(error.message);
      const { error: logError } = await supabase.from("audit_log").insert({
        acquisition_id: acquisitionId,
        actor: user.name,
        action: choice === "go" ? "Go recorded" : "No-go recorded",
        field: mySeat.reviewer_role,
        old_value: mySeat.vote,
        new_value: choice,
        reason: reason ?? `${def?.name ?? "document"} reviewed`,
        phase,
      });
      if (logError) throw new Error(logError.message);
    },
    onSuccess: async (_d, v) => {
      setMessage(v.choice === "go" ? "Go recorded. The file resumes if nothing else blocks it." : "No-go recorded. The file is on hold.");
      await queryClient.invalidateQueries({ queryKey: ["document-context", templateKey, acquisitionId] });
      await queryClient.invalidateQueries({ queryKey: ["acquisition-file", acquisitionId] });
    },
    onError: (e: Error) => setMessage(`The vote did not save: ${e.message}`),
  });

  const addComment = useMutation({
    mutationFn: async (body: string) => {
      if (!latest) throw new Error("Save a version first, then start the thread.");
      const { error } = await supabase
        .from("comments")
        .insert({ document_id: latest.document_id, author: user.name, body });
      if (error) throw new Error(error.message);
      const { error: logError } = await supabase.from("audit_log").insert({
        acquisition_id: acquisitionId,
        actor: user.name,
        action: "Comment added",
        field: def?.name ?? "document",
        new_value: body.slice(0, 200),
        reason: `Comment on version ${latest.version}`,
        phase,
      });
      if (logError) throw new Error(logError.message);
    },
    onSuccess: async () => {
      setComment("");
      await queryClient.invalidateQueries({ queryKey: ["document-context", templateKey, acquisitionId] });
    },
    onError: (e: Error) => setMessage(`The comment did not save: ${e.message}`),
  });

  const markReviewed = useMutation({
    mutationFn: async () => {
      if (!latest) throw new Error("Save a version first.");
      const reviewedAt = new Date().toISOString();
      const { error } = await supabase
        .from("documents")
        .update({ reviewed_by: user.name, reviewed_at: reviewedAt })
        .eq("document_id", latest.document_id);
      if (error) throw new Error(error.message);
      const { error: logError } = await supabase.from("audit_log").insert({
        acquisition_id: acquisitionId,
        actor: user.name,
        action: "Document reviewed",
        field: def?.name ?? "document",
        old_value: latest.reviewed_by,
        new_value: user.name,
        reason: `Version ${latest.version} reviewed`,
        phase,
      });
      if (logError) throw new Error(logError.message);
    },
    onSuccess: async () => {
      setMessage("Marked reviewed. The provenance block shows your name and the time.");
      await queryClient.invalidateQueries({ queryKey: ["document-context", templateKey, acquisitionId] });
    },
    onError: (e: Error) => setMessage(`That did not save: ${e.message}`),
  });

  // Prior awards for this NAICS and PSC, half to double the estimated value.
  const runComparables = useMutation({
    mutationFn: async () => runComparablesFn({ data: { acquisitionId } }),
    onSuccess: (view) => {
      setComparables(view);
      setTouched(true);
      const lines = view.awards.map(
        (a) =>
          `${a.agency} · ${a.awardDate} · ${a.pricingType} · ${a.extentCompeted} · ${money(a.obligatedAmount)}`,
      );
      setValues((prev) => ({
        ...prev,
        comparables_summary: [
          `${view.awards.length} prior award${view.awards.length === 1 ? "" : "s"} for NAICS ${view.naicsCode} and PSC ${view.pscCode} between ${money(view.minValue)} and ${money(view.maxValue)} (${view.sourceLabel}).`,
          ...lines,
        ].join("\n"),
      }));
      setMessage(`Comparables loaded. ${view.sourceLabel}.`);
    },
    onError: (e: Error) => setMessage(`Comparables did not load: ${e.message}`),
  });



  // Vendor facts from the stored SAM.gov entity check, offered to the
  // nonresponsibility memo as pre-fill values.
  const samFacts = useMemo(() => {
    const acq = q.data?.acq;
    const envelope = (q.data?.samCheck?.response_json ?? null) as Record<string, unknown> | null;
    const n = (envelope?.["normalized"] ?? null) as Record<string, unknown> | null;
    // The PNM reads the IGCE and quote from the intake answers where the
    // requester recorded them.
    const answers = (acq?.["nf1707_answers"] ?? null) as Record<string, unknown> | null;
    const answerValue = (match: RegExp) => {
      const hit = Object.entries(answers ?? {}).find(([k, v]) => match.test(k) && v !== null && v !== "");
      return hit ? String(hit[1]) : "";
    };
    return {
      sam_legal_name: n?.["legalName"] ?? acq?.["vendor_legal_name"] ?? "",
      sam_uei: n?.["uei"] ?? acq?.["vendor_uei"] ?? "",
      sam_cage: n?.["cage"] ?? acq?.["vendor_cage"] ?? "",
      sam_registration_status: n?.["registrationStatus"] ?? "No entity check recorded",
      sam_registration_expiration: n?.["registrationExpiration"] ?? "—",
      sam_exclusion_flag: n?.["exclusionFlag"] ?? "No entity check recorded",
      sam_integrity_count:
        n?.["integrityRecordsCount"] === undefined ? "—" : String(n["integrityRecordsCount"]),
      sam_checked_at: q.data?.samCheck?.checked_at ?? "No entity check recorded",
      igce_amount: answerValue(/igce|cost_estimate/i) || (acq?.["estimated_value"] ?? ""),
      quoted_price: answerValue(/quote|proposed_price/i),
    } as Record<string, unknown>;
  }, [q.data]);

  // Counts from the stored set-aside evidence search, when it has been run.
  const researchEvidence = useMemo(() => {
    const row = q.data?.evidence as { response_json?: unknown; checked_at?: string | null } | null | undefined;
    if (!row) return null;
    const envelope = (row.response_json ?? {}) as Record<string, unknown>;
    const raw = (envelope["raw"] ?? {}) as Record<string, unknown>;
    const rows = Array.isArray(raw["entityData"]) ? (raw["entityData"] as Record<string, unknown>[]) : [];
    const small = rows.filter((r) => JSON.stringify(r).toLowerCase().includes('"y"')).length;
    return {
      runOn: (row.checked_at ?? "").slice(0, 10),
      sources: rows.length,
      smallBusinesses: small,
    };
  }, [q.data?.evidence]);

  // Pre-fill from the record, or from the latest saved version.
  useEffect(() => {
    if (!def || !q.data?.acq || touched) return;
    const latest = q.data.versions[0]?.field_values;
    if (latest && typeof latest === "object") {
      const stored = { ...(latest as Values) };
      const provenance = stored["__ai_provenance"];
      if (provenance) {
        try {
          setAiMeta(JSON.parse(provenance) as Record<string, DraftProvenance>);
        } catch {
          setAiMeta({});
        }
      }
      setValues(stored);
      return;
    }
    const filled = prefill(def, {
      ...q.data.acq,
      // The record block reads the mission by name, never by its code.
      mission_id: q.data.missionName || q.data.acq["mission_id"],
      ...samFacts,
      acquisition_id: acquisitionId,
    });
    if (def.key === "nf-1707" && !filled["approvals_summary"]) {
      filled["approvals_summary"] = answersSummary(q.data.acq["nf1707_answers"]);
    }
    if (def.key === "jofoc" && !filled["barriers"]) {
      filled["barriers"] =
        "The Agency will continue to examine the market in the future for alternative solutions or new sources before executing any subsequent acquisitions for the same requirements.";
    }
    // A memorandum body is drafted from the record, section by section, so no
    // numbered heading is ever exported empty.
    const drafted = applyMemoDraft(filled, draftMemoBody(def.key, {
      acquisitionId,
      acq: q.data.acq,
      missionName: q.data.missionName ?? "",
      fileDocuments: q.data.fileDocuments ?? [],
      evidence: researchEvidence,
    }));
    setValues(drafted);
  }, [def, q.data, touched, acquisitionId, samFacts, researchEvidence]);

  // NF 1858: the flag and the header come from the saved version when there is
  // one, and otherwise from the Center's routing table and the record.
  useEffect(() => {
    if (!def || !q.data?.acq || memoHeader) return;
    const saved = q.data.versions[0];
    const routing = q.data.routing;
    const on =
      typeof saved?.issue_on_nf1858 === "boolean" ? saved.issue_on_nf1858 : memoDefaultFor(def.key, routing);
    const built = buildMemoHeader({
      templateKey: def.key,
      templateName: def.name,
      documentCitation: def.badge.citation,
      acquisition: { ...q.data.acq, acquisition_id: acquisitionId },
      centerName: q.data.center?.center_name ?? String(q.data.acq["center_code"] ?? ""),
      centerAddress: q.data.center?.address_line ?? "",
      routing,
      coName: String(q.data.acq["co_name"] ?? user.name),
      approvals: (q.data.approvals ?? []).map((a) => ({ role: a.approval_role, name: a.owner_name })),
      enclosures: def.key === "packet-transmittal-memo" ? (q.data.fileDocuments ?? []) : [],
      today: todayISO(),
    });
    const storedHeader = saved?.memo_header;
    setMemoOn(on);
    setMemoHeader(
      storedHeader && typeof storedHeader === "object" ? { ...built, ...(storedHeader as MemoHeader) } : built,
    );
  }, [def, q.data, memoHeader, acquisitionId, user.name]);

  const estimatedValue = q.data?.acq?.["estimated_value"] ? Number(q.data.acq["estimated_value"]) : null;
  const signature = useMemo(
    () => (def?.signature ? def.signature(estimatedValue, q.data?.thresholds ?? []) : undefined),
    [def, estimatedValue, q.data?.thresholds],
  );

  const errors = def ? validate(def, values) : {};
  const errorCount = Object.keys(errors).length;
  const rendered = def ? renderDocument(def, values, acquisitionId, signature) : null;
  const memoDoc = rendered && memoHeader ? buildMemoDoc(rendered, memoHeader) : null;
  const setMemo = <K extends keyof MemoHeader>(key: K, value: MemoHeader[K]) =>
    setMemoHeader((prev) => (prev ? { ...prev, [key]: value } : prev));
  const linesToList = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

  const targetDate = q.data?.acq?.["target_award_date"] as string | null | undefined;
  const daysToAward = targetDate ? daysBetween(todayISO(), targetDate) : null;
  const headerLine = `${acquisitionId} · ${daysToAward === null ? "no target award date" : `${daysToAward} days to award`}`;

  const save = useMutation({
    mutationFn: async () => {
      if (!def || !q.data?.templateId) throw new Error("This template is not loaded in the database.");
      const nextVersion = (q.data.versions[0]?.version ?? 0) + 1;
      const savedAt = new Date().toISOString();
      // Editing a drafted paragraph clears its AI label on the new version.
      const keptMeta: Record<string, DraftProvenance> = {};
      for (const [key, meta] of Object.entries(aiMeta)) {
        if ((values[key] ?? "") === meta.draftText) keptMeta[key] = meta;
      }
      const fieldValues: Values = { ...values };
      if (Object.keys(keptMeta).length) fieldValues["__ai_provenance"] = JSON.stringify(keptMeta);
      else delete fieldValues["__ai_provenance"];
      setAiMeta(keptMeta);
      const { error } = await supabase.from("documents").insert({
        acquisition_id: acquisitionId,
        template_id: q.data.templateId,
        field_values: fieldValues as never,
        version: nextVersion,
        issue_on_nf1858: memoOn ?? false,
        memo_header: (memoOn && memoHeader ? memoHeader : null) as never,
        saved_by: user.name,
        saved_at: savedAt,
        // Fields are drawn from the record by the template engine, so the
        // provenance names the engine, and review is recorded separately.
        ai_model: "T-Minus template engine (record pre-fill, no model)",
        ai_generated_at: savedAt,
      });
      if (error) throw new Error(error.message);
      const { error: logError } = await supabase.from("audit_log").insert({
        acquisition_id: acquisitionId,
        actor: user.name,
        action: "Document saved",
        field: def.name,
        old_value: q.data.versions[0] ? `version ${q.data.versions[0].version}` : null,
        new_value: `version ${nextVersion}`,
        reason: `${def.name} saved from the template engine`,
        phase,
      });
      if (logError) throw new Error(logError.message);
      return nextVersion;
    },
    onSuccess: async (v) => {
      setMessage(`Saved as version ${v}.`);
      // Saving releases the check-out, so the next person can edit.
      if (myCheckoutId && def) {
        await releaseCheckout({
          checkoutId: myCheckoutId,
          acquisitionId,
          documentName: def.name,
          phase,
          userName: user.name,
          reason: "Saved a version",
        });
        setMyCheckoutId(null);
        setCheckout(null);
      }
      await queryClient.invalidateQueries({ queryKey: ["document-context", templateKey, acquisitionId] });
    },

    onError: (e: unknown) =>
      setMessage(
        e instanceof Error ? `The save did not finish: ${e.message}` : "The save did not finish. Try again.",
      ),
  });

  if (!def) {
    return (
      <AppShell>
        <PageHeader title="Template not found" lead="Go back to Templates and choose a live template." />
        <Link to="/templates" className="text-primary">
          Back to Templates
        </Link>
      </AppShell>
    );
  }

  // The nonresponsibility memo exists only on that finding. On a finding of
  // responsible, the signature on the SF 1449 is the determination.
  if (def.key === "nonresponsibility" && q.data?.acq && q.data.acq["responsibility_finding"] !== "nonresponsibility") {
    return (
      <AppShell>
        <PageHeader
          title="No memorandum is written for this file"
          lead={`${acquisitionId} · the responsibility finding is not nonresponsibility.`}
        />
        <p className="max-w-[80ch] text-[15px] leading-[22px]">
          The contracting officer's signature on the SF 1449 is the affirmative responsibility determination
          (FAR 9.105-2(a)(1)). A separate memorandum is written only on a finding of nonresponsibility.
        </p>
        <p className="mt-6">
          <Link to="/files/$acquisitionId" params={{ acquisitionId }} className="text-primary">
            Back to the acquisition file
          </Link>
        </p>
      </AppShell>
    );
  }

  const guidance = newerGuidance(def.badge.citation, def.badge.effective ?? null, q.data?.watchItems ?? []);

  const recordValue = (bind: string) => {
    const v = (q.data?.acq as Record<string, unknown> | null | undefined)?.[bind];
    return v === null || v === undefined || v === "" ? "not recorded" : String(v);
  };

  /** Where a filled field came from: the intake field, the template item, or the citation. */
  const openSource = (s: { id: string; title: string; citation?: string }, f: { key: string; label: string; bind?: string }) => {
    const meta = aiMeta[f.key];
    const lines: string[] = [];
    if (meta) {
      lines.push(`AI draft written by ${meta.model} on ${new Date(meta.generatedAt).toLocaleString()}.`);
      lines.push(`Template revision: ${meta.templateRevision} · Item: ${meta.templateItem}`);
      lines.push(`Template instruction used: ${meta.templateText}`);
      lines.push(`Record fields used: ${meta.recordFields.map((r) => `${r.field} = ${r.value}`).join("; ")}`);
      lines.push(meta.intakeAnswersUsed ? "Intake answers were included in the draft." : "Intake answers were not included in this draft.");
      lines.push(meta.reviewed ? "Marked reviewed by the contracting officer." : "AI draft, not yet reviewed.");
    } else if (f.bind) {
      lines.push(`Intake field: ${f.bind}`);
      lines.push(`Value on the record: ${recordValue(f.bind)}`);
      lines.push(`Written into: ${s.title}`);
      lines.push(`Template revision: ${def.badge.revision}`);
    } else {
      lines.push(`Typed on this template. Template revision: ${def.badge.revision}`);
      lines.push(`Item: ${s.title}`);
    }
    if (s.citation) lines.push(`Authority citation: ${s.citation}`);
    setSourcePanel({ title: f.label, lines });
  };

  const runDraft = async (key: string) => {
    setDraftingKey(key);
    setMessage(null);
    try {
      const result = await draftItemFn({ data: { acquisitionId, fieldKey: key } });
      setTouched(true);
      setValues((prev) => ({ ...prev, [key]: result.text }));
      setAiMeta((prev) => ({ ...prev, [key]: result.provenance }));
      setMessage(`Drafted with ${result.provenance.model}. Read it, edit it, then save a version.`);
    } catch (e) {
      setMessage(e instanceof Error ? `The draft did not run: ${e.message}` : "The draft did not run.");
    } finally {
      setDraftingKey(null);
    }
  };

  const set = (key: string, v: string) => {
    setTouched(true);
    setValues((prev) => ({ ...prev, [key]: v }));
  };

  return (
    <AppShell>
      <PageHeader
        title={def.name}
        lead={`${acquisitionId} · ${def.lead}${
          Object.values(aiMeta).some((m) => !m.reviewed) ? " · contains an AI draft, not yet reviewed" : ""
        }`}
      />

      <RegulationSidebar phase={phase} />

      <section aria-label="Version badge" className="mb-8 max-w-[80ch] border border-border bg-background p-4">
        <p className="text-[15px] leading-[22px]">
          {def.badge.revision}
          {def.tab === "—" ? "" : ` · NF 1098 tab ${def.tab}`}
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {def.badge.citation} · {def.badge.tier === "binding" ? "Binding" : "Guidance"}
        </p>
        {def.badge.note ? (
          <div className="mt-1 flex items-start gap-2 text-[13px] text-muted-foreground">
            <p>{def.badge.note}</p>
            {def.badge.corrections?.length ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Show the three citation corrections"
                      className="shrink-0 rounded-lg border border-border px-2 text-foreground"
                    >
                      Details
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm bg-popover text-popover-foreground">
                    <ul className="list-disc space-y-1 pl-4">
                      {def.badge.corrections.map((correction) => (
                        <li key={correction}>{correction}</li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
        ) : null}
        {guidance ? (
          <p className="mt-2 text-[13px]">
            <StatusMark color="var(--attention)">Newer guidance published; review</StatusMark>{" "}
            {guidance.url ? (
              <a href={guidance.url} target="_blank" rel="noreferrer" className="text-primary underline">
                {guidance.title}
              </a>
            ) : (
              <span className="text-muted-foreground">{guidance.title}</span>
            )}
            <span className="text-muted-foreground"> · {guidance.date ?? "date not published"}</span>
          </p>
        ) : null}
        <p className="mt-1 text-[13px] text-muted-foreground" data-numeric>
          {headerLine}
          {estimatedValue !== null ? ` · ${formatMoney(estimatedValue)}` : ""}
        </p>
      </section>

      <DefectReport
        templateKey={templateKey}
        templateName={def.name}
        revision={def.badge.revision}
        defaultCitation={def.badge.citation}
        acquisitionId={acquisitionId}
      />

      {q.isLoading ? <p className="text-muted-foreground">Loading the record.</p> : null}

      
      {heldByOther && checkout ? (
        <p
          role="status"
          className="mb-4 max-w-[80ch] border border-border bg-background p-3 text-[15px] leading-[22px]"
        >
          Checked out by {checkout.user_name} since {checkoutTime(checkout.checked_out_at).replace(/\.?$/, ".")}{" "}
          The fields are
          read-only for you until that person saves or closes the document, or thirty minutes pass. Refresh
          this page to pick it up.
        </p>
      ) : null}

      <form
        className="max-w-[80ch]"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (errorCount) {
            setMessage(`${errorCount} required field${errorCount === 1 ? "" : "s"} still to complete.`);
            return;
          }
          save.mutate();
        }}
      >

        {visibleSections(def, values).map((s) => (
          <section key={s.id} className="mb-8">
            <h2 className="text-[18px] leading-6 font-medium">{s.title}</h2>
            {s.citation ? (
              <p className="mb-2 text-[13px] text-muted-foreground">
                {s.citation}
                {s.tier ? ` · ${s.tier === "binding" ? "Binding" : "Guidance"}` : ""}
              </p>
            ) : null}
            {s.standingText ? <p className="mb-3 text-[15px] leading-[22px]">{s.standingText}</p> : null}
            {visibleFields(s, values).map((f) => {
              const id = `${s.id}-${f.key}`;
              const err = touched ? errors[f.key] : undefined;
              return (
                <div key={f.key} className="mb-4">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <label htmlFor={id} className="block text-[13px] text-muted-foreground">
                      {f.label}
                      {f.required ? " (required)" : ""}
                    </label>
                    <button
                      type="button"
                      className="text-[13px] text-primary underline"
                      onClick={() => openSource(s, f)}
                    >
                      Source
                    </button>
                    {def.key === "jofoc" && DRAFTABLE_JOFOC_FIELDS[f.key] && canEdit ? (
                      <button
                        type="button"
                        className="rounded-lg border border-border px-2 py-1 text-[13px]"
                        disabled={draftingKey === f.key}
                        onClick={() => void runDraft(f.key)}
                      >
                        {draftingKey === f.key ? "Drafting" : "Draft from the record"}
                      </button>
                    ) : null}
                  </div>
                  {aiMeta[f.key] ? (
                    <p className="mt-1 text-[13px]">
                      <StatusMark color={aiMeta[f.key]!.reviewed ? "var(--ontrack)" : "var(--attention)"}>
                        {aiMeta[f.key]!.reviewed ? "Reviewed by the contracting officer" : "AI draft, not yet reviewed"}
                      </StatusMark>
                      <span className="ml-2 text-muted-foreground">
                        {aiMeta[f.key]!.model} · {new Date(aiMeta[f.key]!.generatedAt).toLocaleString()}
                      </span>
                      {!aiMeta[f.key]!.reviewed && canEdit ? (
                        <button
                          type="button"
                          className="ml-3 rounded-lg border border-border px-2 py-1 text-[13px]"
                          onClick={() => {
                            setTouched(true);
                            setAiMeta((prev) => ({ ...prev, [f.key]: { ...prev[f.key]!, reviewed: true } }));
                          }}
                        >
                          Mark reviewed
                        </button>
                      ) : null}
                    </p>
                  ) : null}
                  {f.kind === "readonly" ? (
                    <p id={id} className="text-[15px]">
                      {values[f.key] || "—"}
                    </p>
                  ) : f.kind === "textarea" ? (
                    <textarea
                      id={id}
                      rows={4}
                      className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-[15px]"
                      value={values[f.key] ?? ""}
                      disabled={!canEdit}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  ) : f.kind === "select" ? (
                    <select
                      id={id}
                      className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-[15px]"
                      value={values[f.key] ?? ""}
                      disabled={!canEdit}
                      onChange={(e) => set(f.key, e.target.value)}
                    >
                      <option value="">Choose one</option>
                      {(f.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={id}
                      type={f.kind === "date" ? "date" : "text"}
                      inputMode={f.kind === "money" ? "decimal" : undefined}
                      className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-[15px]"
                      value={values[f.key] ?? ""}
                      disabled={!canEdit}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  )}
                  {f.help ? <p className="mt-1 text-[13px] text-muted-foreground">{f.help}</p> : null}
                  {err ? (
                    <p className="mt-1 text-[13px]" style={{ color: "var(--atrisk)" }}>
                      {err}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </section>
        ))}

        {signature ? (
          <section className="mb-8 border border-border bg-background p-4">
            <h2 className="text-[18px] leading-6 font-medium">Signatures</h2>
            <p className="text-[13px] text-muted-foreground">
              {signature.tierLabel} · {signature.citation} · selected by the estimated value{" "}
              <span data-numeric>{money(estimatedValue)}</span>
            </p>
            <ul className="mt-2">
              {signature.blocks.map((b) => (
                <li key={b} className="mb-1 text-[15px] leading-[22px]">
                  {b}
                </li>
              ))}
            </ul>
            {signature.note ? <p className="mt-2 text-[13px] text-muted-foreground">{signature.note}</p> : null}
          </section>
        ) : null}

        <section className="mb-8 border border-border bg-background p-4" aria-label="NF 1858 memorandum">
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="issue-on-1858"
              type="checkbox"
              checked={!!memoOn}
              disabled={!canEdit}
              onChange={(e) => {
                setMemoOn(e.target.checked);
                setTouched(true);
              }}
            />
            <label htmlFor="issue-on-1858" className="text-[18px] leading-6 font-medium">
              Issue on NF 1858
            </label>
            <span className="text-[13px] text-muted-foreground">
              NASA Form 1858 (Rev 12/24) electronic letterhead memorandum.
            </span>
          </div>
          {memoOn && memoHeader ? (
            <div className="mt-4 max-w-[80ch]">
              <p className="mb-3 text-[13px] text-muted-foreground">
                {memoHeader.centerName}
                {memoHeader.centerAddress ? ` · ${memoHeader.centerAddress}` : ""} · {memoHeader.date} · Reply to Attn
                of: {memoHeader.replyTo || "—"}
              </p>
              <div className="mb-3">
                <label htmlFor="memo-to" className="text-[15px]">To</label>
                <input
                  id="memo-to"
                  className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-[15px]"
                  value={memoHeader.to}
                  disabled={!canEdit}
                  onChange={(e) => { setMemo("to", e.target.value); setTouched(true); }}
                />
                <p className="mt-1 text-[13px] text-muted-foreground">
                  From the Center routing table for this document type. Edit it in Center configuration.
                </p>
              </div>
              <div className="mb-3">
                <label htmlFor="memo-thru" className="text-[15px]">Thru, one official per line</label>
                <textarea
                  id="memo-thru"
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-[15px]"
                  value={memoHeader.thru.join("\n")}
                  disabled={!canEdit}
                  onChange={(e) => { setMemo("thru", linesToList(e.target.value)); setTouched(true); }}
                />
              </div>
              <div className="mb-3">
                <label htmlFor="memo-from" className="text-[15px]">From</label>
                <input
                  id="memo-from"
                  className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-[15px]"
                  value={memoHeader.from}
                  disabled={!canEdit}
                  onChange={(e) => { setMemo("from", e.target.value); setTouched(true); }}
                />
              </div>
              <div className="mb-3">
                <label htmlFor="memo-subject" className="text-[15px]">Subject</label>
                <input
                  id="memo-subject"
                  className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-[15px]"
                  value={memoHeader.subject}
                  disabled={!canEdit}
                  onChange={(e) => { setMemo("subject", e.target.value); setTouched(true); }}
                />
              </div>
              <div className="mb-3">
                <label htmlFor="memo-ref" className="text-[15px]">Ref, one authority per line</label>
                <textarea
                  id="memo-ref"
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-[15px]"
                  value={memoHeader.ref.join("\n")}
                  disabled={!canEdit}
                  onChange={(e) => { setMemo("ref", linesToList(e.target.value)); setTouched(true); }}
                />
              </div>
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="memo-sig-name" className="text-[15px]">Signature, typed name</label>
                  <input
                    id="memo-sig-name"
                    className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-[15px]"
                    value={memoHeader.signatureName}
                    disabled={!canEdit}
                    onChange={(e) => { setMemo("signatureName", e.target.value); setTouched(true); }}
                  />
                </div>
                <div>
                  <label htmlFor="memo-sig-title" className="text-[15px]">Signature, title</label>
                  <input
                    id="memo-sig-title"
                    className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-[15px]"
                    value={memoHeader.signatureTitle}
                    disabled={!canEdit}
                    onChange={(e) => { setMemo("signatureTitle", e.target.value); setTouched(true); }}
                  />
                </div>
              </div>
              <div className="mb-3">
                <label htmlFor="memo-conc" className="text-[15px]">Concurrence, one official per line as name, title</label>
                <textarea
                  id="memo-conc"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-[15px]"
                  value={memoHeader.concurrence.map((c) => [c.name, c.title].filter(Boolean).join(", ")).join("\n")}
                  disabled={!canEdit}
                  onChange={(e) => {
                    setMemo(
                      "concurrence",
                      linesToList(e.target.value).map((l) => {
                        const [name, ...rest] = l.split(",");
                        return { name: rest.length ? (name ?? "").trim() : "", title: (rest.length ? rest.join(",") : l).trim() };
                      }),
                    );
                    setTouched(true);
                  }}
                />
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Prefilled from the officials the Approvals step records, in order, and left blank for signature.
                </p>
              </div>
              <div className="mb-3">
                <label htmlFor="memo-encl" className="text-[15px]">Enclosures, one per line, numbered on the memo</label>
                <textarea
                  id="memo-encl"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-[15px]"
                  value={memoHeader.enclosures.join("\n")}
                  disabled={!canEdit}
                  onChange={(e) => { setMemo("enclosures", linesToList(e.target.value)); setTouched(true); }}
                />
              </div>
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="memo-dist" className="text-[15px]">Distribution, one per line</label>
                  <textarea
                    id="memo-dist"
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-[15px]"
                    value={memoHeader.distribution.join("\n")}
                    disabled={!canEdit}
                    onChange={(e) => { setMemo("distribution", linesToList(e.target.value)); setTouched(true); }}
                  />
                </div>
                <div>
                  <label htmlFor="memo-cc" className="text-[15px]">cc, one per line</label>
                  <textarea
                    id="memo-cc"
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-[15px]"
                    value={memoHeader.cc.join("\n")}
                    disabled={!canEdit}
                    onChange={(e) => { setMemo("cc", linesToList(e.target.value)); setTouched(true); }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="memo-cui"
                  type="checkbox"
                  checked={memoHeader.cui}
                  disabled={!canEdit}
                  onChange={(e) => { setMemo("cui", e.target.checked); setTouched(true); }}
                />
                <label htmlFor="memo-cui" className="text-[15px]">
                  Mark CUI, adding the banner and the cover sheet
                </label>
              </div>
            </div>
          ) : null}
        </section>

        <div className="mb-6 flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-lg px-3 py-2 text-[15px] text-primary-foreground"
            style={{ background: "var(--primary, #0B3D91)" }}
            disabled={!canEdit || save.isPending}
          >
            {save.isPending ? "Saving" : "Save version"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-2 text-[15px]"
            onClick={() => {
              if (memoOn && memoDoc) void exportMemoDocx(memoDoc, `${def.key}-memo-${acquisitionId}`, headerLine);
              else if (rendered) void exportDocx(rendered, `${def.key}-${acquisitionId}`);
            }}
          >
            Export Word
          </button>
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-2 text-[15px]"
            onClick={() => {
              if (memoOn && memoDoc) {
                void exportMemoPdf(memoDoc, headerLine, `${def.key}-memo-${acquisitionId}`).catch(() =>
                  setMessage("The PDF did not export. Try again, or export Word."),
                );
                return;
              }
              const ok = rendered ? exportPdf(rendered, headerLine) : true;
              if (!ok) {
                setMessage("The print window was blocked. Allow pop-ups for this site, then export again.");
              }
            }}
          >
            Export PDF
          </button>
        </div>

        {message ? (
          <p role="status" className="mb-6 text-[15px]">
            {message}
          </p>
        ) : null}
        {!canWrite ? (
          <p className="mb-6 text-[13px] text-muted-foreground">
            Reading only. Switch to the contracting specialist or HQ role to edit and save.
          </p>
        ) : null}
      </form>

      {def.key === "pnm" ? (
        <section aria-label="Comparable prior awards" className="mb-10 max-w-[80ch]">
          <h2 className="mb-1 text-[18px] leading-6 font-medium">Comparable prior awards</h2>
          <p className="mb-3 text-[13px] text-muted-foreground">
            SAM.gov contract awards for this NAICS and PSC, half to double the estimated value.
          </p>
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-2 text-[15px]"
            disabled={!canEdit || runComparables.isPending}
            onClick={() => runComparables.mutate()}
          >
            {runComparables.isPending ? "Running comparables" : "Run comparables"}
          </button>
          {comparables ? (
            <>
              <p className="mt-3 text-[13px]">
                <StatusMark color={comparables.source === "live" ? "var(--ontrack)" : "var(--attention)"}>
                  {comparables.sourceLabel}
                </StatusMark>
                <span className="ml-2 text-muted-foreground" data-numeric>
                  NAICS {comparables.naicsCode} · PSC {comparables.pscCode} · {money(comparables.minValue)} to{" "}
                  {money(comparables.maxValue)}
                </span>
              </p>
              {comparables.awards.length ? (
                <table className="mt-3 w-full border border-border bg-background text-[13px] leading-[18px]">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th scope="col" className="px-3 py-2 font-medium">Agency</th>
                      <th scope="col" className="px-3 py-2 font-medium">Award date</th>
                      <th scope="col" className="px-3 py-2 font-medium">Pricing type</th>
                      <th scope="col" className="px-3 py-2 font-medium">Extent competed</th>
                      <th scope="col" className="px-3 py-2 font-medium">Obligated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparables.awards.map((a, i) => (
                      <tr key={`${a.agency}-${a.awardDate}-${i}`} className="border-b border-border last:border-0 align-top">
                        <td className="px-3 py-2">{a.agency}</td>
                        <td className="px-3 py-2" data-numeric>{a.awardDate}</td>
                        <td className="px-3 py-2">{a.pricingType}</td>
                        <td className="px-3 py-2">{a.extentCompeted}</td>
                        <td className="px-3 py-2" data-numeric>{money(a.obligatedAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-3 text-muted-foreground">No prior awards came back for this NAICS and PSC.</p>
              )}
              <p className="mt-2 text-[13px] text-muted-foreground">
                The summary above the table is written into the memorandum. Edit it to state what the comparison shows.
              </p>
            </>
          ) : (
            <p className="mt-3 text-muted-foreground">
              No comparables run yet. Run comparables to pull prior awards for this requirement.
            </p>
          )}
        </section>
      ) : null}


      <section aria-label="Provenance" className="mb-10 max-w-[80ch] border border-border bg-background p-4">
        <h2 className="mb-2 text-[18px] leading-6 font-medium">Provenance</h2>
        {latest ? (
          <>
            <p className="text-[15px] leading-[22px]">
              {latest.reviewed_by ? "Reviewed" : "AI draft, not yet reviewed"}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Model: {latest.ai_model ?? "—"} · Generated:{" "}
              {latest.ai_generated_at ? new Date(latest.ai_generated_at).toLocaleString() : "—"}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Reviewed by: {latest.reviewed_by ?? "—"} · Reviewed at:{" "}
              {latest.reviewed_at ? new Date(latest.reviewed_at).toLocaleString() : "—"}
            </p>
            {canWrite ? (
              <button
                type="button"
                className="mt-3 rounded-lg border border-border px-3 py-2 text-[15px]"
                onClick={() => markReviewed.mutate()}
                disabled={markReviewed.isPending}
              >
                Mark reviewed
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground">Save a version to record its provenance.</p>
        )}
      </section>

      <section aria-label="Go/No-go" className="mb-10 max-w-[80ch]">
        <h2 className="mb-3 text-[18px] leading-6 font-medium">Go/No-go for {phase}</h2>
        {board.length ? (
          <table className="w-full border border-border bg-background text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="px-3 py-2 font-medium">Reviewer</th>
                <th scope="col" className="px-3 py-2 font-medium">Name</th>
                <th scope="col" className="px-3 py-2 font-medium">Vote</th>
                <th scope="col" className="px-3 py-2 font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {board.map((b) => (
                <tr key={`${b.phase}-${b.reviewer_role}`} className="border-b border-border last:border-0 align-top">
                  <td className="px-3 py-2">{b.reviewer_role}</td>
                  <td className="px-3 py-2">{b.reviewer_name}</td>
                  <td className="px-3 py-2">
                    <StatusMark
                      color={
                        b.vote === "go"
                          ? "var(--ontrack)"
                          : b.vote === "no-go"
                            ? "var(--atrisk)"
                            : "var(--attention)"
                      }
                    >
                      {b.vote === "go" ? "Go" : b.vote === "no-go" ? "No-go" : "Pending"}
                      {b.reason ? ` — ${b.reason}` : ""}
                    </StatusMark>
                  </td>

                  <td className="px-3 py-2" data-numeric>
                    {b.due_date ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted-foreground">No review is triggered for this phase.</p>
        )}

        {role === "reviewer" ? (
          mySeat?.poll_id ? (
            <div className="mt-4">
              <label htmlFor="vote-reason" className="block text-[13px] text-muted-foreground">
                Reason (required for No-go)
              </label>
              <textarea
                id="vote-reason"
                rows={3}
                className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-[15px]"
                value={voteReason}
                onChange={(e) => setVoteReason(e.target.value)}
              />
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  className="rounded-lg border-2 bg-background px-3 py-2 text-[15px] text-foreground"
                  style={{ borderColor: "var(--ontrack)" }}
                  disabled={vote.isPending}
                  onClick={() => vote.mutate({ choice: "go", reason: voteReason.trim() || null })}
                >
                  Go
                </button>
                <button
                  type="button"
                  className="rounded-lg border-2 bg-background px-3 py-2 text-[15px] text-foreground"
                  style={{ borderColor: "var(--atrisk)" }}

                  disabled={vote.isPending}
                  onClick={() => {
                    if (!voteReason.trim()) {
                      setMessage("A No-go needs a reason. Write one, then vote again.");
                      return;
                    }
                    vote.mutate({ choice: "no-go", reason: voteReason.trim() });
                  }}
                >
                  No-go
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-muted-foreground">
              The poll for this phase is not open yet. A contracting specialist opens it on the acquisition file.
            </p>
          )
        ) : null}
      </section>

      <section aria-label="Comments" className="mb-10 max-w-[80ch]">
        <h2 className="mb-3 text-[18px] leading-6 font-medium">Comments</h2>
        {q.data?.comments.length ? (
          <ul className="mb-4 border border-border bg-background">
            {q.data.comments.map((c) => (
              <li key={c.comment_id} className="border-b border-border p-3 last:border-0">
                <p className="text-[13px] text-muted-foreground">
                  {c.author ?? "—"} · {new Date(c.created_at).toLocaleString()}
                </p>
                <p className="text-[15px] leading-[22px]">{c.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-muted-foreground">No comments yet. Start the thread below.</p>
        )}
        <label htmlFor="new-comment" className="block text-[13px] text-muted-foreground">
          Add a comment
        </label>
        <textarea
          id="new-comment"
          rows={3}
          className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-[15px]"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <button
          type="button"
          className="mt-3 rounded-lg border border-border px-3 py-2 text-[15px]"
          disabled={addComment.isPending || !comment.trim() || !latest}
          onClick={() => addComment.mutate(comment.trim())}
        >
          Add comment
        </button>
        {!latest ? (
          <p className="mt-2 text-[13px] text-muted-foreground">Save a version first, then comment on it.</p>
        ) : null}
      </section>

      <ShareDocument
        documentId={latest?.document_id ?? null}
        canShare={role === "specialist" || role === "hq"}
      />

      <section className="mb-10 max-w-[80ch]">
        <h2 className="mb-3 text-[18px] leading-6 font-medium">Versions</h2>
        {q.data?.versions.length ? (
          <table className="w-full border border-border bg-background text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="px-3 py-2 font-medium">Version</th>
                <th scope="col" className="px-3 py-2 font-medium">Saved by</th>
                <th scope="col" className="px-3 py-2 font-medium">Saved</th>
              </tr>
            </thead>
            <tbody>
              {q.data.versions.map((v) => (
                <tr key={v.document_id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2" data-numeric>
                    {v.version}
                  </td>
                  <td className="px-3 py-2">{v.saved_by ?? "—"}</td>
                  <td className="px-3 py-2">{v.saved_at ? new Date(v.saved_at).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted-foreground">No versions yet. Save one to start the history.</p>
        )}
      </section>

      {sourcePanel ? (
        <section
          aria-label="Source"
          className="mb-10 max-w-[80ch] border border-border bg-background p-4"
        >
          <h2 className="text-[18px] leading-6 font-medium">Source of {sourcePanel.title}</h2>
          <ul className="mt-2 space-y-1">
            {sourcePanel.lines.map((line) => (
              <li key={line} className="text-[15px] leading-[22px]">
                {line}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-3 rounded-lg border border-border px-3 py-2 text-[15px]"
            onClick={() => setSourcePanel(null)}
          >
            Close
          </button>
        </section>
      ) : null}

      <div className="flex gap-4">
        <Link to="/templates" className="text-primary">
          Back to Templates
        </Link>
        <Link to="/files/$acquisitionId" params={{ acquisitionId }} className="text-primary">
          Open the acquisition file
        </Link>
      </div>
    </AppShell>
  );
}
