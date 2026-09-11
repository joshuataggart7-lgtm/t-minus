import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { runSamEntityCheck, type SamCheckView } from "@/lib/sam-check.functions";

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

function ChecksPage() {
  const { authState, role } = useRole();
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

  const check = useMutation({
    mutationFn: () =>
      runCheck({
        data: mode === "record" ? { mode, acquisitionId } : { mode, uei: uei.trim().toUpperCase() },
      }),
    onSuccess: setResult,
  });
  const allowed = role === "specialist" || role === "reviewer" || role === "hq";

  return (
    <AppShell>
      <PageHeader title="Checks" lead="Record SAM.gov entity, exclusion, and responsibility results." />

      <div className="mb-8 inline-flex rounded-lg border border-border bg-background p-1" aria-label="Check mode">
        <Button variant={mode === "record" ? "default" : "ghost"} onClick={() => setMode("record")}>
          Record vendor
        </Button>
        <Button variant={mode === "live" ? "default" : "ghost"} onClick={() => setMode("live")}>
          Look up any UEI
        </Button>
      </div>

      <section className="mb-8 max-w-3xl border-y border-border py-6">
        {mode === "record" ? (
          <label className="block max-w-2xl text-[15px]">
            Acquisition
            <select
              value={acquisitionId}
              onChange={(event) => setAcquisitionId(event.target.value)}
              className="mt-2 block w-full rounded-lg border border-input bg-background px-3 py-2"
            >
              {(acquisitions.data ?? []).map((item) => (
                <option key={item.acquisition_id} value={item.acquisition_id}>
                  {item.acquisition_id} · {item.vendor_legal_name ?? item.title} · {item.vendor_uei}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="block max-w-md text-[15px]">
            Unique Entity Identifier (UEI)
            <input
              value={uei}
              onChange={(event) => setUei(event.target.value)}
              maxLength={20}
              autoComplete="off"
              className="mt-2 block w-full rounded-lg border border-input bg-background px-3 py-2 uppercase"
              placeholder="Enter UEI"
            />
          </label>
        )}
        <Button
          className="mt-4"
          disabled={!allowed || check.isPending || (mode === "live" && uei.trim().length < 3)}
          onClick={() => {
            setResult(null);
            check.mutate();
          }}
        >
          {check.isPending ? "Checking" : mode === "record" ? "Run record check" : "Run live check"}
        </Button>
        {!allowed ? (
          <p className="mt-3 text-[13px] text-muted-foreground">Switch to contracting, reviewer, or HQ to run a check.</p>
        ) : null}
        {check.isError ? (
          <p role="alert" className="mt-4 text-destructive">
            {check.error instanceof Error ? check.error.message : "The check failed. Try again."}
          </p>
        ) : null}
      </section>

      {result ? <CheckResult result={result} /> : null}
    </AppShell>
  );
}

function CheckResult({ result }: { result: SamCheckView }) {
  const fields = [
    ["Legal name", result.legalName],
    ["UEI", result.uei],
    ["CAGE", result.cage],
    ["Registration", result.registrationStatus],
    ["Registration expires", result.registrationExpiration],
    ["Exclusions", result.exclusionFlag],
    [`Small business status for NAICS ${result.naicsCode || "—"}`, result.smallBusinessStatus],
    ["Reps and certs", result.repsAndCertsSummary],
    ["Integrity records", String(result.integrityRecordsCount)],
  ];
  return (
    <section className="max-w-3xl" aria-labelledby="check-result-title">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 id="check-result-title" className="section-title">Entity check result</h2>
        <Badge variant={result.source === "sample" || result.source === "cached" ? "outline" : "secondary"}>
          {result.sourceLabel}
        </Badge>
      </div>
      {result.providerError ? (
        <p role="alert" className="mb-4 whitespace-pre-wrap break-words border border-destructive px-3 py-2 text-[13px] text-destructive">
          Live lookup failed, so a saved result is shown. {result.providerError}
        </p>
      ) : null}

      <dl className="border-t border-border bg-background">
        {fields.map(([label, value]) => (
          <div key={label} className="grid gap-1 border-b border-border px-3 py-3 sm:grid-cols-[15rem_1fr]">
            <dt className="font-medium">{label}</dt>
            <dd data-numeric>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-5 text-[13px]">
        <a href={result.exclusionUrl} target="_blank" rel="noreferrer" className="text-primary underline">
          View active exclusions on SAM.gov
        </a>
        <time dateTime={result.checkedAt} className="text-muted-foreground">
          Checked {new Date(result.checkedAt).toLocaleString()}
        </time>
      </div>
    </section>
  );
}