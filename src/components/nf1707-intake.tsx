import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { IntakeFacts } from "@/lib/intake";
import type { Nf1707Field } from "@/lib/nf1707";

export type NfAnswers = Record<string, string>;
type GateKey = "services" | "it" | "hardware" | "space" | "aviation" | "hazards";
type Question = { key: string; label: string; short?: string; kind: "yesno" | "check" | "checklist" | "radio" | "text" | "number"; options?: { value: string; label: string; help?: string }[]; when?: (a: NfAnswers) => boolean; required?: boolean; help?: string; placeholder?: string };
type Section = { key: string; title: string; citation: string; gates?: GateKey[]; questions: Question[] };

export const GATES: { key: GateKey; label: string }[] = [
  { key: "services", label: "Does this include services?" },
  { key: "it", label: "Does this include information technology?" },
  { key: "hardware", label: "Does this include hardware, materials, or a physical deliverable?" },
  { key: "space", label: "Does this involve space flight hardware/software or ground systems?" },
  { key: "aviation", label: "Does this involve aircraft, aviation services, or UAS?" },
  { key: "hazards", label: "Could this involve hazardous substances, radiation, lasers, pressure vessels, explosives, or biological agents?" },
];

const yn: { value: string; label: string; help?: string }[] = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];
const yna = [...yn, { value: "na", label: "Not applicable" }];
const q = (key: string, label: string, kind: Question["kind"], extra: Partial<Question> = {}): Question => ({ key, label, kind, ...extra });

export const NF1707_SECTIONS: Section[] = [
  { key: "1", title: "Strategic sourcing", citation: "NASA Form 1707, Section 1", questions: [
    q("s1_strategy", "Is the requirement available through a NASA enterprise or strategic sourcing solution?", "yesno", { options: yna, short: "strategic sourcing" }),
  ]},
  { key: "2", title: "Section 508 and information technology", citation: "FITARA; NFS 1839; PCD 25-06A", gates: ["it"], questions: [
    q("s2_authorization", "Which IT authorization applies?", "radio", { options: [{value:"citr",label:"CITR authorization"},{value:"orca",label:"ORCA authorization"},{value:"none",label:"No IT authorization"}], required:true }),
    q("s2_citr_number", "CITR authorization number", "text", { when:a=>a["s2_authorization"]==="citr" }),
    q("s2_orca_number", "ORCA authorization number", "text", { when:a=>a["s2_authorization"]==="orca" }),
    q("s2_no_authorization_reason", "Reason no IT authorization applies", "text", { when:a=>a["s2_authorization"]==="none" }),
  ]},
  { key: "3", title: "Environmental", citation: "FAR subpart 23.1; NPR 8530.1", questions: [
    q("s3_gpc", "Green Procurement Compilation search", "radio", { options:[{value:"requirements",label:"GPC searched — applicable requirements identified"},{value:"none",label:"GPC searched — none apply"},{value:"na",label:"Not applicable"}], required:true }),
    q("s3_biobased", "Bio-based / Bio-preferred, USDA-designated items", "check", { when:a=>a["s3_gpc"]==="requirements", short:"bio-based" }),
    q("s3_energy", "Energy efficient", "check", { when:a=>a["s3_gpc"]==="requirements", short:"energy efficient" }),
    q("s3_smartway", "SmartWay transportation services", "check", { when:a=>a["s3_gpc"]==="requirements", short:"SmartWay" }),
    q("s3_epa", "EPA-designated products or services", "check", { when:a=>a["s3_gpc"]==="requirements", short:"EPA-designated" }),
    q("s3_epeat", "Electronic Product Environmental Assessment Tool (EPEAT)", "check", { when:a=>a["s3_gpc"]==="requirements", short:"EPEAT" }),
    q("s3_recovered", "Recovered material", "check", { when:a=>a["s3_gpc"]==="requirements", short:"recovered material" }),
    q("s3_snap", "SNAP non-ozone-depleting substances", "check", { when:a=>a["s3_gpc"]==="requirements", short:"SNAP" }),
    q("s3_epeat_verified", "Are there sufficient EPEAT Silver- or Gold-registered products available to meet NASA needs?", "yesno", { options:yna, when:a=>a["s3_epeat"]==="true" }),
    q("s3_recovered_verified", "Will NASA be able to independently verify contractor estimates of recovered material used in contract performance?", "yesno", { options:yna, when:a=>a["s3_recovered"]==="true" }),
    q("s3_nepa", "National Environmental Policy Act review", "radio", { options:[{value:"nerf",label:"NERF completed — CatEx number"},{value:"excluded",label:"Fits excluded activities list"},{value:"na",label:"Not applicable"}], required:true, help:"NERF: https://www.nasa.gov/reference/nepa/" }),
    q("s3_catex", "CatEx number", "text", { when:a=>a["s3_nepa"]==="nerf" }),
  ]},
  { key: "4", title: "Service contracting", citation: "FAR 37.104; NFS 1837.104; FAR 7.503; OMB Circular A-76", gates:["services"], questions:[
    q("s4_not_personal", "Will not be used for the performance of personal services. (FAR 37.104 / NFS 1837.104)", "check", {required:true, short:"not personal"}),
    q("s4_not_governmental", "Will not be used for the performance of inherently governmental functions. (FAR 7.503)", "check", {required:true, short:"not inherently governmental"}),
    q("s4_not_employees", "Are not presently being performed, nor recently performed, by government employees. (OMB Circular A-76)", "check", {required:true, short:"not performed by civil servants"}),
  ]},
  { key:"5.I", title:"Space flight hardware and software", citation:"NPR 7123.1", gates:["space"], questions:[
    q("s5_space_standards", "Are technical standards and specifications current, tailored, and registered for change notices?", "yesno", {options:yna}),
  ]},
  { key:"5.II", title:"SCaN and radio frequency", citation:"NPD 2570.5; NFS 1839.70", gates:["space"], questions:[
    q("s5_scan", "Does this requirement include Space Communication and Navigation capabilities?", "yesno", {options:yna, short:"SCaN"}),
    q("s5_rf", "Does this requirement contain RF equipment such as transmitters, receivers, antennas, or RF signal equipment?", "yesno", {options:yna, short:"RF equipment"}),
  ]},
  { key:"5.III", title:"Earned value management", citation:"NFS 1834.201; NPR 7120.5", questions:[
    q("s5_evms", "Which earned value management statement applies?", "radio", { options:[{value:"not-required",label:"EVMS is not required"},{value:"required",label:"EVMS is required and the contract DRDs are attached"},{value:"exception",label:"An exception to EVMS requirements applies"}] }),
  ]},
  { key:"5.IV", title:"Communications", citation:"NPD 2521.1", gates:["space"], questions:[
    q("s5_communications", "Does this involve the design, preparation, or creation of communications material?", "yesno", {options:yna, short:"communications material"}),
  ]},
  { key:"5.V", title:"Aviation", citation:"NPR 7900.3", gates:["aviation"], questions:[
    q("s5_aviation", "Does this involve acquisition or use of manned or unmanned aircraft systems, including charter, lease, or related services?", "yesno", {options:yna, short:"aircraft use"}),
  ]},
  { key:"5.VI", title:"Software", citation:"NPR 7150.2", gates:["space"], questions:[
    q("s5_software", "Does this requirement include software subject to NPR 7150.2?", "yesno", {options:yna, short:"NPR 7150.2 software"}),
    q("s5_software_class", "Software class", "radio", {options:[{value:"A",label:"Class A — Human-rated space software systems"},{value:"B",label:"Class B — Non-human-rated space systems or large-scale aeronautics vehicles"},{value:"C",label:"Class C — Mission support, aeronautics, or major facility software"},{value:"D",label:"Class D — Basic science, engineering, research, or technology software"},{value:"E",label:"Class E — Mission support software not otherwise classified"}], when:a=>a["s5_software"]==="yes"}),
  ]},
  { key:"5.VII", title:"Sensitive and controlled items", citation:"SCV reporting DRD", gates:["space"], questions:[
    q("s5_scv", "Sensitive and controlled items reporting", "radio", {options:[{value:"required",label:"SCV reporting DRD required"},{value:"not-required",label:"SCV reporting DRD not required"}]}),
    q("s5_scv_under_20m", "Procurement value, including options, is below the $20M threshold", "check", {when:a=>a["s5_scv"]==="not-required", short:"below $20M"}),
    q("s5_scv_not_ampl", "Procurement is not for a program/project on the approved AMPL", "check", {when:a=>a["s5_scv"]==="not-required", short:"not on the AMPL"}),
    q("s5_scv_modification", "Modification of an existing contract, not a new procurement", "check", {when:a=>a["s5_scv"]==="not-required", short:"modification"}),
  ]},
  { key:"6", title:"Quality assurance", citation:"NPR 8735.2C; FAR 46.202-4; NFS 1846", gates:["hardware"], questions:[
    q("s6_exempt_it_infra", "Information technology or institutional infrastructure projects", "check", {short:"exempt: IT or institutional infrastructure"}), q("s6_exempt_it_services", "Information Technology services", "check", {short:"exempt: IT services"}), q("s6_exempt_software", "Software assurance functions under NASA-STD-8739.8 and NPR 7150.2", "check", {short:"exempt: software assurance"}), q("s6_exempt_facilities", "NASA institutional facilities or facility maintenance", "check", {short:"exempt: facilities"}), q("s6_exempt_agreement", "Grants, cooperative agreements, or Space Act agreements", "check", {short:"exempt: agreements"}),
    q("s6_commercial", "Commercial or COTS items under FAR Part 12 and NPR 8735.2C paragraph 5.1", "check", {when:a=>!qualityExempt(a), short:"commercial or COTS"}), q("s6_critical", "Critical items or Critical Work under NPR 8735.2C, Appendix A", "check", {when:a=>!qualityExempt(a), short:"critical"}), q("s6_complex", "Complex acquisition items or Complex Work under NPR 8735.2C, Appendix A", "check", {when:a=>!qualityExempt(a), short:"complex"}),
    q("s6_standard", "Higher-level quality standard", "radio", {options:[{value:"AS9100",label:"AS9100",help:"Hardware that is both Critical and Complex."},{value:"ISO9001",label:"ISO 9001",help:"Hardware that is not both Critical and Complex."},{value:"AS9003",label:"AS9003",help:"Hardware that is not Complex."},{value:"ISO17025",label:"ISO 17025",help:"Critical calibration or testing services."},{value:"none",label:"No higher-level quality standard"}], when:a=>!qualityExempt(a)}),
    q("s6_acceptance_days", "Government acceptance testing days after delivery", "number", {when:a=>!qualityExempt(a), placeholder:"14–30"}), q("s6_conformance", "Certificate of Conformance under FAR 52.246-15", "check", {when:a=>!qualityExempt(a), short:"Certificate of Conformance"}), q("s6_chemical", "Certificate of Chemical Analysis", "check", {when:a=>!qualityExempt(a), short:"Certificate of Chemical Analysis"}), q("s6_chemical_spec", "Certificate of Chemical Analysis — as specified in", "text", {when:a=>!qualityExempt(a)&&a["s6_chemical"]==="true"}), q("s6_gsi", "Government Source Inspection", "check", {when:a=>!qualityExempt(a), short:"Government Source Inspection"}), q("s6_first_article", "First Article Approval under FAR 52.209-3", "check", {when:a=>!qualityExempt(a), short:"First Article Approval"}),
    q("s6_gidep", "Does GIDEP screening identify a requirement for coordination?", "yesno", {options:yna, short:"GIDEP screening"}),
  ]},
  { key:"7", title:"Safety and health", citation:"NF 1707 Section 7; Center safety and health routing", gates:["hazards"], questions:[
    q("s7_hazards", "Will this involve any of the following?", "checklist", { options:[{value:"radiation",label:"Ionizing radiation"},{value:"lasers",label:"Lasers / optical radiation"},{value:"uvir",label:"High-intensity UV / IR"},{value:"rf",label:"RF / microwave emitters"},{value:"noise",label:"Hazardous noise ≥80 dBA at 1 m"},{value:"explosives",label:"Pyrotechnics / explosives"},{value:"pressure",label:"Pressure vessels"},{value:"toxic",label:"Toxic / hazardous substances"},{value:"nano",label:"Nano / ultrafine particles"},{value:"biological",label:"Infectious / biological agents"},{value:"other",label:"Other Appendix D hazard"}] }),
  ]},
  { key:"8", title:"Property management", citation:"NF 1707 Section 8", gates:["hardware"], questions:[
    q("s8_capital", "Will this acquisition include capital equipment?", "yesno", {options:yna, short:"capital equipment"}),
    q("s8_property_note", "Government-furnished property note", "text", {placeholder:"What government property is involved?"}),
  ]},
  { key:"9", title:"Center-specific approvals", citation:"NF 1707 Section 9; Center policy", questions:[q("s9_required", "Is a Center-specific approval required?", "yesno", {options:yna, short:"Center approval"}),q("s9_which", "Which approval?", "text", {when:a=>a["s9_required"]==="yes"})]},
  { key:"10", title:"Foreign travel briefings", citation:"NPR 1660.1", questions:[q("s10_foreign_travel", "Does this requirement include foreign travel that requires a counterintelligence or counterterrorism briefing?", "yesno", {options:yna, short:"foreign travel briefing"})]},
  { key:"11", title:"Extraneous items", citation:"MSC-2011-12-001", questions:[q("s11_extraneous", "Does this requirement include extraneous items that require review?", "yesno", {options:yna, short:"extraneous items"})]},
  { key:"12", title:"Other current NASA directives", citation:"NF 1707 Section 12", questions:[q("s12_fee", "Required fee-limitation coordination has been completed", "check", {when:a=>a["derived.fee_contract"]==="yes", short:"fee-limitation coordination"})]},
];

function qualityExempt(a:NfAnswers){return ["s6_exempt_it_infra","s6_exempt_it_services","s6_exempt_software","s6_exempt_facilities","s6_exempt_agreement"].some(k=>a[k]==="true")}
export function canonicalFromFacts(facts:IntakeFacts):NfAnswers{return {"gate.it":facts.includes_it?"yes":"no","gate.services":facts.contract_type?(/service|time-and-materials|labor-hour/i.test(facts.contract_type)?"yes":"no"):"","gate.hardware":facts.hardware_deliverable?"yes":"no","derived.fee_contract":/cost|incentive/i.test(`${facts.contract_type} ${facts.hybrid_contract_type}`)?"yes":"no"}}

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
 if(sourcing) out["s1_strategy"]=/NotAvailable|not available/i.test(sourcing)?"no":"yes";
 if(out["gate.it"]==="yes"&&/no IT authorization/i.test(it)){out["s2_authorization"]="none";out["s2_no_authorization_reason"]=it}
 else if(/CITR/i.test(it)) out["s2_authorization"]="citr"; else if(/ORCA/i.test(it)) out["s2_authorization"]="orca";
 const env=text("Section3_environmental");
 if(env) out["s3_gpc"]=/no GPC|S3n1\b/i.test(env)?"none":"requirements";
 if(services){out["s4_not_personal"]=String(/not personal/i.test(services));out["s4_not_governmental"]=String(/not inherently governmental/i.test(services));out["s4_not_employees"]=String(/not performed by government employees|not performed by civil/i.test(services))}
 const scan=text("Section5_II_scan_rf");
 if(scan){out["s5_scan"]=/no SCaN|S5IIn1\b/i.test(scan)?"no":"yes";out["s5_rf"]=/radar|RF use|RF equipment|transmitter|spectrum/i.test(scan)?"yes":"no"}
 const evms=text("Section5_III_evms");
 if(evms) out["s5_evms"]=/no EVMS|S5IIIn1\b/i.test(evms)?"not-required":/exception/i.test(evms)?"exception":"required";
 const comms=text("Section5_IV_communications");
 if(comms) out["s5_communications"]=/S5IVn1\b|\bno\b/i.test(comms)?"no":"yes";
 if(aviation) out["s5_aviation"]=out["gate.aviation"]==="yes"?"yes":"no";
 const software=text("Section5_VI_software");
 if(software&&!/not subject|S5VIn1\b/i.test(software)){out["s5_software"]="yes";const cls=software.match(/class\s+([A-E])\b/i);if(cls?.[1])out["s5_software_class"]=cls[1].toUpperCase()}
 const scv=text("Section5_VII_scv");
 if(scv){const notRequired=/not required|SCVIn2/i.test(scv);out["s5_scv"]=notRequired?"not-required":"required";if(notRequired){out["s5_scv_under_20m"]=String(/\$20M|20 ?M|SCVIn2s1/i.test(scv));out["s5_scv_not_ampl"]=String(/AMPL/i.test(scv));out["s5_scv_modification"]=String(/modification/i.test(scv))}}
 const quality=text("Section6_quality");
 if(quality){out["s6_critical"]=String(/(?<!neither )\bcritical\b/i.test(quality)&&!/neither critical/i.test(quality));out["s6_complex"]=String(/\bcomplex\b/i.test(quality)&&!/neither critical nor complex/i.test(quality));const std=["AS9100","ISO 9001","AS9003","ISO 17025"].find(s=>new RegExp(s.replace(" ","\\s?"),"i").test(quality));out["s6_standard"]=std?std.replace(" ",""):"none"}
 if(safety){const map:[RegExp,string][]=[[/ionizing radiation/i,"radiation"],[/laser/i,"lasers"],[/UV|infrared|\bIR\b/i,"uvir"],[/\bRF\b|microwave|radar/i,"rf"],[/noise/i,"noise"],[/pyrotechnic|explosive/i,"explosives"],[/pressure vessel/i,"pressure"],[/toxic|hazardous substance/i,"toxic"],[/nano|ultrafine/i,"nano"],[/biological|infectious/i,"biological"]];const picked=map.filter(([re])=>re.test(safety)).map(([,v])=>v);if(picked.length)out["s7_hazards"]=picked.join("|")}
 if(property){out["s8_capital"]=/capital equipment/i.test(property)?"yes":"no";out["s8_property_note"]=property}
 const travel=text("Section10_foreign_travel"); if(travel) out["s10_foreign_travel"]=has("Section10_foreign_travel")?"yes":"no";
 const extraneous=text("Section11_promotional_items"); if(extraneous) out["s11_extraneous"]=has("Section11_promotional_items")?"yes":"no";
 return out;
}

export function sectionApplies(s:Section,a:NfAnswers){return !s.gates||s.gates.some(g=>a[`gate.${g}`]==="yes")}
function answered(v?:string){return !!v&&v!=="false"}
function sectionAnswered(s:Section,a:NfAnswers){return s.questions.some(question=>answered(a[question.key]))}
function sectionVisible(s:Section,a:NfAnswers){return s.key==="2"||sectionApplies(s,a)||sectionAnswered(s,a)}
function choiceText(question:Question,value:string){
 if(question.kind==="check")return value==="true"?(question.short??question.label):"";
 if(question.kind==="checklist")return value.split("|").map(v=>question.options?.find(o=>o.value===v)?.label).filter(Boolean).join(", ");
 const option=question.options?.find(o=>o.value===value);
 if(!option)return value;
 if(question.kind==="yesno"&&question.short)return `${question.short}: ${option.label.toLowerCase()}`;
 return option.label;
}
function sectionSummary(questions:Question[],a:NfAnswers){
 return questions.map(question=>answered(a[question.key])?choiceText(question,a[question.key]!):"").filter(Boolean).join(" · ");
}

export function mappedNf1707(fields:Nf1707Field[], answers:NfAnswers, approvals:Record<string,string>={}, facts?:Partial<IntakeFacts>){
 const out:Record<string,string>={}; for(const f of fields) out[`${f.section??""}.${f.subform??""}.${f.field_name??""}`]="";
 const set=(cell:string,v:string)=>{out[cell]=v}; const tri=(v?:string)=>v==="yes"?"1":v==="no"?"0":v==="na"?"2":""; const chk=(v?:string)=>v==="true"?"1":"0";
 set("Section2.Section2.CITRAuth",answers["s2_authorization"]==="citr"?answers["s2_citr_number"]??"":""); set("Section2.Section2.ORCAAuth",answers["s2_authorization"]==="orca"?answers["s2_orca_number"]??"":""); set("Section2.Section2.UnderLimitNoIT",answers["gate.it"]==="no"?"2":answers["s2_authorization"]==="none"?"1":"0"); set("Section2.Section2.NoITAuth",answers["s2_no_authorization_reason"]??"");
 const one=(cell:string,key:string)=>set(cell,tri(answers[key])); one("Section3.Section3.S3n1","s3_gpc"); ["s3_biobased","s3_energy","s3_smartway","s3_epa"].forEach((k,i)=>set(`Section3.Section3.S3n2s${i+1}`,chk(answers[k]))); ["S3n2s5Yes","S3n2s5No","S3n2s6"].forEach(c=>set(`Section3.Section3.${c}`,tri(answers["s3_epeat_verified"]))); ["S3n2s7Yes","S3n2s7No","S3n2s8"].forEach(c=>set(`Section3.Section3.${c}`,tri(answers["s3_recovered_verified"]))); set("Section3.Section3.S3n2s9",chk(answers["s3_snap"])); set("Section3s3.Section3s3.S3s3n1",answers["s3_nepa"]==="nerf"?"1":"0"); set("Section3s3.Section3s3.S3n3n1Info",answers["s3_catex"]??""); set("Section3s3.Section3s3.S3s3n3",answers["s3_nepa"]==="excluded"?"1":answers["s3_nepa"]==="na"?"2":"0");
 ["s4_not_personal","s4_not_governmental","s4_not_employees"].forEach((k,i)=>set(`Section4.Section4.S4n2s${i+2}`,chk(answers[k])));
 set("Section5s1.Section5s1.S5In1",tri(answers["gate.space"])); set("Section5s2.Section5s2.S5IIn1",tri(answers["s5_scan"])); set("Section5s2.Section5s2.S5IIn3",tri(answers["s5_rf"])); set("Section5s3.Section5s3.S5IIIn2",answers["s5_evms"]==="not-required"?"1":"0"); set("Section5s3.Section5s3.S5IIIn3",answers["s5_evms"]==="required"?"1":"0"); set("Section5s3.Section5s3.S5IIIn4",answers["s5_evms"]==="exception"?"0":"1"); set("Section5s4.Section5s4.S5IVn1",tri(answers["s5_communications"])); set("Section5s5.Section5s5.S5Vn2",tri(answers["s5_aviation"]));
 ["A","B","C","D","E"].forEach((c,i)=>set(`Section5s6.Section5s6.S5VIn2s${i+2}`,answers["s5_software_class"]===c?"1":"0")); set("Section5s7.Section5s7.SCVIn1",answers["s5_scv"]==="required"?"1":"0"); ["s5_scv_under_20m","s5_scv_not_ampl","s5_scv_modification"].forEach((k,i)=>set(`Section5s7.Section5s7.SCVIn2s${i+2}`,chk(answers[k])));
 ["s6_exempt_it_infra","s6_exempt_it_services","s6_exempt_software","s6_exempt_facilities","s6_exempt_agreement"].forEach((k,i)=>set(`Section6s1.Section6s1.S6In${[2,3,4,6,9][i]}`,chk(answers[k]))); set("Section6s1.Section6s1.S6In8",chk(answers["s6_commercial"])); set("Section6s2.Section6s2.S6IIn3",chk(answers["s6_critical"])); set("Section6s2.Section6s2.HigherControls",answers["s6_complex"]??""); ["AS9100","ISO9001","AS9003","ISO17025"].forEach((c,i)=>set(`Section6s3n2.Section6s3n2.S6IIIn${i+3}`,answers["s6_standard"]===c?"1":"0")); set("Section6s4.Section6s4.S6IVn1Input",answers["s6_acceptance_days"]??""); set("Section6s4.Section6s4.S6IVn3",chk(answers["s6_conformance"])); set("Section6s4.Section6s4.S6IVn4",chk(answers["s6_chemical"])); set("Section6s4.Section6s4.CertificateInput",answers["s6_chemical_spec"]??""); set("Section6s4.Section6s4.S6IVn5",chk(answers["s6_gsi"])); set("Section6s4.Section6s4.S6IVn6",chk(answers["s6_first_article"])); set("Section6s6.Section6s6.S6VIn2",tri(answers["s6_gidep"]));
 const hazards=(answers["s7_hazards"]??"").split("|"); hazards.forEach((h,i)=>{if(h)set(`Section7.Section7.S7In2s${i+1}`,"1")}); set("Section8.Section8.S8In1",tri(answers["s8_capital"])); set("Section9.Section9.S9n1",tri(answers["s9_required"])); set("Section9s1.Section9s1.S9n3",answers["s9_which"]??""); set("Section10.Section10.S10n1",tri(answers["s10_foreign_travel"])); set("Section11.Section11.S11n1",tri(answers["s11_extraneous"])); set("Section12.Section12.S12n2",chk(answers["s12_fee"]));
 if(facts){set("HeaderWrapper.HeaderWrapper.Center",facts.center_code??"");set("HeaderWrapper.HeaderWrapper.ReqNumber",facts.pr_number??"");set("HeaderWrapper.HeaderWrapper.ReqOrg",facts.requester_org_code??"");set("HeaderWrapper.HeaderWrapper.RequirementDescription",facts.description_of_requirement??"")}
 Object.assign(out,approvals); return out;
}

function QuestionRow({question,answers,setAnswers}:{question:Question;answers:NfAnswers;setAnswers:React.Dispatch<React.SetStateAction<NfAnswers>>}){
 if(question.when&&!question.when(answers))return null; const value=answers[question.key]??""; const id=`nf-${question.key}`; const set=(v:string)=>setAnswers(a=>({...a,[question.key]:v}));
 if(question.kind==="checklist") return <fieldset className="py-4"><legend className="text-[15px] leading-[22px]">{question.label}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{question.options?.map(o=>{const values=value?value.split("|"):[];const checked=values.includes(o.value);return <label key={o.value} className="flex items-start gap-2 text-[14px]"><input type="checkbox" checked={checked} onChange={()=>set(checked?values.filter(v=>v!==o.value).join("|"):[...values,o.value].join("|"))}/><span>{o.label}</span></label>})}</div></fieldset>;
 if(question.kind==="check")return <div className="py-4"><label className="flex items-start gap-2 text-[15px]"><input id={id} type="checkbox" checked={value==="true"} onChange={e=>set(String(e.target.checked))}/><span>{question.label}{question.required?" (required)":""}</span></label>{question.help?<p className="ml-6 mt-1 text-[13px] text-muted-foreground">{question.help}</p>:null}</div>;
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
  return s.questions.filter(x=>!x.when||x.when(merged)).filter(x=>x.key!=="s5_evms"||value>=evmThreshold||answered(merged["s5_evms"]));
 };
 const answeredCount=sections.filter(s=>sectionAnswered(s,merged)).length;
 const [preview,setPreview]=useState(false); const mapped=useMemo(()=>mappedNf1707(fields,merged,{},facts),[fields,merged,facts]);
 return <section aria-labelledby="nf1707-title" className="mb-10 border-t border-border pt-6"><div className="mb-2 flex flex-wrap items-start justify-between gap-3"><div><h2 id="nf1707-title" className="text-[18px] font-medium leading-6">NF 1707 requester questions</h2><p className="mt-1 max-w-[70ch] text-[13px] text-muted-foreground">Approvals and signatures are tracked later in the acquisition roadmap.</p></div><Button type="button" variant="link" className="h-auto p-0" onClick={()=>setPreview(true)}>Export preview</Button></div>
 <p className="mb-5 text-[13px] text-muted-foreground">{answeredCount} of {sections.length} sections answered.</p>
 <fieldset className="mb-6 max-w-[70ch] border border-border bg-background p-4"><legend className="px-1 text-[15px] font-medium">Gate questions</legend>{GATES.map(g=><div key={g.key} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 last:border-b-0"><span className="text-[15px]">{g.label}</span><div className="flex gap-4">{yn.map(o=><label key={o.value} className="flex items-center gap-2 text-[14px]"><input type="radio" name={`gate-${g.key}`} checked={merged[`gate.${g.key}`]===o.value} onChange={()=>setAnswers(a=>({...a,[`gate.${g.key}`]:o.value}))}/>{o.label}</label>)}</div></div>)}</fieldset>
 <div className="max-w-[70ch] space-y-3">{sections.map(s=>{const qs=questionsFor(s);const summary=qs.length?sectionSummary(qs,merged):"Not applicable";return <details key={s.key} id={`nf-section-${s.key}`} className="rounded-lg border border-border bg-background" open={false}><summary className="cursor-pointer list-none px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="text-[18px] font-medium">Section {s.key} · {s.title}</span><span className="mt-1 block text-[13px] text-muted-foreground">{s.citation}</span>{summary?<span className="mt-1 block text-[13px]">{summary}</span>:null}</summary><div className="divide-y divide-border border-t border-border px-4">{qs.length?qs.map(question=><QuestionRow key={question.key} question={question} answers={merged} setAnswers={setAnswers}/>):<p className="py-4 text-[15px] text-muted-foreground">This section does not apply to this requirement. It exports as Not applicable.</p>}</div></details>})}</div>
 {preview?<div role="dialog" aria-modal="true" aria-labelledby="export-title" className="fixed inset-0 z-50 grid place-items-center bg-foreground/60 p-4"><div className="max-h-[88vh] w-full max-w-4xl overflow-auto rounded-xl bg-background p-6 shadow-lg"><div className="mb-4 flex items-center justify-between gap-4"><div><h2 id="export-title" className="text-[18px] font-medium">NF 1707 export preview</h2><p className="text-[13px] text-muted-foreground">{Object.keys(mapped).length} mapped form fields · blank approval fields fill from the Approvals step.</p></div><Button type="button" variant="outline" onClick={()=>setPreview(false)}>Close</Button></div><table className="w-full border border-border text-[13px]"><thead><tr><th className="px-3 py-2 text-left">Form field</th><th className="px-3 py-2 text-left">Filled value</th></tr></thead><tbody>{Object.entries(mapped).map(([k,v])=><tr key={k} className="border-t border-border"><td className="px-3 py-2 text-muted-foreground">{k}</td><td className="px-3 py-2">{v||"—"}</td></tr>)}</tbody></table></div></div>:null}</section>
}
