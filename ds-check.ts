import { readFileSync } from "fs";
import { PDFDocument } from "pdf-lib";
import { buildSf1449 } from "@/lib/sf-forms";
import { xfaDatasets } from "@/lib/nf1787";
import { withPagePaths } from "@/lib/form-page-map";

const bare = (s: string) => s.replace(/\[\d+\]$/, "");
const doc = await PDFDocument.load(readFileSync("public/forms/SF1449.pdf"), { updateMetadata: false });
const map = new Map<string, string[]>();
for (const fld of doc.getForm().getFields()) {
  const parts = fld.getName().split(".").map(bare);
  if (parts.length < 3) continue;
  const leaf = parts[parts.length - 1]!;
  if (!map.has(leaf)) map.set(leaf, parts.slice(0, -1));
}
const acq = {
  acquisition_id: "A-2027-0101", pr_number: "PR-2027-0101", title: "Airborne snow radar survey",
  center_code: "ARC", center_name: "Ames Research Center", naics_code: "481219",
  proposed_price: 1385000, acquisition_method: "simplified", contract_format: "commercial",
  description_of_requirement: "Airborne radar survey flights.",
};
const clins = [{ clinNumber: "0001", description: "Flight hours", quantity: 160, unit: "hour", unitPrice: 3600, extendedPrice: 576000, source: "record" }];
const form = buildSf1449({ acq, clins } as any);
const xml = xfaDatasets(withPagePaths(form, map));
console.log(xml.slice(0, 400));
console.log("...");
console.log(/<quantity1>[^<]*<\/quantity1><unit1>[^<]*<\/unit1><unitprice1>[^<]*<\/unitprice1><amount1>[^<]*<\/amount1>/.exec(xml)?.[0] ?? "priced row not found");
console.log("boolean sample:", /<UNRESTRICTIONTED>[^<]*<\/UNRESTRICTIONTED>/.exec(xml)?.[0]);
console.log("page nesting:", xml.includes("<topmostSubform><Page1>"));
