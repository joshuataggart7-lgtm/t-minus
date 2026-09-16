// Who signed / saved what — advisory only. Saved document versions are shown
// exactly as recorded; empty signature fields stay empty. Nothing here holds
// the file or blocks a phase exit.

import { useQuery } from "@tanstack/react-query";
import {
  NO_VERSIONS_NOTE,
  loadDocumentVersions,
  stampOrBlank,
  textOrBlank,
} from "@/lib/document-versions";

export function DocumentVersionsPanel({ acquisitionId }: { acquisitionId: string }) {
  const q = useQuery({
    queryKey: ["document-versions", acquisitionId],
    queryFn: () => loadDocumentVersions(acquisitionId),
  });
  const rows = q.data?.rows ?? [];
  const lastAudit = q.data?.lastAudit ?? null;

  return (
    <section
      id="document-versions"
      aria-label="Who signed or saved what"
      className="mb-10 max-w-[80ch] rounded-xl border border-border bg-background p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[18px] leading-6 font-medium">Who signed / saved what</h2>
        <span className="text-[13px] text-muted-foreground">
          Advisory — never holds the file or blocks a phase exit.
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-2 text-[15px] leading-[22px] text-muted-foreground">{NO_VERSIONS_NOTE}</p>
      ) : (
        <table className="mt-3 w-full border-collapse text-[13px] leading-[18px]">
          <caption className="sr-only">Saved document versions on this file</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="py-2 font-medium">Document</th>
              <th scope="col" className="py-2 font-medium">Version</th>
              <th scope="col" className="py-2 font-medium">Saved by</th>
              <th scope="col" className="py-2 font-medium">Saved</th>
              <th scope="col" className="py-2 font-medium">Reviewed by</th>
              <th scope="col" className="py-2 font-medium">Reviewed</th>
              <th scope="col" className="py-2 font-medium">Official</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.document_id} className="border-b border-border align-top">
                <td className="py-2 pr-3">{r.name}</td>
                <td className="py-2 pr-3" data-numeric>
                  {r.version ?? "—"}
                </td>
                <td className="py-2 pr-3 text-muted-foreground">{textOrBlank(r.saved_by)}</td>
                <td className="py-2 pr-3 text-muted-foreground" data-numeric>
                  {stampOrBlank(r.saved_at)}
                </td>
                <td className="py-2 pr-3 text-muted-foreground">{textOrBlank(r.reviewed_by)}</td>
                <td className="py-2 pr-3 text-muted-foreground" data-numeric>
                  {stampOrBlank(r.reviewed_at)}
                </td>
                <td className="py-2 text-muted-foreground">
                  {r.official
                    ? `Yes — ${stampOrBlank(r.filedAt)}${r.filedBy ? ` by ${r.filedBy}` : ""}`
                    : "Draft"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {lastAudit ? (
        <p className="mt-3 border-t border-border pt-2 text-[13px] leading-[18px] text-muted-foreground">
          Last recorded action: {textOrBlank(lastAudit.action)} by {textOrBlank(lastAudit.actor)} on{" "}
          {stampOrBlank(lastAudit.logged_at)}.
        </p>
      ) : null}
    </section>
  );
}
