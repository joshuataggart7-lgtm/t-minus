import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { Button } from "@/components/ui/button";
import {
  CiteChip,
  DataTable,
  DetailsList,
  DetailsSection,
  EmptyCell,
  McPageHeader,
  StatusChip,
  WithDetailsPanel,
  type DataColumn,
} from "@/components/ui-mc";
import { supabase } from "@/integrations/supabase/client";
import { runSamEntityCheck, type SamCheckView } from "@/lib/sam-check.functions";
import { LockHint, useDemoLocked } from "@/components/demo-lock";

export const Route = createFileRoute("/checks")({
  head: () => ({
    meta: [
      { title: "Checks — T-Minus" },
      { name: "description", content: "SAM.gov entity, exclusion, and responsibility checks for acquisitions." },
      { property: "og:title", content: "Checks — T-Minus" },
      { property: "og:description", content: "SAM.gov entity, exclusion, and responsibility checks for acquisitions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChecksPage,
});

// Stored entity and exclusion checks for one file, newest first. Read only.
const ENTITY_CHECK_TYPES = ["Sample data, fictional vendor", "Live SAM.gov response", "Exclusions sweep"];

type HistoryRow = {
  id: string;
  checkedAt: string;
  kind: string;
  checkedBy: string;
  sourceLabel: string;
  registration: string;
  exclusions: string;
  excluded: boolean;
  integrity: string;
  view: SamCheckView | null;
};

const str = (v: unknown): string => (typeof v === "string" && v.trim() ? v.trim() : "");

function toHistory(row: {
  check_id: string;
  check_type: string | null;
  checked_at: string | null;
  checked_by: string | null;
  response_json: unknown;
}): HistoryRow {
  const json = (row.response_json ?? {}) as Record<string, unknown>;
  const n = (json["normalized"] ?? {}) as Record<string, unknown>;
  const exclusions = str(n["exclusionFlag"]) || str(n["exclusionLabel"]);
  const excluded = n["excluded"] === true || /^active exclusion|excluded/i.test(exclusions);
  const integrity = typeof n["integrityRecordsCount"] === "number" ? String(n["integrityRecordsCount"]) : "";
  const isEntity = Boolean(str(n["registrationStatus"]));
  return {
    id: row.check_id,
    checkedAt: row.checked_at ?? str(n["checkedAt"]),
    kind: row.check_type === "Exclusions sweep" ? "Exclusions sweep" : "Entity check",
    checkedBy: row.checked_by ?? "",
    sourceLabel: str(n["sourceLabel"]) || str(row.check_type),
    registration: str(n["registrationStatus"]),
    exclusions,
    excluded,
    integrity,
    view: isEntity
      ? {
          uei: str(n["uei"]),
          acquisitionId: str(n["acquisitionId"]) || null,
          legalName: str(n["legalName"]),
          cage: str(n["cage"]),
          registrationStatus: str(n["registrationStatus"]),
          registrationExpiration: str(n["registrationExpiration"]),
          exclusionFlag: exclusions,
          exclusionUrl: str(n["exclusionUrl"]),
          naicsCode: str(n["naicsCode"]),
          smallBusinessStatus: str(n["smallBusinessStatus"]),
          repsAndCertsSummary: str(n["repsAndCertsSummary"]),
          integrityRecordsCount: Number(n["integrityRecordsCount"] ?? 0),
          checkedAt: row.checked_at ?? str(n["checkedAt"]),
          source: n["source"] === "live" ? "live" : n["source"] === "cached" ? "cached" : "sample",
          sourceLabel: str(n["sourceLabel"]) || str(row.check_type),
        }
      : null,
  };
}

const when = (ts: string) => (ts ? new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "");

const HISTORY_COLUMNS: DataColumn<HistoryRow>[] = [
  { key: "when", header: "Checked", nowrap: true, cell: (r) => (r.checkedAt ? <time dateTime={r.checkedAt}>{when(r.checkedAt)}</time> : <EmptyCell />) },
  { key: "kind", header: "Check", cell: (r) => r.kind },
  {
    key: "exclusions",
    header: "Exclusions",
    cell: (r) =>
      r.exclusions ? (
        <StatusChip label={r.excluded ? "Active exclusion" : "No active exclusion"} tone={r.excluded ? "atrisk" : "ontrack"} />
      ) : (
        <EmptyCell />
      ),
  },
  { key: "registration", header: "Registration", cell: (r) => r.registration || <EmptyCell>Not part of this check</EmptyCell> },
  { key: "integrity", header: "Integrity records (FAPIIS)", numeric: true, cell: (r) => (r.integrity ? <span data-numeric>{r.integrity}</span> : <EmptyCell>Not part of this check</EmptyCell>) },
  { key: "source", header: "Source", cell: (r) => r.sourceLabel || <EmptyCell /> },
  { key: "by", header: "By", cell: (r) => r.checkedBy || <EmptyCell /> },
];

function ChecksPage() {
  const { authState, hasAnyRole } = useRole();
  const [mode, setMode] = useState<"record" | "live">("record");
  const [acquisitionId, setAcquisitionId] = useState("A-2027-0102");
  const [uei, setUei] = useState("");
  const [result, setResult] = useState<SamCheckView | null>(null);
  const runCheck = useServerFn(runSamEntityCheck);

  const acquisitions = useQuery({
    queryKey: ["check-acquisitions"],
    enabled: authState === "signed-in",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acquisition_facts")
        .select("acquisition_id,title,vendor_legal_name,vendor_uei")
        .not("vendor_uei", "is", null)
        .order("acquisition_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const selected = (acquisitions.data ?? []).find((a) => a.acquisition_id === acquisitionId) ?? null;

  const history = useQuery({
    queryKey: ["check-history", acquisitionId, selected?.vendor_uei ?? ""],
    enabled: authState === "signed-in" && mode === "record" && Boolean(acquisitionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sam_checks")
        .select("check_id,check_type,checked_at,checked_by,response_json,vendor_uei")
        .eq("acquisition_id", acquisitionId)
        .in("check_type", ENTITY_CHECK_TYPES)
        .order("checked_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      const vendor = selected?.vendor_uei ?? "";
      return (data ?? []).filter((r) => !vendor || !r.vendor_uei || r.vendor_uei === vendor).map(toHistory);
    },
  });

  const check = useMutation({
    mutationFn: () =>
      runCheck({
        data: mode === "record" ? { mode, acquisitionId } : { mode, uei: uei.trim().toUpperCase() },
      }),
    onSuccess: setResult,
  });
  const allowed = hasAnyRole(["specialist", "reviewer", "hq"]);
  const demoLocked = useDemoLocked();

  const rows = history.data ?? [];
  const lastEntity = rows.find((r) => r.view)?.view ?? null;
  const lastSweep = rows.find((r) => r.kind === "Exclusions sweep") ?? null;
  const shown = result ?? (mode === "record" ? lastEntity : null);

  return (
    <AppShell kit>
      <McPageHeader
        eyebrow="Documents"
        title="Checks"
        lead="The vendor on a file as SAM.gov shows it: registration, exclusions and integrity records (FAPIIS), with every check stored on the file."
      />
      <WithDetailsPanel
        panelLabel="Responsibility"
        panel={
          <>
            <DetailsSection title="This vendor">
              <DetailsList
                items={[
                  { term: "File", value: mode === "record" ? <span data-numeric>{acquisitionId}</span> : "Any UEI" },
                  {
                    term: "Exclusions",
                    value: shown ? (
                      <StatusChip
                        label={/^no active/i.test(shown.exclusionFlag) ? "No active exclusion" : shown.exclusionFlag || "Not recorded"}
                        tone={/^no active/i.test(shown.exclusionFlag) ? "ontrack" : "atrisk"}
                      />
                    ) : (
                      <EmptyCell />
                    ),
                  },
                  {
                    term: "Integrity records",
                    value: shown ? <span data-numeric>{String(shown.integrityRecordsCount)}</span> : <EmptyCell />,
                  },
                  {
                    term: "Last sweep",
                    value: lastSweep?.checkedAt ? <time dateTime={lastSweep.checkedAt}>{when(lastSweep.checkedAt)}</time> : <EmptyCell />,
                  },
                  { term: "Checks on file", value: <span data-numeric>{mode === "record" ? rows.length : 0}</span> },
                ]}
              />
            </DetailsSection>
            <DetailsSection title="What the contracting officer weighs">
              <ul className="mc-checks-rules">
                <li>
                  Information available through FAPIIS, including information from SAM and CPARS.{" "}
                  <CiteChip cite="RFO FAR 9.105-1(c)" />
                </li>
                <li>
                  Above the simplified acquisition threshold, FAPIIS is reviewed before award.{" "}
                  <CiteChip cite="RFO FAR 9.104-6(a)(1)" />
                </li>
                <li>
                  Signing the contract is the determination that the vendor is responsible.{" "}
                  <CiteChip cite="RFO FAR 9.105-2(a)(1)" />
                </li>
              </ul>
            </DetailsSection>
          </>
        }
      >
        <section className="mc-kpanel" aria-labelledby="checks-run-title">
          <div className="mc-kpanel-head">
            <div className="min-w-0">
              <h2 id="checks-run-title" className="mc-kpanel-title">Run a check</h2>
              <p className="mc-req-meta">Check the vendor recorded on a file, or look up any UEI.</p>
            </div>
            <div className="mc-work-toolbar inline-flex p-1" aria-label="Check mode">
              <Button variant={mode === "record" ? "default" : "ghost"} onClick={() => setMode("record")}>
                Record vendor
              </Button>
              <Button variant={mode === "live" ? "default" : "ghost"} onClick={() => setMode("live")}>
                Look up any UEI
              </Button>
            </div>
          </div>
          <div className="mc-checks-form">
            {mode === "record" ? (
              <label className="block min-w-0 flex-1 text-[15px]">
                Acquisition
                <select
                  value={acquisitionId}
                  onChange={(event) => {
                    setAcquisitionId(event.target.value);
                    setResult(null);
                  }}
                  className="mt-2 block w-full border border-input bg-background px-3 py-2 [border-radius:var(--mc-radius-control)]"
                >
                  {(acquisitions.data ?? []).map((item) => (
                    <option key={item.acquisition_id} value={item.acquisition_id}>
                      {item.acquisition_id} · {item.vendor_legal_name ?? item.title} · {item.vendor_uei}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="block min-w-0 flex-1 text-[15px]">
                Unique Entity Identifier (UEI)
                <input
                  value={uei}
                  onChange={(event) => setUei(event.target.value)}
                  maxLength={20}
                  autoComplete="off"
                  className="mt-2 block w-full border border-input bg-background px-3 py-2 [border-radius:var(--mc-radius-control)]"
                  placeholder="Enter UEI"
                />
              </label>
            )}
            <Button
              disabled={demoLocked || !allowed || check.isPending || (mode === "live" && uei.trim().length < 3)}
              onClick={() => {
                setResult(null);
                check.mutate();
              }}
            >
              {check.isPending ? "Checking" : mode === "record" ? "Run record check" : "Run live check"}
            </Button>
          </div>
          {demoLocked ? (
            <LockHint className="mt-3" />
          ) : !allowed ? (
            <p className="mt-3 text-[14px] text-muted-foreground">Switch to contracting, reviewer, or HQ to run a check.</p>
          ) : null}
          {check.isError ? (
            <p role="alert" className="mt-4 text-destructive">
              {check.error instanceof Error ? check.error.message : "The check failed. Try again."}
            </p>
          ) : null}
        </section>

        {shown ? <CheckResult result={shown} stored={!result} /> : null}

        {mode === "record" ? (
          <section className="mc-kpanel" aria-labelledby="checks-history-title">
            <div className="mc-kpanel-head">
              <div className="min-w-0">
                <h2 id="checks-history-title" className="mc-kpanel-title">Check history</h2>
                <p className="mc-req-meta">Entity checks and exclusion sweeps stored on {acquisitionId}, newest first.</p>
              </div>
            </div>
            {history.isError ? (
              <p role="alert" className="mt-3 text-destructive">The check history did not load. Reload the page to try again.</p>
            ) : (
              <div className="mt-4">
                <DataTable
                  label={`Check history for ${acquisitionId}`}
                  caption="Stored SAM.gov checks for this file"
                  columns={HISTORY_COLUMNS}
                  rows={rows}
                  rowKey={(r) => r.id}
                  maxHeight="32rem"
                  empty={history.isLoading ? "Loading the check history." : "No checks are stored on this file yet."}
                />
              </div>
            )}
          </section>
        ) : null}
      </WithDetailsPanel>
    </AppShell>
  );
}

function CheckResult({ result, stored }: { result: SamCheckView; stored: boolean }) {
  const excluded = !/^no active/i.test(result.exclusionFlag);
  const fields: { term: string; value: string }[] = [
    { term: "UEI", value: result.uei },
    { term: "CAGE", value: result.cage },
    { term: "Registration expires", value: result.registrationExpiration },
    { term: `Small business status for NAICS ${result.naicsCode || "not recorded"}`, value: result.smallBusinessStatus },
    { term: "Reps and certs", value: result.repsAndCertsSummary },
  ];
  return (
    <section className="mc-kpanel mc-vendor-card" aria-labelledby="check-result-title">
      <div className="mc-kpanel-head">
        <div className="min-w-0">
          <p className="mc-req-h">{stored ? "Last entity check on file" : "Entity check result"}</p>
          <h2 id="check-result-title" className="mc-kpanel-title">
            {result.legalName || "Legal name not returned"}
          </h2>
          <p className="mc-req-meta">
            <time dateTime={result.checkedAt}>Checked {when(result.checkedAt)}</time> · {result.sourceLabel}
          </p>
        </div>
        <StatusChip label={result.source === "live" ? "Live" : result.source === "cached" ? "Saved result" : "Sample"} tone={result.source === "live" ? "info" : "neutral"} />
      </div>
      {result.providerError ? (
        <p role="alert" className="mt-4 whitespace-pre-wrap break-words rounded-md border border-destructive px-3 py-2 text-[14px] text-destructive">
          Live lookup failed, so a saved result is shown. {result.providerError}
        </p>
      ) : null}
      <div className="mc-vendor-signals">
        <div className={excluded ? "is-atrisk" : "is-ontrack"}>
          <span className="mc-req-h">SAM exclusions</span>
          <strong>{result.exclusionFlag || "Not recorded"}</strong>
        </div>
        <div className={result.integrityRecordsCount > 0 ? "is-attention" : "is-ontrack"}>
          <span className="mc-req-h">Integrity records (FAPIIS)</span>
          <strong data-numeric>{String(result.integrityRecordsCount)}</strong>
        </div>
        <div className={/^active/i.test(result.registrationStatus) ? "is-ontrack" : "is-attention"}>
          <span className="mc-req-h">Registration</span>
          <strong>{result.registrationStatus || "Not recorded"}</strong>
        </div>
      </div>
      <dl className="mc-vendor-facts">
        {fields.map((f) => (
          <div key={f.term}>
            <dt>{f.term}</dt>
            <dd data-numeric>{f.value || "Not recorded"}</dd>
          </div>
        ))}
      </dl>
      {result.exclusionUrl ? (
        <p className="mc-kpanel-foot">
          <a href={result.exclusionUrl} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
            View active exclusions on SAM.gov
          </a>
          <span className="sr-only"> (opens in a new tab)</span>
        </p>
      ) : null}
    </section>
  );
}
