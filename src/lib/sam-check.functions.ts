import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z
  .object({
    mode: z.enum(["record", "live"]),
    acquisitionId: z.string().trim().min(1).max(40).optional(),
    uei: z.string().trim().min(3).max(20).regex(/^[A-Za-z0-9]+$/).optional(),
    simulateFailure: z.boolean().optional(),
  })
  .refine((value) => (value.mode === "record" ? Boolean(value.acquisitionId) : Boolean(value.uei)), {
    message: "Choose an acquisition or enter a UEI.",
  });

export type SamCheckView = {
  uei: string;
  acquisitionId: string | null;
  legalName: string;
  cage: string;
  registrationStatus: string;
  registrationExpiration: string;
  exclusionFlag: string;
  exclusionUrl: string;
  naicsCode: string;
  smallBusinessStatus: string;
  repsAndCertsSummary: string;
  integrityRecordsCount: number;
  checkedAt: string;
  source: "sample" | "live" | "cached";
  sourceLabel: string;
};

type JsonRecord = Record<string, unknown>;

const object = (value: unknown): JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (...values: unknown[]) => {
  const found = values.find((value) => typeof value === "string" && value.trim());
  return typeof found === "string" ? found : "—";
};

function normalizedFromRaw(
  raw: unknown,
  uei: string,
  naicsCode: string | null,
  checkedAt: string,
  source: SamCheckView["source"],
  acquisitionId: string | null,
): SamCheckView {
  const root = object(raw);
  const entity = object(array(root["entityData"])[0] ?? root["entityData"] ?? root);
  const registration = object(entity["entityRegistration"]);
  const core = object(entity["coreData"]);
  const assertions = object(entity["assertions"]);
  const goods = object(assertions["goodsAndServices"]);
  const naics = array(goods["naicsList"] ?? assertions["naicsList"]).map(object);
  const matchingNaics = naics.find((row) => text(row["naicsCode"], row["naics"]) === naicsCode);
  const reps = object(entity["repsAndCerts"]);
  const certifications = array(reps["certifications"] ?? reps["certificationList"]);
  const integrity = object(entity["integrityInformation"]);
  const integrityRecords = array(
    integrity["responsibilityQualificationList"] ?? integrity["integrityRecords"] ?? integrity["records"],
  );
  const exclusion = text(registration["exclusionStatusFlag"], core["exclusionStatusFlag"], "N");

  return {
    uei,
    acquisitionId,
    legalName: text(registration["legalBusinessName"], core["legalBusinessName"]),
    cage: text(core["cageCode"], registration["cageCode"]),
    registrationStatus: text(registration["registrationStatus"]),
    registrationExpiration: text(registration["registrationExpirationDate"]),
    exclusionFlag: exclusion === "Y" ? "Exclusion found" : exclusion === "N" ? "No active exclusion" : exclusion,
    exclusionUrl: `https://sam.gov/entity-information/exclusions/active?uei=${encodeURIComponent(uei)}`,
    naicsCode: naicsCode ?? text(matchingNaics?.["naicsCode"]),
    smallBusinessStatus:
      text(matchingNaics?.["isSmallBusiness"]) === "Y"
        ? "Small business"
        : text(matchingNaics?.["isSmallBusiness"]) === "N"
          ? "Other than small business"
          : text(matchingNaics?.["isSmallBusiness"], "Not reported"),
    repsAndCertsSummary:
      certifications.length > 0
        ? `${certifications.length} certification response${certifications.length === 1 ? "" : "s"} returned`
        : text(reps["summary"], "No certification summary returned"),
    integrityRecordsCount: integrityRecords.length,
    checkedAt,
    source,
    sourceLabel:
      source === "sample" ? "Sample data, fictional vendor" : source === "cached" ? "Cached" : "Live SAM.gov response",
  };
}

function sampleResponse(legalName: string | null, cage: string | null, naicsCode: string | null) {
  return {
    entityData: [
      {
        entityRegistration: {
          legalBusinessName: legalName ?? "Fictional vendor",
          registrationStatus: "Active — sample",
          registrationExpirationDate: "2027-08-31",
          exclusionStatusFlag: "N",
        },
        coreData: { cageCode: cage ?? "DEMO1" },
        assertions: {
          goodsAndServices: { naicsList: [{ naicsCode: naicsCode ?? "—", isSmallBusiness: "N" }] },
        },
        repsAndCerts: { certifications: [{ provision: "Sample representations and certifications" }] },
        integrityInformation: { responsibilityQualificationList: [] },
      },
    ],
  };
}

export const runSamEntityCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<SamCheckView> => {
    const { data: me, error: meError } = await context.supabase
      .from("users")
      .select("name,role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (meError) throw new Error(meError.message);
    if (!me || !["specialist", "reviewer", "hq"].includes(me.role)) {
      throw new Error("Entity checks are available to contracting, reviewer, and HQ roles.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let acquisition: {
      acquisition_id: string;
      vendor_uei: string | null;
      vendor_legal_name: string | null;
      vendor_cage: string | null;
      naics_code: string | null;
    } | null = null;

    if (data.acquisitionId) {
      const result = await supabaseAdmin
        .from("acquisition_facts")
        .select("acquisition_id,vendor_uei,vendor_legal_name,vendor_cage,naics_code")
        .eq("acquisition_id", data.acquisitionId)
        .maybeSingle();
      if (result.error) throw new Error(result.error.message);
      acquisition = result.data;
      if (!acquisition) throw new Error("The selected acquisition was not found.");
    }

    const uei = (data.mode === "record" ? acquisition?.vendor_uei : data.uei)?.trim().toUpperCase();
    if (!uei) throw new Error("This record does not have a vendor UEI.");
    const acquisitionId = acquisition?.acquisition_id ?? null;
    const naicsCode = acquisition?.naics_code ?? null;
    const checkedAt = new Date().toISOString();
    let raw: unknown;
    let source: SamCheckView["source"];
    let providerError = "";

    if (uei.startsWith("DEMO")) {
      raw = sampleResponse(acquisition?.vendor_legal_name ?? null, acquisition?.vendor_cage ?? null, naicsCode);
      source = "sample";
    } else {
      try {
        if (data.simulateFailure) throw new Error("Simulated network failure");
        const apiKey = process.env['SAM_GOV_API_KEY'];
        if (!apiKey) throw new Error("The SAM.gov API key has not been configured.");
        const url = new URL("https://api.sam.gov/entity-information/v3/entities");
        url.searchParams.set("api_key", apiKey);
        url.searchParams.set("samUEI", uei);
        url.searchParams.set(
          "includeSections",
          "entityRegistration,coreData,assertions,repsAndCerts,integrityInformation",
        );
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`SAM.gov returned ${response.status}: ${await response.text()}`);
        raw = await response.json();
        if (!array(object(raw)["entityData"]).length) throw new Error("SAM.gov returned no registration for this UEI.");
        source = "live";
      } catch (error) {
        providerError = error instanceof Error ? error.message : "SAM.gov lookup failed.";
        console.error(`[SAM.gov] ${providerError}`);
        const cached = await supabaseAdmin
          .from("sam_checks")
          .select("response_json,checked_at")
          .eq("vendor_uei", uei)
          .order("checked_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const cachedEnvelope = object(cached.data?.response_json);
        raw = cachedEnvelope["raw"] ?? cached.data?.response_json;
        if (cached.error || !raw) {
          await supabaseAdmin.from("audit_log").insert({
            acquisition_id: acquisitionId,
            actor: me.name,
            action: "SAM.gov entity check failed",
            field: "vendor_uei",
            old_value: uei,
            new_value: null,
            reason: providerError,
            logged_at: checkedAt,
          });
          throw new Error(`${providerError} No cached result is available for this UEI.`);
        }
        source = "cached";
      }
    }

    const view = normalizedFromRaw(raw, uei, naicsCode, checkedAt, source, acquisitionId);
    const { error: saveError } = await supabaseAdmin.from("sam_checks").insert({
      acquisition_id: acquisitionId,
      vendor_uei: uei,
      check_type: view.sourceLabel,
      response_json: { raw, normalized: view, providerError: providerError || null },
      checked_by: me.name,
      checked_at: checkedAt,
    });
    if (saveError) throw new Error(saveError.message);

    const { error: auditError } = await supabaseAdmin.from("audit_log").insert({
      acquisition_id: acquisitionId,
      actor: me.name,
      action: "SAM.gov entity check",
      field: "vendor_uei",
      old_value: uei,
      new_value: view.sourceLabel,
      reason: providerError ? `Live lookup failed; cached result used. ${providerError}` : view.sourceLabel,
      logged_at: checkedAt,
    });
    if (auditError) throw new Error(auditError.message);
    return view;
  });