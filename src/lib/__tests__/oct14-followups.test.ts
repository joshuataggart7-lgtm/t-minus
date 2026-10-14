import { describe, expect, it, vi } from "vitest";
// Review/date tests do not initialize the unrelated document-template catalog.
vi.mock("@/lib/template-engine", () => ({ TEMPLATES: [], EMPTY_FIELD: "Not recorded", MFR_SITUATION_PURPOSE: "Record of an unexpected event affecting the schedule" }));
import { formatDate, formatStamp } from "@/lib/metrics";
import { daysSince, daysUntil } from "@/lib/desk-data";
import { receiptsSizeStandard } from "@/lib/size-standard";
import { nf1787Trigger } from "@/lib/nf1787-trigger";
import { pollBoard, pendingRequiredReviews, requestedReviewsOffBoard, type AcqRow, type PollRow, type ReviewRuleRow } from "@/lib/launch-sequence";
import type { RefData } from "@/lib/intake";

describe("CT dates", () => {
  it("keeps evening UTC rollover on the Chicago calendar date", () => {
    expect(formatDate("2026-10-15T00:30:00Z")).toBe("Oct 14, 2026");
    expect(formatStamp("2026-10-15T00:30:00Z")).toBe("Oct 14, 2026, 7:30 PM CT");
  });
  it("never shifts a bare calendar date", () => {
    expect(formatDate("2026-10-15")).toBe("Oct 15, 2026");
    expect(formatStamp("2026-10-15")).toBe("Oct 15, 2026");
  });
  it("uses CST in winter and preserves calendar days across DST", () => {
    expect(formatStamp("2026-12-15T00:30:00Z")).toBe("Dec 14, 2026, 6:30 PM CT");
    expect(daysSince("2026-03-08", new Date("2026-03-09T05:30:00Z"))).toBe(1);
    expect(daysUntil("2026-10-15T00:30:00Z", new Date("2026-10-14T17:00:00Z"))).toBe(0);
  });
});

it("formats the 481219 table value as 25.0 million in receipts", () => {
  expect(receiptsSizeStandard(25_000_000)).toBe("$25.0 million in average annual receipts");
});

it("uses the relocated set-aside authority above the micro-purchase threshold", () => {
  expect(nf1787Trigger({ estimated_value: 1_450_000, set_aside: "None" }).advisory).toContain("RFO FAR 19.104-1(b)(1)");
});

it("Sample 1 has four required reviews, with one optional small-business request kept separate", () => {
  const roles = ["Legal review (Center Chief Counsel)", "Small business coordination (NF 1787, Center SBS and SBA PCR)", "Enterprise strategy coordination", "Flight Operations Office concurrence", "Aviation safety: Flight Operations Office, airworthiness review, and S&MA involvement"];
  const rules: ReviewRuleRow[] = roles.map((reviewer_role, i) => ({ rule_id: String(i), reviewer_role, trigger: null, citation: null, planned_days: 5, note: null }));
  const acq: AcqRow = { acquisition_id: "A-2027-0101", estimated_value: 1_450_000, set_aside: "Total small business set-aside", title: "Aircraft flight services", enterprise_psl_check: "A-102.7 reviewed", nf1707_answers: { "Section5s5.Section5s5.S5Vn2": "1" } };
  const ref: RefData = { thresholds: [{ name: "Simplified acquisition threshold", value: 350_000, citation: null, note: null }], phasePlan: [], strategies: [{ psl: "A-102.7", name: "Aircraft", buying_location: null, mandatory_vehicles: null, required_coordination: "Flight Operations" }] };
  const polls: PollRow[] = roles.map((reviewer_role, i) => ({ poll_id: String(i), acquisition_id: acq.acquisition_id, phase: "Reviews and approvals", reviewer_role, reviewer_name: "Fictional reviewer", vote: "pending", reason: null, due_date: "2026-10-25" }));
  const board = pollBoard(acq, rules, polls, ref, null);
  expect(pendingRequiredReviews(board)).toHaveLength(4);
  expect(board.map((r) => r.reviewer_role)).toEqual([roles[0], roles[2], roles[3], roles[4]]);
  expect(requestedReviewsOffBoard(acq, polls, board)).toHaveLength(1);
  expect(pendingRequiredReviews(board.map((r, i) => i === 0 ? { ...r, vote: "favorable" } : r))).toHaveLength(3);
});