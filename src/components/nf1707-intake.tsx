import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { IntakeFacts } from "@/lib/intake";
import type { Nf1707Field } from "@/lib/nf1707";
import { nf1707CellText } from "@/lib/nf1707-cells";

export type NfAnswers = Record<string, string>;
type GateKey = "services" | "it" | "hardware" | "space" | "aviation" | "hazards";
type Question = { key: string; label: string; short?: string; kind: "yesno" | "check" | "checklist" | "radio" | "text" | "number"; options?: { value: string; label: string; help?: string }[]; when?: (a: NfAnswers) => boolean; required?: boolean; help?: string; placeholder?: string; yesText?: string; noText?: string; exclusive?: string[] };
type Section = { key: string; title: string; citation: string; gates?: GateKey[]; questions: Question[] };

export const GATES: { key: GateKey; label: string }[] = [
  { key: "services", label: "Does this include services?" },
  { key: "it", label: "Does this include information technology?" },
  { key: "hardware", label: "Does this include hardware, materials, or a physical deliverable?" },
  { key: "space", label: "Does this involve space flight hardware/software or ground systems?" },
  { key: "aviation", label: "Does this involve aircraft, aviation services, or UAS?" },
];

const yn: { value: string; label: string; help?: string }[] = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];
const yna = [...yn, { value: "na", label: "Not applicable" }];
const q = (key: string, label: string, kind: Question["kind"], extra: Partial<Question> = {}): Question => ({ key, label, kind, ...extra });

export const NF1707_SECTIONS: Section[] = [
  { key: "1", title: "NASA strategic sourcing initiative", citation: "NF 1707 Section 1; NFS 1808.003-72", questions: [
    q("s1_strategy", "Is the requirement available through a NASA strategic sourcing contract?", "yesno", {yesText:"Available through a strategic sourcing contract", noText:"Not available through a strategic sourcing contract",  options: yn, short: "strategic sourcing", help: "If no, attach documentation of the review." }),
    q("s1_contract_number", "Strategic sourcing contract number", "text", {short:"Contract number",  when: a => a["s1_strategy"] === "yes" }),
  ]},
  { key: "2", title: "Information systems and ICT accessibility (Section 508)", citation: "NF 1707 Section 2; FAR 2.101 (IT definition)", gates: ["it"], questions: [
    q("s2_authorization", "Which Section 2 statement applies? Complete only one.", "radio", { options: [{value:"citr",label:"I. CITR authorization"},{value:"orca",label:"II. ORCA authorization"},{value:"under_limit",label:"III. Under $7.5M and contains no information technology"},{value:"none",label:"III. No IT authorization number"},{value:"not_reviewed",label:"IV. Not yet reviewed by the OCIO because the manufacturer is not yet known"}], required:true }),
    q("s2_citr_number", "CITR authorization number", "text", {short:"CITR number",  when:a=>a["s2_authorization"]==="citr" }),
    q("s2_orca_number", "ORCA authorization number", "text", {short:"ORCA number",  when:a=>a["s2_authorization"]==="orca" }),
    q("s2_no_authorization_reason", "No IT authorization number", "text", {short:"No IT authorization number",  when:a=>a["s2_authorization"]==="none" }),
  ]},
  { key: "3", title: "Environmental and sustainable acquisition", citation: "NF 1707 Section 3; FAR Part 23; NFS 1823; NPR 8530.1; NPR 8580.1", questions: [
    q("s3_gpc", "Green Procurement Compilation (GPC) search result", "radio", { options:[{value:"none",label:"A. Acquires no products or services listed in the GPC"},{value:"requirements",label:"B. Acquires GPC-listed products or services"}], required:true }),
    q("s3_biobased", "Bio-based/Bio-preferred, USDA-designated items", "check", { when:a=>a["s3_gpc"]==="requirements", short:"Bio-based items" }),
    q("s3_smartway", "SmartWay Transportation Services", "check", { when:a=>a["s3_gpc"]==="requirements", short:"SmartWay transportation" }),
    q("s3_energy", "Energy Star, FEMP-designated, FEMP Low Standby Power, or WaterSense products", "check", { when:a=>a["s3_gpc"]==="requirements", short:"Energy efficient products" }),
    q("s3_epeat", "EPEAT-registered electronics", "check", { when:a=>a["s3_gpc"]==="requirements", short:"EPEAT electronics" }),
    q("s3_epeat_verified", "Are there sufficient EPEAT Silver- or Gold-registered products available to meet NASA needs?", "yesno", {yesText:"Enough EPEAT Silver or Gold products are available", noText:"Not enough EPEAT Silver or Gold products are available",  options:yn, when:a=>a["s3_epeat"]==="true" }),
    q("s3_recovered", "Comprehensive Procurement Guideline recycled content or recovered material products", "check", { when:a=>a["s3_gpc"]==="requirements", short:"Recovered material products" }),
    q("s3_recovered_verified", "Will NASA be able to independently verify contractor estimates of recovered material used in contract performance?", "yesno", {yesText:"NASA can verify recovered material estimates", noText:"NASA cannot verify recovered material estimates",  options:yn, when:a=>a["s3_recovered"]==="true" }),
    q("s3_snap", "Non-ozone depleting substances (SNAP program)", "check", { when:a=>a["s3_gpc"]==="requirements", short:"SNAP substances" }),
    q("s3_epa", "Safer Choice products, SmartWay Certified Vehicles, or EPA recommended specifications and ecolabels", "check", { when:a=>a["s3_gpc"]==="requirements", short:"Safer Choice or EPA recommendations" }),
    q("s3_nepa", "National Environmental Policy Act (NEPA) review by the Center NEPA Manager", "radio", { options:[{value:"nerf",label:"Fits a Categorical Exclusion (CatEx) with no extraordinary circumstances"},{value:"catex_consult",label:"Fits a CatEx but needs further consultation, permitting, or studies"},{value:"excluded",label:"Fits the list of excluded activities that need no checklist"}], required:true, help:"Complete the NASA Environmental Review Form or the Center form with the Center NEPA Manager." }),
    q("s3_catex", "CatEx number", "text", {short:"CatEx number",  when:a=>a["s3_nepa"]==="nerf" }),
  ]},
  { key: "4", title: "Service contracting", citation: "FAR 37.104; NFS 1837.104; FAR 7.503; OMB Circular A-76", gates:["services"], questions:[
    q("s4_not_personal", "Will not be used for the performance of personal services. (FAR 37.104 and NFS 1837.104)", "check", {required:true, short:"Not personal services"}),
    q("s4_not_governmental", "Will not be used for the performance of inherently governmental functions. (FAR 7.503)", "check", {required:true, short:"Not inherently governmental"}),
    q("s4_not_employees", "Are not presently being performed, nor recently performed, by government employees. (OMB Circular A-76)", "check", {required:true, short:"Not performed by government employees"}),
    q("s4_advisory", "Will be advisory and assistance services. (FAR 2.1, FAR 37.204, and NFS 1837.204)", "check", {short:"Advisory and assistance services"}),
  ]},
  { key:"5.I", title:"Space flight and ground support programs", citation:"NF 1707 Section 5-I; NPR 7120.5", gates:["space"], questions:[
    q("s5_space_standards", "Are the cited technical standards and specifications the most recent version, tailored, and registered in a standards.nasa.gov watch list?", "radio", {yesText:"Standards are current and registered", noText:"Approved exceptions to standards are attached", options:[{value:"yes",label:"Yes"},{value:"no",label:"No. Exceptions approved by the technical authorities are attached"}]}),
  ]},
  { key:"5.II", title:"Communication and navigation capabilities", citation:"NF 1707 Section 5-II; NPD 8074.1; NPD 2570.5", questions:[
    q("s5_scan", "Does this procurement have Space Communication and Navigation (SCaN) requirements?", "yesno", {yesText:"Has SCaN requirements", noText:"No SCaN requirements", options:yn, short:"SCaN"}),
    q("s5_rf", "Does this procurement contain RF equipment such as transmitters, receivers, antennas, or anything that modifies or amplifies RF signals?", "yesno", {yesText:"Contains RF equipment", noText:"No RF equipment", options:yn, short:"RF equipment", help:"If yes, attach the Center Spectrum Management Office approval."}),
  ]},
  { key:"5.III", title:"Earned value management system", citation:"NFS 1834.201; NPR 7120.5", questions:[
    q("s5_evms", "Which earned value management statement applies?", "radio", { options:[{value:"not-required",label:"EVMS is not required"},{value:"required",label:"EVMS is required, DRDs are attached, and no exceptions apply"},{value:"exception",label:"EVMS is required and approved exceptions are attached"}] }),
  ]},
  { key:"5.IV", title:"Communications", citation:"NPD 2521.1", questions:[
    q("s5_communications", "Does this involve the design, preparation, or creation of communications material?", "yesno", {yesText:"Involves communications material", noText:"No communications material", options:yn, short:"communications material"}),
  ]},
  { key:"5.V", title:"Manned commercial aviation services and unmanned aircraft systems", citation:"NPR 7900.3", gates:["aviation"], questions:[
    q("s5_aviation", "Does this involve acquisition or use of manned or unmanned aircraft systems, including charter, lease, or related aircraft services?", "yesno", {yesText:"Involves aircraft or UAS", noText:"No aircraft or UAS", options:yn, short:"aircraft use", help:"If yes, the Center Flight Operations Office concurrence is required."}),
  ]},
  { key:"5.VI", title:"Software engineering", citation:"NPR 7150.2", questions:[
    q("s5_software", "Is this procurement subject to NPR 7150.2 software engineering requirements?", "yesno", {yesText:"Subject to NPR 7150.2", noText:"Not subject to NPR 7150.2", options:yn, short:"NPR 7150.2 software"}),
    q("s5_software_class", "Software class", "radio", {options:[{value:"A",label:"Class A: Human rated space software systems"},{value:"B",label:"Class B: Non-human rated space software systems or large-scale aeronautics vehicles"},{value:"C",label:"Class C: Mission support software or aeronautic vehicles, or major engineering/research facility software"},{value:"D",label:"Class D: Basic science/engineering design and research and technology software"},{value:"E",label:"Class E: Small light weight design concept and research and technology software"}], when:a=>a["s5_software"]==="yes"}),
  ]},
  { key:"5.VII", title:"Supply chain visibility (SCV) reporting", citation:"NF 1707 Section 5-VII", questions:[
    q("s5_scv", "Is the SCV Reporting DRD required?", "radio", {options:[{value:"required",label:"Required"},{value:"not-required",label:"Not required"}], help:"The DRD applies to new procurements for programs or projects on the approved AMPL valued at $20M or more, including options."}),
    q("s5_scv_under_20m", "Procurement value, including options, is below the $20M threshold", "check", {when:a=>a["s5_scv"]==="not-required", short:"Below $20M"}),
    q("s5_scv_not_ampl", "Procurement is not for a program or project on the approved AMPL", "check", {when:a=>a["s5_scv"]==="not-required", short:"Not on the AMPL"}),
    q("s5_scv_modification", "Modification of an existing contract, not a new procurement", "check", {when:a=>a["s5_scv"]==="not-required", short:"Modification of an existing contract"}),
    q("s5_scv_waiver", "Waiver approved by the NASA Supply Chain Resiliency Board", "check", {when:a=>a["s5_scv"]==="not-required", short:"SCRB waiver"}),
  ]},
  { key:"6", title:"Quality assurance", citation:"NPR 8735.2C; NPR 8735.1; FAR 46.202-4; NFS 1846", questions:[
    q("s6_exempt_it_infra", "Information technology or institutional infrastructure projects", "check", {exclusive:["s6_exempt_it_services","s6_exempt_software","s6_exempt_support","s6_exempt_facilities","s6_exempt_agreement","s6_exempt_other","s6_commercial","s6_rd"], short:"IT or institutional infrastructure"}), q("s6_exempt_it_services", "Information technology services", "check", {exclusive:["s6_exempt_it_infra","s6_exempt_software","s6_exempt_support","s6_exempt_facilities","s6_exempt_agreement","s6_exempt_other","s6_commercial","s6_rd"], short:"IT services"}), q("s6_exempt_software", "Software assurance functions under NASA-STD-8739.8 and NPR 7150.2", "check", {exclusive:["s6_exempt_it_infra","s6_exempt_it_services","s6_exempt_support","s6_exempt_facilities","s6_exempt_agreement","s6_exempt_other","s6_commercial","s6_rd"], short:"Software assurance"}), q("s6_exempt_support", "Contractor support services that do not directly affect product configuration", "check", {exclusive:["s6_exempt_it_infra","s6_exempt_it_services","s6_exempt_software","s6_exempt_facilities","s6_exempt_agreement","s6_exempt_other","s6_commercial","s6_rd"], short:"Contractor support services"}), q("s6_exempt_facilities", "NASA institutional facilities or facility maintenance", "check", {exclusive:["s6_exempt_it_infra","s6_exempt_it_services","s6_exempt_software","s6_exempt_support","s6_exempt_agreement","s6_exempt_other","s6_commercial","s6_rd"], short:"Facilities"}), q("s6_exempt_agreement", "Grants, cooperative agreements, or Space Act agreements", "check", {exclusive:["s6_exempt_it_infra","s6_exempt_it_services","s6_exempt_software","s6_exempt_support","s6_exempt_facilities","s6_exempt_other","s6_commercial","s6_rd"], short:"Grants or agreements"}), q("s6_exempt_other", "Other acquisition. NPR 8735.2C does not apply", "check", {exclusive:["s6_exempt_it_infra","s6_exempt_it_services","s6_exempt_software","s6_exempt_support","s6_exempt_facilities","s6_exempt_agreement","s6_commercial","s6_rd"], short:"Other acquisition"}),
    q("s6_commercial", "Commercial or COTS items under FAR Part 12. NPR 8735.2C paragraph 5.1 applies", "check", {exclusive:["s6_exempt_it_infra","s6_exempt_it_services","s6_exempt_software","s6_exempt_support","s6_exempt_facilities","s6_exempt_agreement","s6_exempt_other","s6_rd"], when:a=>!qualityExempt(a), short:"Commercial or COTS"}), q("s6_rd", "Research and development. NPR 8735.2C paragraph 5.2 applies", "check", {exclusive:["s6_exempt_it_infra","s6_exempt_it_services","s6_exempt_software","s6_exempt_support","s6_exempt_facilities","s6_exempt_agreement","s6_exempt_other","s6_commercial"], when:a=>!qualityExempt(a), short:"Research and development"}),
    q("s6_neither", "Neither critical nor complex. Higher-level quality is not required", "check", {exclusive:["s6_critical","s6_complex"], when:a=>!qualityExempt(a), short:"Neither critical nor complex"}), q("s6_critical", "Critical items or critical work under NPR 8735.2C, Appendix A", "check", {exclusive:["s6_neither"], when:a=>!qualityExempt(a), short:"Critical"}), q("s6_complex", "Complex items or complex work under NPR 8735.2C, Appendix A", "check", {exclusive:["s6_neither"], when:a=>!qualityExempt(a), short:"Complex"}),
    q("s6_standard", "Higher-level quality standard", "radio", {options:[{value:"AS9100",label:"SAE AS9100",help:"Hardware that is any combination of critical or complex."},{value:"ISO9001",label:"ISO 9001",help:"Hardware that is not both critical and complex."},{value:"AS9003",label:"SAE AS9003",help:"Hardware that is not complex."},{value:"ISO17025",label:"ISO 17025",help:"Critical calibration or testing services."},{value:"none",label:"Test and inspection requirements set by the acquiring organization",help:"Hardware that is neither critical nor complex."}], when:a=>!qualityExempt(a)}),
    q("s6_acceptance_days", "Government acceptance testing days after delivery", "number", {short:"Acceptance testing days", when:a=>!qualityExempt(a), placeholder:"14 to 30"}), q("s6_conformance", "Certificate of Conformance under FAR 52.246-15", "check", {when:a=>!qualityExempt(a), short:"Certificate of Conformance"}), q("s6_chemical", "Certificate of Chemical Analysis", "check", {when:a=>!qualityExempt(a), short:"Certificate of Chemical Analysis"}), q("s6_chemical_spec", "Certificate of Chemical Analysis, as specified in", "text", {short:"Chemical analysis as specified in", when:a=>!qualityExempt(a)&&a["s6_chemical"]==="true"}), q("s6_gsi", "Government Source Inspection", "check", {when:a=>!qualityExempt(a), short:"Government Source Inspection"}), q("s6_first_article", "First Article Approval under FAR 52.209-3", "check", {when:a=>!qualityExempt(a), short:"First Article Approval"}), q("s6_further", "Further quality requirements are stated in the attached SOW or specification", "check", {when:a=>!qualityExempt(a), short:"Further quality requirements in the SOW"}),
    q("s6_gidep", "Is this procurement for safety critical items as defined in NPR 8735.1?", "yesno", {yesText:"Safety critical items, GIDEP screened", noText:"Not safety critical items", options:yn, short:"safety critical items", help:"If yes, the items are GIDEP screened and the Center GIDEP Coordinator signs."}),
  ]},
  { key:"7", title:"Safety and health", citation:"NPR 1800.1; NPR 8715.1", questions:[
    q("s7_onsite", "Will the contractor perform work partially or completely on a NASA Center?", "yesno", {yesText:"Work on a NASA Center", noText:"No work on a NASA Center", options:yn, short:"work on a NASA Center"}),
    q("s7_hazards", "Will this involve any of the following?", "checklist", { options:[{value:"radiation",label:"Ionizing radiation sources and devices"},{value:"lasers",label:"Lasers and hazardous non-laser optical radiation"},{value:"uvir",label:"High intensity, ultraviolet, and infrared lights"},{value:"rf",label:"RF and microwave emitters"},{value:"noise",label:"Hazardous noise, 80 dBA or more at 1 meter or less"},{value:"explosives",label:"Pyrotechnic devices and explosives"},{value:"pressure",label:"Pressurized vessels"},{value:"toxic",label:"Toxic or hazardous substances, materials, or chemicals"},{value:"nano",label:"Nano and ultrafine particles"},{value:"biological",label:"Infectious or biological agents"},{value:"other",label:"Other articles or substances listed in Appendix D"}] }),
    q("s7_sma", "Requires Center Safety and Mission Assurance review and approval (for example lifting devices, fall protection, or construction services)", "check", {short:"Center SMA review"}),
    q("s7_reviewed", "Reviewed under NPR 1800.1 chapter 4 and NPR 8715.1 to identify risks, controls, alternatives, and safety requirements", "check", {short:"Safety review done"}),
  ]},
  { key:"8", title:"Property management", citation:"NPR 4100.1; NPR 4200.1; NPR 4300.1", questions:[
    q("s8_capital", "Will this procurement involve the purchase or fabrication of property with a unit value of $1,000,000 or more, to which the government will take title?", "yesno", {yesText:"Property of $1M or more, NF 1739 attached", noText:"No property of $1M or more", options:yn, short:"property of $1M or more", help:"If yes, attach NF 1739, Capitalization Determination Form."}),
    q("s8_supply", "Primary source of supply, acquisition, and reutilization efforts are exhausted (NPR 4200.1, NPR 4300.1)", "check", {short:"Supply sources exhausted"}),
    q("s8_equipment", "Equipment management personnel are coordinated for control and accountability (NPR 4200.1)", "check", {short:"Equipment management coordinated"}),
    q("s8_property_note", "Government property note (kept on the file, not printed on the form)", "text", {short:"Property note", placeholder:"What government property is involved?"}),
  ]},
  { key:"9", title:"Required special approvals, Center-specific supplements", citation:"NF 1707 Section 9; Center policy", questions:[q("s9_required", "Which special approvals statement applies?", "radio", {options:[{value:"no",label:"There are no items requiring special approval"},{value:"sap",label:"Approvals were obtained through the SAP release strategy"},{value:"yes",label:"Approvals for special items are attached"}]}),q("s9_which", "Which approval? (kept on the file)", "text", {short:"Approval", when:a=>a["s9_required"]==="yes"||a["s9_required"]==="sap"})]},
  { key:"10", title:"Foreign travel briefings for NASA contractors", citation:"NPR 1660.1", questions:[q("s10_foreign_travel", "Will NASA contractor employees go on official travel to Designated Countries, Russia, or other high-threat locations?", "yesno", {yesText:"Travel to high-threat locations", noText:"No travel to high-threat locations", options:yn, short:"high-threat travel", help:"If yes, the contract includes the Counterintelligence Briefings requirement."})]},
  { key:"11", title:"Extraneous promotional and personal use items", citation:"MSC-2011-12-001", questions:[q("s11_extraneous", "Does this procurement involve any prohibited extraneous promotional or personal use items?", "yesno", {yesText:"Involves prohibited promotional items", noText:"No prohibited promotional items", options:yn, short:"prohibited items", help:"The form only allows the statement that none are involved. Remove any such items before submitting."})]},
  { key:"12", title:"Other current NASA directives", citation:"NF 1707 Section 12; NODIS", questions:[q("s12_directives", "After reviewing NODIS, do additional NASA directives apply?", "radio", {options:[{value:"none",label:"No additional NASA directives apply"},{value:"attached",label:"Additional directives apply and the list is attached"}]})]},
];

function qualityExempt(a:NfAnswers){return ["s6_exempt_it_infra","s6_exempt_it_services","s6_exempt_software","s6_exempt_support","s6_exempt_facilities","s6_exempt_agreement","s6_exempt_other"].some(k=>a[k]==="true")}
export function canonicalFromFacts(facts:IntakeFacts):NfAnswers{return {"gate.it":facts.includes_it?"yes":"no","gate.services":facts.contract_type?(/service|time-and-materials|labor-hour/i.test(facts.contract_type)?"yes":"no"):"","gate.hardware":facts.hardware_deliverable?"yes":"no","derived.fee_contract":/cost|incentive/i.test(`${facts.contract_type} ${facts.hybrid_contract_type}`)?"yes":"no"}}

/** The answer keys Intake owns (gates, derived flags, and the s-numbered questions). */
export function canonicalAnswers(a:Record<string,unknown>):NfAnswers{const out:NfAnswers={};for(const [k,v] of Object.entries(a))if(/^(gate\.|derived\.|s\d)/.test(k)&&typeof v==="string"&&v!=="")out[k]=v;return out}

/**
 * Read the answers stored on an acquisition (sample or saved action) back into
 * the gate answers and the curated questions, so nothing is left orphaned.
 */
export function answersFromStored(stored:Record<string,unknown>):NfAnswers{
 const out:NfAnswers={}; const text=(key:string)=>String(stored[key]??"").trim(); const has=(key:string)=>{const v=text(key);return !!v&&!/^none$/i.test(v)};
 // Some records already hold canonical keys; carry them straight through.
 for(const [key,value] of Object.entries(stored)) if(/^(gate\.|derived\.|s\d)/.test(key)&&typeof value==="string") out[key]=value;

 const services=text("Section4_service_contracting"); const it=text("Section2_section_508"); const property=text("Section8_property");
 const space=text("Section5_I_space_flight"); const aviation=text("Section5_V_aviation"); const safety=text("Section7_safety_health");
 if(services) out["gate.services"]=/\bservices?\b/i.test(services)?"yes":"no";
 if(it) out["gate.it"]=/no information technology|UnderLimitNoIT/i.test(it)?"no":"yes";
 if(property) out["gate.hardware"]=has("Section8_property")?"yes":"no";
 if(space) out["gate.space"]=/S5In1|not space flight/i.test(space)?"no":"yes";
 if(aviation) out["gate.aviation"]=/\byes\b|S5Vn2/i.test(aviation)&&!/S5Vn1\b/i.test(aviation)?"yes":"no";
 if(safety) out["gate.hazards"]=has("Section7_safety_health")?"yes":"no";

 const sourcing=text("Section1_strategic_sourcing");
 if(sourcing&&!out["s1_strategy"]) out["s1_strategy"]=/NotAvailable|not available/i.test(sourcing)?"no":"yes";
 if(!out["s2_authorization"]){if(it&&out["gate.it"]==="no") out["s2_authorization"]="under_limit"; else if(/CITR/i.test(it)) out["s2_authorization"]="citr"; else if(/ORCA/i.test(it)) out["s2_authorization"]="orca";}
 const env=text("Section3_environmental");
 if(env) out["s3_gpc"]=/no GPC|S3n1\b/i.test(env)?"none":"requirements";
 if(services&&/S4n2|services/i.test(services)) out["gate.services"]="yes";
 if(services){out["s4_not_personal"]=String(/not personal/i.test(services));out["s4_not_governmental"]=String(/not inherently governmental/i.test(services));out["s4_not_employees"]=String(/not performed by government employees|not performed by civil/i.test(services))}
 const scan=text("Section5_II_scan_rf");
 if(scan){out["s5_scan"]=/no SCaN|S5IIn1\b/i.test(scan)?"no":"yes";out["s5_rf"]=/radar|RF use|RF equipment|transmitter|spectrum/i.test(scan)?"yes":"no"}
 const evms=text("Section5_III_evms");
 if(evms) out["s5_evms"]=/no EVMS|S5IIIn1\b/i.test(evms)?"not-required":/exception/i.test(evms)?"exception":"required";
 const comms=text("Section5_IV_communications");
 if(comms) out["s5_communications"]=/S5IVn1\b|\bno\b/i.test(comms)?"no":"yes";
 if(aviation) out["s5_aviation"]=out["gate.aviation"]==="yes"?"yes":"no";
 const software=text("Section5_VI_software");
 if(software&&/not subject|S5VIn1\b/i.test(software)&&!out["s5_software"]) out["s5_software"]="no";
 if(software&&!/not subject|S5VIn1\b/i.test(software)){out["s5_software"]="yes";const cls=software.match(/class\s+([A-E])\b/i);if(cls?.[1])out["s5_software_class"]=cls[1].toUpperCase()}
 const scv=text("Section5_VII_scv");
 if(scv){const notRequired=/not required|SCVIn2/i.test(scv);out["s5_scv"]=notRequired?"not-required":"required";if(notRequired){out["s5_scv_under_20m"]=String(/\$20M|20 ?M|SCVIn2s1/i.test(scv));out["s5_scv_not_ampl"]=String(/AMPL/i.test(scv));out["s5_scv_modification"]=String(/modification/i.test(scv))}}
 const quality=text("Section6_quality");
 if(quality&&/neither critical nor complex/i.test(quality)) out["s6_neither"]="true";
 if(quality){out["s6_critical"]=String(/(?<!neither )\bcritical\b/i.test(quality)&&!/neither critical/i.test(quality));out["s6_complex"]=String(/\bcomplex\b/i.test(quality)&&!/neither critical nor complex/i.test(quality));const std=["AS9100","ISO 9001","AS9003","ISO 17025"].find(s=>new RegExp(s.replace(" ","\\s?"),"i").test(quality));out["s6_standard"]=std?std.replace(" ",""):""}
 if(safety&&/Safety and Mission Assurance/i.test(safety)) out["s7_sma"]="true";
 if(safety&&/S7In4/i.test(safety)) out["s7_reviewed"]="true";
 if(safety){const map:[RegExp,string][]=[[/ionizing radiation/i,"radiation"],[/laser/i,"lasers"],[/UV|infrared|\bIR\b/i,"uvir"],[/\bRF\b|microwave|radar/i,"rf"],[/noise/i,"noise"],[/pyrotechnic|explosive/i,"explosives"],[/pressure vessel/i,"pressure"],[/toxic|hazardous substance/i,"toxic"],[/nano|ultrafine/i,"nano"],[/biological|infectious/i,"biological"]];const picked=map.filter(([re])=>re.test(safety)).map(([,v])=>v);if(picked.length)out["s7_hazards"]=picked.join("|")}
 if(property){out["s8_capital"]=/capital equipment/i.test(property)?"yes":"no";out["s8_property_note"]=property}
 const travel=text("Section10_foreign_travel"); if(travel) out["s10_foreign_travel"]=has("Section10_foreign_travel")?"yes":"no";
 const extraneous=text("Section11_promotional_items"); if(extraneous) out["s11_extraneous"]=has("Section11_promotional_items")?"yes":"no";
 // Answers saved from Intake or the form page win over the older narrative keys.
 for(const [key,value] of Object.entries(stored)) if(/^(gate\.|derived\.|s\d)/.test(key)&&typeof value==="string") out[key]=value;
 return out;
}

export function sectionApplies(s:Section,a:NfAnswers){return !s.gates||s.gates.some(g=>a[`gate.${g}`]==="yes")}
function answered(v?:string){return !!v&&v!=="false"}
function sectionAnswered(s:Section,a:NfAnswers){return s.questions.some(question=>answered(a[question.key]))}
function sectionVisible(s:Section,a:NfAnswers){return s.key==="2"||sectionApplies(s,a)||sectionAnswered(s,a)}
function choiceText(question:Question,value:string){
 if(question.kind==="check")return value==="true"?(question.short??question.label):"";
 if(question.kind==="checklist")return value.split("|").map(v=>question.options?.find(o=>o.value===v)?.label).filter(Boolean).join(", ");
 if(value==="yes"&&question.yesText)return question.yesText;
 if(value==="no"&&question.noText)return question.noText;
 const option=question.options?.find(o=>o.value===value);
 if(option)return option.label;
 return question.kind==="text"||question.kind==="number"?`${question.short??question.label}: ${value}`:value;
}
function sectionSummary(questions:Question[],a:NfAnswers){
 return questions.map(question=>answered(a[question.key])?choiceText(question,a[question.key]!):"").filter(Boolean).join(" · ");
}

/**
 * Intake answers written onto the NF 1707 (03/25) blank. Cell names are the
 * blank's own Subform.Field names; each comment names the statement. Only a
 * checked box ("1") or entered text is written; every other cell stays blank,
 * which is how the blank reads an unchecked box.
 */
export function mappedNf1707(fields:Nf1707Field[], answers:NfAnswers, approvals:Record<string,string>={}, facts?:Partial<IntakeFacts>){
 const out:Record<string,string>={}; for(const f of fields) out[`${f.section??""}.${f.subform??""}.${f.field_name??""}`]="";
 const a=answers; const box=(cell:string,on:boolean)=>{if(on)out[cell]="1"}; const text=(cell:string,v?:string)=>{if(v&&v.trim())out[cell]=v.trim()}; const yes=(k:string)=>a[k]==="yes"; const no=(k:string)=>a[k]==="no"; const chk=(k:string)=>a[k]==="true";
 // Section 1, strategic sourcing.
 box("Section1.Section1.Available",yes("s1_strategy")); text("Section1.Section1.MandatoryContractNum",yes("s1_strategy")?a["s1_contract_number"]:""); box("Section1.Section1.NotAvailable",no("s1_strategy"));
 // Section 2, complete only one subsection.
 const s2=a["s2_authorization"]??(a["gate.it"]==="no"?"under_limit":"");
 if(s2==="citr")text("Section2.Section2.CITRAuth",a["s2_citr_number"]); if(s2==="orca")text("Section2.Section2.ORCAAuth",a["s2_orca_number"]);
 box("Section2.Section2.UnderLimitNoIT",s2==="under_limit"); if(s2==="none")text("Section2.Section2.NoITAuth",a["s2_no_authorization_reason"]); box("Section2.Section2.NotReviewed",s2==="not_reviewed");
 // Section 3-I, GPC; 3-III, NEPA.
 box("Section3.Section3.S3n1",a["s3_gpc"]==="none"); box("Section3.Section3.S3n2",a["s3_gpc"]==="requirements");
 if(a["s3_gpc"]==="requirements"){box("Section3.Section3.S3n2s1",chk("s3_biobased"));box("Section3.Section3.S3n2s2",chk("s3_smartway"));box("Section3.Section3.S3n2s3",chk("s3_energy"));box("Section3.Section3.S3n2s4",chk("s3_epeat"));if(chk("s3_epeat")){box("Section3.Section3.S3n2s5Yes",yes("s3_epeat_verified"));box("Section3.Section3.S3n2s5No",no("s3_epeat_verified"))}box("Section3.Section3.S3n2s6",chk("s3_recovered"));if(chk("s3_recovered")){box("Section3.Section3.S3n2s7Yes",yes("s3_recovered_verified"));box("Section3.Section3.S3n2s7No",no("s3_recovered_verified"))}box("Section3.Section3.S3n2s8",chk("s3_snap"));box("Section3.Section3.S3n2s9",chk("s3_epa"))}
 box("Section3s3.Section3s3.S3s3n1",a["s3_nepa"]==="nerf"); if(a["s3_nepa"]==="nerf")text("Section3s3.Section3s3.S3n3n1Info",a["s3_catex"]); box("Section3s3.Section3s3.S3s3n2",a["s3_nepa"]==="catex_consult"); box("Section3s3.Section3s3.S3s3n3",a["s3_nepa"]==="excluded");
 // Section 4: supplies only, or services with the affirmations checked.
 box("Section4.Section4.S4n1",a["gate.services"]==="no"); box("Section4.Section4.S4n2",a["gate.services"]==="yes");
 if(a["gate.services"]==="yes"){box("Section4.Section4.S4n2s1",chk("s4_not_personal"));box("Section4.Section4.S4n2s2",chk("s4_not_governmental"));box("Section4.Section4.S4n2s3",chk("s4_not_employees"));box("Section4.Section4.S4n2s4",chk("s4_advisory"))}
 // Section 5-I to 5-VII.
 box("Section5s1.Section5s1.S5In1",a["gate.space"]==="no"); box("Section5s1.Section5s1.S5In2",a["gate.space"]==="yes");
 if(a["gate.space"]==="yes"){box("Section5s1.Section5s1.S5In2s1",yes("s5_space_standards"));box("Section5s1.Section5s1.S5In2s2",no("s5_space_standards"))}
 box("Section5s2.Section5s2.S5IIn1",no("s5_scan")); box("Section5s2.Section5s2.S5IIn2",yes("s5_scan")); box("Section5s2.Section5s2.S5IIn3",no("s5_rf")); box("Section5s2.Section5s2.S5IIn4",yes("s5_rf"));
 box("Section5s3.Section5s3.S5IIIn1",a["s5_evms"]==="not-required"); box("Section5s3.Section5s3.S5IIIn2",a["s5_evms"]==="required"||a["s5_evms"]==="exception"); box("Section5s3.Section5s3.S5IIIn3",a["s5_evms"]==="required"); box("Section5s3.Section5s3.S5IIIn4",a["s5_evms"]==="exception");
 box("Section5s4.Section5s4.S5IVn1",no("s5_communications")); box("Section5s4.Section5s4.S5IVn2",yes("s5_communications"));
 const aviation=a["s5_aviation"]||a["gate.aviation"]; box("Section5s5.Section5s5.S5Vn1",aviation==="no"); box("Section5s5.Section5s5.S5Vn2",aviation==="yes");
 box("Section5s6.Section5s6.S5VIn1",no("s5_software")); box("Section5s6.Section5s6.S5VIn2",yes("s5_software"));
 if(yes("s5_software"))["A","B","C","D","E"].forEach((c,i)=>box(`Section5s6.Section5s6.S5VIn2s${i+1}`,a["s5_software_class"]===c));
 box("Section5s7.Section5s7.SCVIn1",a["s5_scv"]==="required"); box("Section5s7.Section5s7.SCVIn2",a["s5_scv"]==="not-required");
 if(a["s5_scv"]==="not-required")["s5_scv_under_20m","s5_scv_not_ampl","s5_scv_modification","s5_scv_waiver"].forEach((k,i)=>box(`Section5s7.Section5s7.SCVIn2s${i+1}`,chk(k)));
 // Section 6-I exclusions and type, critical or complex; 6-II standard; 6-III other; 6-IV GIDEP.
 const exempt:[string,string][]=[["s6_exempt_it_infra","S6In1"],["s6_exempt_it_services","S6In2"],["s6_exempt_software","S6In3"],["s6_exempt_support","S6In4"],["s6_exempt_facilities","S6In5"],["s6_exempt_agreement","S6In6"],["s6_exempt_other","S6In9"]];
 exempt.forEach(([k,c])=>box(`Section6s1.Section6s1.${c}`,chk(k)));
 if(!qualityExempt(a)){
  box("Section6s1.Section6s1.S6In7",chk("s6_commercial")); box("Section6s1.Section6s1.S6In8",chk("s6_rd"));
  box("Section6s2.Section6s2.S6IIn1",chk("s6_neither")); box("Section6s2.Section6s2.S6IIn2",chk("s6_critical")); box("Section6s2.Section6s2.S6IIn3",chk("s6_complex"));
  const std=a["s6_standard"]; box("Section6s3.Section6s3.S6IIIn1",!!std&&std!=="none");
  [["AS9100","S6IIIn2"],["ISO9001","S6IIIn3"],["AS9003","S6IIIn4"],["ISO17025","S6IIIn5"],["none","S6IIIn6"]].forEach(([v,c])=>box(`Section6s3n2.Section6s3n2.${c}`,std===v));
  const days=(a["s6_acceptance_days"]??"").trim(); box("Section6s4.Section6s4.S6IVn1",!!days); text("Section6s4.Section6s4.S6IVn1Input",days);
  box("Section6s4.Section6s4.S6IVn2",chk("s6_conformance")); box("Section6s4.Section6s4.S6IVn3",chk("s6_chemical")); if(chk("s6_chemical"))text("Section6s4.Section6s4.CertificateInput",a["s6_chemical_spec"]);
  box("Section6s4.Section6s4.S6IVn4",chk("s6_gsi")); box("Section6s4.Section6s4.S6IVn5",chk("s6_first_article")); box("Section6s4.Section6s4.S6IVn6",chk("s6_further"));
 }
 box("Section6s6.Section6s6.S6VIn1",no("s6_gidep")); box("Section6s6.Section6s6.S6VIn2",yes("s6_gidep"));
 // Section 7, safety and health. Hazard boxes in the order the form prints them.
 box("Section7.Section7.S7In1",yes("s7_onsite"));
 const hazards=(a["s7_hazards"]??"").split("|").filter(Boolean); const order=["radiation","lasers","uvir","rf","noise","explosives","pressure","toxic","nano","biological","other"];
 box("Section7.Section7.S7In2",hazards.length>0); order.forEach((h,i)=>box(`Section7.Section7.S7In2s${i+1}`,hazards.includes(h)));
 box("Section7.Section7.S7In3",chk("s7_sma")); box("Section7.Section7.S7In4",chk("s7_reviewed"));
 // Section 8, property.
 box("Section8.Section8.S8IIn1",no("s8_capital")); box("Section8.Section8.S8IIn2",yes("s8_capital")); box("Section8.Section8.S8In1",chk("s8_supply")); box("Section8.Section8.S8In2",chk("s8_equipment"));
 // Section 9 to 12.
 box("Section9s1.Section9s1.S9n1",a["s9_required"]==="no"); box("Section9s1.Section9s1.S9n2",a["s9_required"]==="sap"); box("Section9s1.Section9s1.S9n3",a["s9_required"]==="yes");
 box("Section10.Section10.S10n1",no("s10_foreign_travel")); box("Section10.Section10.S10n2",yes("s10_foreign_travel"));
 box("Section11.Section11.S11n1",no("s11_extraneous"));
 box("Section12.Section12.S12n1",a["s12_directives"]==="none"); box("Section12.Section12.S12n2",a["s12_directives"]==="attached");
 if(facts){text("HeaderWrapper.HeaderWrapper.Center",facts.center_code??"");text("HeaderWrapper.HeaderWrapper.ReqNumber",facts.pr_number??"");text("HeaderWrapper.HeaderWrapper.ReqOrg",facts.requester_org_code??"");text("HeaderWrapper.HeaderWrapper.RequirementDescription",facts.description_of_requirement??"")}
 Object.assign(out,approvals); return out;
}

/**
 * Stored NF 1707 answers in the form the export and read view use. Records
 * that carry Intake answer keys, or the older seeded narrative keys, are
 * re-mapped onto the blank's cells; signature and concurrence text already on
 * the record is kept. Records that hold only cells are returned as stored.
 */
export function normalizeNf1707Stored(stored:Record<string,unknown>, facts?:Partial<IntakeFacts>):Record<string,string>{
 const entries=Object.entries(stored??{}); const hasIntake=entries.some(([k])=>/^(gate\.|derived\.|s\d)/.test(k)); const hasLegacy=entries.some(([k])=>/^Section\d+_/.test(k));
 const cells:Record<string,string>={}; for(const [k,v] of entries) if(k.split(".").length>=3&&v!==null&&v!==undefined&&typeof v!=="object") cells[k]=String(v);
 if(!hasIntake&&!hasLegacy) return cells;
 const keep:Record<string,string>={}; for(const [k,v] of Object.entries(cells)) if(/^HeaderWrapper\.|Sig$|Concurrence$|Approval$|Txt$/.test(k)&&v) keep[k]=v;
 return {...mappedNf1707([], answersFromStored(stored), {}, facts), ...keep};
}

function QuestionRow({question,answers,setAnswers}:{question:Question;answers:NfAnswers;setAnswers:React.Dispatch<React.SetStateAction<NfAnswers>>}){
 if(question.when&&!question.when(answers))return null; const value=answers[question.key]??""; const id=`nf-${question.key}`; const set=(v:string)=>setAnswers(a=>({...a,[question.key]:v}));
 if(question.kind==="checklist") return <fieldset className="py-4"><legend className="text-[15px] leading-[22px]">{question.label}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{question.options?.map(o=>{const values=value?value.split("|"):[];const checked=values.includes(o.value);return <label key={o.value} className="flex items-start gap-2 text-[14px]"><input type="checkbox" checked={checked} onChange={()=>set(checked?values.filter(v=>v!==o.value).join("|"):[...values,o.value].join("|"))}/><span>{o.label}</span></label>})}</div></fieldset>;
 if(question.kind==="check")return <div className="py-4"><label className="flex items-start gap-2 text-[15px]"><input id={id} type="checkbox" checked={value==="true"} onChange={e=>{const on=e.target.checked;setAnswers(a=>{const next={...a,[question.key]:String(on)};if(on)for(const k of question.exclusive??[])if(next[k]==="true")next[k]="false";return next})}}/><span>{question.label}{question.required?" (required)":""}</span></label>{question.help?<p className="ml-6 mt-1 text-[13px] text-muted-foreground">{question.help}</p>:null}</div>;
 if(question.kind==="radio"||question.kind==="yesno")return <fieldset className="py-4"><legend className="text-[15px] leading-[22px]">{question.label}{question.required?" (required)":""}</legend><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">{(question.options??yn).map(o=><label key={o.value} className="flex items-start gap-2 text-[14px]"><input type="radio" name={id} value={o.value} checked={value===o.value} onChange={()=>set(o.value)}/><span>{o.label}{o.help?<small className="block text-muted-foreground">{o.help}</small>:null}</span></label>)}</div>{question.help?<p className="mt-1 text-[13px] text-muted-foreground">{question.help}</p>:null}</fieldset>;
 return <div className="py-4"><label htmlFor={id} className="block text-[13px] text-muted-foreground">{question.label}</label><input id={id} type={question.kind==="number"?"number":"text"} placeholder={question.placeholder} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[15px]" value={value} onChange={e=>set(e.target.value)}/></div>
}

export function Nf1707Intake({answers,setAnswers,fields,facts,evmThreshold}:{answers:NfAnswers;setAnswers:React.Dispatch<React.SetStateAction<NfAnswers>>;fields:Nf1707Field[];facts:IntakeFacts;evmThreshold:number}){
 const merged=useMemo(()=>({...canonicalFromFacts(facts),...answers}),[facts,answers]);
 const value=Number(String(facts.estimated_value).replace(/[^0-9.]/g,""))||0;
 const sections=NF1707_SECTIONS.filter(s=>sectionVisible(s,merged));
 const questionsFor=(s:Section)=>{
  const notApplicable=s.gates&&!sectionApplies(s,merged)&&!sectionAnswered(s,merged);
  if(notApplicable)return [] as Question[];
  return s.questions.filter(x=>!x.when||x.when(merged));
 };
 const answeredCount=sections.filter(s=>sectionAnswered(s,merged)).length;
 const [preview,setPreview]=useState(false); const mapped=useMemo(()=>mappedNf1707(fields,merged,{},facts),[fields,merged,facts]);
 return <section aria-labelledby="nf1707-title" className="mb-10 border-t border-border pt-6"><div className="mb-2 flex flex-wrap items-start justify-between gap-3"><div><h2 id="nf1707-title" className="text-[18px] font-medium leading-6">NF 1707 requester questions</h2><p className="mt-1 max-w-[70ch] text-[13px] text-muted-foreground">Approvals and signatures are tracked later in the acquisition roadmap.</p></div><Button type="button" variant="link" className="h-auto p-0" onClick={()=>setPreview(true)}>Export preview</Button></div>
 <p className="mb-5 text-[13px] text-muted-foreground">{answeredCount} of {sections.length} sections answered.</p>
 <fieldset className="mb-6 max-w-[70ch] border border-border bg-background p-4"><legend className="px-1 text-[15px] font-medium">Gate questions</legend>{GATES.map(g=><div key={g.key} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 last:border-b-0"><span className="text-[15px]">{g.label}</span><div className="flex gap-4">{yn.map(o=><label key={o.value} className="flex items-center gap-2 text-[14px]"><input type="radio" name={`gate-${g.key}`} checked={merged[`gate.${g.key}`]===o.value} onChange={()=>setAnswers(a=>({...a,[`gate.${g.key}`]:o.value}))}/>{o.label}</label>)}</div></div>)}</fieldset>
 <div className="max-w-[70ch] space-y-3">{sections.map(s=>{const qs=questionsFor(s);const summary=qs.length?sectionSummary(qs,merged):"Not applicable";return <details key={s.key} id={`nf-section-${s.key}`} className="rounded-lg border border-border bg-background" open={false}><summary className="cursor-pointer list-none px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="text-[18px] font-medium">Section {s.key} · {s.title}</span><span className="mt-1 block text-[13px] text-muted-foreground">{s.citation}</span>{summary?<span className="mt-1 block text-[13px]">{summary}</span>:null}</summary><div className="divide-y divide-border border-t border-border px-4">{qs.length?qs.map(question=><QuestionRow key={question.key} question={question} answers={merged} setAnswers={setAnswers}/>):<p className="py-4 text-[15px] text-muted-foreground">Answered by the gate question above. The form prints the matching statement.</p>}</div></details>})}</div>
 {preview?<div role="dialog" aria-modal="true" aria-labelledby="export-title" className="fixed inset-0 z-50 grid place-items-center bg-foreground/60 p-4"><div className="max-h-[88vh] w-full max-w-4xl overflow-auto rounded-xl bg-background p-6 shadow-lg"><div className="mb-4 flex items-center justify-between gap-4"><div><h2 id="export-title" className="text-[18px] font-medium">NF 1707 export preview</h2><p className="text-[13px] text-muted-foreground">{Object.values(mapped).filter(Boolean).length} filled form fields. Approval fields fill from the Approvals step.</p></div><Button type="button" variant="outline" onClick={()=>setPreview(false)}>Close</Button></div><div className="overflow-x-auto"><table className="w-full border border-border text-[13px]"><thead><tr><th className="px-3 py-2 text-left">Form field</th><th className="px-3 py-2 text-left">Filled value</th></tr></thead><tbody>{Object.entries(mapped).filter(([,v])=>!!v).map(([k,v])=><tr key={k} className="border-t border-border"><td className="px-3 py-2 text-muted-foreground">{nf1707CellText(k)??k}</td><td className="px-3 py-2">{v==="1"?"Checked":v}</td></tr>)}</tbody></table></div></div></div>:null}</section>
}
