// Enterprise PSL check above SAT — advisory only. Never holds the file and
// never blocks a phase exit. Every figure comes from the seeded tables.

import { useQuery } from "@tanstack/react-query";
import {
  aboveSatStrategies,
  enterprisePslAdvisory,
  loadEnterpriseStrategies,
  loadSatThreshold,
} from "@/lib/enterprise-psl";

export function EnterprisePslPanel({ acq }: { acq: Record<string, unknown> | null | undefined }) {
  const satQ = useQuery({ queryKey: ["sat-threshold"], queryFn: loadSatThreshold });
  const stratQ = useQuery({ queryKey: ["enterprise-strategies"], queryFn: loadEnterpriseStrategies });

  if (!acq) return null;
  const advisory = enterprisePslAdvisory(acq, satQ.data ?? null);
  const reference = advisory.showReference ? aboveSatStrategies(stratQ.data ?? []) : [];

  return (
    <section
      id="enterprise-psl"
      aria-label="Enterprise PSL check"
      className="mb-10 max-w-[80ch] rounded-xl border border-border bg-background p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[18px] leading-6 font-medium">Enterprise PSL check</h2>
        <span className="text-[13px] text-muted-foreground">
          Advisory — never holds the file or blocks a phase exit.
        </span>
      </div>

      <p className="mt-2 text-[15px] leading-[22px]">{advisory.headline}</p>
      <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">{advisory.detail}</p>

      {advisory.recordedCheck ? (
        <p className="mt-3 border-t border-border pt-2 text-[15px] leading-[22px]">
          <span className="font-medium">Recorded on this file:</span> {advisory.recordedCheck}
        </p>
      ) : null}

      {reference.length > 0 ? (
        <details className="mt-3 border-t border-border pt-2">
          <summary className="cursor-pointer text-[13px] leading-[18px] text-muted-foreground">
            Enterprise strategies that apply above the simplified acquisition threshold ({reference.length}) — read-only reference
          </summary>
          <p className="mt-2 text-[13px] leading-[18px] text-muted-foreground">
            Reference only. T-Minus does not claim this file sits inside any of these strategies unless the
            recorded check above says so.
          </p>
          <ul className="mt-2 list-none space-y-1">
            {reference.map((r) => (
              <li key={r.psl} className="text-[13px] leading-[18px] text-muted-foreground">
                <span className="text-foreground" data-numeric>
                  {r.psl}
                </span>{" "}
                {r.name ?? "Not recorded"} — coordination: {r.required_coordination ?? "Not recorded"}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
