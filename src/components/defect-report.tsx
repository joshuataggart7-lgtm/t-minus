import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRole } from "@/components/role-context";
import { reportDefect } from "@/lib/template-defects";

/**
 * "Report a template defect" — available on every template. It captures the
 * defect, the citation it turns on, the template name and revision shown on the
 * badge, and the reporter, then writes the audit entry and adds the item to the
 * PGPD queue.
 */
export function DefectReport({
  templateKey,
  templateName,
  revision,
  defaultCitation,
  acquisitionId,
}: {
  templateKey: string;
  templateName: string;
  revision: string | null;
  defaultCitation: string | null;
  acquisitionId?: string | null;
}) {
  const { user, roles } = useRole();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [defect, setDefect] = useState("");
  const [citation, setCitation] = useState(defaultCitation ?? "");
  const [message, setMessage] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () =>
      reportDefect({
        templateKey,
        templateName,
        revision,
        citation: citation.trim() || null,
        defect: defect.trim(),
        acquisitionId: acquisitionId ?? null,
        reporterName: user.name,
        reporterRole: roles.join(", "),
      }),
    onSuccess: () => {
      setMessage("Reported. The item is on the PGPD queue.");
      setDefect("");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["template-defects"] });
    },
    onError: (e: Error) => setMessage(`The report did not save: ${e.message}. Try again.`),
  });

  return (
    <section aria-label="Report a template defect" className="mb-8 max-w-[80ch]">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setMessage(null);
          }}
          className="rounded-lg border border-border px-3 py-2 text-[14px]"
        >
          Report a template defect
        </button>
      ) : (
        <div className="rounded-lg border border-border p-4">
          <p className="text-[15px] leading-[22px]">
            Reporting a defect in {templateName}
            {revision ? ` (${revision})` : ""} as {user.name}.
          </p>
          <div className="mt-3">
            <label htmlFor="defect-text" className="block text-[13px] text-muted-foreground">
              What is wrong with this template
            </label>
            <textarea
              id="defect-text"
              value={defect}
              onChange={(e) => setDefect(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-[15px]"
            />
          </div>
          <div className="mt-3">
            <label htmlFor="defect-citation" className="block text-[13px] text-muted-foreground">
              Citation the defect turns on
            </label>
            <input
              id="defect-citation"
              value={citation}
              onChange={(e) => setCitation(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-[15px]"
            />
          </div>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={!defect.trim() || submit.isPending}
              onClick={() => submit.mutate()}
              className="rounded-lg bg-primary px-3 py-2 text-[14px] text-primary-foreground disabled:opacity-50"
            >
              Send to PGPD
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-border px-3 py-2 text-[14px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {message ? <p className="mt-2 text-[13px] text-muted-foreground">{message}</p> : null}
    </section>
  );
}
