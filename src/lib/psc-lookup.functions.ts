/**
 * Product or service code validation against the SAM.gov Public PSC API.
 * The lookup confirms the official PSC name and whether the code is active.
 * If SAM.gov cannot be reached the code is allowed through with a clear note,
 * so an outage never blocks intake.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PscLookup = {
  code: string;
  /** "valid" the code exists and is active, "inactive" it exists but is retired,
   *  "unknown" SAM.gov has no such code, "unchecked" SAM.gov could not be reached. */
  state: "valid" | "inactive" | "unknown" | "unchecked";
  officialName: string;
  message: string;
  source: "live" | "unchecked";
  sourceLabel: string;
  providerError?: string;
};

const inputSchema = z.object({ code: z.string().trim().min(2).max(6) });

const object = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const array = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (...v: unknown[]) => {
  const hit = v.find((x) => typeof x === "string" && x.trim());
  return typeof hit === "string" ? hit.trim() : "";
};

export const lookupPsc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<PscLookup> => {
    const code = data.code.toUpperCase();
    const apiKey = process.env["SAM_GOV_API_KEY"]?.trim();
    console.log(`[SAM.gov PSC] key present: ${Boolean(apiKey)}; length: ${apiKey?.length ?? 0}`);

    try {
      if (!apiKey) throw new Error("The SAM.gov API key has not been configured.");
      const url = new URL("https://api.sam.gov/prod/locationservices/v1/api/publicpscdetails");
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("searchBy", "psc");
      url.searchParams.set("q", code);
      url.searchParams.set("active", "Y");
      url.searchParams.set("limit", "10");
      url.searchParams.set("offset", "0");
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        const body = (await response.text()).slice(0, 200);
        throw new Error(`api.sam.gov responded ${response.status}. ${body || "(empty body)"}`);
      }
      const body = await response.json();
      const rows = array(
        object(body)["pscDetails"] ?? object(body)["_embedded"] ?? object(body)["results"] ?? body,
      ).map(object);
      const match = rows.find(
        (row) => str(row["pscCode"], row["psc_code"], row["code"]).toUpperCase() === code,
      );
      if (!match) {
        return {
          code,
          state: "unknown",
          officialName: "",
          message: `SAM.gov has no active product or service code ${code}. Check the code before you save.`,
          source: "live",
          sourceLabel: "Live SAM.gov product and service code list",
        };
      }
      const officialName = str(
        match["pscName"],
        match["pscNameLong"],
        match["description"],
        match["shortName"],
      );
      const active = str(match["isActive"], match["active"], match["activeInd"], "Y").toUpperCase();
      const isActive = active.startsWith("Y") || active === "TRUE" || active === "ACTIVE";
      return {
        code,
        state: isActive ? "valid" : "inactive",
        officialName,
        message: isActive
          ? officialName || `Code ${code} is active.`
          : `${officialName || `Code ${code}`} is no longer active. Choose a current code.`,
        source: "live",
        sourceLabel: "Live SAM.gov product and service code list",
      };
    } catch (error) {
      const providerError = error instanceof Error ? error.message : "The code lookup failed.";
      console.error(`[SAM.gov PSC] ${providerError}`);
      return {
        code,
        state: "unchecked",
        officialName: "",
        message: `SAM.gov could not be reached, so code ${code} was not confirmed. You can still save it.`,
        source: "unchecked",
        sourceLabel: "Not confirmed against SAM.gov",
        providerError,
      };
    }
  });
