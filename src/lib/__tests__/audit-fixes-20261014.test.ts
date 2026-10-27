import { describe, expect, it } from "vitest";
import { presolicitationNote } from "@/lib/presolicitation-note";
import { hasOptionClause, optionNoticeCitation } from "@/lib/vehicles";
import { resolveSampleMemoSignature } from "@/lib/softwalk-samples";

describe("Sample 1 officer of record", () => {
  it("uses J. Rivera instead of a stale saved signature on A-2027-0101", () => {
    expect(resolveSampleMemoSignature("A-2027-0101", "M. Corvane (fictional CO)", "J. Rivera (fictional CO)"))
      .toBe("J. Rivera (fictional CO)");
  });
  it("keeps other files' saved signatures unchanged", () => {
    expect(resolveSampleMemoSignature("A-2027-0102", "S. Varnell (fictional CO)", "J. Rivera (fictional CO)"))
      .toBe("S. Varnell (fictional CO)");
  });
});

describe("Table 5-2 presolicitation note (RFO FAR 5.101(d))", () => {
  it("over $20,000 to $25,000 is 10 days with the GPE exemption", () => {
    const n = presolicitationNote({ estimated_value: 22_000 } as never, false);
    expect(n.startsWith("10 days")).toBe(true);
    expect(n).toContain("RFO FAR 5.101(b)(1)(i)");
  });
  it("over $25,000 to the SAT is 15 days before solicitation", () => {
    expect(presolicitationNote({ estimated_value: 200_000 } as never, false).startsWith("15 days before solicitation")).toBe(true);
  });
  it("commercial over the SAT is combined with the solicitation", () => {
    expect(presolicitationNote({ estimated_value: 820_000 } as never, true)).toContain("combined with the solicitation");
  });
});

describe("option notice cite", () => {
  it("cites 52.217-9(a) only when the packet carries 52.217-9", () => {
    expect(optionNoticeCitation({ contract_clauses: ["52.217-9"] })).toContain("52.217-9(a)");
    expect(optionNoticeCitation({ contract_clauses: ["52.212-4"] })).toBe("RFO FAR 17.204-1(b)(1)");
    expect(hasOptionClause(null)).toBe(false);
  });
});

import { presolNotRequired } from "@/lib/template-engine";
describe("LA17 presolicitation not required at or below $20,000", () => {
  it("flags $8,500 and passes $25,000 and blank", () => {
    expect(presolNotRequired({ estimated_value: "$8,500" })).toBe(true);
    expect(presolNotRequired({ estimated_value: "25000" })).toBe(false);
    expect(presolNotRequired({})).toBe(false);
    expect(presolNotRequired({ estimated_value: "TBD" })).toBe(false);
    expect(presolNotRequired({ estimated_value: "$1.2M" })).toBe(false);
    expect(presolNotRequired({ estimated_value: "$20,000.00" })).toBe(true);
  });
});
