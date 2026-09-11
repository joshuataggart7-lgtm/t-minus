import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

/**
 * E24. Set-aside evidence assistant.
 *
 * On Market Research, for the record's NAICS and place of performance, this
 * pulls SAM.gov registered entities with their small business flag for that
 * NAICS, plus recent subaward history for the same NAICS, and assembles the
 * Rule of Two evidence (FAR 19.502-2). It suggests a set-aside decision; the
 * contracting officer confirms it. Nothing is decided automatically. When
 * SAM.gov cannot be reached, clearly labeled sample data is shown so the
 * demonstration never depends on the network.
 */

const inputSchema = z.object({
  acquisitionId: z.string().trim().min(1).max(40),
  simulateFailure: z.boolean().optional(),
});

export type SetAsideEntity = {
  legalName: string;
  uei: string;
  cage: string;
  state: string;
  registrationStatus: string;
  smallBusiness: boolean | null;
  smallBusinessLabel: string;
  socioeconomic: string;
};

export type SetAsideSubaward = {
  primeName: string;
  subName: string;
  subLocation: string;
  amount: number | null;
  actionDate: string;
};

export type SetAsideEvidence = {
  acquisitionId: string;
  naicsCode: string;
  placeOfPerformance: string;
  stateCode: string | null;
  estimatedValue: number | null;
  currentSetAside: string;
  entities: SetAsideEntity[];
  entitiesSource: "live" | "cached" | "sample";
  entitiesSourceLabel: string;
  subawards: SetAsideSubaward[];
  subawardsSource: "live" | "cached" | "sample";
  subawardsSourceLabel: string;
  smallBusinessCount: number;
  ruleOfTwoMet: boolean;
  simplifiedThreshold: number | null;
  simplifiedThresholdCitation: string;
  suggestedDecision: string;
  suggestionReason: string;
  citations: { citation: string; tier: string; note: string }[];
  checkedAt: string;
  providerError?: string;
};

type JsonRecord = Record<string, unknown>;
const object = (value: unknown): JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (...values: unknown[]) => {
  const found = values.find((value) => typeof value === "string" && value.trim());
  return typeof found === "string" ? found : "—";
};
const numberOrNull = (value: unknown) => {
  const n = Number(typeof value === "string" ? value.replace(/[$,]/g, "") : value);
  return Number.isFinite(n) ? n : null;
};

/** "Fairbanks, AK" or "Moffett Field, CA 94035" yields "AK" / "CA". */
export function stateFromPlace(place: string | null): string | null {
  if (!place) return null;
  const match = place.toUpperCase().match(/\b([A-Z]{2})\b(?!.*\b[A-Z]{2}\b)/);
  return match?.[1] ?? null;
}

function entitiesFromRaw(raw: unknown, naicsCode: string): SetAsideEntity[] {
  const root = object(raw);
  const rows = array(root["entityData"] ?? root["entities"] ?? root["data"]).map(object);
  return rows.slice(0, 25).map((row) => {
    const registration = object(row["entityRegistration"]);
    const core = object(row["coreData"]);
    const address = object(core["physicalAddress"]);
    const assertions = object(row["assertions"]);
    const naicsList = array(object(assertions["goodsAndServices"])["naicsList"] ?? assertions["naicsList"]).map(object);
    const match = naicsList.find((n) => text(n["naicsCode"], n["naics"]) === naicsCode) ?? naicsList[0];
    // SAM.gov reports the SBA size status per NAICS as sbaSmallBusiness:
    // "Y" small, "N" other than small, "E" small under a NAICS exception.
    const flag = text(match?.["sbaSmallBusiness"], match?.["isSmallBusiness"], match?.["smallBusiness"]);
    const small = flag === "Y" || flag === "E" ? true : flag === "N" ? false : null;
    const businessTypes = object(core["businessTypes"]);
    const codes = array(businessTypes["businessTypeList"])
      .map(object)
      .map((b) => text(b["businessTypeDesc"], b["businessTypeCode"]))
      .filter((v) => v !== "—");
    return {
      legalName: text(registration["legalBusinessName"], core["legalBusinessName"]),
      uei: text(registration["ueiSAM"], core["ueiSAM"]),
      cage: text(core["cageCode"], registration["cageCode"]),
      state: text(address["stateOrProvinceCode"], address["state"]),
      registrationStatus: text(registration["registrationStatus"]),
      smallBusiness: small,
      smallBusinessLabel:
        small === true
          ? flag === "E"
            ? "Small business (NAICS exception)"
            : "Small business"
          : small === false
            ? "Other than small business"
            : "Not reported",
      socioeconomic: codes.length ? codes.join(", ") : "Not reported",
    };
  });
}

function subawardsFromRaw(raw: unknown): SetAsideSubaward[] {
  const root = object(raw);
  const rows = array(root["subawards"] ?? root["data"] ?? root["results"]).map(object);
  return rows.slice(0, 10).map((row) => ({
    primeName: text(row["primeAwardeeName"], row["primeEntityName"], row["primeName"]),
    subName: text(row["subAwardeeName"], row["subEntityName"], row["subawardeeName"]),
    subLocation: text(row["subAwardeeCity"], row["subEntityCity"], row["subLocation"]),
    amount: numberOrNull(row["subAwardAmount"] ?? row["subawardAmount"] ?? row["amount"]),
    actionDate: text(row["subAwardDate"], row["subawardActionDate"], row["actionDate"]),
  }));
}

/** Fictional registered entities, clearly labeled, used when SAM.gov is unreachable. */
function sampleEntities(naics: string, state: string | null) {
  const st = state ?? "CA";
  const make = (name: string, uei: string, cage: string, small: string, types: string[]) => ({
    entityRegistration: { legalBusinessName: name, ueiSAM: uei, registrationStatus: "Active — sample" },
    coreData: {
      cageCode: cage,
      physicalAddress: { stateOrProvinceCode: st },
      businessTypes: { businessTypeList: types.map((t) => ({ businessTypeDesc: t })) },
    },
    assertions: { goodsAndServices: { naicsList: [{ naicsCode: naics, isSmallBusiness: small }] } },
  });
  return {
    sample: true,
    entityData: [
      make("Cascade Rotor Maintenance Inc (fictional)", "DEMOSB000A1", "7C221", "Y", ["Small business", "Woman owned small business"]),
      make("Highland Avionics Services LLC (fictional)", "DEMOSB000B2", "8D114", "Y", ["Small business", "Service disabled veteran owned"]),
      make("Tule Field Logistics LLC (fictional)", "DEMOSB000C3", "9F007", "Y", ["Small business", "HUBZone"]),
      make("Meridian Flight Sciences LLC (fictional)", "DEMOLG000D4", "4K902", "N", ["Other than small business"]),
    ],
  };
}

function sampleSubawards(naics: string) {
  return {
    sample: true,
    naicsCode: naics,
    subawards: [
      {
        primeAwardeeName: "Meridian Flight Sciences LLC (fictional)",
        subAwardeeName: "Cascade Rotor Maintenance Inc (fictional)",
        subAwardeeCity: "Bakersfield, CA",
        subAwardAmount: 240000,
        subAwardDate: "2026-04-02",
      },
      {
        primeAwardeeName: "Meridian Flight Sciences LLC (fictional)",
        subAwardeeName: "Highland Avionics Services LLC (fictional)",
        subAwardeeCity: "Boise, ID",
        subAwardAmount: 118500,
        subAwardDate: "2026-01-19",
      },
    ],
  };
}

export const runSetAsideEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<SetAsideEvidence> => {
    const { data: me, error: meError } = await context.supabase
      .from("users")
      .select("name,role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (meError) throw new Error(meError.message);
    if (!me || !["specialist", "reviewer", "hq"].includes(me.role)) {
      throw new Error("Set-aside evidence is available to contracting, reviewer, and HQ roles.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const acq = await supabaseAdmin
      .from("acquisition_facts")
      .select(
        "acquisition_id,naics_code,place_of_performance,place_of_performance_standardized,estimated_value,set_aside",
      )
      .eq("acquisition_id", data.acquisitionId)
      .maybeSingle();
    if (acq.error) throw new Error(acq.error.message);
    if (!acq.data) throw new Error("The acquisition was not found.");

    const naics = (acq.data.naics_code ?? "").trim();
    if (!naics) throw new Error("This record has no NAICS code, so the search cannot run. Add one on the intake.");
    const place = acq.data.place_of_performance_standardized ?? acq.data.place_of_performance ?? null;
    const stateCode = stateFromPlace(place);
    const checkedAt = new Date().toISOString();
    const apiKey = process.env['SAM_GOV_API_KEY']?.trim();
    console.log(`[SAM.gov set-aside] key present: ${Boolean(apiKey)}; length: ${apiKey?.length ?? 0}`);

    async function pull(
      label: string,
      build: (key: string) => URL,
      parse: (raw: unknown) => unknown[],
      sample: () => unknown,
    ): Promise<{ raw: unknown; source: "live" | "cached" | "sample"; error: string }> {
      let providerError = "";
      try {
        if (data.simulateFailure) throw new Error("Simulated network failure");
        if (!apiKey) throw new Error("The SAM.gov API key has not been configured.");
        const url = build(apiKey);
        const redacted = url.toString().replace(encodeURIComponent(apiKey), "REDACTED").replace(apiKey, "REDACTED");
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) {
          const body = (await response.text()).slice(0, 300);
          throw new Error(`api.sam.gov responded ${response.status} for GET ${redacted}. Body: ${body || "(empty)"}`);
        }
        const raw = await response.json();
        if (!parse(raw).length) throw new Error(`SAM.gov returned no ${label} records for NAICS ${naics}.`);
        return { raw, source: "live", error: "" };
      } catch (error) {
        providerError = error instanceof Error ? error.message : `The ${label} lookup failed.`;
        console.error(`[SAM.gov set-aside] ${providerError}`);
        const cached = await supabaseAdmin
          .from("sam_checks")
          .select("response_json,checked_at")
          .eq("check_type", `Set-aside ${label} ${naics}${stateCode ? ` ${stateCode}` : ""}`)
          .order("checked_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const envelope = object(cached.data?.response_json);
        const cachedRaw = envelope["raw"];
        if (!cached.error && cachedRaw && parse(cachedRaw).length && envelope["source"] !== "sample") {
          return { raw: cachedRaw, source: "cached", error: providerError };
        }
        return { raw: sample(), source: "sample", error: providerError };
      }
    }

    const entityPull = await pull(
      "entities",
      (key) => {
        const url = new URL("https://api.sam.gov/entity-information/v3/entities");
        url.searchParams.set("api_key", key);
        url.searchParams.set("naicsCode", naics);
        url.searchParams.set("registrationStatus", "A");
        if (stateCode) url.searchParams.set("physicalAddressProvinceOrStateCode", stateCode);
        url.searchParams.set("includeSections", "entityRegistration,coreData,assertions");
        return url;
      },
      (raw) => entitiesFromRaw(raw, naics),
      () => sampleEntities(naics, stateCode),
    );

    const subawardPull = await pull(
      "subawards",
      (key) => {
        const url = new URL("https://api.sam.gov/prod/federalcontractawards/subawards/v1/search");
        url.searchParams.set("api_key", key);
        url.searchParams.set("naicsCode", naics);
        url.searchParams.set("limit", "10");
        return url;
      },
      (raw) => subawardsFromRaw(raw),
      () => sampleSubawards(naics),
    );

    const entities = entitiesFromRaw(entityPull.raw, naics);
    const subawards = subawardsFromRaw(subawardPull.raw);
    const smallBusinessCount = entities.filter((e) => e.smallBusiness === true).length;
    const ruleOfTwoMet = smallBusinessCount >= 2;

    const thresholds = await supabaseAdmin
      .from("thresholds")
      .select("name,value,citation,superseded_date")
      .ilike("name", "%simplified acquisition%");
    const sat =
      (thresholds.data ?? []).find((t) => !t.superseded_date && (t.name ?? "").toLowerCase().includes("simplified")) ??
      null;
    const satValue = sat?.value === null || sat?.value === undefined ? null : Number(sat.value);
    const value = acq.data.estimated_value === null ? null : Number(acq.data.estimated_value);

    const aboveMicro = value !== null && satValue !== null && value > satValue;
    const suggestedDecision = ruleOfTwoMet
      ? aboveMicro
        ? "Total small business set-aside"
        : "Set aside for small business (reserved below the simplified acquisition threshold)"
      : "No set-aside; proceed unrestricted and document the market research";
    const suggestionReason = ruleOfTwoMet
      ? `${smallBusinessCount} registered small businesses appear under NAICS ${naics}${stateCode ? ` in ${stateCode}` : ""}, so there is a reasonable expectation of offers from two or more.`
      : `${smallBusinessCount} registered small business${smallBusinessCount === 1 ? "" : "es"} appear under NAICS ${naics}${stateCode ? ` in ${stateCode}` : ""}, which does not meet the Rule of Two.`;

    const view: SetAsideEvidence = {
      acquisitionId: acq.data.acquisition_id,
      naicsCode: naics,
      placeOfPerformance: place ?? "Not recorded",
      stateCode,
      estimatedValue: value,
      currentSetAside: acq.data.set_aside ?? "Not recorded",
      entities,
      entitiesSource: entityPull.source,
      entitiesSourceLabel:
        entityPull.source === "live"
          ? "Live SAM.gov entity search"
          : entityPull.source === "cached"
            ? "Cached SAM.gov entity search"
            : "Sample data, fictional entities",
      subawards,
      subawardsSource: subawardPull.source,
      subawardsSourceLabel:
        subawardPull.source === "live"
          ? "Live SAM.gov subaward reporting"
          : subawardPull.source === "cached"
            ? "Cached SAM.gov subaward reporting"
            : "Sample data, fictional subawards",
      smallBusinessCount,
      ruleOfTwoMet,
      simplifiedThreshold: satValue,
      simplifiedThresholdCitation: sat?.citation ?? "Not recorded",
      suggestedDecision,
      suggestionReason,
      citations: [
        {
          citation: "FAR 19.502-2",
          tier: "Binding",
          note: "Set aside when there is a reasonable expectation of offers from two or more responsible small businesses at a fair market price.",
        },
        {
          citation: "FAR 10.001",
          tier: "Binding",
          note: "Market research supports the set-aside decision and is documented in the file.",
        },
        {
          citation: "NFS CG 1810.12",
          tier: "Guidance",
          note: "NASA market research practice for documenting sources.",
        },
      ],
      checkedAt,
    };
    const providerError = entityPull.error || subawardPull.error;
    if (providerError) view.providerError = providerError;

    for (const [label, pulled] of [
      ["entities", entityPull],
      ["subawards", subawardPull],
    ] as const) {
      const { error } = await supabaseAdmin.from("sam_checks").insert({
        acquisition_id: acq.data.acquisition_id,
        vendor_uei: null,
        check_type: `Set-aside ${label} ${naics}${stateCode ? ` ${stateCode}` : ""}`,
        response_json: { raw: pulled.raw, source: pulled.source, providerError: pulled.error || null } as Json,
        checked_by: me.name,
        checked_at: checkedAt,
      });
      if (error) throw new Error(error.message);
    }

    const { error: auditError } = await supabaseAdmin.from("audit_log").insert({
      acquisition_id: acq.data.acquisition_id,
      actor: me.name,
      action: "Set-aside evidence assembled",
      field: `NAICS ${naics}${stateCode ? ` · ${stateCode}` : ""}`,
      old_value: acq.data.set_aside,
      new_value: `${smallBusinessCount} small businesses · suggested: ${suggestedDecision}`,
      reason: `${view.entitiesSourceLabel}; ${view.subawardsSourceLabel}`,
      phase: "Market Research",
      logged_at: checkedAt,
    });
    if (auditError) throw new Error(auditError.message);

    return view;
  });

const confirmSchema = z.object({
  acquisitionId: z.string().trim().min(1).max(40),
  decision: z.string().trim().min(1).max(120),
  reason: z.string().trim().max(500).optional(),
});

export const confirmSetAside = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => confirmSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: me, error: meError } = await context.supabase
      .from("users")
      .select("name,role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (meError) throw new Error(meError.message);
    if (!me || !["specialist", "hq"].includes(me.role)) {
      throw new Error("Only the contracting officer or specialist confirms the set-aside decision.");
    }

    const { data: before, error: readError } = await context.supabase
      .from("acquisition_facts")
      .select("set_aside")
      .eq("acquisition_id", data.acquisitionId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    const { error } = await context.supabase
      .from("acquisition_facts")
      .update({ set_aside: data.decision })
      .eq("acquisition_id", data.acquisitionId);
    if (error) throw new Error(error.message);

    const { error: auditError } = await context.supabase.from("audit_log").insert({
      acquisition_id: data.acquisitionId,
      actor: me.name,
      action: "Set-aside decision confirmed",
      field: "set_aside",
      old_value: before?.set_aside ?? null,
      new_value: data.decision,
      reason: data.reason ?? "Confirmed from the Rule of Two evidence on Market Research.",
      phase: "Market Research",
      logged_at: new Date().toISOString(),
    });
    if (auditError) throw new Error(auditError.message);
    return { decision: data.decision };
  });
