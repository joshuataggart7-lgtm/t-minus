import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader, ErrorNote, LoadingNote } from "@/components/app-shell";
import { useRole } from "@/components/role-context";
import { reportDefect } from "@/lib/template-defects";
import {
  buildStamp,
  features,
  FEATURE_HEADING,
  FEATURE_ORDER,
  LIVE_FEEDS,
  loadAboutData,
  SEED_SOURCES,
  templateGroups,
} from "@/lib/about";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About T-Minus — Mission Acquisition Acceleration" },
      {
        name: "description",
        content:
          "What T-Minus is and is not: a working prototype of mission acquisition acceleration, built on NASA's own rules, with fictional records only.",
      },
      { property: "og:title", content: "About T-Minus — Mission Acquisition Acceleration" },
      {
        property: "og:description",
        content:
          "A working prototype of mission acquisition acceleration. Not an official NASA system. Every record is fictional.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const { authState, user, role } = useRole();
  const q = useQuery({ queryKey: ["about"], enabled: authState === "signed-in", queryFn: loadAboutData });
  const list = features();
  const groups = q.data ? templateGroups(q.data.templates) : null;

  const [text, setText] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: async () => {
      const body = text.trim();
      if (!body) throw new Error("Write what you would change, then send it again.");
      await reportDefect({
        templateKey: "feedback",
        templateName: "T-Minus feedback",
        revision: buildStamp(),
        citation: null,
        defect: body,
        acquisitionId: null,
        reporterName: user.name,
        reporterRole: role,
      });
    },
    onSuccess: () => {
      setSent("Thank you. Your feedback is on the HQ queue.");
      setText("");
    },
  });

  return (
    <AppShell>
      <PageHeader
        title="About T-Minus"
        lead="A working prototype of procurement at the speed of mission."
      />

      <section aria-label="What T-Minus is" className="mb-10 max-w-[70ch] space-y-3">
        <h2 className="section-title text-[18px] leading-6 font-medium">What this is, and what it is not</h2>
        <p>
          T-Minus is a working prototype built by a NASA contracting officer on the agency's own
          rules. It makes acquisition time visible against the mission date: the phase, the next
          decision, the days to award, the blocker, and who owns it.
        </p>
        <p>
          It is not an official NASA system and it implies no endorsement. Every record in it is
          fictional: the vendors, the prices, the people, and the contract numbers. Only the Center
          names are real. It extends NCMS, SAM.gov and ORBIT; it never replaces them, and NCMS
          remains the document of record for solicitations and contracts.
        </p>
      </section>

      {q.isError ? (
        <ErrorNote message="The template list did not load. Refresh the page; if it fails again, open Seed status." />
      ) : null}
      {q.isLoading ? <LoadingNote what="the build detail" /> : null}

      <section aria-label="What is built" className="mb-10">
        <h2 className="section-title text-[18px] leading-6 font-medium">What is built</h2>
        {FEATURE_ORDER.map((status) => {
          const rows = list.filter((f) => f.status === status);
          if (rows.length === 0) return null;
          return (
            <div key={status} className="mt-4">
              <h3 className="text-[15px] leading-[22px] font-medium">{FEATURE_HEADING[status]}</h3>
              <ul className="mt-2 max-w-[80ch] space-y-1">
                {rows.map((f) => (
                  <li key={f.name} className="text-[15px] leading-[22px]">
                    <span className="font-medium">{f.name}</span>{" "}
                    <span className="text-muted-foreground">{f.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        {groups ? (
          <div className="mt-6">
            <h3 className="text-[15px] leading-[22px] font-medium">
              Live forms, from the templates list
            </h3>
            <ul className="mt-2 max-w-[80ch] space-y-1">
              {groups.live.map((t) => (
                <li key={t.template_id} className="text-[13px] leading-[18px]">
                  {t.nf_1098_tab ? `Tab ${t.nf_1098_tab} · ` : ""}
                  {t.name}
                  <span className="text-muted-foreground">
                    {t.hq_revision_date ? ` · HQ revision ${t.hq_revision_date}` : ""}
                    {t.governing_citation ? ` · ${t.governing_citation}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 max-w-[70ch] text-[13px] text-muted-foreground">
              {groups.listed.length} further forms are carried in the templates list with their HQ
              dates and are not yet built as forms.
            </p>
          </div>
        ) : null}
      </section>

      <section aria-label="Data sources" className="mb-10">
        <h2 className="section-title text-[18px] leading-6 font-medium">Data sources and their dates</h2>
        <ul className="mt-3 max-w-[70ch] space-y-1">
          {SEED_SOURCES.map((s) => (
            <li key={s.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-[15px] leading-[22px]">
              <span>{s.name}</span>
              <span className="text-muted-foreground" data-numeric>
                {s.asOf}
              </span>
            </li>
          ))}
        </ul>

        {q.data ? (
          <table className="mt-5 w-full border border-border text-[13px] leading-[18px]">
            <caption className="sr-only">Regulatory references loaded, newest first</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="px-3 py-2">Citation</th>
                <th scope="col" className="px-3 py-2">Title</th>
                <th scope="col" className="px-3 py-2">Tier</th>
                <th scope="col" className="px-3 py-2">Source</th>
                <th scope="col" className="px-3 py-2">Effective</th>
              </tr>
            </thead>
            <tbody>
              {q.data.refs.slice(0, 25).map((r) => (
                <tr key={`${r.citation}-${r.effective_date ?? ""}`} className="border-b border-border">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {r.url ? (
                      <a href={r.url} className="text-primary" target="_blank" rel="noreferrer">
                        {r.citation}
                      </a>
                    ) : (
                      r.citation
                    )}
                  </th>
                  <td className="px-3 py-2">{r.title ?? "No title recorded"}</td>
                  <td className="px-3 py-2">{r.tier ?? "Tier not recorded"}</td>
                  <td className="px-3 py-2">{r.source ?? "Source not recorded"}</td>
                  <td className="px-3 py-2" data-numeric>
                    {r.effective_date ?? "No date recorded"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section aria-label="Live feeds" className="mb-10">
        <h2 className="section-title text-[18px] leading-6 font-medium">Live feeds</h2>
        <p className="mt-1 max-w-[70ch] text-[13px] text-muted-foreground">
          Every outside call is made by the server, never by the browser.
        </p>
        <ul className="mt-3 max-w-[80ch] space-y-1">
          {LIVE_FEEDS.map((f) => (
            <li key={f.name} className="text-[15px] leading-[22px]">
              <span className="font-medium">{f.name}</span>{" "}
              <span className="text-muted-foreground">{f.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Build stamp" className="mb-10">
        <h2 className="section-title text-[18px] leading-6 font-medium">Build</h2>
        <p className="mt-2 text-[15px] leading-[22px]" data-numeric>
          This deploy was built {buildStamp()}.
        </p>
      </section>

      <section aria-label="Send feedback" className="mb-12 max-w-[70ch]">
        <h2 className="section-title text-[18px] leading-6 font-medium">Send feedback</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Feedback goes to the same HQ queue as a template defect report, under your name.
        </p>
        <label htmlFor="feedback" className="mt-3 block text-[13px] text-muted-foreground">
          What would you change?
        </label>
        <textarea
          id="feedback"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSent(null);
          }}
          rows={4}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[15px]"
        />
        <button
          type="button"
          onClick={() => send.mutate()}
          disabled={send.isPending}
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-[15px] text-primary-foreground disabled:opacity-60"
        >
          {send.isPending ? "Sending" : "Send feedback"}
        </button>
        {send.isError ? <ErrorNote message={(send.error as Error).message} /> : null}
        {sent ? (
          <p role="status" className="mt-3 text-[15px]">
            {sent}
          </p>
        ) : null}
      </section>
    </AppShell>
  );
}
