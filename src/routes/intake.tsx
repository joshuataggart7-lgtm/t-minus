import { writeAudit } from "@/lib/audit";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageHeader, StatusMark } from "@/components/app-shell";
import { McPageHeader, StatusChip } from "@/components/ui-mc";
import { planToAward } from "@/lib/file-timeline";
import type { PhasePlanRow } from "@/lib/launch-sequence";
import { useRole } from "@/components/role-context";
import { DEMO_READ_ONLY_NOTE, isDemoSession } from "@/lib/demo-guard";
import { DemoFieldset, LockHint } from "@/components/demo-lock";
import { supabase } from "@/integrations/supabase/client";
import { FAIR_OPPORTUNITY_EXCEPTIONS, VEHICLE_DEFAULTS, type VehicleProfile } from "@/lib/vehicles";
import { lookupPlaceOfPerformance, type PlaceLookup } from "@/lib/place-of-performance.functions";
import { lookupPsc, type PscLookup } from "@/lib/psc-lookup.functions";
import {
  visibleForCenter,
  type Nf1707Field,
} from "@/lib/nf1707";
import {
  ACQUISITION_METHODS,
  CENTERS,
  COMPETITION_CHOICES,
  CONTRACT_TYPES,
  EMPTY_FACTS,
  MISSION_DIRECTORATES,
  SET_ASIDES,
  addDays,
  fieldErrors,
  formatMoney,
  parseMoney,
  matchStrategy,
  phaseDaysToAward,
  scanRedFlags,
  todayISO,
  type IntakeFacts,
  type RedFlag,
  type RefData,
} from "@/lib/intake";
import { estimate, inputsFromFacts, toStored } from "@/lib/estimator";
import { ExplainThis } from "@/components/explain-this";
import { explainRedFlag } from "@/lib/explain";
import { Nf1707Intake, answersFromStored, canonicalAnswers, canonicalFromFacts, mappedNf1707, nf1707SectionList } from "@/components/nf1707-intake";
import { RequesterPackageDraft } from "@/components/requester-package-draft";
import type { PackageClin } from "@/lib/requester-package.functions";
import { ATTACHMENT_ACCEPT, igceFromFile, uploadAttachment } from "@/lib/attachments";
import { SCENARIO_DEFAULTS, performanceDays, type ScenarioAnswers } from "@/lib/scenario";
import { isCommercialSimplifiedMethod, methodDisplayLabel, methodKey } from "@/lib/rfo-simplified-cites";

export const Route = createFileRoute("/intake")({
  head: () => ({
    meta: [
      { title: "Intake: NF 1707 — T-Minus" },
      {
        name: "description",
        content:
          "Enter an acquisition once on the NF 1707 intake, clear the red flags, and start the clock.",
      },
      { property: "og:title", content: "Intake: NF 1707 — T-Minus" },
      {
        property: "og:description",
        content: "Enter an acquisition once, clear the red flags, and start the clock.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntakePage,
});

type Answers = Record<string, string>;

function strategyValue(strategy: { psl: string; name: string | null }) {
  return `${strategy.psl}: ${strategy.name ?? ""}`.trim().replace(/:$/, "").trim();
}

type StrategyRow = {
  psl: string;
  name: string | null;
  mandatory_vehicles: string | null;
  required_coordination: string | null;
};

function dropTrailingPeriod(value: string) {
  return value.replace(/[.\s]+$/, "").trim();
}

function strategyLabel(strategy: StrategyRow) {
  const name = (strategy.name ?? "").trim();
  return name ? `${strategy.psl}, ${name}` : strategy.psl;
}

/** The line under the determination select. With no determination recorded the
 *  matched strategy is still the plan of record, so it reads as a match. Once a
 *  determination exists it governs, and the match is only the closest thing
 *  that was reviewed. */
function strategyLineText(
  match: StrategyRow | null,
  determination: string,
  recorded: string | null,
): string | null {
  if (!match) return null;
  const matched = strategyValue(match);
  const value = determination.trim();
  if (!value || value === matched) {
    return `Matched ${matched}. Mandatory vehicles: ${match.mandatory_vehicles ?? "not stated"}. Required coordination: ${match.required_coordination ?? "not stated"}.`;
  }
  const vehicles = dropTrailingPeriod(match.mandatory_vehicles ?? "not stated");
  const coordination = match.required_coordination
    ? dropTrailingPeriod(match.required_coordination)
    : "";
  const governs =
    recorded !== null
      ? "The recorded determination above governs."
      : "The determination selected above governs.";
  return `Closest match reviewed: ${strategyLabel(match)} (mandatory vehicles ${vehicles}${
    coordination ? `; ${coordination}` : ""
  }). ${governs}`;
}



function useRefData(enabled: boolean) {
  return useQuery({
    queryKey: ["intake-ref"],
    enabled,
    queryFn: async () => {
      const [missions, orgCodes, authorities, thresholds, phasePlan, strategies, fields] =
        await Promise.all([
          supabase.from("missions").select("mission_id,name,milestone,milestone_date,mission_directorate_code,mission_directorate_name").order("priority"),
          supabase.from("acquisition_facts").select("branch_code").not("branch_code", "is", null),
          supabase.from("competition_authorities").select("acquisition_method,competition_type,citation,description").order("citation"),
          supabase.from("thresholds").select("name,value,citation,note"),
          supabase.from("phase_plan").select("acquisition_type,phase,planned_days,order"),
          supabase
            .from("enterprise_strategies")
            .select("psl,name,buying_location,mandatory_vehicles,required_coordination"),
          supabase.from("nf1707_fields").select("*"),
        ]);
      // Files a new intake can be recorded as the successor of.
      const { data: priorFiles } = await supabase
        .from("acquisition_facts")
        .select("acquisition_id,title,clock_state,period_of_performance_end")
        .order("acquisition_id");
      const plan = (phasePlan.data ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return {
        missions: missions.data ?? [],
        priorFiles: priorFiles ?? [],
        orgCodes: [...new Set((orgCodes.data ?? []).map((row) => row.branch_code).filter(Boolean))] as string[],
        authorities: authorities.data ?? [],
        fields: (fields.data ?? []) as Nf1707Field[],
        ref: {
          thresholds: thresholds.data ?? [],
          phasePlan: plan,
          strategies: strategies.data ?? [],
        } as RefData,
      };
    },
  });
}

function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: React.ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="mc-field-label">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {hint ? <p className="mc-field-hint">{hint}</p> : null}
      {error ? (
        <p className="mt-1 text-[13px]" style={{ color: "var(--atrisk)" }} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Kit field style (styles.css .mc-input): one border, radius, size and focus ring for every intake field.
const inputClass = "mc-input";

function IntakePage() {
  const { user, hasAnyRole, authState, profile, readOnly, role, canSwitchPersona } = useRole();
  const navigate = useNavigate();
  const data = useRefData(authState === "signed-in");

  const [facts, setFacts] = useState<IntakeFacts>({
    ...EMPTY_FACTS,
    requester_name: user.name,
    center_code: user.center_code,
    center_name: CENTERS.find(([code]) => code === user.center_code)?.[1] ?? "Other",
  });
  const [answers, setAnswers] = useState<Answers>({});
  // Scenario answers. Every question carries a default, so nothing here can
  // stop the record being saved.
  const [scenario, setScenario] = useState<ScenarioAnswers>(SCENARIO_DEFAULTS);
  // A parent IDIQ or BPA carries its own terms; an order inherits them.
  const [vehicle, setVehicle] = useState<VehicleProfile>(VEHICLE_DEFAULTS);
  const setVeh = <K extends keyof VehicleProfile>(key: K, value: VehicleProfile[K]) =>
    setVehicle((v) => ({ ...v, [key]: value }));
  const popDays = performanceDays({
    period_of_performance_start: facts.period_of_performance_start,
    period_of_performance_end: facts.period_of_performance_end,
  });
  const setScen = <K extends keyof ScenarioAnswers>(key: K, value: ScenarioAnswers[K]) =>
    setScenario((prev) => ({ ...prev, [key]: value }));
  
  const [touched, setTouched] = useState(false);
  const [scan, setScan] = useState<RedFlag[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [packageClins, setPackageClins] = useState<PackageClin[]>([]);
  const [packageConfirmedCount, setPackageConfirmedCount] = useState(0);

  // Files staged on this intake. They upload once the record exists, and the
  // IGCE and SOW/PWS states follow the files, never a bare checkbox.
  type DocSlot = "igce_attached" | "sow_attached" | "pr" | "nf-1707";
  const [docFiles, setDocFiles] = useState<Partial<Record<DocSlot, File>>>({});
  const [igceNote, setIgceNote] = useState<string | null>(null);
  const [igceTotal, setIgceTotal] = useState<number | null>(null);

  async function stageFile(slot: DocSlot, file: File) {
    setDocFiles((current) => ({ ...current, [slot]: file }));
    if (slot === "sow_attached") setFacts((f) => ({ ...f, sow_attached: true }));
    if (slot !== "igce_attached") return;
    try {
      const read = await igceFromFile(file);
      if (read?.clins.length) setPackageClins(read.clins as unknown as PackageClin[]);
      setIgceTotal(read?.total ?? null);
      setFacts((f) => ({ ...f, igce_attached: read?.total != null }));
      setIgceNote(
        read?.total != null
          ? `${read.clins.length} CLIN row${read.clins.length === 1 ? "" : "s"} read. Total: ${read.total.toLocaleString()}.`
          : "The file was stored, but no total was found. The IGCE red flag stays until a total is found.",
      );
    } catch (reason) {
      setIgceTotal(null);
      setFacts((f) => ({ ...f, igce_attached: false }));
      setIgceNote(reason instanceof Error ? reason.message : "That file could not be read.");
    }
  }

  function removeStaged(slot: DocSlot) {
    setDocFiles((current) => {
      const next = { ...current };
      delete next[slot];
      return next;
    });
    if (slot === "sow_attached") setFacts((f) => ({ ...f, sow_attached: false }));
    if (slot === "igce_attached") {
      setFacts((f) => ({ ...f, igce_attached: false }));
      setIgceNote(null);
      setIgceTotal(null);
    }
  }


  const errors = useMemo(() => fieldErrors(facts), [facts]);
  const errorCount = Object.keys(errors).length;
  const set = <K extends keyof IntakeFacts>(k: K, v: IntakeFacts[K]) => {
    setFacts((f) => ({ ...f, [k]: v }));
    setScan(null);
  };
  const err = (k: string) => (touched ? errors[k] : undefined);

  const fields = data.data?.fields ?? [];
  const packageComplete = facts.funds_certified && facts.igce_attached && facts.sow_attached;
  const needsAuthority = /limited sources|sole source|brand name/i.test(facts.competition);
  const authorityOptions = (data.data?.authorities ?? []).filter(
    // Reference rows may carry the legacy "FAR ..." method labels; match on the method itself.
    (row) => methodKey(row.acquisition_method) === methodKey(facts.acquisition_method) && row.competition_type === facts.competition,
  );
  const strategies = data.data?.ref.strategies ?? [];
  const pslOptionValues = new Set<string>([
    ...strategies.map((strategy) => strategyValue(strategy)),
    "No mandatory strategy applies",
    "Deviation approved (attach)",
  ]);
  const recordedDetermination =
    facts.enterprise_psl_check.trim() !== "" && !pslOptionValues.has(facts.enterprise_psl_check)
      ? facts.enterprise_psl_check
      : null;
  const strategyMatch = useMemo(
    () =>
      data.data
        ? matchStrategy(data.data.ref, `${facts.title} ${facts.description_of_requirement}`)
        : null,
    [data.data, facts.title, facts.description_of_requirement],
  );
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDate, setNewProjectDate] = useState("");
  const [projectError, setProjectError] = useState<string | null>(null);

  useEffect(() => {
    const centerCode = profile?.last_center_code || user.center_code;
    const centerName = CENTERS.find(([code]) => code === centerCode)?.[1] ?? "Other";
    setFacts((current) => ({
      ...current,
      center_code: centerCode,
      center_name: centerName,
      branch_code: profile?.last_organization_code || current.branch_code,
    }));
  }, [profile?.last_center_code, profile?.last_organization_code, user.center_code]);

  async function loadSample(acquisitionId: string) {
    setSaveError(null);
    const { data: row, error } = await supabase
      .from("acquisition_facts")
      .select("*")
      .eq("acquisition_id", acquisitionId)
      .maybeSingle();
    if (error || !row) {
      setSaveError("The sample could not be loaded. Try again.");
      return;
    }
    setFacts((f) => ({
      ...f,
      title: row.title ?? "",
      mission_id: row.mission_id ?? "",
      mission_directorate_code: row.mission_directorate_code ?? "",
      mission_directorate_name: row.mission_directorate_name ?? "",
      mission_directorate_other: row.mission_directorate_other ?? "",
      sponsoring_agency: row.sponsoring_agency ?? "",
      is_reimbursable: !!row.is_reimbursable,
      center_code: row.center_code ?? f.center_code,
      center_name: row.center_name ?? CENTERS.find(([code]) => code === row.center_code)?.[1] ?? "Other",
      branch_code: row.branch_code ?? "",
      requester_name: row.requester_name ?? f.requester_name,
      requester_org_code: row.requester_org_code ?? "",
      pr_number: row.pr_number ?? "",
      description_of_requirement: row.description_of_requirement ?? "",
      estimated_value: row.estimated_value ? String(row.estimated_value) : "",
      need_date: row.need_date ?? "",
      period_of_performance_start: row.period_of_performance_start ?? "",
      period_of_performance_end: row.period_of_performance_end ?? "",
      place_of_performance: row.place_of_performance ?? "",
      naics_code: row.naics_code ?? "",
      psc_code: row.psc_code ?? "",
      contract_type: /^(ffp|firm-fixed-price)$/i.test(row.contract_type ?? "")
        ? "Firm-fixed-price (FFP)"
        : (row.contract_type ?? ""),
      hybrid_contract_type: row.hybrid_contract_type ?? "",
      acquisition_method: isCommercialSimplifiedMethod(row.acquisition_method)
        ? ACQUISITION_METHODS[0] ?? ""
        : /13/.test(row.acquisition_method ?? "")
          ? ACQUISITION_METHODS[1] ?? ""
          : (row.acquisition_method ?? ""),
      competition: /sole/i.test(row.competition ?? "")
        ? "Sole source"
        : "Competitive",
      set_aside: /total small business/i.test(row.set_aside ?? "")
        ? "Total small business set-aside"
        : (row.set_aside ?? "None"),
      jofoc_authority_citation: row.jofoc_authority_citation ?? "",
      lead_to_delivery_days: String(row.lead_to_delivery_days ?? 30),
      funding_fiscal_year: row.funding_fiscal_year ?? "",
      funds_certified: !!row.funds_certified,
      enterprise_psl_check: row.enterprise_psl_check ?? "",
      // The sample arrives with the IGCE still missing: that is the demo flag.
      igce_attached: acquisitionId === "A-2027-0101" ? false : !!row.igce_attached,
      sow_attached: !!row.sow_attached,
      hardware_deliverable: !!row.hardware_deliverable,
      includes_it: !!row.includes_it,
      acquisition_forecast_verified: !!row.acquisition_forecast_verified,
    }));
    const carriedAnswers = (row.nf1707_answers ?? {}) as Record<string, unknown>;
    setAnswers(answersFromStored(carriedAnswers));
    // The sample's stored scenario answers (GFP, OCI, vehicle and the rest)
    // load with it, so the conditions match the NF 1707 answers it carries.
    const storedScenario = row.scenario && typeof row.scenario === "object" && !Array.isArray(row.scenario)
      ? (row.scenario as Partial<ScenarioAnswers>)
      : {};
    setScenario({ ...SCENARIO_DEFAULTS, ...storedScenario });
    setScan(null);
  }

  async function addProject() {
    if (await isDemoSession()) {
      setProjectError(DEMO_READ_ONLY_NOTE);
      return;
    }
    if (!newProjectName.trim() || !newProjectDate || !facts.mission_directorate_code) {
      setProjectError("Enter a project name and need date after choosing a mission directorate.");
      return;
    }
    const missionId = `M-${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await supabase.from("missions").insert({
      mission_id: missionId,
      name: newProjectName.trim(),
      program: newProjectName.trim(),
      center_code: facts.center_code,
      milestone: "Mission need date",
      milestone_date: newProjectDate,
      mission_directorate_code: facts.mission_directorate_code,
      mission_directorate_name: facts.mission_directorate_name,
    });
    if (error) {
      setProjectError(`The project could not be added: ${error.message}`);
      return;
    }
    await data.refetch();
    set("mission_id", missionId);
    set("need_date", newProjectDate);
    setAddingProject(false);
    setNewProjectName("");
    setNewProjectDate("");
    setProjectError(null);
  }

  const [psc, setPsc] = useState<PscLookup | null>(null);
  const [pscChecking, setPscChecking] = useState(false);
  const lookupPscCode = useServerFn(lookupPsc);

  async function checkPsc() {
    const code = facts.psc_code.trim().toUpperCase();
    if (!code) return;
    setPscChecking(true);
    try {
      setPsc(await lookupPscCode({ data: { code } }));
    } catch {
      setPsc(null);
    } finally {
      setPscChecking(false);
    }
  }

  const [place, setPlace] = useState<PlaceLookup | null>(null);
  const [placeStandardized, setPlaceStandardized] = useState("");
  const [placeChecking, setPlaceChecking] = useState(false);
  const lookupPlace = useServerFn(lookupPlaceOfPerformance);

  async function checkPlace() {
    if (!facts.place_of_performance.trim()) return;
    setPlaceChecking(true);
    try {
      setPlace(await lookupPlace({ data: { query: facts.place_of_performance.trim() } }));
    } catch {
      setPlace(null);
    } finally {
      setPlaceChecking(false);
    }
  }

  function runScan() {
    setTouched(true);
    if (errorCount > 0) {
      setScan(null);
      return;
    }
    const result = scanRedFlags(facts, data.data!.ref, { pr: !!docFiles.pr, nf1707: !!docFiles["nf-1707"] });
    setScan(result);
    // A matched enterprise strategy preselects the determination; the CO's
    // choice then clears or keeps the flag on the next scan.
    if (result.some((flag) => flag.id === "psl") && strategyMatch && !facts.enterprise_psl_check) {
      setFacts((current) => ({ ...current, enterprise_psl_check: strategyValue(strategyMatch) }));
    }
  }

  async function startTheClock() {
    if (await isDemoSession()) {
      setSaveError(DEMO_READ_ONLY_NOTE);
      return;
    }
    if (!scan || scan.some((f) => f.blocking)) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { data: existing } = await supabase
        .from("acquisition_facts")
        .select("acquisition_id")
        .like("acquisition_id", "A-2027-%")
        .order("acquisition_id", { ascending: false })
        .limit(1);
      const last = existing?.[0]?.acquisition_id ?? "A-2027-0100";
      const next = `A-2027-${String(Number(last.slice(-4)) + 1).padStart(4, "0")}`;
      const today = todayISO();
      const lead = Number(facts.lead_to_delivery_days) || 0;
      const target = addDays(facts.need_date, -lead);
      const est = estimate(inputsFromFacts(facts, scenario.vehicle), data.data!.ref);
      const stored = toStored(est);

      const payload = {
        acquisition_id: next,
        mission_id: facts.mission_id || null,
        mission_directorate_code: facts.mission_directorate_code || null,
        mission_directorate_name: facts.mission_directorate_name || null,
        mission_directorate_other: facts.mission_directorate_other || null,
        sponsoring_agency: facts.sponsoring_agency || null,
        is_reimbursable: facts.is_reimbursable,
        successor_of: facts.successor_of || null,
        title: facts.title,
        center_code: facts.center_code,
        center_name: facts.center_name,
        branch_code: facts.branch_code || null,
        requester_name: facts.requester_name,
        requester_org_code: facts.requester_org_code || null,
        pr_number: facts.pr_number || null,
        description_of_requirement: facts.description_of_requirement,
        estimated_value: parseMoney(facts.estimated_value),
        need_date: facts.need_date,
        period_of_performance_start: facts.period_of_performance_start || null,
        period_of_performance_end: facts.period_of_performance_end || null,
        place_of_performance: facts.place_of_performance || null,
        place_of_performance_standardized: placeStandardized || null,
        naics_code: facts.naics_code,
        psc_code: facts.psc_code,
        contract_type: facts.contract_type,
        hybrid_contract_type: facts.hybrid_contract_type || null,
        acquisition_method: facts.acquisition_method,
        competition: facts.competition,
        set_aside: facts.set_aside || null,
        jofoc_authority_citation: facts.jofoc_authority_citation || null,
        funding_fiscal_year: facts.funding_fiscal_year || null,
        funds_certified: facts.funds_certified,
        igce_attached: facts.igce_attached,
        sow_attached: facts.sow_attached,
        is_package_complete: packageComplete,
        hardware_deliverable: facts.hardware_deliverable,
        includes_it: facts.includes_it,
        enterprise_psl_check: facts.enterprise_psl_check || null,
        acquisition_forecast_verified: facts.acquisition_forecast_verified,
        lead_to_delivery_days: lead,
        regulatory_baseline_date: today,
        target_award_date: target,
        clock_state: "running",
        status: "On Track",
        current_phase: "Intake",
        nf1707_answers: {
          ...mappedNf1707(fields, { ...canonicalFromFacts(facts), ...answers }, {}, facts),
          // The Intake answer keys travel with the cells so the answers reload for editing.
          ...canonicalAnswers({ ...canonicalFromFacts(facts), ...answers }),
        },
        intake_estimate: stored,
        vehicle:
          scenario.vehicle === "idiq_award" || scenario.vehicle === "bpa"
            ? { ...vehicle, award_type: scenario.idiq_single_award ? "single" : "multiple" }
            : {},
        parent_contract_number: scenario.parent_contract_number || null,
        scenario: {
          ...scenario,
          contract_type: facts.contract_type || scenario.contract_type,
          set_aside_type: scenario.set_aside_type || facts.set_aside || "",
        },
      };

      // Two people submitting at once can land on the same number; take the
      // next one instead of failing silently.
      let inserted = await supabase.from("acquisition_facts").insert(payload);
      let attempt = 0;
      while (inserted.error && /duplicate key|already exists/i.test(inserted.error.message) && attempt < 5) {
        attempt += 1;
        payload.acquisition_id = `A-2027-${String(Number(last.slice(-4)) + 1 + attempt).padStart(4, "0")}`;
        inserted = await supabase.from("acquisition_facts").insert(payload);
      }
      if (inserted.error) throw inserted.error;
      const created = payload.acquisition_id;

      if (packageClins.length) {
        const { error: clinError } = await supabase.from("igce_clins").insert(packageClins.map((clin) => ({
          acquisition_id: created,
          clin_number: clin.clinNumber,
          description: clin.description,
          quantity: clin.quantity ? Number(clin.quantity) : null,
          unit_of_issue: clin.unit || null,
          unit_price: clin.unitPrice ? parseMoney(clin.unitPrice) : null,
          extended_price: clin.extendedPrice ? parseMoney(clin.extendedPrice) : null,
          period_start: clin.periodStart || null,
          period_end: clin.periodEnd || null,
        })));
        if (clinError) throw clinError;
      }

      // Staged files upload now that the record exists, each with its own audit entry.
      const labels: Record<string, string> = {
        igce_attached: "IGCE",
        sow_attached: "SOW/PWS",
        pr: "Purchase request",
        "nf-1707": "NF 1707 from the requester",
      };
      for (const [key, file] of Object.entries(docFiles)) {
        if (!file) continue;
        await uploadAttachment({
          acquisitionId: created,
          key,
          label: labels[key] ?? key,
          file,
          actor: user.name,
          parsedTotal: key === "igce_attached" ? igceTotal : null,
        });
      }

      if (profile && !readOnly) {
        await supabase.from("profiles").update({
          last_center_code: facts.center_code,
          last_organization_code: facts.branch_code || null,
        }).eq("id", profile.id);
      }

      await writeAudit([
        {
          acquisition_id: created,
          actor: user.name,
          action: "Intake submitted; clock started",
          field: "clock_state",
          old_value: null,
          new_value: "running",
          reason: "NF 1707 intake submitted and red-flag scan cleared",
        },
        ...(packageConfirmedCount > 0 || packageClins.length ? [{
          acquisition_id: created,
          actor: user.name,
          action: "Requester package draft confirmed",
          field: "igce_clins",
          old_value: null,
          new_value: `${packageConfirmedCount} proposed value${packageConfirmedCount === 1 ? "" : "s"}; ${packageClins.length} CLIN row${packageClins.length === 1 ? "" : "s"}`,
          reason: "CO confirmed requester-package suggestions before starting the clock; source files were session-only and were not stored",
        }] : []),
        {
          acquisition_id: created,
          actor: user.name,
          action: "Target award date set",
          field: "target_award_date",
          old_value: null,
          new_value: target,
          reason: `Need date ${facts.need_date} minus ${lead} days to delivery`,
        },
        {
          acquisition_id: created,
          actor: user.name,
          action: "Intake estimate recorded",
          field: "intake_estimate",
          old_value: null,
          new_value: `${est.monthsToAward} months to award; ${est.phases.length} phases; ${est.hours.total} contracting hours`,
          reason:
            "LOE Estimator model run against the intake answers (value, competition, pricing, instrument, requirement type)",
        },
      ]);

      navigate({ to: "/intake/$acquisitionId", params: { acquisitionId: created } });
    } catch (e) {
      setSaveError(
        e instanceof Error
          ? `The intake could not be saved: ${e.message}. Check the required fields and try again.`
          : "The intake could not be saved. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!hasAnyRole(["specialist", "requester", "hq"])) {
    return (
      <AppShell>
        <PageHeader
          title="Intake"
          lead={
            role === "executive"
              ? canSwitchPersona
                ? "Executive access is read-only. Switch to Requester or Contracting to create an intake."
                : "Executive access is read-only. Creating an intake requires Contracting, Requester, or HQ."
              : "Submitting an intake requires Contracting, Requester, or HQ."
          }
        />
      </AppShell>
    );
  }

  const value = parseMoney(facts.estimated_value);
  // The level-of-effort estimate the requester sees before the clock starts.
  const intakeEstimate = scan && data.data ? estimate(inputsFromFacts(facts, scenario.vehicle), data.data.ref) : null;
  const blocking = scan?.filter((f) => f.blocking) ?? [];

  const nfSections = nf1707SectionList(answers, facts);
  const nfAnswered = nfSections.filter((section) => section.answered).length;
  const scanStatus = scan === null
    ? { label: "Not run", tone: "neutral" as const }
    : blocking.length > 0
      ? { label: `${blocking.length} blocking`, tone: "atrisk" as const }
      : scan.length > 0
        ? { label: `${scan.length} to review`, tone: "attention" as const }
        : { label: "Clear", tone: "ontrack" as const };
  // The phase plan to award for the row this intake would save, from the same
  // helper the requester card, Files list and confirmation page use.
  const intakePlan = scan && data.data
    ? planToAward(
        {
          ...facts,
          estimated_value: value,
          scenario: { ...scenario, contract_type: facts.contract_type || scenario.contract_type },
        },
        data.data.ref.phasePlan as unknown as PhasePlanRow[],
      )
    : null;
  // The need-date red flag counts to the award decision itself, without the FPDS-NG report after it.
  const needDateDays = scan && data.data ? phaseDaysToAward(data.data.ref, facts.competition, facts.acquisition_method) : null;

  // Moves to a step without scrolling any inner container: the window scrolls so
  // the step's heading sits just under the sticky header.
  const goTo = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    if (target instanceof HTMLDetailsElement) target.open = true;
    window.requestAnimationFrame(() => {
      const headerH = document.querySelector<HTMLElement>("header")?.offsetHeight ?? 64;
      const top = target.getBoundingClientRect().top + window.scrollY - headerH - 16;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
      const focusable = target.matches("summary, h2, button") ? target : target.querySelector<HTMLElement>("summary, h2, button, input, select, textarea");
      focusable?.focus({ preventScroll: true });
    });
  };
  const scanAndShow = () => {
    runScan();
    window.setTimeout(() => goTo(errorCount > 0 ? "intake-scan" : "intake-scan-results"), 80);
  };

  return (
    <AppShell kit>
      <McPageHeader
        title="Intake: NF 1707"
        lead="Enter the acquisition once. Every document, check, and record reads from this file."
        actions={
          <div className="mc-intake-samples" role="group" aria-label="Demo samples">
            <span className="mc-intake-samples-label">Demo samples</span>
            <button type="button" onClick={() => void loadSample("A-2027-0101")} className="mc-intake-button">
              Load Sample 1 (competed)
            </button>
            <button type="button" onClick={() => void loadSample("A-2027-0102")} className="mc-intake-button">
              Load Sample 2 (sole source)
            </button>
          </div>
        }
      />
      <p className="mc-intake-note mb-4">
        Sample A-2027-0101 loads as a requester would send it: IGCE not yet attached.
      </p>
      {readOnly ? <LockHint className="mb-6" /> : null}

      <div className="mc-intake-layout">
      <div className="min-w-0">
      <DemoFieldset>
      <div id="intake-package" className="scroll-mt-24">
      <RequesterPackageDraft
        missions={data.data?.missions ?? []}
        applyFact={(key, nextValue) => set(key, nextValue)}
        applyAnswers={(nextAnswers) => {
          setAnswers((current) => ({ ...current, ...nextAnswers }));
          setScan(null);
        }}
        onClinsConfirmed={setPackageClins}
        onConfirmedCount={setPackageConfirmedCount}
      />
      </div>

      {/* T-Minus section: the facts the paper form does not carry. */}
      <section id="intake-record" className="mc-work-form-section mb-10 scroll-mt-24">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 tabIndex={-1} className="text-[18px] leading-6 font-medium">T-Minus record</h2>
          <StatusMark color={packageComplete ? "var(--ontrack)" : "var(--attention)"} className="text-[13px] font-medium">
            Package {packageComplete ? "complete" : "incomplete"}
          </StatusMark>
        </div>
        <div className="grid gap-x-8 md:grid-cols-2">
          <Field label="Center" htmlFor="center" error={err("center_code")}>
            <select
              id="center"
              className={inputClass}
              value={facts.center_code}
              onChange={(e) => {
                const selected = CENTERS.find(([code]) => code === e.target.value);
                setFacts((current) => ({
                  ...current,
                  center_code: e.target.value,
                  center_name: selected?.[1] ?? "Other",
                }));
                setScan(null);
              }}
            >
              {CENTERS.map(([code, name]) => (
                <option key={code} value={code}>
                  {code} — {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Organization code" htmlFor="organization-code" hint="Enter any code or choose one used before.">
            <input
              id="organization-code"
              list="organization-codes"
              autoComplete="off"
              className={inputClass}
              value={facts.branch_code}
              onChange={(e) => set("branch_code", e.target.value)}
            />
            <datalist id="organization-codes">
              {(data.data?.orgCodes ?? []).map((code) => <option key={code} value={code} />)}
            </datalist>
          </Field>
          <Field label="Mission directorate" htmlFor="mission-directorate" error={err("mission_directorate_code")}>
            <select
              id="mission-directorate"
              className={inputClass}
              value={facts.mission_directorate_code}
              onChange={(e) => {
                const selected = MISSION_DIRECTORATES.find(([code]) => code === e.target.value);
                setFacts((current) => ({
                  ...current,
                  mission_directorate_code: e.target.value,
                  mission_directorate_name: selected?.[1] ?? "",
                  is_reimbursable: e.target.value === "REIMBURSABLE",
                  sponsoring_agency: e.target.value === "REIMBURSABLE" ? current.sponsoring_agency : "",
                  mission_directorate_other: e.target.value === "OTHER" ? current.mission_directorate_other : "",
                }));
                setScan(null);
              }}
            >
              <option value="">Choose a directorate</option>
              {MISSION_DIRECTORATES.map(([code, name]) => <option key={code} value={code}>{["HSMD", "RTMD", "SMD", "MSD"].includes(code) ? `${name} (${code})` : name}</option>)}
            </select>
          </Field>
          {facts.is_reimbursable ? (
            <Field label="Sponsoring agency" htmlFor="sponsoring-agency" error={err("sponsoring_agency")}>
              <input id="sponsoring-agency" className={inputClass} value={facts.sponsoring_agency} onChange={(e) => set("sponsoring_agency", e.target.value)} />
            </Field>
          ) : null}
          {facts.mission_directorate_code === "OTHER" ? (
            <Field label="Specify mission directorate" htmlFor="directorate-other" error={err("mission_directorate_other")}>
              <input id="directorate-other" className={inputClass} value={facts.mission_directorate_other} onChange={(e) => set("mission_directorate_other", e.target.value)} />
            </Field>
          ) : null}
          <Field label="Program / project" htmlFor="mission" error={err("mission_id")}>
            <select
              id="mission"
              className={inputClass}
              value={facts.mission_id}
              onChange={(e) => {
                if (e.target.value === "__new__") {
                  setAddingProject(true);
                  return;
                }
                const mission = data.data?.missions.find((item) => item.mission_id === e.target.value);
                setFacts((current) => ({
                  ...current,
                  mission_id: e.target.value,
                  need_date: mission?.milestone_date ?? current.need_date,
                  mission_directorate_code: mission?.mission_directorate_code ?? current.mission_directorate_code,
                  mission_directorate_name: mission?.mission_directorate_name ?? current.mission_directorate_name,
                }));
                setScan(null);
              }}
            >
              <option value="">Choose a project</option>
              {(data.data?.missions ?? []).map((m) => <option key={m.mission_id} value={m.mission_id}>{m.name}</option>)}
              <option value="__new__">Add new project</option>
            </select>
            {addingProject ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto] max-sm:grid-cols-1">
                <input aria-label="New project name" placeholder="Project name" className={inputClass} value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
                <input aria-label="New project need date" type="date" className={inputClass} value={newProjectDate} onChange={(e) => setNewProjectDate(e.target.value)} />
                {readOnly ? null : <button type="button" className="rounded-lg bg-primary px-3 py-2 text-[14px] text-primary-foreground" onClick={() => void addProject()}>Add</button>}
              </div>
            ) : null}
            {projectError ? <p className="mt-1 text-[13px]" style={{ color: "var(--atrisk)" }}>{projectError}</p> : null}
          </Field>
          <Field label="Title of the requirement" htmlFor="title" error={err("title")}>
            <input
              id="title"
              className={inputClass}
              value={facts.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </Field>
          <Field label="Requisition number" htmlFor="pr">
            <input
              id="pr"
              className={inputClass}
              value={facts.pr_number}
              onChange={(e) => set("pr_number", e.target.value)}
            />
          </Field>
          <Field label="Requesting organization" htmlFor="org">
            <input
              id="org"
              className={inputClass}
              value={facts.requester_org_code}
              onChange={(e) => set("requester_org_code", e.target.value)}
            />
          </Field>
          <Field label="Requester" htmlFor="requester" error={err("requester_name")}>
            <input
              id="requester"
              className={inputClass}
              value={facts.requester_name}
              onChange={(e) => set("requester_name", e.target.value)}
            />
          </Field>
          <div className="md:col-span-2">
            <Field
              label="Brief description of this requirement"
              htmlFor="desc"
              error={err("description_of_requirement")}
            >
              <textarea
                id="desc"
                rows={4}
                className={inputClass}
                value={facts.description_of_requirement}
                onChange={(e) => set("description_of_requirement", e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Successor of"
            htmlFor="successor-of"
            hint="Leave this blank unless the request replaces an existing acquisition."
          >
            <select
              id="successor-of"
              className={inputClass}
              value={facts.successor_of}
              onChange={(e) => set("successor_of", e.target.value)}
            >
              <option value="">Not a follow-on</option>
              {/* Scrubbed files are left out unless one is already the recorded predecessor. */}
              {(data.data?.priorFiles ?? [])
                .filter((f) => f.clock_state !== "scrubbed" || f.acquisition_id === facts.successor_of)
                .map((f) => (
                <option key={f.acquisition_id} value={f.acquisition_id}>
                  {f.acquisition_id} · {f.clock_state === "hold" ? "On hold" : f.clock_state === "launched" ? "Launched" : f.clock_state === "scrubbed" ? "Scrubbed" : "Open"} · {f.title ?? "Untitled"}
                  {f.period_of_performance_end ? ` (ends ${f.period_of_performance_end})` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mission need date" htmlFor="need" error={err("need_date")}>
            <input
              id="need"
              type="date"
              className={inputClass}
              value={facts.need_date}
              onChange={(e) => set("need_date", e.target.value)}
            />
          </Field>
          <Field
            label="Days from award until the mission has what it bought"
            htmlFor="lead"
            error={err("lead_to_delivery_days")}
          >
            <input
              id="lead"
              inputMode="numeric"
              className={inputClass}
              value={facts.lead_to_delivery_days}
              onChange={(e) => set("lead_to_delivery_days", e.target.value)}
            />
          </Field>
          <Field
            label="Estimated value"
            htmlFor="value"
            hint={value !== null ? formatMoney(value) : undefined}
            error={err("estimated_value")}
          >
            <input
              id="value"
              inputMode="decimal"
              className={inputClass}
              value={facts.estimated_value}
              onChange={(e) => set("estimated_value", e.target.value)}
            />
          </Field>
          <Field label="NAICS code" htmlFor="naics" hint="Six digits." error={err("naics_code")}>
            <input
              id="naics"
              className={inputClass}
              value={facts.naics_code}
              onChange={(e) => set("naics_code", e.target.value)}
            />
          </Field>
          <Field label="PSC code" htmlFor="psc" hint="Four characters." error={err("psc_code")}>
            <input
              id="psc"
              className={inputClass}
              value={facts.psc_code}
              onChange={(e) => {
                set("psc_code", e.target.value.toUpperCase());
                setPsc(null);
              }}
            />
            <button
              type="button"
              className="mt-2 rounded-lg border border-border px-3 py-2 text-[13px]"
              disabled={pscChecking || !facts.psc_code.trim()}
              onClick={() => void checkPsc()}
            >
              {pscChecking ? "Checking" : "Check product or service code"}
            </button>
            {psc ? (
              <p className="mt-2 text-[13px] text-muted-foreground">
                {psc.state === "valid" && psc.officialName ? (
                  `${psc.code} — ${psc.officialName}`
                ) : (
                  <StatusMark color="var(--attention)">{psc.message}</StatusMark>
                )}
                <span className="block text-muted-foreground">{psc.sourceLabel}</span>
              </p>
            ) : null}
          </Field>
          <Field label="Contract type" htmlFor="ctype" error={err("contract_type")}>
            <select
              id="ctype"
              className={inputClass}
              value={facts.contract_type}
              onChange={(e) => set("contract_type", e.target.value)}
            >
              <option value="">Choose a contract type</option>
              {CONTRACT_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hybrid with (optional)" htmlFor="hybrid-type">
            <select id="hybrid-type" className={inputClass} value={facts.hybrid_contract_type} onChange={(e) => set("hybrid_contract_type", e.target.value)}>
              <option value="">No hybrid type</option>
              {CONTRACT_TYPES.filter((c) => c !== facts.contract_type).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          {/^(T&M|TM|LH|LABOR)/i.test(facts.contract_type.trim()) || /labor[- ]hour|time[- ]and[- ]materials?/i.test(facts.contract_type) ? (
            // RFO FAR 12.104(b)(1)(ii) (commercial) and RFO FAR 16.601-3(c): a
            // T&M or labor-hour contract or order includes a ceiling price
            // that the contractor exceeds at its own risk.
            <Field label="Ceiling price (T&M or labor-hour)" htmlFor="tm-ceiling">
              <input
                id="tm-ceiling"
                inputMode="decimal"
                className={inputClass}
                value={scenario.tm_ceiling_price ?? ""}
                onChange={(e) => setScen("tm_ceiling_price", e.target.value)}
              />
            </Field>
          ) : null}
          <Field label="Acquisition method" htmlFor="method" error={err("acquisition_method")}>
            <select
              id="method"
              className={inputClass}
              value={facts.acquisition_method}
              onChange={(e) => set("acquisition_method", e.target.value)}
            >
              <option value="">Choose a method</option>
              {ACQUISITION_METHODS.map((c) => (
                <option key={c} value={c}>
                  {methodDisplayLabel(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Competition" htmlFor="comp" error={err("competition")}>
            <select
              id="comp"
              className={inputClass}
              value={facts.competition}
              onChange={(e) => set("competition", e.target.value)}
            >
              <option value="">Choose the competition approach</option>
              {COMPETITION_CHOICES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Set-aside" htmlFor="setaside">
            <select
              id="setaside"
              className={inputClass}
              value={facts.set_aside}
              onChange={(e) => set("set_aside", e.target.value)}
            >
              <option value="">Choose a set-aside</option>
              {SET_ASIDES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          {needsAuthority ? (
            <Field label="Authority for other than full and open competition" htmlFor="jofoc" error={err("jofoc_authority_citation")}>
              <select id="jofoc" className={inputClass} value={facts.jofoc_authority_citation} onChange={(e) => set("jofoc_authority_citation", e.target.value)}>
                <option value="">Choose an authority</option>
                {authorityOptions.map((option) => <option key={`${option.citation}-${option.description}`} value={`${option.citation} — ${option.description}`}>{option.citation} — {option.description}</option>)}
              </select>
            </Field>
          ) : null}
          <Field label="Period of performance begins" htmlFor="pops">
            <input
              id="pops"
              type="date"
              className={inputClass}
              value={facts.period_of_performance_start}
              onChange={(e) => set("period_of_performance_start", e.target.value)}
            />
          </Field>
          <Field
            label="Period of performance ends"
            htmlFor="pope"
            error={err("period_of_performance_end")}
          >
            <input
              id="pope"
              type="date"
              className={inputClass}
              value={facts.period_of_performance_end}
              onChange={(e) => set("period_of_performance_end", e.target.value)}
            />
          </Field>
          <Field label="Place of performance" htmlFor="place">
            <input
              id="place"
              className={inputClass}
              value={facts.place_of_performance}
              onChange={(e) => {
                set("place_of_performance", e.target.value);
                setPlace(null);
                setPlaceStandardized("");
              }}
            />
            <button
              type="button"
              className="mt-2 rounded-lg border border-border px-3 py-2 text-[13px]"
              disabled={placeChecking || !facts.place_of_performance.trim()}
              onClick={() => void checkPlace()}
            >
              {placeChecking ? "Checking" : "Check place of performance"}
            </button>
            {placeStandardized ? (
              <p className="mt-2 text-[13px] text-muted-foreground">
                Standardized value stored with the free text: {placeStandardized}
              </p>
            ) : null}
            {place ? (
              <div className="mt-2">
                <p className="text-[13px] text-muted-foreground">{place.sourceLabel}</p>
                <ul className="mt-1 space-y-1">
                  {place.matches.map((m) => (
                    <li key={m.standardized} className="text-[13px]">
                      <button
                        type="button"
                        className="rounded-lg border border-border px-2 py-1"
                        onClick={() => {
                          setPlaceStandardized(m.standardized);
                          setPlace(null);
                        }}
                      >
                        Accept {m.standardized}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Field>
          <Field label="Funding fiscal year" htmlFor="ffy">
            <input
              id="ffy"
              className={inputClass}
              value={facts.funding_fiscal_year}
              onChange={(e) => set("funding_fiscal_year", e.target.value)}
            />
          </Field>
          <Field label="Enterprise strategy determination" htmlFor="psl">
            <select
              id="psl"
              className={inputClass}
              value={facts.enterprise_psl_check}
              onChange={(e) => set("enterprise_psl_check", e.target.value)}
            >
              <option value="">CO determination needed</option>
              {recordedDetermination ? (
                <option value={recordedDetermination}>Recorded determination (see below)</option>
              ) : null}
              {strategies.map((strategy) => (
                <option key={strategy.psl} value={strategyValue(strategy)}>
                  {strategyValue(strategy)}
                </option>
              ))}
              <option value="No mandatory strategy applies">No mandatory strategy applies</option>
              <option value="Deviation approved (attach)">Deviation approved (attach)</option>
            </select>
            {recordedDetermination ? (
              <p className="mt-1 text-[13px] text-muted-foreground">
                Recorded determination: {recordedDetermination}
              </p>
            ) : null}
            {strategyLineText(strategyMatch, facts.enterprise_psl_check, recordedDetermination) ? (
              <p className="mt-1 text-[13px] text-muted-foreground">
                {strategyLineText(strategyMatch, facts.enterprise_psl_check, recordedDetermination)}
              </p>
            ) : null}

          </Field>
        </div>

        <fieldset className="mt-2">
          <legend className="mb-2 text-[13px] text-muted-foreground">
            Conditions that decide which documents this file needs
          </legend>
          <p className="mb-3 text-[13px] text-muted-foreground">
            Every answer has a default, so none of these stops the record being saved. Each answer
            switches document rows on in the launch sequence with the citation that requires them.
          </p>
          <div className="grid gap-x-8 md:grid-cols-2">
            <Field label="Vehicle" htmlFor="scen-vehicle">
              <select
                id="scen-vehicle"
                className={inputClass}
                value={scenario.vehicle}
                onChange={(e) => setScen("vehicle", e.target.value as ScenarioAnswers["vehicle"])}
              >
                <option value="new">New contract</option>
                <option value="idiq_award">IDIQ award</option>
                <option value="idiq_order">Order under an existing IDIQ</option>
                <option value="bpa">BPA</option>
                <option value="gsa_fss">GSA Federal Supply Schedule order</option>
                <option value="other_agency">Other agency vehicle</option>
              </select>
            </Field>
            {scenario.vehicle === "idiq_award" ? (
              <Field label="Single award IDIQ" htmlFor="scen-idiq-single">
                <select
                  id="scen-idiq-single"
                  className={inputClass}
                  value={scenario.idiq_single_award ? "yes" : "no"}
                  onChange={(e) => setScen("idiq_single_award", e.target.value === "yes")}
                >
                  <option value="no">No, multiple award</option>
                  <option value="yes">Yes, single award</option>
                </select>
              </Field>
            ) : null}
            {scenario.vehicle === "idiq_award" || scenario.vehicle === "bpa" ? (
              <>
                <Field label="Ceiling, dollars" htmlFor="veh-ceiling">
                  <input
                    id="veh-ceiling"
                    className={inputClass}
                    inputMode="decimal"
                    value={vehicle.ceiling ?? ""}
                    onChange={(e) => setVeh("ceiling", e.target.value.trim() ? Number(e.target.value) : null)}
                  />
                </Field>
                <Field label="Minimum guarantee, dollars" htmlFor="veh-minimum">
                  <input
                    id="veh-minimum"
                    className={inputClass}
                    inputMode="decimal"
                    value={vehicle.minimum_guarantee ?? ""}
                    onChange={(e) =>
                      setVeh("minimum_guarantee", e.target.value.trim() ? Number(e.target.value) : null)
                    }
                  />
                </Field>
                <Field label="Ordering period start" htmlFor="veh-start">
                  <input
                    id="veh-start"
                    type="date"
                    className={inputClass}
                    value={vehicle.ordering_start ?? ""}
                    onChange={(e) => setVeh("ordering_start", e.target.value || null)}
                  />
                </Field>
                <Field label="Ordering period end" htmlFor="veh-end">
                  <input
                    id="veh-end"
                    type="date"
                    className={inputClass}
                    value={vehicle.ordering_end ?? ""}
                    onChange={(e) => setVeh("ordering_end", e.target.value || null)}
                  />
                </Field>
                <Field label="Order types allowed" htmlFor="veh-order-types">
                  <input
                    id="veh-order-types"
                    className={inputClass}
                    value={vehicle.order_types.join(", ")}
                    onChange={(e) =>
                      setVeh(
                        "order_types",
                        e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                      )
                    }
                  />
                </Field>
                <Field label="Fair opportunity procedures" htmlFor="veh-fair">
                  <select
                    id="veh-fair"
                    className={inputClass}
                    value={vehicle.fair_opportunity}
                    onChange={(e) =>
                      setVeh("fair_opportunity", e.target.value as VehicleProfile["fair_opportunity"])
                    }
                  >
                    <option value="competed">Fair opportunity to every awardee, RFO FAR 16.507-2</option>
                    {FAIR_OPPORTUNITY_EXCEPTIONS.map((x) => (
                      <option key={x.key} value={x.key}>
                        Exception: {x.label}, {x.citation}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Clause set at award" htmlFor="veh-clauses">
                  <input
                    id="veh-clauses"
                    className={inputClass}
                    value={vehicle.clause_set}
                    onChange={(e) => setVeh("clause_set", e.target.value)}
                  />
                </Field>
              </>
            ) : null}
            {scenario.vehicle === "idiq_order" ? (
              <Field label="Parent contract number" htmlFor="scen-parent">
                <input
                  id="scen-parent"
                  className={inputClass}
                  value={scenario.parent_contract_number}
                  onChange={(e) => setScen("parent_contract_number", e.target.value)}
                />
              </Field>
            ) : null}
            <Field label="Funding and servicing" htmlFor="scen-funding">
              <select
                id="scen-funding"
                className={inputClass}
                value={scenario.funding}
                onChange={(e) => setScen("funding", e.target.value as ScenarioAnswers["funding"])}
              >
                <option value="nasa">NASA funds, NASA buys</option>
                <option value="reimbursable">Another agency funds NASA, reimbursable</option>
                <option value="assisted">NASA buys through another agency, assisted acquisition</option>
              </select>
            </Field>
            {scenario.funding !== "nasa" ? (
              <>
                <Field label="Authority" htmlFor="scen-authority">
                  <select
                    id="scen-authority"
                    className={inputClass}
                    value={scenario.reimbursable_authority}
                    onChange={(e) =>
                      setScen(
                        "reimbursable_authority",
                        e.target.value as ScenarioAnswers["reimbursable_authority"],
                      )
                    }
                  >
                    <option value="economy_act">Economy Act</option>
                    <option value="other">Other authority</option>
                  </select>
                </Field>
                <Field label="Agreement number" htmlFor="scen-agreement">
                  <input
                    id="scen-agreement"
                    className={inputClass}
                    value={scenario.agreement_number}
                    onChange={(e) => setScen("agreement_number", e.target.value)}
                  />
                </Field>
              </>
            ) : null}
            <Field label="Vendor country" htmlFor="scen-vendor-country">
              <input
                id="scen-vendor-country"
                className={inputClass}
                value={scenario.vendor_country}
                onChange={(e) => setScen("vendor_country", e.target.value)}
              />
            </Field>
            <Field label="Place of performance country" htmlFor="scen-place-country">
              <input
                id="scen-place-country"
                className={inputClass}
                value={scenario.place_country}
                onChange={(e) => setScen("place_country", e.target.value)}
              />
            </Field>
            <Field label="Deliverable" htmlFor="scen-deliverable">
              <select
                id="scen-deliverable"
                className={inputClass}
                value={scenario.deliverable}
                onChange={(e) =>
                  setScen("deliverable", e.target.value as ScenarioAnswers["deliverable"])
                }
              >
                <option value="services">Services</option>
                <option value="supplies">Supplies</option>
                <option value="construction">Construction</option>
                <option value="rd">Research and development</option>
              </select>
            </Field>
            {scenario.deliverable === "supplies" ? (
              <Field label="Are all end products domestic?" htmlFor="scen-domestic">
                <select
                  id="scen-domestic"
                  className={inputClass}
                  value={scenario.end_products_domestic}
                  onChange={(e) =>
                    setScen(
                      "end_products_domestic",
                      e.target.value as ScenarioAnswers["end_products_domestic"],
                    )
                  }
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="unknown">Unknown</option>
                </select>
              </Field>
            ) : null}
            <Field label="Commercial product or service" htmlFor="scen-commercial">
              <select
                id="scen-commercial"
                className={inputClass}
                value={scenario.commercial ? "yes" : "no"}
                onChange={(e) => setScen("commercial", e.target.value === "yes")}
              >
                <option value="yes">Yes, commercial</option>
                <option value="no">No, not commercial</option>
              </select>
            </Field>
            <Field
              label="Period of performance length"
              htmlFor="scen-pop-length"
              hint={
                facts.period_of_performance_start && facts.period_of_performance_end
                  ? popDays !== null && popDays > 1826
                    ? `${popDays} days from the dates on this record. Longer than five years.`
                    : `${popDays} days from the dates on this record.`
                  : "Enter the period of performance dates above."
              }
            >
              <input
                id="scen-pop-length"
                readOnly
                className={inputClass}
                value={popDays === null ? "Not yet computed" : `${popDays} days`}
              />
            </Field>
            {(
              [
                ["combines_requirements", "Combines requirements previously under separate contracts"],
                ["gfp", "Government-furnished property is provided"],
                ["oci_advisory", "OCI: advisory or assistance services"],
                ["oci_systems_engineering", "OCI: systems engineering"],
                ["oci_proprietary_data", "OCI: access to other contractors' proprietary data"],
                ["oci_incumbent", "OCI: incumbent"],
                ["urgency", "Unusual and compelling urgency"],
                ["precontract_costs", "Precontract costs requested"],
                ["subcontracting_plan_applies", "A subcontracting plan applies"],
                ["subcontracting_possibilities", "Subcontracting possibilities exist"],
                ["approved_plan_exists", "An approved acquisition plan or PSM exists"],
                ["approved_plan_changes", "This action changes the approved plan"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="mb-3 flex items-baseline gap-2 text-[15px]">
                <input
                  type="checkbox"
                  checked={Boolean(scenario[key])}
                  onChange={(e) => setScen(key, e.target.checked as never)}
                />
                <span>{label}</span>
              </label>
            ))}
            {scenario.urgency ? (
              <Field label="Date the need arose" htmlFor="scen-urgency-date">
                <input
                  id="scen-urgency-date"
                  type="date"
                  className={inputClass}
                  value={scenario.urgency_need_arose}
                  onChange={(e) => setScen("urgency_need_arose", e.target.value)}
                />
              </Field>
            ) : null}
            <Field label="Set-aside type" htmlFor="scen-setaside-type">
              <select
                id="scen-setaside-type"
                className={inputClass}
                value={scenario.set_aside_type}
                onChange={(e) => setScen("set_aside_type", e.target.value)}
              >
                <option value="">Follow the set-aside above</option>
                <option value="Total small business set-aside">Total small business set-aside</option>
                <option value="8(a) sole source">8(a) sole source</option>
                <option value="8(a) competitive">8(a) competitive</option>
                <option value="HUBZone">HUBZone</option>
                <option value="Service-disabled veteran-owned">Service-disabled veteran-owned</option>
                <option value="Women-owned small business">Women-owned small business</option>
              </select>
            </Field>
            <Field label="Collective bargaining agreement covers the incumbent workforce" htmlFor="scen-cba">
              <select
                id="scen-cba"
                className={inputClass}
                value={scenario.cba}
                onChange={(e) => setScen("cba", e.target.value as ScenarioAnswers["cba"])}
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
          </div>
        </fieldset>

        <fieldset className="mt-2">
          <legend className="mb-2 text-[13px] text-muted-foreground">Attachments and conditions</legend>
          {(
            [
              ["igce_attached", "IGCE", "Supports the independent cost estimate and package-complete gate."],
              ["sow_attached", "SOW/PWS", "Defines what will be bought and feeds the package-complete gate."],
              ["pr", "Purchase request", "The requesting organization's purchase request."],
              ["nf-1707", "NF 1707 from the requester", "The signed intake form as received."],
            ] as const
          ).map(([key, label, why]) => {
            const staged = docFiles[key] ?? null;
            return (
              <div key={key} className="mb-2 flex flex-wrap items-baseline gap-3 text-[15px]" title={why}>
                <span>{label}</span>
                {staged ? (
                  <>
                    <span className="text-[13px] text-muted-foreground">{staged.name}</span>
                    <button type="button" className="text-[13px] text-primary" onClick={() => removeStaged(key)}>
                      Remove
                    </button>
                  </>
                ) : key === "pr" && facts.pr_number.trim() ? (
                  <>
                    <span className="text-[13px] text-muted-foreground">PR {facts.pr_number.trim()} recorded; copy not attached</span>
                    <label className="cursor-pointer text-[13px] text-primary">
                      Attach
                      <input
                        type="file"
                        className="sr-only"
                        accept={ATTACHMENT_ACCEPT}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void stageFile(key, file);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <StatusMark color="var(--atrisk)" className="text-[13px]">Missing</StatusMark>
                    <label className="cursor-pointer text-[13px] text-primary">
                      Attach
                      <input
                        type="file"
                        className="sr-only"
                        accept={ATTACHMENT_ACCEPT}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void stageFile(key, file);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </>
                )}
                {key === "igce_attached" && igceNote ? (
                  <span className="block w-full text-[13px] text-muted-foreground">{igceNote}</span>
                ) : null}
              </div>
            );
          })}
          {(
            [
              ["funds_certified", "Funds certified", "Confirms funding and feeds the package-complete gate."],
              ["hardware_deliverable", "Hardware deliverable", "Activates hardware-specific requirements."],
              ["right_to_repair_statement", "Right to Repair statement included", "Required when the acquisition delivers hardware."],
              ["includes_it", "Includes information technology", "Activates IT review requirements."],
              ["cio_review_flagged", "CIO review flagged", "Records that required IT review is planned."],
              ["acquisition_forecast_verified", "Acquisition Forecast verified", "Confirms the forecast entry was checked."],
            ] as const
          ).map(([key, label, why]) => (
            <label key={key} className="mb-2 flex items-center gap-2 text-[15px]" title={why}>
              <input
                type="checkbox"
                checked={facts[key] as boolean}
                onChange={(e) => set(key, e.target.checked as never)}
              />
              {label}
            </label>
          ))}
        </fieldset>
      </section>

      <Nf1707Intake
        answers={answers}
        setAnswers={setAnswers}
        fields={fields.filter((field) => visibleForCenter(field, facts.center_code))}
        facts={facts}
        evmThreshold={Number(data.data?.ref.thresholds.find((threshold) => threshold.name === "Earned value management system applicability")?.value ?? 50_000_000)}
      />
      </DemoFieldset>


      {/* Red-flag scan and submit */}
      <section id="intake-scan" className="mc-work-form-section scroll-mt-24">
        <h2 className="mc-intake-scan-title">Red-flag scan and start</h2>
        <p className="mc-intake-note mb-3">
          The scan checks this intake against the rules before anything is saved. Run it from the bar at the
          bottom of the screen{scan ? "; run it again after any change" : ""}.
        </p>

        {touched && errorCount > 0 ? (
          <div className="mb-4" role="alert">
            <p className="text-[15px]" style={{ color: "var(--atrisk)" }}>
              {errorCount} field{errorCount === 1 ? "" : "s"} need attention above. The scan and the
              clock wait until they are fixed.
            </p>
            <ul className="mt-2 text-[13px]">
              {Object.entries(errors).map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div id="intake-scan-results" className="scroll-mt-24" tabIndex={-1}>
        {scan && data.data && intakePlan ? (
            <div className="mc-work-summary mt-6 max-w-[80ch]">
            <h2 className="text-[18px] leading-6 font-medium">Expected effort and time to award</h2>
            <p className="mt-2 text-[15px] leading-[22px]" data-numeric>
              {intakePlan.plannedDays > 0
                ? `The phase plan for this kind of buy runs ${intakePlan.plannedDays} calendar days from intake to award, through ${intakePlan.phases.length} phases, with about ${intakeEstimate?.hours.total.toLocaleString("en-US")} hours of contracting work.`
                : `No phase plan is seeded for this kind of buy. The estimate is about ${intakeEstimate?.hours.total.toLocaleString("en-US")} hours of contracting work.`}{" "}
              If you need it sooner, talk to your contracting officer now.
            </p>
            <ul className="mt-2 space-y-1 text-[14px] leading-[20px] text-[var(--mc-meta-ink)]">
              <li data-numeric>
                Phase plan: {intakePlan.plannedDays} calendar days to award. The file page counts the same days once
                the clock starts.
              </li>
              {needDateDays !== null && needDateDays !== intakePlan.plannedDays ? (
                <li data-numeric>
                  The need-date check counts {needDateDays} days, to the award decision itself, without the reporting
                  that follows award.
                </li>
              ) : null}
              <li data-numeric>
                Contracting hours (estimate): {intakeEstimate?.hours.total.toLocaleString("en-US")} (specialist{" "}
                {intakeEstimate?.hours.cs.toLocaleString("en-US")}, officer{" "}
                {intakeEstimate?.hours.co.toLocaleString("en-US")}).
              </li>
              <li>Phases to award: {intakePlan.phases.join(" · ")}</li>
            </ul>
            <p className="mt-2 text-[13px] text-[var(--mc-meta-ink)]">
              The hours estimate is stored on the record as the estimate at intake when the clock starts.
            </p>
          </div>
        ) : null}

        {scan ? (
          <div className="mc-work-summary mt-6">
            <h2 className="text-[18px] leading-6 font-medium">
              {scan.length === 0
                ? "No red flags. The file is ready."
                : `${scan.length} red flag${scan.length === 1 ? "" : "s"} found`}
            </h2>
            <ul className="mt-4">
              {scan.map((f) => (
                <li
                  key={f.id}
                  className="mb-4 border-l-2 pl-3"
                  style={{ borderColor: f.blocking ? "var(--atrisk)" : "var(--attention)" }}
                >
                  <p className="text-[15px] font-medium">
                    {f.blocking ? "Blocking" : "Needs attention"}: {f.title}
                  </p>
                  <p className="text-[15px] text-muted-foreground">{f.detail}</p>
                  {f.citation ? (
                    <p className="text-[13px] text-muted-foreground">{f.citation}</p>
                  ) : null}
                  <p className="mt-1">
                    <ExplainThis explanation={explainRedFlag(f)} />
                  </p>
                </li>
              ))}
            </ul>

            {saveError ? (
              <p className="mb-4 text-[15px]" style={{ color: "var(--atrisk)" }} role="alert">
                {saveError}
              </p>
            ) : null}

            {readOnly ? null : <button
              type="button"
              disabled={blocking.length > 0 || saving}
              onClick={() => void startTheClock()}
              className="bg-primary px-4 py-2 text-[15px] text-primary-foreground disabled:opacity-50 [border-radius:var(--mc-radius-control)]"
            >
              {saving ? "Starting" : "Start the clock"}
            </button>}
            {blocking.length > 0 ? (
              <p className="mt-2 text-[13px] text-muted-foreground">
                Clear the {blocking.length} blocking flag{blocking.length === 1 ? "" : "s"} above to
                start the clock.
              </p>
            ) : null}
          </div>
        ) : null}
        </div>
      </section>

      {/* Save state: the intake lives only on this screen until the clock starts. */}
      <div className="mc-intake-savebar" role="region" aria-label="Save state">
        <p className="mc-intake-savebar-text">
          <span className="font-medium">Not saved yet.</span>{" "}
          <span className="mc-intake-savebar-long">Nothing is stored until you start the clock.</span>
          <span className="mc-intake-savebar-meta" data-numeric>
            {nfAnswered} of {nfSections.length} NF 1707 sections answered · Package {packageComplete ? "complete" : "incomplete"}
            {scan !== null ? ` · Scan: ${scanStatus.label.toLowerCase()}` : ""}
          </span>
        </p>
        <button type="button" onClick={scanAndShow} className="mc-intake-button is-primary">
          {scan === null ? "Run the red-flag scan" : "Scan again"}
        </button>
      </div>
      </div>

      <aside className="mc-intake-rail" aria-label="Intake progress">
        <p className="mc-intake-rail-title">Your progress</p>
        <ol className="mc-intake-steps">
          <li>
            <button type="button" onClick={() => goTo("intake-package")}>
              <span>Requester package draft</span>
              <span className="mc-intake-step-meta">Optional upload</span>
            </button>
          </li>
          <li>
            <button type="button" onClick={() => goTo("intake-record")}>
              <span>T-Minus record</span>
              <StatusChip label={packageComplete ? "Complete" : "Incomplete"} tone={packageComplete ? "ontrack" : "attention"} />
            </button>
          </li>
          <li>
            <button type="button" onClick={() => goTo("nf1707-title")}>
              <span>NF 1707 questions</span>
              <span className="mc-intake-step-meta" data-numeric>{nfAnswered} of {nfSections.length}</span>
            </button>
            <ol className="mc-intake-sections">
              {nfSections.map((section) => (
                <li key={section.key}>
                  <button type="button" onClick={() => goTo(`nf-section-${section.key}`)} aria-label={`Section ${section.key}, ${section.title}: ${section.answered ? "answered" : "not answered"}`}>
                    <span className={section.answered ? "mc-intake-dot is-done" : "mc-intake-dot"} aria-hidden="true" />
                    <span className="min-w-0">{section.key}. {section.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </li>
          <li>
            <button type="button" onClick={() => goTo("intake-scan")} aria-label={`Go to Red-flag scan and start: ${scanStatus.label}`}>
              <span>Red-flag scan and start</span>
              <StatusChip label={scanStatus.label} tone={scanStatus.tone} />
            </button>
          </li>
        </ol>
        {touched && errorCount > 0 ? (
          <p className="mc-intake-rail-alert" data-numeric>
            {errorCount} field{errorCount === 1 ? "" : "s"} need attention.
          </p>
        ) : null}
      </aside>
      </div>
    </AppShell>
  );
}
