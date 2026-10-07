// NF 1707 (03/25) statement text, read from the official blank in
// public/forms/NF1707.pdf. Keys are "Subform.Field" as the blank names them.
// The read view and the flattened print use this text so each checked box
// reads as the statement it carries on the form.

export const NF1707_SECTION_TITLES: Record<number, string> = {
  1: "Section 1. NASA strategic sourcing initiative",
  2: "Section 2. Information systems and ICT accessibility (Section 508)",
  3: "Section 3. Environmental and sustainable acquisition",
  4: "Section 4. Service contracting",
  5: "Section 5. Technical approval",
  6: "Section 6. Quality assurance",
  7: "Section 7. Safety and health (I. Safety and health requirements)",
  8: "Section 8. Property management",
  9: "Section 9. Required special approvals, Center-specific supplements",
  10: "Section 10. Foreign travel briefings for NASA contractors",
  11: "Section 11. Extraneous promotional and personal use items",
  12: "Section 12. Other current NASA directives",
};

/**
 * Short notes shown under a section in the read view and the flattened print.
 * The form's own statement text is left as printed on the 03/25 blank.
 */
export const NF1707_SECTION_NOTES: Record<number, string> = {
  4: "Note: Item 1 quotes the form's references (FAR 37.104, NFS 1837.104), which predate the RFO. Personal services are now at RFO FAR 37.201 and 37.202-1, and the interim NFS covers them at NFS 1837.201-1.",
};

export const NF1707_CELL_TEXT: Record<string, string> = {
  "Section1.Available": "The requirement IS AVAILABLE through a NASA strategic sourcing contract.",
  "Section1.MandatoryContractNum": "Contract number",
  "Section1.NotAvailable": "The requirement IS NOT AVAILABLE through a Mandatory Source Contract. Documentation of the review is attached.",

  "Section2.CITRAuth": "I. CITR authorization number",
  "Section2.ORCAAuth": "II. ORCA authorization number",
  "Section2.UnderLimitNoIT": "III. Valued less than $7.5M and does not contain information technology.",
  "Section2.NoITAuth": "III. No IT authorization number",
  "Section2.NotReviewed": "IV. Commercial IT items not yet reviewed by the OCIO because the manufacturer is not yet known. Authorization is required before award.",

  "Section3.S3n1": "I.A. Does not acquire any products or services listed in the GPC.",
  "Section3.S3n2": "I.B. Acquires products or services listed in the GPC in the programs checked.",
  "Section3.S3n2s1": "Bio-based/Bio-preferred, USDA-designated items.",
  "Section3.S3n2s2": "SmartWay Transportation Services.",
  "Section3.S3n2s3": "Energy Star, FEMP-designated, FEMP Low Standby Power, or WaterSense products.",
  "Section3.S3n2s4": "EPEAT-registered electronics.",
  "Section3.S3n2s5Yes": "Sufficient EPEAT Silver- or Gold-registered products are available: Yes.",
  "Section3.S3n2s5No": "Sufficient EPEAT Silver- or Gold-registered products are available: No.",
  "Section3.S3n2s6": "Comprehensive Procurement Guideline recycled content or recovered material products.",
  "Section3.S3n2s7Yes": "NASA can independently verify contractor recovered material estimates: Yes.",
  "Section3.S3n2s7No": "NASA can independently verify contractor recovered material estimates: No.",
  "Section3.S3n2s8": "Non-ozone depleting substances (SNAP program).",
  "Section3.S3n2s9": "Safer Choice products, SmartWay Certified Vehicles, or EPA Recommendations of Specifications, Standards, and Ecolabels.",
  "Section3s2.S3s2n1": "II. GPC-listed items apply, but the attached memo or waiver supports buying non-GPC items.",
  "Section3s2.S3s2n1s1": "II. The attached memo or waiver is fully approved.",
  "Section3s2.S3s2n1s2": "II. The attached memo or waiver is approved up to, but not including, the Contracting Officer.",
  "Section3s3.S3s3n1": "III. NEPA: fits a Categorical Exclusion with no extraordinary circumstances.",
  "Section3s3.S3n3n1Info": "III. CatEx number",
  "Section3s3.S3s3n2": "III. NEPA: fits a Categorical Exclusion but needs further consultation, permitting, or studies.",
  "Section3s3.S3s3n3": "III. NEPA: fits the list of excluded activities that do not need a checklist.",

  "Section4.S4n1": "Supplies only. No services are being procured.",
  "Section4.S4n2": "This requirement is for, or includes, services.",
  "Section4.S4n2s1": "1. Will not be used for personal services (FAR 37.104, NFS 1837.104).",
  "Section4.S4n2s2": "2. Will not be used for inherently governmental functions (FAR 7.503).",
  "Section4.S4n2s3": "3. Not presently or recently performed by government employees (OMB Circular A-76).",
  "Section4.S4n2s4": "4. Will be advisory and assistance services (FAR 2.1, FAR 37.204, NFS 1837.204).",

  "Section5s1.S5In1": "I. Not for space flight hardware or software, or ground systems in direct support of space flight operations.",
  "Section5s1.S5In2": "I. For space flight hardware or software and ground systems or components.",
  "Section5s1.S5In2s1": "I. Cited technical standards are the most recent version, tailored, and registered in a standards.nasa.gov watch list.",
  "Section5s1.S5In2s2": "I. Exceptions approved by the technical authorities are attached (NPR 7120.5).",
  "Section5s2.S5IIn1": "II. No Space Communication and Navigation (SCaN) requirements.",
  "Section5s2.S5IIn2": "II. Has SCaN requirements, coordinated with the SCaN office.",
  "Section5s2.S5IIn3": "II. Does NOT contain RF equipment.",
  "Section5s2.S5IIn4": "II. DOES contain RF equipment. Spectrum Management Office approval is attached (NPD 2570.5).",
  "Section5s3.S5IIIn1": "III. Does not require an Earned Value Management System.",
  "Section5s3.S5IIIn2": "III. Requires EVMS. DRDs for the solicitation and contract are attached.",
  "Section5s3.S5IIIn3": "III. No exceptions to the EVMS requirements apply.",
  "Section5s3.S5IIIn4": "III. EVMS exceptions approved by the Center EVM point of contact are attached.",
  "Section5s4.S5IVn1": "IV. Does not involve creating communications material.",
  "Section5s4.S5IVn2": "IV. Involves creating communications material, subject to NPD 2521.1.",
  "Section5s5.S5Vn1": "V. No acquisition or use of manned or unmanned aircraft. NPR 7900.3 does not apply.",
  "Section5s5.S5Vn2": "V. Involves acquisition or use of manned or unmanned aircraft. NPR 7900.3 applies and flight operations concurrence is obtained.",
  "Section5s6.S5VIn1": "VI. Not subject to NPR 7150.2 software engineering requirements.",
  "Section5s6.S5VIn2": "VI. Subject to NPR 7150.2 software engineering requirements.",
  "Section5s6.S5VIn2s1": "VI. Class A: Human rated space software systems.",
  "Section5s6.S5VIn2s2": "VI. Class B: Non-human rated space software systems or large-scale aeronautics vehicles.",
  "Section5s6.S5VIn2s3": "VI. Class C: Mission support software or aeronautic vehicles, or major engineering/research facility software.",
  "Section5s6.S5VIn2s4": "VI. Class D: Basic science/engineering design and research and technology software.",
  "Section5s6.S5VIn2s5": "VI. Class E: Small light weight design concept and research and technology software.",
  "Section5s7.SCVIn1": "VII. The SCV Reporting DRD is required.",
  "Section5s7.SCVIn2": "VII. The SCV Reporting DRD is not required.",
  "Section5s7.SCVIn2s1": "VII. Value, including options, is below the $20M threshold.",
  "Section5s7.SCVIn2s2": "VII. Not for a program or project on the approved AMPL.",
  "Section5s7.SCVIn2s3": "VII. Modification of an existing contract, not a new procurement.",
  "Section5s7.SCVIn2s4": "VII. Waiver approved by the NASA Supply Chain Resiliency Board.",

  "Section6s1.S6In1": "I. Information technology or institutional infrastructure projects.",
  "Section6s1.S6In2": "I. Information technology services.",
  "Section6s1.S6In3": "I. Software assurance functions (NASA-STD-8739.8, NPR 7150.2).",
  "Section6s1.S6In4": "I. Contractor support services that do not directly affect product configuration.",
  "Section6s1.S6In5": "I. NASA institutional facilities or facility maintenance.",
  "Section6s1.S6In6": "I. Grants, cooperative agreements, or Space Act agreements.",
  "Section6s1.S6In9": "I. Other acquisition. NPR 8735.2C does not apply.",
  "Section6s1.S6In7": "I. Commercial or COTS items under FAR Part 12. NPR 8735.2C paragraph 5.1 applies.",
  "Section6s1.S6In8": "I. Research and development. NPR 8735.2C paragraph 5.2 applies.",
  "Section6s2.S6IIn1": "I. Neither critical nor complex. Higher-level quality is not required.",
  "Section6s2.S6IIn2": "I. Critical items or critical work (NPR 8735.2C, Appendix A).",
  "Section6s2.S6IIn3": "I. Complex items or complex work (NPR 8735.2C, Appendix A).",
  "Section6s3.S6IIIn1": "II. Subject to higher-level quality requirements (FAR 46.202-4, NFS 1846).",
  "Section6s3n2.S6IIIn2": "II. SAE AS9100.",
  "Section6s3n2.S6IIIn3": "II. ISO 9001.",
  "Section6s3n2.S6IIIn4": "II. SAE AS9003.",
  "Section6s3n2.S6IIIn5": "II. ISO 17025.",
  "Section6s3n2.S6IIIn6": "II. Test and inspection requirements set by the acquiring organization.",
  "Section6s4.S6IVn1": "III. Government acceptance testing after delivery.",
  "Section6s4.S6IVn1Input": "III. Acceptance testing days",
  "Section6s4.S6IVn2": "III. Certificate(s) of Conformance (FAR 52.246-15).",
  "Section6s4.S6IVn3": "III. Certificate of Chemical Analysis.",
  "Section6s4.CertificateInput": "III. Chemical analysis as specified in",
  "Section6s4.S6IVn4": "III. Government Source Inspection.",
  "Section6s4.S6IVn5": "III. First Article Approval (FAR 52.209-3).",
  "Section6s4.S6IVn6": "III. Further quality requirements are in the attached SOW or specification.",
  "Section6s6.S6VIn1": "IV. Not for safety critical items (NPR 8735.1).",
  "Section6s6.S6VIn2": "IV. For safety critical items and GIDEP screened (NPR 8735.1).",

  "Section7.S7In1": "The contractor will work partly or completely on a NASA Center.",
  "Section7.S7In2": "Involves hazardous or potentially hazardous substances or articles (NPR 1800.1, NPR 8715.1).",
  "Section7.S7In2s1": "Hazard: Ionizing radiation sources and devices.",
  "Section7.S7In2s2": "Hazard: Lasers and hazardous non-laser optical radiation.",
  "Section7.S7In2s3": "Hazard: High intensity, ultraviolet, and infrared lights.",
  "Section7.S7In2s4": "Hazard: Radio frequency (RF) and microwave emitters.",
  "Section7.S7In2s5": "Hazard: Devices that produce hazardous noise (80 dBA or more at 1 meter or less).",
  "Section7.S7In2s6": "Hazard: Pyrotechnic devices and explosives.",
  "Section7.S7In2s7": "Hazard: Pressurized vessels.",
  "Section7.S7In2s8": "Hazard: Toxic or hazardous substances, materials, or chemicals.",
  "Section7.S7In2s9": "Hazard: Nano and ultrafine particles.",
  "Section7.S7In2s10": "Hazard: Infectious or biological agents.",
  "Section7.S7In2s11": "Hazard: Other articles or substances listed in Appendix D.",
  "Section7.S7In3": "Equipment or services that need Center SMA review and approval.",
  "Section7.S7In4": "Reviewed under NPR 1800.1 chapter 4 and NPR 8715.1 for risks, controls, alternatives, and safety requirements.",

  "Section8.S8IIn1": "No purchase or fabrication of property with a unit value of $1,000,000 or more to which the government takes title.",
  "Section8.S8IIn2": "Involves property of $1,000,000 or more per item to which the government takes title. NF 1739 is attached.",
  "Section8.S8In1": "Primary source of supply, acquisition, and reutilization efforts are exhausted (NPR 4200.1, NPR 4300.1).",
  "Section8.S8In2": "Equipment management personnel are coordinated for control and accountability (NPR 4200.1).",

  "Section9s1.S9n1": "There are no items requiring special approval.",
  "Section9s1.S9n2": "Approvals for special items were obtained through the SAP release strategy.",
  "Section9s1.S9n3": "Approvals for special items are attached.",

  "Section10.S10n1": "No NASA contractor travel to Designated Countries, Russia, or other high-threat locations.",
  "Section10.S10n2": "Requires NASA contractor travel to Designated Countries, Russia, or other high-threat locations. The contract includes the Counterintelligence Briefings requirement (NPR 1660.1).",

  "Section11.S11n1": "Does not involve any prohibited extraneous promotional or personal use items (MSC-2011-12-001, as amended).",

  "Section12.S12n1": "NODIS reviewed. No additional NASA directives apply.",
  "Section12.S12n2": "NODIS reviewed. Additional NASA directives apply and the list is attached.",
};

/** Statement text for a stored answer key ("Section.Subform.Field" or "Subform.Field"). */
export function nf1707CellText(key: string): string | null {
  const parts = key.split(".");
  if (parts.length < 2) return null;
  const leaf = parts[parts.length - 1]!;
  const subform = parts[parts.length - 2]!;
  return NF1707_CELL_TEXT[`${subform}.${leaf}`] ?? null;
}

/** Form section number (1 to 12) a stored answer key belongs to, or null. */
export function nf1707SectionOf(key: string): number | null {
  const m = /^Section(\d+)/.exec(key);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 12 ? n : null;
}
