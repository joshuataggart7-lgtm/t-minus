import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { openSharedDocument } from "@/lib/document-share.functions";
import { TEMPLATES, renderDocument, type Values } from "@/lib/template-engine";

export const Route = createFileRoute("/shared/$token")({
  head: () => ({
    meta: [
      { title: "Shared document — T-Minus" },
      { name: "description", content: "A single read-only acquisition document shared for a limited time." },
      { property: "og:title", content: "Shared document — T-Minus" },
      { property: "og:description", content: "One read-only document, shared for seven days." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SharedDocumentPage,
});

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-[80ch] px-6 py-10">
        <p className="text-[18px] leading-6 font-semibold">T-Minus</p>
        <p className="mb-8 text-[13px] text-muted-foreground">Mission Acquisition Acceleration</p>
        <main>{children}</main>
        <footer className="mt-16 border-t border-border pt-3 text-[13px] text-muted-foreground">
          Prototype. Not an official NASA system.
        </footer>
      </div>
    </div>
  );
}

function SharedDocumentPage() {
  const { token } = Route.useParams();
  const q = useQuery({
    queryKey: ["shared-document", token],
    retry: false,
    queryFn: () => openSharedDocument({ data: { token } }),
  });

  if (q.isLoading) {
    return (
      <Frame>
        <p role="status" className="text-muted-foreground">
          Opening the shared document.
        </p>
      </Frame>
    );
  }

  if (q.error || !q.data || q.data.ok === false) {
    const reason = q.data && q.data.ok === false ? q.data.reason : "unknown";
    const text =
      reason === "revoked"
        ? "This link was revoked by the contracting office and no longer opens the document. Ask them for a new link."
        : reason === "expired"
          ? "This link has passed its seven-day window. Ask the contracting office for a new link."
          : "This link does not open a document. Check that you used the whole link, or ask the contracting office for a new one.";
    return (
      <Frame>
        <h1 className="mb-3 text-[28px] leading-[34px] font-semibold">This link is closed</h1>
        <p className="max-w-[70ch] text-[15px] leading-[22px]">{text}</p>
      </Frame>
    );
  }

  const share = q.data;
  const def = TEMPLATES.find((t) => t.name === share.templateName);
  const doc = def ? renderDocument(def, share.values as Values, share.acquisitionId ?? "") : null;

  return (
    <Frame>
      <h1 className="mb-2 text-[28px] leading-[34px] font-semibold">{share.templateName}</h1>
      <p className="mb-1 text-[13px] text-muted-foreground" data-numeric>
        {share.acquisitionId ? `Acquisition ${share.acquisitionId} · ` : ""}Version {share.version ?? 1}
        {doc ? ` · ${doc.badgeLine}` : ""}
      </p>
      <p className="mb-8 text-[13px] text-muted-foreground" data-numeric>
        Read only. Shared with {share.recipientEmail} by {share.issuedBy}. This link closes on{" "}
        {share.expiresAt.slice(0, 10)}. Nothing else in T-Minus is open to this link.
      </p>

      {doc ? (
        doc.blocks.map((b) => (
          <section key={b.heading} className="mb-8">
            <h2 className="text-[18px] leading-6 font-medium">{b.heading}</h2>
            {b.citation ? <p className="text-[13px] text-muted-foreground italic">{b.citation}</p> : null}
            {b.lines.map((l, i) => (
              <p key={`${b.heading}-${i}`} className="mt-2 text-[15px] leading-[22px] whitespace-pre-wrap">
                {l}
              </p>
            ))}
          </section>
        ))
      ) : (
        <dl className="text-[15px] leading-[22px]">
          {Object.entries(share.values).map(([k, v]) => (
            <div key={k} className="mb-3">
              <dt className="text-muted-foreground">{k}</dt>
              <dd>{String(v ?? "—")}</dd>
            </div>
          ))}
        </dl>
      )}
    </Frame>
  );
}
