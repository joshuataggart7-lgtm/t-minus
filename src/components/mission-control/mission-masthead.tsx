import { useState } from "react";
import { Button } from "@/components/ui/button";

export function MissionMasthead() {
  const [scopeOpen, setScopeOpen] = useState(false);
  return (
    <header className="mc-masthead" aria-labelledby="executive-overview-title">
      <div className="mc-masthead-brand">
        <img src="/brand/nasa-insignia.png" alt="NASA" className="mc-masthead-insignia" />
        <div className="min-w-0">
          <p className="mc-masthead-kicker">NASA · T–MINUS</p>
          <h1 id="executive-overview-title" className="mc-masthead-title">
            Procurement Mission Control
          </h1>
        </div>
      </div>
      <div className="mc-scope-preview">
        <Button
          type="button"
          variant="ghost"
          className="mc-masthead-office"
          aria-expanded={scopeOpen}
          onClick={() => setScopeOpen((open) => !open)}
        >
          <span>Scope</span>
          <strong>Ames Research Center · Office of Procurement</strong>
        </Button>
        <div className="mc-scope-tip" data-open={scopeOpen || undefined}>
          <span>Preview</span>
          Enterprise → Center → Office → Acquisition
        </div>
      </div>
      <p className="mc-masthead-purpose">T-Minus turns acquisition time into mission readiness.</p>
    </header>
  );
}
