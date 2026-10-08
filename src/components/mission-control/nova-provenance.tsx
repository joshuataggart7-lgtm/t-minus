import { useState } from "react";
import { Nova } from "@/components/nova";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProvenanceChip, type ProvenanceKind } from "./primitives";

const PROVENANCE = [
  { key: "Fact", detail: "Read straight from the acquisition record." },
  { key: "Rule", detail: "Worked out by a T-Minus rule from the recorded facts and the loaded references." },
  { key: "Inference", detail: "Inferred from recorded facts and the loaded rules." },
  { key: "Draft", detail: "Proposed text that a person has to review." },
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
              <ProvenanceChip kind={item.key.toUpperCase() as ProvenanceKind} markerOnly />
              {item.key}
            </Button>
          ))}
        </div>
        <p className="mc-nova-assurance">Actions require your confirmation. Drafts are never written on their own.</p>
        {selected ? (
          <div className="mc-provenance-panel" role="status">
            <span>What this means</span>
            <strong>{selected.key}</strong>
            <p>{selected.detail}</p>
          </div>
        ) : null}
      </div>
      <Nova className="mc-nova-action" />
    </section>
  );
}