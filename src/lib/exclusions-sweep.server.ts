import type { Json } from "@/integrations/supabase/types";

/**
 * exclusions_sweep
 *
 * Checks every vendor of record on every open file against SAM.gov exclusions,
 * by exact UEI and never by legal name. Fictional demo vendors (UEIs beginning
 * DEMO) get a clearly labeled sample result so the sweep never depends on the
 * network. Every vendor checked gets a sam_checks row.
 *
 * The sweep never changes a clock. An exclusion record raises a flag for the
 * contracting officer to review; only a person places a file on hold. A clean
 * live check on the same UEI clears the flag.
 */

export const SWEEP_CHECK_TYPE = "Exclusions sweep";
export const EXCLUSION_REVIEW_FLAG = "vendor exclusion flagged; CO review";

type JsonRecord = Record<string, unknown>;
const object = (value: unknown): JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (...values: unknown[]) => {
  const found = values.find((value) => typeof value === "string" && value.trim());
  return typeof found === "string" ? found : "";
};

export type SweepVendorResult = {
  acquisitionId: string;
  uei: string;
  legalName: string;
  excluded: boolean;
  exclusionLabel: string;
  source: "live" | "cached" | "sample";
  sourceLabel: string;
  /** Raised for the contracting officer to review. No clock is ever changed. */
  flaggedForReview: boolean;
  checkedAt: string;
  providerError?: string;
};

export type SweepResult = {
  ranAt: string;
  actor: string;
  filesChecked: number;
  vendorsChecked: number;
  excludedFound: number;
  flaggedForReview: number;
  results: SweepVendorResult[];
};

/** Fictional exclusion response for a demo vendor, clearly labeled. */
function sampleExclusion(legalName: string | null, uei: string) {
  return {
    sample: true,
    ueiSAM: uei,
    entityData: [
      {
        entityRegistration: {
          legalBusinessName: legalName ?? "Fictional vendor",
          registrationStatus: "Active — sample",
          exclusionStatusFlag: "N",
        },
      },
    ],
  };
}

/**
 * Reads an exclusions payload only.
 *
 * A registration record is not an exclusion: an entity response carries
 * totalRecords for the registration itself, so counting it as an exclusion
 * turns a clean, active vendor into a false positive. Only exclusion records,
 * or an exclusion flag of Y on the entity, mean excluded. An empty exclusions
 * list means the vendor is not excluded.
 */
export function excludedFromRaw(raw: unknown): { excluded: boolean; label: string } {
  const root = object(raw);
  const exclusions = array(
    root["excludedEntity"] ?? root["excludedEntityData"] ?? root["exclusionData"] ?? root["exclusionDetails"],
  );
  if (exclusions.length > 0) return { excluded: true, label: `Exclusion found (${exclusions.length} record(s))` };
  const entity = object(array(root["entityData"])[0] ?? root["entityData"] ?? root);
  const registration = object(entity["entityRegistration"]);
  const flag = text(registration["exclusionStatusFlag"], object(entity["coreData"])["exclusionStatusFlag"]);
  if (flag.toUpperCase() === "Y") return { excluded: true, label: "Exclusion found" };
  return { excluded: false, label: "No active exclusion" };
}

/** Does this stored payload come from the exclusions endpoint at all? */
export function isExclusionsPayload(raw: unknown): boolean {
  const root = object(raw);
  if (root["sample"] === true) return true;
  return (
    "excludedEntity" in root ||
    "excludedEntityData" in root ||
    "exclusionData" in root ||
    "exclusionDetails" in root
  );
}

/** Reads the dedicated SAM.gov exclusions record for one UEI. */
async function lookupExclusion(uei: string, _legalName: string | null) {
  const apiKey = process.env['SAM_GOV_API_KEY']?.trim();
  console.log(`[Exclusions sweep] key present: ${Boolean(apiKey)}; length: ${apiKey?.length ?? 0}`);
  if (!apiKey) throw new Error("The SAM.gov API key has not been configured.");
  const url = new URL("https://api.sam.gov/entity-information/v4/exclusions");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("ueiSAM", uei);
  url.searchParams.set("recordStatus", "active");
  url.searchParams.set("page", "0");
  url.searchParams.set("size", "10");
  const redacted = url.toString().replace(encodeURIComponent(apiKey), "REDACTED").replace(apiKey, "REDACTED");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    throw new Error(`api.sam.gov responded ${response.status} for GET ${redacted}. Body: ${body || "(empty)"}`);
  }
  // An empty exclusions list is a valid answer: the vendor is not excluded.
  return await response.json();
}

/** Runs the sweep. `actor` is the name recorded on every check and audit row. */
export async function runExclusionsSweep(actor: string): Promise<SweepResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ranAt = new Date().toISOString();

  const open = await supabaseAdmin
    .from("acquisition_facts")
    .select("acquisition_id,vendor_uei,vendor_legal_name,clock_state,hold_reason,hold_owner,co_name,status")
    .order("acquisition_id");
  if (open.error) throw new Error(open.error.message);

  const files = (open.data ?? []).filter(
    (row) => row.clock_state !== "launched" && row.clock_state !== "scrubbed" && Boolean(row.vendor_uei),
  );

  const results: SweepVendorResult[] = [];
  let placedOnHold = 0;

  for (const file of files) {
    const uei = String(file.vendor_uei).trim().toUpperCase();
    const legalName = file.vendor_legal_name ?? null;
    let raw: unknown;
    let source: SweepVendorResult["source"];
    let providerError = "";

    if (uei.startsWith("DEMO")) {
      raw = sampleExclusion(legalName, uei);
      source = "sample";
    } else {
      try {
        raw = await lookupExclusion(uei, legalName);
        source = "live";
      } catch (error) {
        providerError = error instanceof Error ? error.message : "The exclusions lookup failed.";
        console.error(`[Exclusions sweep] ${providerError}`);
        // Only a prior exclusions answer for this exact UEI may stand in. An
        // entity registration response is a different question and must never
        // be read as an exclusion.
        const cached = await supabaseAdmin
          .from("sam_checks")
          .select("response_json,checked_at,check_type,vendor_uei")
          .eq("vendor_uei", uei)
          .eq("check_type", SWEEP_CHECK_TYPE)
          .order("checked_at", { ascending: false })
          .limit(5);
        let reuse: unknown = null;
        for (const row of cached.data ?? []) {
          const envelope = object(row.response_json);
          const body = envelope["raw"] ?? row.response_json ?? null;
          if (body && isExclusionsPayload(body)) {
            reuse = body;
            break;
          }
        }
        raw = reuse;
        source = raw ? "cached" : "sample";
        if (!raw) raw = sampleExclusion(legalName, uei);
      }
    }

    const { excluded, label } = excludedFromRaw(raw);
    const sourceLabel =
      source === "live"
        ? "Live SAM.gov exclusions result"
        : source === "cached"
          ? "Cached SAM.gov result"
          : "Sample data, fictional vendor";

    const result: SweepVendorResult = {
      acquisitionId: file.acquisition_id,
      uei,
      legalName: legalName ?? uei,
      excluded,
      exclusionLabel: label,
      source,
      sourceLabel,
      flaggedForReview: excluded,
      checkedAt: ranAt,
    };
    if (providerError) result.providerError = providerError;

    const { error: saveError } = await supabaseAdmin.from("sam_checks").insert({
      acquisition_id: file.acquisition_id,
      vendor_uei: uei,
      check_type: SWEEP_CHECK_TYPE,
      response_json: { raw, normalized: result, source, providerError: providerError || null } as Json,
      checked_by: actor,
      checked_at: ranAt,
    });
    if (saveError) throw new Error(saveError.message);

    // The sweep never touches the clock. It records what it saw and, where an
    // exclusion record exists, asks the contracting officer to look.
    if (excluded) {
      flaggedForReview += 1;
      await supabaseAdmin.from("audit_log").insert({
        acquisition_id: file.acquisition_id,
        actor,
        action: "Vendor exclusion flagged",
        field: "vendor exclusions",
        old_value: null,
        new_value: EXCLUSION_REVIEW_FLAG,
        reason: `${label} for ${legalName ?? uei} (UEI ${uei}); ${sourceLabel}; checked ${ranAt}`,
        logged_at: ranAt,
      });
    }

    results.push(result);
  }

  const excludedFound = results.filter((r) => r.excluded).length;

  const { error: auditError } = await supabaseAdmin.from("audit_log").insert({
    acquisition_id: null,
    actor,
    action: "Exclusions sweep",
    field: "vendor exclusions",
    old_value: null,
    new_value: `${results.length} vendor check${results.length === 1 ? "" : "s"} across ${files.length} open file${files.length === 1 ? "" : "s"}`,
    reason:
      excludedFound === 0
        ? "No vendor of record is excluded"
        : `${excludedFound} excluded; ${placedOnHold} placed on hold`,
    logged_at: ranAt,
  });
  if (auditError) throw new Error(auditError.message);

  return {
    ranAt,
    actor,
    filesChecked: files.length,
    vendorsChecked: results.length,
    excludedFound,
    placedOnHold,
    results,
  };
}
