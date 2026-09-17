/**
 * Market research evidence engine, server side.
 *
 * Runs only when the contracting officer asks for it. Each public source is
 * searched in turn, every search is written to the research log with its query,
 * date and result count, and the findings are drafted from what came back.
 * Nothing is invented: a source that returns nothing is recorded as returning
 * nothing, and no finding is drafted from it.
 *
 * Sources: SAM.gov Entity Management, SAM.gov Opportunities, USAspending
 * awards, the seeded SBA size standard table, GSA CALC and eLibrary for FAR 8.4
 * buys, and T-Minus's own prior acquisitions under the same NAICS.
 */

type JsonRecord = Record<string, unknown>;

export const object = (v: unknown): JsonRecord =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as JsonRecord) : {};
export const array = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (...values: unknown[]) => {
  const found = values.find((v) => typeof v === "string" && v.trim());
  return typeof found === "string" ? found : "";
};
const num = (v: unknown) => {
  const n = Number(typeof v === "string" ? v.replace(/[$,]/g, "") : v);
  return Number.isFinite(n) ? n : null;
};
const money = (n: number | null) =>
  n === null ? "not reported" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export type LogEntry = {
  source: string;
  query: string;
  resultCount: number | null;
  outcome: string;
};

export type EngineEntity = {
  legalName: string;
  uei: string;
  state: string;
  smallBusiness: boolean | null;
  smallBusinessLabel: string;
  socioeconomic: string;
  excluded: boolean;
};

export type EngineAward = {
  vendor: string;
  agency: string;
  amount: number | null;
  date: string;
  type: string;
  setAside: string;
  competition: string;
};

export type EngineNotice = {
  title: string;
  noticeType: string;
  posted: string;
  setAside: string;
};

export type EngineResult = {
  runId: string;
  naics: string;
  psc: string;
  stateCode: string | null;
  acquisitionMethod: string;
  ranAt: string;
  stateEntities: EngineEntity[];
  nationalEntities: EngineEntity[];
  notices: EngineNotice[];
  /** True when at least one notices window was actually searched. */
  noticesSearched: boolean;
  awards: EngineAward[];
  priorActions: { acquisitionId: string; title: string; phase: string; setAside: string }[];
  sizeStandardText: string;
  calcNote: string;
  log: LogEntry[];
  smallBusinessCount: number;
  ruleOfTwoMet: boolean;
};

const dateOnly = (iso: string) => iso.slice(0, 10);
const yearsAgo = (n: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return dateOnly(d.toISOString());
};

function redact(url: URL, key: string | undefined) {
  const s = url.toString();
  if (!key) return s;
  return s.replace(encodeURIComponent(key), "REDACTED").replace(key, "REDACTED");
}

async function getJson(url: URL, key?: string, timeoutMs?: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: timeoutMs ? controller.signal : null,
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 200);
      throw new Error(`${url.host} responded ${response.status} for ${redact(url, key)}. ${body}`);
    }
    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError" && timeoutMs) {
      throw new Error(`${url.host} did not respond within ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function entitiesFromRaw(raw: unknown, naics: string): EngineEntity[] {
  const rows = array(object(raw)["entityData"] ?? object(raw)["entities"]).map(object);
  return rows.slice(0, 50).map((row) => {
    const registration = object(row["entityRegistration"]);
    const core = object(row["coreData"]);
    const address = object(core["physicalAddress"]);
    const assertions = object(row["assertions"]);
    const naicsList = array(object(assertions["goodsAndServices"])["naicsList"] ?? assertions["naicsList"]).map(object);
    const match = naicsList.find((n) => text(n["naicsCode"], n["naics"]) === naics) ?? naicsList[0];
    const flag = text(match?.["sbaSmallBusiness"], match?.["isSmallBusiness"]);
    const small = flag === "Y" || flag === "E" ? true : flag === "N" ? false : null;
    const types = array(object(core["businessTypes"])["businessTypeList"])
      .map(object)
      .map((b) => text(b["businessTypeDesc"], b["businessTypeCode"]))
      .filter(Boolean);
    return {
      legalName: text(registration["legalBusinessName"], core["legalBusinessName"]) || "Not reported",
      uei: text(registration["ueiSAM"], core["ueiSAM"]) || "Not reported",
      state: text(address["stateOrProvinceCode"], address["state"]) || "Not reported",
      smallBusiness: small,
      smallBusinessLabel:
        small === true ? "Small business" : small === false ? "Other than small business" : "Not reported",
      socioeconomic: types.length ? types.join(", ") : "Not reported",
      excluded: text(registration["exclusionStatusFlag"]) === "Y",
    };
  });
}

function noticesFromRaw(raw: unknown): EngineNotice[] {
  const rows = array(object(raw)["opportunitiesData"] ?? object(raw)["data"]).map(object);
  return rows.slice(0, 100).map((row) => ({
    title: text(row["title"]) || "Not reported",
    noticeType: text(row["type"], row["baseType"]) || "Not reported",
    posted: text(row["postedDate"]) || "Not reported",
    setAside: text(row["typeOfSetAsideDescription"], row["typeOfSetAside"]) || "None reported",
  }));
}

function awardsFromRaw(raw: unknown): EngineAward[] {
  const rows = array(object(raw)["results"]).map(object);
  return rows.slice(0, 25).map((row) => ({
    vendor: text(row["Recipient Name"]) || "Not reported",
    agency: text(row["Awarding Agency"]) || "Not reported",
    amount: num(row["Award Amount"]),
    date: text(row["Start Date"], row["Last Date to Order"]) || "Not reported",
    type: text(row["Contract Award Type"], row["Award Type"]) || "Not reported",
    setAside: text(row["Set Aside Type"]) || "None reported",
    competition: text(row["Extent Competed"], row["extent_competed"]) || "Not reported",
  }));
}

type Admin = {
  from: (t: string) => any;
};

/** Runs every source in turn and returns the raw evidence plus the research log. */
export async function runEngine(options: {
  runId: string;
  acq: Record<string, unknown>;
  supabaseAdmin: Admin;
}): Promise<EngineResult> {
  const { acq, runId } = options;
  const naics = String(acq["naics_code"] ?? "").trim();
  const psc = String(acq["psc_code"] ?? "").trim();
  const method = String(acq["acquisition_method"] ?? "").trim();
  const place = String(acq["place_of_performance_standardized"] ?? acq["place_of_performance"] ?? "");
  // Every state named in the place of performance is searched, not only the last.
  const STATES = new Set(
    ("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY " +
      "NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA VI WA WV WI WY").split(" "),
  );
  const stateCodes = [...new Set((place.toUpperCase().match(/\b[A-Z]{2}\b/g) ?? []).filter((c) => STATES.has(c)))];
  const stateCode = stateCodes.length ? stateCodes.join(", ") : null;
  const ranAt = new Date().toISOString();
  const today = dateOnly(ranAt);
  const samKey = process.env['SAM_GOV_API_KEY']?.trim();
  const calcKey = process.env['DATA_GOV_API_KEY']?.trim();

  const log: LogEntry[] = [];
  const record = (entry: LogEntry) => log.push(entry);

  // The Entity Management API refuses a size above 10, so each search reads ten
  // records a page and pages through until a short page comes back or twenty
  // pages have been read. Registrants are de-duplicated by UEI across pages.
  const ENTITY_PAGE_SIZE = 10;
  const ENTITY_MAX_PAGES = 20;
  const samEntities = async (label: string, state: string | null): Promise<EngineEntity[]> => {
    const buildUrl = (page: number) => {
      const url = new URL("https://api.sam.gov/entity-information/v3/entities");
      url.searchParams.set("api_key", samKey ?? "");
      url.searchParams.set("naicsCode", naics);
      url.searchParams.set("registrationStatus", "A");
      url.searchParams.set("size", String(ENTITY_PAGE_SIZE));
      url.searchParams.set("page", String(page));
      if (state) url.searchParams.set("physicalAddressProvinceOrStateCode", state);
      url.searchParams.set("includeSections", "entityRegistration,coreData,assertions");
      return url;
    };
    const query = redact(buildUrl(0), samKey);
    if (!samKey) {
      record({ source: label, query, resultCount: null, outcome: "Not run. The SAM.gov key is not configured." });
      return [];
    }
    const found = new Map<string, EngineEntity>();
    let pagesRead = 0;
    try {
      for (let page = 0; page < ENTITY_MAX_PAGES; page += 1) {
        const rows = entitiesFromRaw(await getJson(buildUrl(page), samKey), naics);
        pagesRead += 1;
        for (const row of rows) if (!found.has(row.uei)) found.set(row.uei, row);
        if (rows.length < ENTITY_PAGE_SIZE) break;
      }
      const rows = [...found.values()];
      record({
        source: label,
        query,
        resultCount: rows.length,
        outcome: rows.length
          ? `Returned registrants across ${pagesRead} page${pagesRead === 1 ? "" : "s"} of ten records.`
          : "Returned no registrants under this code.",
      });
      return rows;
    } catch (error) {
      const partial = [...found.values()];
      record({
        source: label,
        query,
        resultCount: null,
        outcome: `The search failed after ${pagesRead} page${pagesRead === 1 ? "" : "s"}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      });
      return partial;
    }
  };

  let stateEntities: EngineEntity[] = [];
  for (const code of stateCodes) {
    stateEntities = stateEntities.concat(
      await samEntities(`SAM.gov Entity Management API, NAICS ${naics} in ${code}`, code),
    );
  }
  // One registrant can appear under two states; count each only once.
  stateEntities = [...new Map(stateEntities.map((e) => [e.uei, e])).values()];
  if (!stateCodes.length) {
    record({
      source: "SAM.gov Entity Management API, place of performance state",
      query: "not run",
      resultCount: null,
      outcome: "No place of performance state is on the record, so the state search was skipped.",
    });
  }
  const nationalEntities = await samEntities(`SAM.gov Entity Management API, NAICS ${naics} nationally`, null);

  // SAM.gov Opportunities, last three years. The API rejects a range wider
  // than one year, so the three years are searched one year at a time and each
  // window is logged on its own.
  let notices: EngineNotice[] = [];
  let noticesSearched = false;
  {
    const mmddyyyy = (d: Date) =>
      `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
    for (let year = 1; year <= 3; year += 1) {
      const to = new Date();
      to.setFullYear(to.getFullYear() - (year - 1));
      const from = new Date(to);
      from.setFullYear(from.getFullYear() - 1);
      from.setDate(from.getDate() + 1);
      const NOTICE_PAGE_SIZE = 100;
      const NOTICE_CAP = 200;
      const buildUrl = (offset: number) => {
        const url = new URL("https://api.sam.gov/opportunities/v2/search");
        url.searchParams.set("api_key", samKey ?? "");
        url.searchParams.set("limit", String(NOTICE_PAGE_SIZE));
        url.searchParams.set("offset", String(offset));
        if (naics) url.searchParams.set("ncode", naics);
        else if (psc) url.searchParams.set("ccode", psc);
        url.searchParams.set("postedFrom", mmddyyyy(from));
        url.searchParams.set("postedTo", mmddyyyy(to));
        return url;
      };
      const source = `SAM.gov Opportunities API, ${dateOnly(from.toISOString())} to ${dateOnly(to.toISOString())}`;
      const query = redact(buildUrl(0), samKey);
      if (!samKey) {
        record({ source, query, resultCount: null, outcome: "Not run. The SAM.gov key is not configured." });
        continue;
      }
      let found: EngineNotice[] = [];
      try {
        for (let offset = 0; offset < NOTICE_CAP; offset += NOTICE_PAGE_SIZE) {
          const page = noticesFromRaw(await getJson(buildUrl(offset), samKey));
          noticesSearched = true;
          found = found.concat(page);
          if (page.length < NOTICE_PAGE_SIZE) break;
        }
        found = found.slice(0, NOTICE_CAP);
        notices = notices.concat(found);
        record({
          source,
          query,
          resultCount: found.length,
          outcome: found.length ? "Returned notices." : "Returned no notices under this code.",
        });
      } catch (error) {
        notices = notices.concat(found);
        record({
          source,
          query,
          resultCount: null,
          outcome: `The search failed: ${error instanceof Error ? error.message : "unknown error"}`,
        });
      }
    }
  }

  // USAspending awards, last five years. No key is required.
  let awards: EngineAward[] = [];
  {
    const endpoint = "https://api.usaspending.gov/api/v2/search/spending_by_award/";
    const body = {
      filters: {
        time_period: [{ start_date: yearsAgo(5), end_date: today }],
        award_type_codes: ["A", "B", "C", "D"],
        ...(naics ? { naics_codes: [naics] } : {}),
        ...(!naics && psc ? { psc_codes: [psc] } : {}),
      },
      fields: [
        "Award ID",
        "Recipient Name",
        "Awarding Agency",
        "Award Amount",
        "Start Date",
        "Contract Award Type",
        "Set Aside Type",
        "Extent Competed",
      ],
      limit: 25,
      page: 1,
      sort: "Award Amount",
      order: "desc",
      subawards: false,
    };
    const query = `POST ${endpoint} naics=${naics || "none"} psc=${psc || "none"} ${yearsAgo(5)} to ${today}`;
    // USAspending returns intermittent 525, 502, 503 and 504 responses, so the
    // search is retried up to three times with a growing backoff. A 4xx other
    // than 429 is a real answer and is never retried.
    const BACKOFF_MS = [500, 1500, 3500];
    const RETRY_STATUS = new Set([429, 502, 503, 504, 520, 521, 522, 523, 525]);
    let attempts = 0;
    let lastError = "";
    let rateLimited = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      attempts = attempt + 1;
      let retryable = true;
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const note = response.status === 525 ? " (TLS/origin)" : "";
          retryable = RETRY_STATUS.has(response.status) || response.status >= 500;
          if (response.status === 429) {
            if (rateLimited) retryable = false;
            rateLimited = true;
          }
          throw new Error(`api.usaspending.gov responded ${response.status}${note}`);
        }
        awards = awardsFromRaw(await response.json());
        lastError = "";
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "unknown network error";
        const wait = BACKOFF_MS[attempt];
        if (!retryable || wait === undefined) break;
        await new Promise((resolve) => setTimeout(resolve, wait + Math.round(Math.random() * 250)));
      }
    }
    if (lastError) {
      console.error(
        `[Market research] USAspending failed after ${attempts} attempt${attempts === 1 ? "" : "s"}: ${lastError}`,
      );
      record({
        source: "USAspending API, awards in the last five years",
        query,
        resultCount: null,
        outcome: `Failed after ${attempts} attempt${attempts === 1 ? "" : "s"}: ${lastError}. Using empty awards for this run.`,
      });
    } else {
      record({
        source: "USAspending API, awards in the last five years",
        query,
        resultCount: awards.length,
        outcome: awards.length ? "Returned awards." : "Returned no awards under this code.",
      });
    }
  }

  // SBA size standard, from the seeded table.
  let sizeStandardText = "";
  {
    const size = await options.supabaseAdmin
      .from("naics_size_standards")
      .select("naics_code,standard_type,employees,receipts_usd,citation,effective_date")
      .eq("naics_code", naics)
      .maybeSingle();
    const row = size.data as
      | {
          standard_type: string;
          employees: number | null;
          receipts_usd: number | null;
          citation: string | null;
          effective_date: string | null;
        }
      | null;
    if (row) {
      sizeStandardText =
        row.standard_type === "employees"
          ? `${row.employees ?? "not reported"} employees`
          : `${money(row.receipts_usd === null ? null : Number(row.receipts_usd))} average annual receipts`;
      record({
        source: `SBA table of small business size standards, NAICS ${naics}`,
        query: `naics_size_standards where naics_code = ${naics}`,
        resultCount: 1,
        outcome: `${sizeStandardText} (${row.citation ?? "citation not recorded"}, effective ${row.effective_date ?? "not recorded"}).`,
      });
    } else {
      record({
        source: `SBA table of small business size standards, NAICS ${naics}`,
        query: `naics_size_standards where naics_code = ${naics}`,
        resultCount: 0,
        outcome: "No size standard is seeded for this code, so none was written to the forms.",
      });
    }
  }

  // CALC+ ceiling rates. These are hourly ceiling rates on GSA schedule
  // contracts, so they only compare against a schedule buy or a labor-hour
  // priced requirement. A service product code or the word "services" in a
  // title is not enough: a commercial aviation charter is not priced by the
  // hour. The endpoint needs no key; a key is sent when one is configured.
  let calcNote = "";
  const titleText = String(acq["title"] ?? "");
  const requirementText = `${titleText} ${String(acq["description_of_requirement"] ?? "")}`.toLowerCase();
  const contractType = String(acq["contract_type"] ?? "").toLowerCase();
  const isSchedule = /8\.4|federal supply schedule|\bfss\b|gsa schedule|multiple award schedule|\bmas\b/i.test(method);
  const laborHour =
    /labor[- ]hour|\blh\b|time[- ]and[- ]materials|time and material|\bt&m\b/.test(contractType) ||
    /labor[- ]hour|time[- ]and[- ]materials|\bt&m\b/.test(`${method.toLowerCase()} ${requirementText}`);
  const runCalc = isSchedule || laborHour;
  if (runCalc) {
    const keywordMatch = requirementText.match(
      /\b(aviation|aircraft|flights?|pilot|engineering|maintenance|repair|technical|operations?|training|inspection|research|analysis|support|services?|labou?r)\b/,
    );
    const keyword = keywordMatch?.[1] ?? (psc || naics);
    const url = new URL("https://api.gsa.gov/acquisition/calc/v3/api/ceilingrates/");
    url.searchParams.set("page", "1");
    url.searchParams.set("page_size", "20");
    url.searchParams.set("ordering", "current_price");
    url.searchParams.set("sort", "asc");
    if (keyword) url.searchParams.set("keyword", keyword);
    if (calcKey) url.searchParams.set("api_key", calcKey);
    const query = redact(url, calcKey);
    try {
      const raw = object(await getJson(url, calcKey, 18_000));
      const hits = object(raw["hits"]);
      const rows = array(hits["hits"] ?? raw["results"] ?? raw["data"]);
      const totalValue = object(hits["total"])["value"] ?? hits["total"];
      const reported = num(totalValue ?? raw["count"] ?? raw["total_count"]);
      const count = reported ?? rows.length;
      calcNote = rows.length
        ? `GSA CALC+ returned ${rows.length} ceiling labor rates for “${keyword}”${
            reported !== null && reported > rows.length ? ` of ${reported} matching rates` : ""
          }. These are awarded ceiling hourly rates on GSA schedule contracts, a comparison point for hourly labor only. They are not a price for this requirement and do not cover materials, travel or other direct costs.`
        : "";
      record({
        source: "GSA CALC+ ceiling labor rates (GSA schedule hourly rates; comparison only)",
        query,
        resultCount: count,
        outcome: rows.length
          ? `Returned ceiling labor rates${calcKey ? "" : " without an API key, which CALC+ does not require"}. Scope: awarded hourly ceiling rates on GSA schedule contracts, used as a labor comparison point, not as a price for this buy.`
          : "Returned no comparable ceiling rates for this keyword.",
      });
    } catch (error) {
      record({
        source: "GSA CALC+ ceiling labor rates",
        query,
        resultCount: null,
        outcome: `The search failed: ${error instanceof Error ? error.message : "unknown error"}`,
      });
    }
  } else {
    record({
      source: "GSA CALC+ ceiling labor rates",
      query: "https://api.gsa.gov/acquisition/calc/v3/api/ceilingrates/ (not called)",
      resultCount: null,
      outcome:
        "Skipped: CALC+ publishes hourly ceiling rates on GSA schedule contracts, and this buy is neither a schedule buy nor priced by the labor hour, so those rates are not a comparison point for it.",
    });
  }
  if (isSchedule) {
    record({
      source: "GSA eLibrary schedule holders",
      query: `https://www.gsaelibrary.gsa.gov/ElibMain/scheduleList.do naics=${naics}`,
      resultCount: null,
      outcome: "Reference link recorded for the file. GSA eLibrary publishes no search API, so no count was captured.",
    });
  }

  // T-Minus's own prior actions under the same NAICS or PSC. These are records
  // in this system, never external awards.
  const prior = await options.supabaseAdmin
    .from("acquisition_facts")
    .select("acquisition_id,title,current_phase,set_aside,naics_code,psc_code,estimated_value,target_award_date")
    .or(
      [naics ? `naics_code.eq.${naics}` : null, psc ? `psc_code.eq.${psc}` : null]
        .filter(Boolean)
        .join(",") || `naics_code.eq.${naics}`,
    )
    .neq("acquisition_id", String(acq["acquisition_id"] ?? ""))
    .limit(10);
  const priorRows = ((prior.data ?? []) as Record<string, unknown>[]).map((r) => ({
    acquisitionId: String(r["acquisition_id"] ?? ""),
    title: String(r["title"] ?? ""),
    phase: String(r["current_phase"] ?? ""),
    setAside: String(r["set_aside"] ?? "Not recorded"),
  }));
  record({
    source: "T-Minus prior actions under the same NAICS or PSC",
    query: `acquisition_facts where naics_code = ${naics} or psc_code = ${psc || "—"}`,
    resultCount: priorRows.length,
    outcome: priorRows.length ? "Returned prior actions on this code." : "No prior action on this code is on file.",
  });

  const all = [...stateEntities, ...nationalEntities];
  const unique = new Map(all.map((e) => [e.uei, e]));
  const smallBusinessCount = [...unique.values()].filter((e) => e.smallBusiness === true && !e.excluded).length;

  return {
    runId,
    naics,
    psc,
    stateCode,
    acquisitionMethod: method,
    ranAt,
    stateEntities,
    nationalEntities,
    notices,
    noticesSearched,
    awards,
    priorActions: priorRows,
    sizeStandardText,
    calcNote,
    log,
    smallBusinessCount,
    ruleOfTwoMet: smallBusinessCount >= 2,
  };
}

import { isSoleSourceRecord, soleSourceFindings } from "@/lib/memo-draft";

export type DraftFinding = {
  target: string;
  label: string;
  value: string;
  source: string;
  sourceDate: string;
};

/**
 * The findings drafted from what the sources actually returned. A source that
 * returned nothing produces no finding, so no value is invented.
 */
export function draftFindings(result: EngineResult, acq: Record<string, unknown>): DraftFinding[] {
  const date = dateOnly(result.ranAt);
  const out: DraftFinding[] = [];
  const add = (target: string, label: string, value: string, source: string) => {
    if (value.trim()) out.push({ target, label, value: value.trim(), source, sourceDate: date });
  };

  const uniqueEntities = new Map(
    [...result.stateEntities, ...result.nationalEntities].map((e) => [e.uei, e]),
  );
  const entities = [...uniqueEntities.values()];
  const searched = result.log.filter((l) => l.resultCount !== null);

  // Paragraph 4: sources searched, dates and techniques.
  const techniques = searched
    .map((l) => `${l.source} on ${date}: ${l.resultCount} result${l.resultCount === 1 ? "" : "s"}`)
    .join("; ");
  const notRun = result.log.filter((l) => l.resultCount === null).map((l) => l.source);
  if (techniques) {
    add(
      "memo.research",
      "Memorandum paragraph 4, sources searched",
      `${techniques}.${notRun.length ? ` Not searched: ${notRun.join("; ")}.` : ""}`,
      "market research evidence engine",
    );
  }

  // Paragraph 5: the findings sentence the record's competition calls for. A
  // sole-source or brand-name file never carries a Rule of Two conclusion.
  const soleSource = isSoleSourceRecord(acq);
  const soleSourceSentence = soleSourceFindings(
    acq,
    { n: entities.length, m: result.smallBusinessCount },
    false,
  );
  // Where the searches return the same entity in more than one geography or
  // source, the findings figure counts each entity once. That relationship is
  // said in plain words so the paragraph's number and the line counts above it
  // read honestly together. No new number is introduced.
  const rawCount = result.stateEntities.length + result.nationalEntities.length;
  const dedupeSentence =
    rawCount > entities.length
      ? " This figure is de-duplicated across the sources and geographies searched, so an entity found in more than one search is counted once."
      : "";
  if (entities.length) {
    add(
      "memo.findings",
      "Memorandum paragraph 5, findings",
      soleSource
        ? `${soleSourceSentence}${dedupeSentence}`
        : `${entities.length} source${entities.length === 1 ? "" : "s"} were identified under NAICS ${result.naics}, of which ${result.smallBusinessCount} are registered as small business under that code.${dedupeSentence} The expectation of offers from two or more responsible small business concerns at fair market prices is ${
            result.ruleOfTwoMet ? "met" : "not met"
          } (FAR 19.502-2).`,
      "SAM.gov Entity Management API",
    );
  }

  if (result.sizeStandardText) {
    add(
      "nf1787.size_standard",
      "NF 1787 size standard",
      result.sizeStandardText,
      "SBA table of small business size standards",
    );
  }

  const setAsideEvidence = entities.length
    ? `${soleSource ? "Market research: " : "Set-aside evidence: "}${entities.length} registrants under NAICS ${result.naics}${
        result.stateCode ? ` (${result.stateEntities.length} in ${result.stateCode})` : ""
      }, ${result.smallBusinessCount} small business. ${
        soleSource ? soleSourceSentence : `Rule of Two ${result.ruleOfTwoMet ? "met" : "not met"} (FAR 19.502-2).`
      }${
        result.awards.length ? ` ${result.awards.length} comparable federal awards in the last five years.` : ""
      }${result.notices.length ? ` ${result.notices.length} notices posted under this code in the last three years.` : ""}`
    : "";
  add("nf1787.remarks", "NF 1787 remarks", setAsideEvidence, "market research evidence engine");

  // NF 1787A research methods, each with its text field.
  if (entities.length) {
    add("nf1787a.ckResults", "NF 1787A, results of the search", "Yes", "SAM.gov Entity Management API");
    add(
      "nf1787a.IdentifyResults",
      "NF 1787A, identify the results",
      `${entities.length} registrants identified under NAICS ${result.naics}; ${result.smallBusinessCount} small business. ${entities
        .slice(0, 5)
        .map((e) => `${e.legalName} (${e.uei}, ${e.smallBusinessLabel})`)
        .join("; ")}.${soleSource ? ` ${soleSourceSentence}` : ""}`,
      "SAM.gov Entity Management API",
    );
    add("nf1787a.ckQuery", "NF 1787A, database query", "Yes", "SAM.gov Entity Management API");
    add(
      "nf1787a.CiteInformation",
      "NF 1787A, information cited",
      `SAM.gov Entity Management API and Opportunities API queried on ${date} for NAICS ${result.naics}${
        result.stateCode ? ` and state ${result.stateCode}` : ""
      }; USAspending queried for awards since ${yearsAgo(5)}.`,
      "SAM.gov and USAspending",
    );
  }
  if (result.awards.length || result.priorActions.length) {
    add(
      "nf1787a.ckHistory",
      "NF 1787A, procurement history",
      "Yes",
      result.awards.length ? "USAspending API" : "T-Minus prior actions",
    );
    const history = [
      result.awards.length
        ? `${result.awards.length} federal awards under this code in the last five years, largest ${money(result.awards[0]?.amount ?? null)} to ${result.awards[0]?.vendor ?? "not reported"} (${result.awards[0]?.competition ?? "extent of competition not reported"}).`
        : "",
      result.priorActions.length
        ? `${
            result.awards.length ? "" : `USAspending unavailable; showing prior T-Minus actions on NAICS ${result.naics} / PSC ${result.psc || "—"}. `
          }Prior T-Minus actions on this code: ${result.priorActions.map((p) => `${p.acquisitionId} ${p.title}`).join("; ")}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    add(
      "nf1787a.ProcurementHistory",
      "NF 1787A, procurement history detail",
      history,
      result.awards.length ? "USAspending API and T-Minus" : "T-Minus prior actions",
    );
  }
  if (result.sizeStandardText) {
    add("nf1787a.ckSBA", "NF 1787A, SBA size standard reviewed", "Yes", "SBA size standards table");
    add(
      "nf1787a.SBA",
      "NF 1787A, SBA size standard",
      `The SBA size standard for NAICS ${result.naics} is ${result.sizeStandardText}.`,
      "SBA table of small business size standards",
    );
  }
  if (searched.length) {
    add("nf1787a.ckMarketResearch", "NF 1787A, market research performed", "Yes", "market research evidence engine");
    add(
      "nf1787a.MarketResearch",
      "NF 1787A, market research summary",
      `${searched.length} public sources searched on ${date}${result.calcNote ? `. ${result.calcNote}` : ""}. ${
        result.notices.length
          ? `${result.notices.length} notices under this code in the last three years.`
          : result.noticesSearched
            ? "No notices were returned under this code in the last three years."
            : "The notices search did not return; see the research log."
      }`,
      "market research evidence engine",
    );
  }

  if (entities.length) {
    add(
      "nf1787a.respondents",
      "NF 1787A, respondents table",
      JSON.stringify(
        entities.slice(0, 10).map((e) => ({
          uei: e.uei,
          name: e.legalName,
          category: e.socioeconomic,
          assessment: `${e.smallBusinessLabel}${e.excluded ? ", active exclusion in SAM.gov" : ", no active exclusion"}; registered in ${e.state}.`,
        })),
      ),
      "SAM.gov Entity Management API",
    );
  }

  const commercialFromAwards = result.awards.filter((a) => /commercial/i.test(a.type)).length;
  const commercialText = result.awards.length
    ? `${result.awards.length} comparable federal awards were placed under this code in the last five years${
        commercialFromAwards ? `, ${commercialFromAwards} using commercial procedures` : ""
      }, which indicates ${result.awards.length > 1 ? "an established market" : "a limited market"} for this requirement.${
        String(acq["commercial_determination"] ?? "")
          ? ` The record states the requirement is ${String(acq["commercial_determination"])}.`
          : ""
      }`
    : "";
  add("nf1787a.commerciality", "NF 1787A, commerciality", commercialText, "USAspending API");

  return out;
}
