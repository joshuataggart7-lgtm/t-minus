import { describe, expect, it } from "vitest";
import { TEMPLATES, validate } from "@/lib/template-engine";

// Audit follow-up: a required field the user cannot see must never block a save.
describe("hidden required fields", () => {
  it("validate() never reports a field that is hidden by showIf", () => {
    let checked = 0;
    for (const def of TEMPLATES) {
      const errors = validate(def, {});
      for (const s of def.sections) {
        const sectionHidden = s.showIf ? !s.showIf({}) : false;
        for (const f of s.fields) {
          const hidden = sectionHidden || (f.showIf ? !f.showIf({}) : false);
          if (f.required && hidden) {
            checked++;
            expect(errors[f.key], `${def.key}.${f.key}`).toBeUndefined();
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("validate() reports a visible required field left blank", () => {
    const def = TEMPLATES.find((t) => t.key === "sam-notice")!;
    expect(validate(def, {})["notice_type"]).toBeDefined();
  });
});

import { sortRefsNewestFirst } from "@/lib/about";
describe("LA14 regulatory references newest first", () => {
  it("sorts text dates by date, not alphabetically", () => {
    const out = sortRefsNewestFirst([
      { effective_date: "September 30, 2025" },
      { effective_date: null },
      { effective_date: "October 1, 2025" },
      { effective_date: "June 23, 2026" },
    ]).map((r) => r.effective_date);
    expect(out).toEqual(["June 23, 2026", "October 1, 2025", "September 30, 2025", null]);
  });
});
