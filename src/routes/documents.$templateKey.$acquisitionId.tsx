import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageHeader, StatusMark, LoadingNote, ErrorNote, EmptyState } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { RegulationSidebar } from "@/components/regulation-sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { samContractAwards, type ComparablesView } from "@/lib/sam-contract-awards.functions";
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

  const phase = phaseForTemplate(templateKey);
  const runComparablesFn = useServerFn(samContractAwards);

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
      const [acq, thr, tpl, polls, rules, watchRows, refs] = await Promise.all([
        supabase.from("acquisition_facts").select("*").eq("acquisition_id", acquisitionId).maybeSingle(),
        supabase.from("thresholds").select("name,value,citation,tier,effective_date,note"),
        supabase.from("templates").select("template_id,name,hq_revision_date,status").eq("name", def!.name).maybeSingle(),
        supabase.from("polls").select("*").eq("acquisition_id", acquisitionId).eq("phase", phase),
        supabase.from("review_rules").select("*"),
        loadWatchRows(),
        loadRegRefs(),
      ]);
      if (acq.error) throw new Error(acq.error.message);
      const templateId = tpl.data?.template_id ?? null;
      const versions = templateId
        ? await supabase
            .from("documents")
            .select(
              "document_id,version,saved_by,saved_at,field_values,ai_model,ai_generated_at,reviewed_by,reviewed_at",
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
      return {
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

  // Pre-fill from the record, or from the latest saved version.
  useEffect(() => {
    if (!def || !q.data?.acq || touched) return;
    const latest = q.data.versions[0]?.field_values;
    if (latest && typeof latest === "object") {
      setValues(latest as Values);
      return;
    }
    const filled = prefill(def, { ...q.data.acq, ...samFacts, acquisition_id: acquisitionId });
    if (def.key === "nf-1707" && !filled["approvals_summary"]) {
      filled["approvals_summary"] = answersSummary(q.data.acq["nf1707_answers"]);
    }
    if (def.key === "jofoc" && !filled["barriers"]) {
      filled["barriers"] =
        "The Agency will continue to examine the market in the future for alternative solutions or new sources before executing any subsequent acquisitions for the same requirements.";
    }
    setValues(filled);
  }, [def, q.data, touched, acquisitionId, samFacts]);

  const estimatedValue = q.data?.acq?.["estimated_value"] ? Number(q.data.acq["estimated_value"]) : null;
  const signature = useMemo(
    () => (def?.signature ? def.signature(estimatedValue, q.data?.thresholds ?? []) : undefined),
    [def, estimatedValue, q.data?.thresholds],
  );

  const errors = def ? validate(def, values) : {};
  const errorCount = Object.keys(errors).length;
  const rendered = def ? renderDocument(def, values, acquisitionId, signature) : null;

  const targetDate = q.data?.acq?.["target_award_date"] as string | null | undefined;
  const daysToAward = targetDate ? daysBetween(todayISO(), targetDate) : null;
  const headerLine = `${acquisitionId} · ${daysToAward === null ? "no target award date" : `${daysToAward} days to award`}`;

  const save = useMutation({
    mutationFn: async () => {
      if (!def || !q.data?.templateId) throw new Error("This template is not loaded in the database.");
      const nextVersion = (q.data.versions[0]?.version ?? 0) + 1;
      const savedAt = new Date().toISOString();
      const { error } = await supabase.from("documents").insert({
        acquisition_id: acquisitionId,
        template_id: q.data.templateId,
        field_values: values as never,
        version: nextVersion,
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

  const set = (key: string, v: string) => {
    setTouched(true);
    setValues((prev) => ({ ...prev, [key]: v }));
  };

  return (
    <AppShell>
      <PageHeader
        title={def.name}
        lead={`${acquisitionId} · ${def.lead}${
          latest && !latest.reviewed_by ? " · AI draft, not yet reviewed" : ""
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
                  <label htmlFor={id} className="block text-[13px] text-muted-foreground">
                    {f.label}
                    {f.required ? " (required)" : ""}
                  </label>
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
            onClick={() => rendered && void exportDocx(rendered, `${def.key}-${acquisitionId}`)}
          >
            Export .docx
          </button>
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-2 text-[15px]"
            onClick={() => {
              if (rendered && !exportPdf(rendered, headerLine)) {
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
