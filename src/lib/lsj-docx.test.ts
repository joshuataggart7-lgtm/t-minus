import { describe, expect, it } from "vitest";
import { LSJ_AUTH_CITATIONS, lsjMarkers, selectLsjAuthority, selectLsjSigBand } from "./lsj-docx";

const ctx = (estimated: string, authority: string) =>
  ({
    acquisitionId: "A-2027-0101",
    centerName: "Ames Research Center (ARC)",
    coName: "Joshua Taggart",
    values: { estimated_value: estimated, authority },
  }) as never;

describe("LSJ Word markers", () => {
  it("prints exactly one authority cite, on FAR 8.401(b)", () => {
    const map = lsjMarkers(ctx("1385000", "unusual urgency"));
    const printed = Object.entries(map).filter(([k, v]) => k.startsWith("[[AUTH_") && v.trim().length > 1);
    expect(printed).toHaveLength(1);
    expect(printed[0]![1]).toBe(LSJ_AUTH_CITATIONS.AUTH_URGENCY);
    expect(printed[0]![1]).toContain("FAR 8.401(b)");
    expect(printed[0]![1]).not.toContain("8.104(b)");
  });

  it("keeps exactly one signature band, amount driven", () => {
    for (const amount of ["500000", "1385000", "45000000", "200000000"]) {
      const map = lsjMarkers(ctx(amount, "only one source"));
      const kept = Object.entries(map).filter(([k, v]) => k.startsWith("[[SIG_BAND_") && v !== "");
      expect(kept).toHaveLength(1);
    }
    expect(selectLsjSigBand(1_385_000)).toBe("GT_900K_LE_20M");
    expect(selectLsjSigBand(200_000_000)).toBe("GE_150M");
  });

  it("fills the contracting officer name from the record", () => {
    expect(lsjMarkers(ctx("1385000", "unusual urgency"))["[[CO_NAME]]"]).toBe("Joshua Taggart");
  });

  it("never invents an authority when the record is blank", () => {
    expect(selectLsjAuthority("")).toBe("AUTH_ONE_SOURCE");
  });
});
