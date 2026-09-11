import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPublicScorecard, VALUE_FLOOR, CELL_FLOOR } from "@/lib/scorecard.functions";

export const Route = createFileRoute("/scorecard")({
  head: () => ({
    meta: [
      { title: "Acquisition scorecard — T-Minus prototype" },
      {
        name: "description",
        content:
          "Aggregate acquisition figures from the T-Minus prototype: median days to award, competition rate, small business share, holds by reason.",
      },
      { property: "og:title", content: "Acquisition scorecard — T-Minus prototype" },
      {
        property: "og:description",
        content: "Aggregate figures only, from fictional prototype data. No file, vendor, or dollar detail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScorecardPage,
});

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-[80ch] px-6 py-10">
        <p className="text-[18px] leading-6 font-semibold">T-Minus</p>
        <p className="mb-8 text-[13px] text-muted-foreground">Mission Acquisition Acceleration</p>
        <main id="main">{children}</main>
        <footer className="mt-16 border-t border-border pt-3 text-[13px] text-muted-foreground">
          Prototype. Not an official NASA system.
        </footer>
      </div>
    </div>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-[28px] leading-[34px] font-semibold" data-numeric>
        {value}
      </p>
      <p className="text-[13px] leading-[18px] text-muted-foreground">{label}</p>
    </div>
  );
}

function ScorecardPage() {
  const q = useQuery({
    queryKey: ["public-scorecard"],
    retry: false,
    queryFn: () => getPublicScorecard(),
  });

  if (q.isLoading) {
    return (
      <Frame>
        <p role="status" className="text-muted-foreground">
          Loading the scorecard.
        </p>
      </Frame>
    );
  }

  if (q.error || !q.data) {
    return (
      <Frame>
        <p role="status" className="text-[15px] leading-[22px]">
          The scorecard did not load. Refresh the page; if it fails again, try later.
        </p>
      </Frame>
    );
  }

  const s = q.data;
  const pct = (n: number | null) => (n === null ? "Not available" : `${n}%`);

  return (
    <Frame>
      <h1 className="text-[28px] leading-[34px] font-semibold">Acquisition scorecard</h1>
      <p className="mt-3 max-w-[70ch] text-[15px] leading-[22px]">
        Aggregate figures across {s.totalFiles} acquisition records. Every number on this page is fictional
        prototype data, published without signing in.
      </p>
      <p className="mt-2 max-w-[70ch] text-[13px] leading-[18px] text-muted-foreground">
        No acquisition, requester, or vendor is named here, no dollar amounts are published, and nothing
        controlled is included. Categories with fewer than {CELL_FLOOR} records are combined so a single file
        cannot be read out of a group. Dollar values under ${(VALUE_FLOOR / 1_000_000).toFixed(0)} million are
        never published in any form.
      </p>

      <section aria-label="Headline figures" className="mt-10 flex flex-wrap gap-x-16 gap-y-6">
        <Figure
          value={s.medianDaysOverall === null ? "Not available" : String(s.medianDaysOverall)}
          label="Median days to award"
        />
        <Figure value={pct(s.competitionRate.percent)} label="Competed" />
        <Figure value={pct(s.smallBusinessShare.percent)} label="Set aside for small business" />
        <Figure value={String(s.launchedThisQuarter)} label={`Launched in ${s.quarterLabel}`} />
      </section>

      <section aria-label="Median days to award by category" className="mt-10 border-t border-border pt-4">
        <h2 className="text-[18px] leading-6 font-medium">Median days to award by category</h2>
        {s.medianDaysByCategory.length ? (
          <table className="mt-3 w-full border border-border text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="p-2">Category</th>
                <th scope="col" className="p-2">Records</th>
                <th scope="col" className="p-2">Median days</th>
              </tr>
            </thead>
            <tbody>
              {s.medianDaysByCategory.map((g) => (
                <tr key={g.label} className="border-b border-border">
                  <td className="p-2">{g.label}</td>
                  <td className="p-2" data-numeric>{g.count}</td>
                  <td className="p-2" data-numeric>{g.medianDays ?? "Not available"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-2 text-[15px] leading-[22px] text-muted-foreground">
            No award dates are recorded yet, so no median can be published.
          </p>
        )}
        <p className="mt-2 text-[13px] leading-[18px] text-muted-foreground">
          Days are measured from the recorded start of the regulatory clock to the award date.
        </p>
      </section>

      <section aria-label="Holds by reason" className="mt-10 border-t border-border pt-4">
        <h2 className="text-[18px] leading-6 font-medium">Holds by reason</h2>
        {s.holdsByReason.length ? (
          <table className="mt-3 w-full border border-border text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="p-2">Reason</th>
                <th scope="col" className="p-2">Files on hold</th>
              </tr>
            </thead>
            <tbody>
              {s.holdsByReason.map((h) => (
                <tr key={h.reason} className="border-b border-border">
                  <td className="p-2">{h.reason}</td>
                  <td className="p-2" data-numeric>{h.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-2 text-[15px] leading-[22px] text-muted-foreground">Nothing is on hold.</p>
        )}
      </section>

      <p className="mt-10 text-[13px] leading-[18px] text-muted-foreground" data-numeric>
        Generated {new Date(s.generatedAt).toISOString().slice(0, 16).replace("T", " ")} UTC.
      </p>
    </Frame>
  );
}
