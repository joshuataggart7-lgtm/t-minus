/**
 * Place of performance validation against the SAM.gov Public Location Services
 * API. The free text the requester types stays on the record; the standardized
 * value the requester accepts is stored beside it.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlaceMatch = {
  standardized: string;
  city: string;
  state: string;
  country: string;
};

export type PlaceLookup = {
  query: string;
  matches: PlaceMatch[];
  source: "live" | "sample";
  sourceLabel: string;
  providerError?: string;
};

const inputSchema = z.object({ query: z.string().trim().min(2).max(120) });

const object = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const array = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (...v: unknown[]) => {
  const hit = v.find((x) => typeof x === "string" && x.trim());
  return typeof hit === "string" ? hit.trim() : "";
};

/** "Fairbanks, AK" -> { city: "Fairbanks", state: "AK" } */
function splitQuery(query: string) {
  const parts = query.split(",").map((p) => p.trim()).filter(Boolean);
  return { city: parts[0] ?? query.trim(), state: parts[1] ?? "" };
}

function standardize(city: string, state: string, country: string) {
  return [city.toUpperCase(), state.toUpperCase(), country.toUpperCase()].filter(Boolean).join(", ");
}

function sampleMatches(query: string): PlaceMatch[] {
  const { city, state } = splitQuery(query);
  const st = state || "AK";
  return [
    {
      standardized: standardize(city, st, "UNITED STATES"),
      city: city.toUpperCase(),
      state: st.toUpperCase(),
      country: "UNITED STATES",
    },
  ];
}

export const lookupPlaceOfPerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<PlaceLookup> => {
    const { city, state } = splitQuery(data.query);
    const rawKey = process.env["SAM_GOV_API_KEY"]?.trim();
    console.log(`[SAM.gov locations] key present: ${Boolean(rawKey)}; length: ${rawKey?.length ?? 0}`);

    try {
      if (!rawKey) throw new Error("The SAM.gov API key has not been configured.");
      const url = new URL("https://api.sam.gov/locationservices/v1/api/cities");
      url.searchParams.set("api_key", rawKey);
      url.searchParams.set("q", city);
      if (state) url.searchParams.set("stateCode", state.toUpperCase());
      url.searchParams.set("countryCode", "USA");
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        const body = (await response.text()).slice(0, 200);
        throw new Error(`api.sam.gov responded ${response.status}. ${body || "(empty body)"}`);
      }
      const body = await response.json();
      const rows = array(object(body)["_embedded"] ?? object(body)["cityList"] ?? body).map(object);
      const matches: PlaceMatch[] = rows
        .map((row) => {
          const c = str(row["cityName"], row["city"], row["name"]);
          const st = str(row["stateCode"], row["state"], row["stateProvinceCode"]);
          const country = str(row["countryCode"], row["country"], "UNITED STATES");
          return { city: c, state: st, country, standardized: standardize(c, st, country) };
        })
        .filter((m) => m.city)
        .slice(0, 8);
      if (!matches.length) throw new Error("SAM.gov returned no matching location.");
      return { query: data.query, matches, source: "live", sourceLabel: "Live SAM.gov location match" };
    } catch (error) {
      const providerError = error instanceof Error ? error.message : "Location lookup failed.";
      console.error(`[SAM.gov locations] ${providerError}`);
      return {
        query: data.query,
        matches: sampleMatches(data.query),
        source: "sample",
        sourceLabel: "Sample data, standardized locally",
        providerError,
      };
    }
  });
