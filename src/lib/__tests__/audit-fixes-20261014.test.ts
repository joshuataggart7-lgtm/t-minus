import { describe, expect, it } from "vitest";
import { presolicitationNote } from "@/lib/presolicitation-note";
import { hasOptionClause, optionNoticeCitation } from "@/lib/vehicles";

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
