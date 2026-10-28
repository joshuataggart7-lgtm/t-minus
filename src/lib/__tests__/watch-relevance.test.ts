import { describe, expect, it } from "vitest";
import { isAcquisitionRelevant } from "@/lib/watch-fetch.server";

describe("LA15 watch relevance", () => {
  it("drops the Medicare Part D rule and keeps acquisition items", () => {
    expect(
      isAcquisitionRelevant(
        "Medicare Program; Implementation of Sections 6219, 6220, and 6224 of the Consolidated Appropriations Act, 2026",
        "This proposed rule would implement section 6219 (Adjustments to Medicare Part D Cost-Sharing Reductions for Low-Income Individuals)",
        "Health and Human Services Department, Centers for Medicare & Medicaid Services",
      ),
    ).toBe(false);
    expect(isAcquisitionRelevant("Information Collection Requirement; Defense Federal Acquisition Regulation Supplement (DFARS) Parts 223 and 226", "")).toBe(true);
  });
});

describe("LA15 watch relevance by agency", () => {
  it("keeps a GSA form clearance that never says FAR", () => {
    expect(isAcquisitionRelevant("Submission for OMB Review; Architect-Engineer Qualifications (SF-330)", "", "General Services Administration")).toBe(true);
  });
  it("does not treat the word far as FAR", () => {
    expect(isAcquisitionRelevant("Medicare Program; payment update", "Results so far show far fewer claims.", "Centers for Medicare & Medicaid Services")).toBe(false);
  });
});
