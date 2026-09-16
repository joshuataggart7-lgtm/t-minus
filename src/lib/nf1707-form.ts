/**
 * NF 1707 (Special Approvals and Affirmations of Requisitions) as a generated
 * form over the official blank.
 *
 * The blank in public/forms/NF1707.pdf is the official agency file, served
 * unchanged. The paths below are the header paths read out of that form's own
 * XFA template, so the populated export is the official form carrying the
 * record's values.
 *
 * Only the requisition header is bound in this pass. The Section 1 to 12
 * answers still live on the Intake screen (nf1707_fields) and are not mapped
 * to form paths here — no path is guessed. Signature, concurrence and approval
 * blocks stay blank; they are completed in the Approvals step. A desktop Adobe
 * field check by a person is still open.
 */

import type { FormCtx, GeneratedForm } from "@/lib/nf1787";

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

export function buildNf1707Form(ctx: FormCtx): GeneratedForm {
  const a = ctx.acq;
  const description = str(a["description_of_requirement"]) || str(a["title"]);

  return {
    key: "nf-1707",
    name: "NF 1707, Special Approvals and Affirmations of Requisitions",
    citation: "NF 1707; NFS 1804.73",
    pdf: "/forms/NF1707.pdf",
    sections: [
      {
        title: "Requisition header",
        citation: "NF 1707 header, official blank",
        fields: [
          {
            path: "form1.Page1.Header.Center",
            label: "Center",
            value: str(a["center_name"]) || str(a["center_code"]),
            ...(str(a["center_code"]) ? {} : { gap: "No Center recorded on the acquisition." }),
          },
          {
            path: "form1.Page1.Header.ReqNumber",
            label: "Requisition number",
            value: str(a["pr_number"]),
            ...(str(a["pr_number"]) ? {} : { gap: "No purchase request number recorded." }),
          },
          {
            path: "form1.Page1.Header.ReqOrg",
            label: "Requisitioning organization",
            value: str(a["requester_org_code"]),
            ...(str(a["requester_org_code"]) ? {} : { gap: "No requesting organization recorded." }),
          },
          {
            path: "form1.Page1.Header.RequirementDescription",
            label: "Description of requirement",
            value: description,
            ...(description ? {} : { gap: "Add the description of the requirement to the record." }),
          },
        ],
      },
      {
        title: "Sections 1 through 12",
        citation: "Answered on Intake",
        fields: [],
      },
      {
        title: "Signatures, concurrence and approvals",
        citation: "Completed in the Approvals step",
        fields: [],
      },
    ],
  };
}
