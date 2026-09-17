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

import type { FormCtx, FormField, GeneratedForm } from "@/lib/nf1787";
import { pathForLeaf, pathForSubformLeaf, type BlankPaths } from "@/lib/xfa-blank-paths";

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

/**
 * Sections 1 to 12 from the Intake answers, bound to the paths the blank
 * itself carries.
 *
 * The answer keys are section.subform.field_name, as Intake stores them. The
 * path is looked up in the blank's own XFA packets; an answer the blank has no
 * field for stays on Intake and is never written under a guessed path. Empty
 * answers are left out. Signature, concurrence and approval blocks stay blank.
 */
export function withNf1707Answers(
  form: GeneratedForm,
  answers: Record<string, unknown>,
  labels: Map<string, string>,
  paths: BlankPaths,
): GeneratedForm {
  if (!paths.size) return form;

  const header = form.sections[0];
  const boundHeader = header
    ? {
        ...header,
        fields: header.fields.map((field) => {
          const leaf = field.path.split(".").pop() ?? "";
          const path = pathForLeaf(paths, leaf);
          return path && path !== field.path ? { ...field, path } : field;
        }),
      }
    : header;

  const fields: FormField[] = [];
  let unmapped = 0;
  for (const [key, raw] of Object.entries(answers)) {
    const value = str(raw);
    if (!value) continue;
    const parts = key.split(".");
    if (parts.length < 3) continue;
    const leaf = parts[parts.length - 1]!;
    const subform = parts[parts.length - 2]!;
    const path = pathForSubformLeaf(paths, subform, leaf);
    if (!path) {
      unmapped += 1;
      continue;
    }
    fields.push({ path, label: labels.get(key) ?? leaf, value });
  }
  fields.sort((a, b) => a.path.localeCompare(b.path));

  const answered = form.sections[1];
  const citation = fields.length
    ? `Answered on Intake. Values read as the form carries them: 1 yes, 0 no, 2 not applicable.${
        unmapped ? ` ${unmapped} answer${unmapped === 1 ? "" : "s"} stay on Intake; this blank has no field for them.` : ""
      }`
    : "Answered on Intake. No answers on this file map to a field on the blank yet.";

  return {
    ...form,
    sections: [
      ...(boundHeader ? [boundHeader] : []),
      ...(answered ? [{ ...answered, citation, fields }] : []),
      ...form.sections.slice(2),
    ],
  };
}
