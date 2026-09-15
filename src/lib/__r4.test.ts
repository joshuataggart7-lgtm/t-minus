import { describe, it, expect } from "vitest";
import { researchLogLines, draftMemoBody } from "@/lib/memo-draft";

describe("round 4", () => {
  it("prints a source without its URL", () => {
    const [line] = researchLogLines([
      {
        source: "SAM.gov Entity Management API, NAICS 481219 in CA",
        query:
          "https://api.sam.gov/entity-information/v3/entities?api_key=X&naicsCode=481219&registrationStatus=A&physicalAddressProvinceOrStateCode=CA",
        ranAt: "2026-09-15T03:48:35Z",
        count: 10,
        outcome: "Returned registrants.",
      },
      {
        source: "SAM.gov Opportunities API",
        query: "https://api.sam.gov/opportunities/v2/search?api_key=X&ncode=481219&postedFrom=09%2F16%2F2025&postedTo=09%2F15%2F2026",
        ranAt: "2026-09-15T03:48:35Z",
        count: 7,
        outcome: "Returned notices.",
      },
    ]);
    expect(line).toBe("SAM.gov Entity Management API, NAICS 481219 in CA · NAICS 481219, CA place of performance · 2026-09-15 · 10 results");
    expect(line).not.toContain("http");
  });

  it("drafts a chronology with events and ordered phases", () => {
    const out = draftMemoBody("memorandum-for-record", {
      acquisitionId: "A-1",
      acq: { pr_number: "PR-1", title: "T", current_phase: "Market Research" },
      missionName: "M",
      fileDocuments: [],
      evidence: { runOn: "2026-08-10", sources: 4, smallBusinesses: 3 },
      today: "2026-09-15",
      values: { purpose: "Chronology of the acquisition to date" },
      researchLog: [
        { source: "SAM.gov Entity Management API", query: "x?naicsCode=481219", ranAt: "2026-08-10T00:00:00Z", count: 10, outcome: "ok" },
        { source: "SAM.gov Opportunities API", query: "x?ncode=481219", ranAt: "2026-08-10T00:00:00Z", count: 7, outcome: "ok" },
      ],
      audit: [
        { action: "Intake submitted; clock started", field: null, actor: "A. Reyes", reason: null, phase: "Intake", at: "2026-08-01T10:00:00Z" },
        { action: "Document attached", field: "sow_attached", actor: "A. Reyes", reason: "Statement of work", phase: null, at: "2026-08-02T10:00:00Z" },
        { action: "Clock on hold", field: null, actor: "A. Reyes", reason: "IGCE is missing", phase: "Intake", at: "2026-08-05T10:00:00Z" },
        { action: "Clock resumed", field: null, actor: "A. Reyes", reason: "Cause cleared", phase: "Intake", at: "2026-08-06T10:00:00Z" },
        { action: "Market research run", field: null, actor: "A. Reyes", reason: null, phase: "Market Research", at: "2026-08-10T10:00:00Z" },
        { action: "Poll opened", field: null, actor: "A. Reyes", reason: null, phase: "Market Research", at: "2026-08-12T10:00:00Z" },
      ],
      phases: [
        { phase: "Intake", status: "complete" },
        { phase: "Market Research", status: "current" },
      ],
    } as never);
    const body = out["body"]!;
    expect(body).toContain("entered the Intake phase on 2026-08-01 and left it on 2026-08-06");
    expect(body).toContain("attached Statement of work on 2026-08-02");
    expect(body).toContain("IGCE is missing");
    expect(body).toContain("entered the Market Research phase on 2026-08-06");
    expect(body).toContain("10 registrants and 7 notices after duplicates were removed");
    expect(body).toContain("go/no-go poll was opened on 2026-08-12");
  });
});
