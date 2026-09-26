import { TableScrollRegion } from "@/components/table-scroll-region";
import { attachmentsForSectionJ, SECTION_J_EMPTY } from "@/lib/section-j";
import type { AttachmentRow } from "@/lib/attachments";

/**
 * Section J — the list of attachments on the file. Read-only: the files are
 * attached elsewhere on the record. The handoff packet carries the same list.
 */
export function SectionJPanel({
  attachments,
  mode,
}: {
  attachments: AttachmentRow[];
  mode: "sf1449" | "ucf";
}) {
  const rows = attachmentsForSectionJ(attachments);
  return (
    <div className="mt-3 border border-border p-4">
      <h4 className="text-[15px] font-medium">
        {mode === "sf1449"
          ? "Document attachments for the handoff"
          : "Section J — Document attachments"}
      </h4>
      <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">
        These files are on the record. Data requirements are listed separately under CDRL / data
        requirements. The handoff packet carries the same list. NCMS remains the system of record.
      </p>
      {rows.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted-foreground">{SECTION_J_EMPTY}</p>
      ) : (
        <TableScrollRegion baseClassName="overflow-x-auto" label="Section J attachments table">
<table className="mt-2 w-full text-[13px] leading-[18px]">
          <caption className="sr-only">Attachments on this file with their NF 1098 tab</caption>
          <thead>
            <tr className="border-y border-border text-left">
              <th scope="col" className="p-2">NF 1098 tab</th>
              <th scope="col" className="p-2">Label</th>
              <th scope="col" className="p-2">File name</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.nf_1098_tab}-${r.label}-${r.file_name}`} className="border-b border-border align-top">
                <td className="p-2" data-numeric>{r.nf_1098_tab}</td>
                <td className="p-2">{r.label}</td>
                <td className="p-2 text-muted-foreground">{r.file_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
</TableScrollRegion>
      )}
    </div>
  );
}
