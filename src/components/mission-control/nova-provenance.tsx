import { useState } from "react";
import { Nova } from "@/components/nova";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PROVENANCE = [
  { key: "Fact", detail: "A value read from the loaded acquisition record." },
  { key: "Rule", detail: "A requirement read from the loaded regulatory references." },
  { key: "Inference", detail: "A conclusion derived from record facts and loaded rules." },
  { key: "Draft", detail: "Proposed language that requires human review and confirmation." },
] as const;

export function NovaProvenance() {
  const [active, setActive] = useState<(typeof PROVENANCE)[number]["key"] | null>(null);
  const selected = PROVENANCE.find((item) => item.key === active);

  return (
    <section className="mc-nova-provenance" aria-labelledby="nova-attention-heading">
      <div className="mc-nova-copy">
        <p className="mc-label">Nova · contextual assist</p>
        <h2 id="nova-attention-heading">Ask against loaded rules and records.</h2>
        <div className="mc-provenance-chips" aria-label="Nova provenance types">
          {PROVENANCE.map((item) => (
            <Button
              key={item.key}
              type="button"
              variant="ghost"
              size="sm"
              className={cn("mc-provenance-chip", active === item.key && "is-active")}
              aria-pressed={active === item.key}
              onClick={() => setActive(active === item.key ? null : item.key)}
            >
              <span aria-hidden="true" />
              {item.key}
            </Button>
          ))}
        </div>
        <p className="mc-nova-assurance">Actions require your confirmation — drafts are never auto-written.</p>
        {selected ? (
          <div className="mc-provenance-panel" role="status">
            <span>Preview</span>
            <strong>{selected.key}</strong>
            <p>{selected.detail}</p>
          </div>
        ) : null}
      </div>
      <Nova className="mc-nova-action" />
    </section>
  );
}