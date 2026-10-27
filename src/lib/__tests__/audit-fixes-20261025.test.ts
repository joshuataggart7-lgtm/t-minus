import { describe, expect, it } from "vitest";
import { todayCT, addCalendarDays } from "@/lib/calendar-date";
import { addDays, daysBetween } from "@/lib/deviations";

// Audit 2026-10-25, H4: "today" must be the America/Chicago date, not the UTC date.
describe("H4 local dates", () => {
  it("8 PM CDT is still the same Chicago day (UTC is already tomorrow)", () => {
    const evening = new Date("2026-10-26T01:00:00Z"); // Oct 25, 8:00 PM CDT
    expect(evening.toISOString().slice(0, 10)).toBe("2026-10-26");
    expect(todayCT(evening)).toBe("2026-10-25");
  });
  it("6:30 PM CST in winter stays on the Chicago day", () => {
    expect(todayCT(new Date("2026-12-02T00:30:00Z"))).toBe("2026-12-01");
  });
  it("deviation addDays counts from the Chicago day", () => {
    expect(addDays(new Date("2026-10-26T01:00:00Z"), 10)).toBe("2026-11-04");
    expect(addCalendarDays("2026-10-25", -90)).toBe("2026-07-27");
  });
});

import { presolicitationNote, presolicitationNotRequired } from "@/lib/presolicitation-note";
// M1: RFO FAR 5.101(a) "greater than $20,000".
describe("M1 presolicitation threshold", () => {
  it("blank or zero asks for a value", () => {
    expect(presolicitationNote({}, false)).toContain("Enter an estimated value");
    expect(presolicitationNote({ estimated_value: 0 }, false)).toContain("Enter an estimated value");
    expect(presolicitationNotRequired({})).toBe(false);
  });
  it("at or below $20,000 says no notice is required", () => {
    expect(presolicitationNote({ estimated_value: 20_000 }, false)).toBe("No presolicitation notice required at or below $20,000 (RFO FAR 5.101(a)).");
    expect(presolicitationNote({ estimated_value: 8_500 }, true)).toContain("No presolicitation notice required");
    expect(presolicitationNotRequired({ estimated_value: 8_500 })).toBe(true);
  });
  it("$20,001 gets the 10-day row and $25,001 the 15-day row", () => {
    expect(presolicitationNote({ estimated_value: 20_001 }, false).startsWith("10 days")).toBe(true);
    expect(presolicitationNote({ estimated_value: 25_001 }, false).startsWith("15 days")).toBe(true);
    expect(presolicitationNotRequired({ estimated_value: 20_001 })).toBe(false);
  });
});

import { FAIR_OPPORTUNITY_EXCEPTIONS } from "@/lib/vehicles";
describe("M7/L10 fair opportunity exceptions", () => {
  it("offers the NASA part 6.103 exception under 16.507-6(b)(6)", () => {
    expect(FAIR_OPPORTUNITY_EXCEPTIONS.find((e) => e.key === "part6_nasa")?.citation).toBe("RFO FAR 16.507-6(b)(6)");
  });
  it("cites brand name to 16.507-7(a), not 11.204", () => {
    expect(FAIR_OPPORTUNITY_EXCEPTIONS.find((e) => e.key === "brand_name")?.citation).toBe("RFO FAR 16.507-7(a)");
  });
});

import { nf1787aExplanation } from "@/lib/nf1787";
describe("L11 NF 1787A at $2M", () => {
  it("required only above $2M, recommended at exactly $2M", () => {
    expect(nf1787aExplanation(2_000_001)).toMatch(/required/);
    expect(nf1787aExplanation(2_000_001)).not.toMatch(/not required/);
    expect(nf1787aExplanation(2_000_000)).toMatch(/recommended/);
    expect(nf1787aExplanation(1_999_999)).toMatch(/optional/);
  });
});

describe("deviations daysBetween on the CT calendar", () => {
  it("counts a YYYY-MM-DD target without a UTC shift", () => {
    expect(daysBetween(new Date("2026-10-26T03:00:00Z"), "2026-10-27")).toBe(2);
    expect(daysBetween("2026-10-25", "2026-10-25")).toBe(0);
  });
});
