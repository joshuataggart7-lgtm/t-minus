import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useRole } from "@/components/role-context";
import { supabase } from "@/integrations/supabase/client";

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
  const { user, profile, canSwitchPersona, isAnonymous } = useRole();
  // A real signed-in account reads its own Center: the roster row linked to the
  // account, then the Center last used at intake. Demo personas keep the
  // persona's Center.
  const realAccount = !canSwitchPersona && !isAnonymous && Boolean(profile?.id);
  const ownCenter = useQuery({
    queryKey: ["masthead-center", profile?.id ?? null],
    enabled: realAccount,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("users").select("center_code").eq("user_id", profile!.id).maybeSingle();
      return (data?.center_code as string | null | undefined) ?? null;
    },
  });
  const centerCode = realAccount ? ownCenter.data || profile?.last_center_code || user?.center_code : user?.center_code;
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
          <strong>{scopeLabel(centerCode)}</strong>
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
