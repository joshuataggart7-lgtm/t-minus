import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRole } from "@/components/role-context";

// Scope line from the persona's Center. Unknown codes keep the Ames line.
const CENTER_NAMES: Record<string, string> = {
  AFRC: "Armstrong Flight Research Center",
  ARC: "Ames Research Center",
  GRC: "Glenn Research Center",
  GSFC: "Goddard Space Flight Center",
  JPL: "Jet Propulsion Laboratory",
  JSC: "Johnson Space Center",
  KSC: "Kennedy Space Center",
  LARC: "Langley Research Center",
  MSFC: "Marshall Space Flight Center",
  NSSC: "NASA Shared Services Center",
  SSC: "Stennis Space Center",
};

function scopeLabel(centerCode: string | null | undefined): string {
  const code = String(centerCode ?? "").trim().toUpperCase();
  if (code === "HQ") return "NASA Headquarters · Agency view";
  const name = CENTER_NAMES[code];
  return name ? `${name} · Office of Procurement` : "Ames Research Center · Office of Procurement";
}

export function MissionMasthead() {
  const [scopeOpen, setScopeOpen] = useState(false);
  const { user } = useRole();
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
          <strong>{scopeLabel(user?.center_code)}</strong>
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
