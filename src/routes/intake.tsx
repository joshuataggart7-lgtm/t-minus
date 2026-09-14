import { useServerFn } from "@tanstack/react-start";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";
import { lookupPlaceOfPerformance, type PlaceLookup } from "@/lib/place-of-performance.functions";
import {
  SECTION_GROUPS,
  answerKey,
  fieldLabel,
  isStructuralField,
  isTriState,
  parseItems,
  TRISTATE_LABELS,
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
  scanRedFlags,
  todayISO,
  type IntakeFacts,
  type RedFlag,
  type RefData,
} from "@/lib/intake";
import { estimate, inputsFromFacts, toStored } from "@/lib/estimator";
import { ExplainThis } from "@/components/explain-this";
import { explainRedFlag } from "@/lib/explain";

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

const RECORDED_SECTION_NAMES: Record<string, string> = {
  Section1: "Section 1. Strategic sourcing",
  Section2: "Section 2. Section 508 and information technology",
  Section3: "Section 3. Environmental",
  Section4: "Section 4. Service contracting",
  Section5_I: "Section 5.I. Space flight hardware and software",
  Section5_II: "Section 5.II. SCaN and radio frequency",
  Section5_III: "Section 5.III. Earned value management",
  Section5_IV: "Section 5.IV. Communications",
  Section5_V: "Section 5.V. Aviation",
  Section5_VI: "Section 5.VI. Software",
  Section5_VII: "Section 5.VII. Sensitive and controlled items",
  Section6: "Section 6. Quality assurance",
  Section7: "Section 7. Safety and health",
  Section8: "Section 8. Property management",
  Section9: "Section 9. Center-specific approvals",
  Section10: "Section 10. Foreign travel briefings",
  Section11: "Section 11. Extraneous items",
  Section12: "Section 12. Signatures and affirmations",
};

function recordedAnswerLabel(key: string) {
  const section = Object.keys(RECORDED_SECTION_NAMES)
    .sort((a, b) => b.length - a.length)
    .find((prefix) => key === prefix || key.startsWith(`${prefix}_`));
  return section ? RECORDED_SECTION_NAMES[section] : key.replaceAll("_", " ");
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
      <label htmlFor={htmlFor} className="block text-[13px] text-muted-foreground">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {hint ? <p className="mt-1 text-[13px] text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p className="mt-1 text-[13px]" style={{ color: "var(--atrisk)" }} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-[15px] text-foreground";

function IntakePage() {
  const { user, role, authState, profile } = useRole();
  const navigate = useNavigate();
  const data = useRefData(authState === "signed-in");

  const [facts, setFacts] = useState<IntakeFacts>({
    ...EMPTY_FACTS,
    requester_name: user.name,
    center_code: user.center_code,
    center_name: CENTERS.find(([code]) => code === user.center_code)?.[1] ?? "Other",
  });
  const [answers, setAnswers] = useState<Answers>({});
  const [carried, setCarried] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const [scan, setScan] = useState<RedFlag[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
    (row) => row.acquisition_method === facts.acquisition_method && row.competition_type === facts.competition,
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
    const { data: row } = await supabase
      .from("acquisition_facts")
      .select("*")
      .eq("acquisition_id", acquisitionId)
      .maybeSingle();
    if (!row) return;
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
      acquisition_method: /13\.5/.test(row.acquisition_method ?? "")
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
      // The sample arrives with the IGCE still missing: that is the demo flag.
      igce_attached: acquisitionId === "A-2027-0101" ? false : !!row.igce_attached,
      sow_attached: !!row.sow_attached,
      hardware_deliverable: !!row.hardware_deliverable,
      includes_it: !!row.includes_it,
      acquisition_forecast_verified: !!row.acquisition_forecast_verified,
    }));
    const carriedAnswers = (row.nf1707_answers ?? {}) as Record<string, string>;
    setCarried(carriedAnswers);
    const seeded: Answers = {};
    const aviation = carriedAnswers["Section5_V_aviation"] ?? "";
    if (/yes/i.test(aviation)) seeded["Section5s5.Section5s5.S5Vn2"] = "1";
    setAnswers(seeded);
    setScan(null);
  }

  async function addProject() {
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
    setScan(scanRedFlags(facts, data.data!.ref));
  }

  async function startTheClock() {
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
      const est = estimate(inputsFromFacts(facts), data.data!.ref);
      const stored = toStored(est);

      const payload = {
        acquisition_id: next,
        mission_id: facts.mission_id || null,
        successor_of: facts.successor_of || null,
        title: facts.title,
        center_code: facts.center_code,
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
        acquisition_method: facts.acquisition_method,
        competition: facts.competition,
        set_aside: facts.set_aside || null,
        jofoc_authority_citation: facts.jofoc_authority_citation || null,
        funding_fiscal_year: facts.funding_fiscal_year || null,
        funds_certified: facts.funds_certified,
        igce_attached: facts.igce_attached,
        sow_attached: facts.sow_attached,
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
        nf1707_answers: { ...carried, ...answers },
        intake_estimate: stored,
      };

      const { error } = await supabase.from("acquisition_facts").insert(payload);
      if (error) throw error;

      await supabase.from("audit_log").insert([
        {
          acquisition_id: next,
          actor: user.name,
          action: "Intake submitted; clock started",
          field: "clock_state",
          old_value: null,
          new_value: "running",
          reason: "NF 1707 intake submitted and red-flag scan cleared",
        },
        {
          acquisition_id: next,
          actor: user.name,
          action: "Target award date set",
          field: "target_award_date",
          old_value: null,
          new_value: target,
          reason: `Need date ${facts.need_date} minus ${lead} days to delivery`,
        },
        {
          acquisition_id: next,
          actor: user.name,
          action: "Intake estimate recorded",
          field: "intake_estimate",
          old_value: null,
          new_value: `${est.monthsToAward} months to award; ${est.phases.length} phases; ${est.hours.total} contracting hours`,
          reason:
            "LOE Estimator model run against the intake answers (value, competition, pricing, instrument, requirement type)",
        },
      ]);

      navigate({ to: "/intake/$acquisitionId", params: { acquisitionId: next } });
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

  if (role === "executive") {
    return (
      <AppShell>
        <PageHeader title="Intake" lead="Executives have read-only access. Switch roles to submit an intake." />
      </AppShell>
    );
  }

  const value = parseMoney(facts.estimated_value);
  const blocking = scan?.filter((f) => f.blocking) ?? [];

  return (
    <AppShell>
      <PageHeader
        title="Intake: NF 1707"
        lead="Enter the acquisition once. Every document, check, and record reads from this file."
      />

      <div className="mb-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => void loadSample()}
          className="rounded-lg border border-border bg-background px-3 py-2 text-[14px] text-primary"
        >
          Load the Commercial Aviation Services sample
        </button>
        <span className="text-[13px] text-muted-foreground">
          Sample A-2027-0101 loads with the IGCE still missing.
        </span>
      </div>

      {/* T-Minus section: the facts the paper form does not carry. */}
      <section className="mb-10 border-t border-border pt-6">
        <h2 className="mb-4 text-[18px] leading-6 font-medium">T-Minus record</h2>
        <div className="grid gap-x-8 md:grid-cols-2">
          <Field label="Center" htmlFor="center" error={err("center_code")}>
            <select
              id="center"
              className={inputClass}
              value={facts.center_code}
              onChange={(e) => set("center_code", e.target.value)}
            >
              {(data.data?.centers ?? []).map((center) => (
                <option key={center.center_code} value={center.center_code}>
                  {center.center_code} — {center.center_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Branch" htmlFor="branch">
            <select
              id="branch"
              className={inputClass}
              value={facts.branch_code}
              onChange={(e) => set("branch_code", e.target.value)}
            >
              <option value="">Choose a branch</option>
              {branches.map((branch) => (
                <option key={branch.branch_code} value={branch.branch_code}>
                  {branch.branch_code} — {branch.branch_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title of the requirement" htmlFor="title" error={err("title")}>
            <input
              id="title"
              className={inputClass}
              value={facts.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </Field>
          <Field label="Mission supported" htmlFor="mission" error={err("mission_id")}>
            <select
              id="mission"
              className={inputClass}
              value={facts.mission_id}
              onChange={(e) => set("mission_id", e.target.value)}
            >
              <option value="">Choose a mission</option>
              {(data.data?.missions ?? []).map((m) => (
                <option key={m.mission_id} value={m.mission_id}>
                  {m.name} — needs {m.milestone_date}
                </option>
              ))}
            </select>
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
              {(data.data?.priorFiles ?? []).map((f) => (
                <option key={f.acquisition_id} value={f.acquisition_id}>
                  {f.acquisition_id} — {f.title ?? "Untitled"}
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
              onChange={(e) => set("psc_code", e.target.value.toUpperCase())}
            />
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
                  {c}
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
          <Field label="Authority for other than full and open competition" htmlFor="jofoc">
            <input
              id="jofoc"
              className={inputClass}
              value={facts.jofoc_authority_citation}
              onChange={(e) => set("jofoc_authority_citation", e.target.value)}
            />
          </Field>
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
            <input
              id="psl"
              className={inputClass}
              value={facts.enterprise_psl_check}
              onChange={(e) => set("enterprise_psl_check", e.target.value)}
            />
          </Field>
        </div>

        <fieldset className="mt-2">
          <legend className="mb-2 text-[13px] text-muted-foreground">Attachments and conditions</legend>
          {(
            [
              ["igce_attached", "IGCE attached"],
              ["sow_attached", "SOW or PWS attached"],
              ["funds_certified", "Funds certified for the full period of performance"],
              ["hardware_deliverable", "Hardware deliverable"],
              ["right_to_repair_statement", "Right to Repair requirements statement included"],
              ["includes_it", "Includes information technology"],
              ["cio_review_flagged", "CIO review flagged"],
              ["acquisition_forecast_verified", "Acquisition Forecast verified"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="mb-2 flex items-center gap-2 text-[15px]">
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

      {/* The NF 1707 itself, rendered from the complete field export. */}
      {SECTION_GROUPS.map((group) => {
        const groupFields = fields
          .filter((f) => group.raw.includes(f.section ?? ""))
          .filter((f) => visibleForCenter(f, facts.center_code))
          .filter((f) => !/^(ServerName|ServerURL)$/i.test(f.field_name ?? ""));
        if (!groupFields.length) return null;
        const parts = group.parts ?? group.raw.map((raw) => ({ raw, title: "" }));
        return (
          <section key={group.key} className="mb-10 border-t border-border pt-6">
            <h2 className="mb-4 text-[18px] leading-6 font-medium">{group.title}</h2>
            {parts.map((part) => {
              const partFields = groupFields.filter((f) => f.section === part.raw);
              if (!partFields.length) return null;
              return (
                <div key={part.raw} className="mb-6">
                  {part.title ? <h3 className="mb-3 text-[15px] font-medium">{part.title}</h3> : null}
                  {partFields.map((f) => {
                    const key = answerKey(f);
                    const id = `f-${f.field_id}`;
                    const label = fieldLabel(f);
                    const items = parseItems(f.choice_items);
                    const answerable = (f.is_answerable ?? "").toLowerCase() === "yes";

                    if (!answerable || isStructuralField(f)) {
                      const instruction = f.nearest_form_text_full?.trim() || f.caption_full?.trim();
                      return instruction ? (
                        <p key={key} className="mb-3 max-w-[80ch] text-[15px] leading-[22px] text-muted-foreground">
                          {instruction}
                        </p>
                      ) : null;
                    }

                    if ((f.field_kind === "checkButton" || f.field_kind === "radioGroup") && isTriState(f.choice_items)) {
                      return (
                        <fieldset key={key} className="mb-4">
                          <legend className="max-w-[80ch] text-[15px] leading-[22px]">{label}</legend>
                          <div className="mt-2 flex flex-wrap gap-4">
                            {TRISTATE_LABELS.map((opt) => (
                              <label key={opt.value} className="flex items-center gap-2 text-[14px]">
                                <input
                                  type="radio"
                                  name={key}
                                  value={opt.value}
                                  checked={answers[key] === opt.value}
                                  onChange={() => setAnswers((current) => ({ ...current, [key]: opt.value }))}
                                />
                                {opt.label}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      );
                    }

                    if (f.field_kind === "choiceList" && items) {
                      return (
                        <Field key={key} label={label} htmlFor={id}>
                          <select
                            id={id}
                            className={inputClass}
                            value={answers[key] ?? ""}
                            onChange={(e) => setAnswers((current) => ({ ...current, [key]: e.target.value }))}
                          >
                            <option value="">Choose one</option>
                            {items.filter(Boolean).map((item) => (
                              <option key={item} value={item}>{item}</option>
                            ))}
                          </select>
                        </Field>
                      );
                    }

                    if (f.field_kind === "button") return null;
                    return (
                      <Field
                        key={key}
                        label={f.field_kind === "signature" ? `${label} (typed name)` : label}
                        htmlFor={id}
                      >
                        <input
                          id={id}
                          type={f.field_kind === "dateTimeEdit" ? "date" : "text"}
                          className={inputClass}
                          value={answers[key] ?? ""}
                          onChange={(e) => setAnswers((current) => ({ ...current, [key]: e.target.value }))}
                        />
                      </Field>
                    );
                  })}
                </div>
              );
            })}
          </section>
        );
      })}

      {Object.keys(carried).length ? (
        <section className="mb-10 border-t border-border pt-6">
          <h2 className="mb-4 text-[18px] leading-6 font-medium">Recorded answers</h2>
          <dl className="max-w-[80ch]">
            {Object.entries(carried).map(([k, v]) => (
              <div key={k} className="mb-3">
                <dt className="text-[13px] text-muted-foreground">{recordedAnswerLabel(k)}</dt>
                <dd className="text-[15px]">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/* Red-flag scan and submit */}
      <section className="border-t border-border pt-6">
        {touched && errorCount > 0 ? (
          <p className="mb-4 text-[15px]" style={{ color: "var(--atrisk)" }} role="alert">
            {errorCount} field{errorCount === 1 ? "" : "s"} need attention above. Fix them, then run
            the scan again.
          </p>
        ) : null}

        <button
          type="button"
          onClick={runScan}
          className="rounded-lg border border-border bg-background px-4 py-2 text-[15px] text-primary"
        >
          Run the red-flag scan
        </button>

        {scan ? (
          <div className="mt-6 rounded-lg border border-border bg-background p-6">
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
                    {f.blocking ? "At Risk" : "Needs attention"}: {f.title}
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

            <button
              type="button"
              disabled={blocking.length > 0 || saving}
              onClick={() => void startTheClock()}
              className="rounded-lg bg-primary px-4 py-2 text-[15px] text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Starting" : "Start the clock"}
            </button>
            {blocking.length > 0 ? (
              <p className="mt-2 text-[13px] text-muted-foreground">
                Clear the {blocking.length} blocking flag{blocking.length === 1 ? "" : "s"} above to
                start the clock.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
