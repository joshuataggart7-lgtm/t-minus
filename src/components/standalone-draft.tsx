import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { TEMPLATES, MFR_KEY } from "@/lib/template-engine";

/**
 * Standalone draft. Any live template in the catalog can be drafted onto an
 * open file without a Required row on the launch sequence. The draft saves and
 * exports like any other document, and it is labelled so nobody reads it as a
 * new award requirement.
 */
export function StandaloneDraft({
  acquisitionId,
  canWrite,
}: {
  acquisitionId: string;
  canWrite: boolean;
}) {
  const navigate = useNavigate();
  const [key, setKey] = useState("");

  const options = useMemo(
    () => TEMPLATES.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  if (!canWrite) return null;

  const open = (templateKey: string, situation?: boolean) => {
    void navigate({
      to: "/documents/$templateKey/$acquisitionId",
      params: { templateKey, acquisitionId },
      search: situation ? { standalone: 1, situation: 1 } : { standalone: 1 },
    });
  };

  return (
    <section className="mt-10 max-w-[720px]">
      <h2 className="text-[18px] leading-6 font-medium">Draft a document outside the sequence</h2>
      <p className="mt-2 max-w-[70ch] text-[15px] leading-[22px] text-muted-foreground">
        Pick any live template and draft it from this file's record. It is saved as a standalone
        draft and does not add a required row to the launch sequence.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[280px]">
          <label htmlFor="standalone-template" className="block text-[13px] text-muted-foreground">
            Live template
          </label>
          <select
            id="standalone-template"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-[15px]"
          >
            <option value="">Choose a template</option>
            {options.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <Button size="sm" disabled={!key} onClick={() => key && open(key)}>
          Draft this document
        </Button>
        <Button variant="ghost" size="sm" onClick={() => open(MFR_KEY, true)}>
          Situation memo starter
        </Button>
      </div>
      <p className="mt-3 max-w-[70ch] text-[13px] text-muted-foreground">
        The situation memo starter opens a memorandum for record scaffolded with this file's
        phase, clock state, hold and dates, for an unexpected event. It is not an award
        requirement.
      </p>
    </section>
  );
}
