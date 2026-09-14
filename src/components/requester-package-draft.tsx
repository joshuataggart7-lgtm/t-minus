import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { draftFromRequesterPackage, lookupNaicsSizeStandard, type NaicsSizeView, type PackageClin, type PackageSuggestion } from "@/lib/requester-package.functions";
import type { IntakeFacts } from "@/lib/intake";
import type { NfAnswers } from "@/components/nf1707-intake";

type SourceKind = "PR" | "NF 1707" | "SOW/PWS" | "IGCE";
type Source = { id: string; kind: SourceKind; name: string; mimeType: string; text: string; pdfData: string | null };
type Mission = { mission_id: string; name: string; mission_directorate_code: string | null };

const kinds: SourceKind[] = ["PR", "NF 1707", "SOW/PWS", "IGCE"];
const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-[14px] text-foreground";

async function fileToSource(file: File, kind: SourceKind): Promise<Source> {
  if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} is larger than 20 MB.`);
  const extension = file.name.split(".").pop()?.toLowerCase();
  const id = crypto.randomUUID();
  if (file.type === "application/pdf" || extension === "pdf") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32_768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
    return { id, kind, name: file.name, mimeType: "application/pdf", text: "", pdfData: `data:application/pdf;base64,${btoa(binary)}` };
  }
  if (extension === "docx" || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { id, kind, name: file.name, mimeType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document", text: result.value, pdfData: null };
  }
  if (file.type.startsWith("text/") || ["txt", "md"].includes(extension ?? "")) {
    return { id, kind, name: file.name, mimeType: file.type || "text/plain", text: await file.text(), pdfData: null };
  }
  throw new Error(`${file.name} is not a supported PDF, Word, or text file.`);
}

export function RequesterPackageDraft({
  missions, applyFact, applyAnswers, onClinsConfirmed,
  onConfirmedCount,
}: {
  missions: Mission[];
  applyFact: <K extends keyof IntakeFacts>(key: K, value: IntakeFacts[K]) => void;
  applyAnswers: (answers: NfAnswers) => void;
  onClinsConfirmed: (clins: PackageClin[]) => void;
  onConfirmedCount: (count: number) => void;
}) {
  const draftPackage = useServerFn(draftFromRequesterPackage);
  const lookupSize = useServerFn(lookupNaicsSizeStandard);
  const [sources, setSources] = useState<Source[]>([]);
  const [pasteKind, setPasteKind] = useState<SourceKind>("PR");
  const [paste, setPaste] = useState("");
  const [suggestions, setSuggestions] = useState<PackageSuggestion[]>([]);
  const [clins, setClins] = useState<PackageClin[]>([]);
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
  const [clinConfirmed, setClinConfirmed] = useState(false);
  const [sizeViews, setSizeViews] = useState<Record<string, NaicsSizeView>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);

  async function addFile(file: File, kind: SourceKind) {
    setError("");
    if (sources.length >= 4) return setError("Remove a source before adding another. The limit is four.");
    try {
      const source = await fileToSource(file, kind);
      setSources((current) => [...current, source]);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The file could not be read."); }
  }

  function addPaste() {
    if (!paste.trim()) return;
    if (sources.length >= 4) return setError("Remove a source before adding another. The limit is four.");
    setSources((current) => [...current, { id: crypto.randomUUID(), kind: pasteKind, name: `${pasteKind} pasted text`, mimeType: "text/plain", text: paste.trim(), pdfData: null }]);
    setPaste("");
  }

  async function runDraft() {
    if (!sources.length) return;
    setBusy(true); setError(""); setSuggestions([]); setClins([]); setConfirmed(new Set()); setClinConfirmed(false);
    try {
      const result = await draftPackage({ data: { sources, missions: missions.map((mission) => ({ id: mission.mission_id, name: mission.name, directorateCode: mission.mission_directorate_code })) } });
      setSuggestions(result.suggestions); setClins(result.clins);
      const codes = [...new Set(result.suggestions.filter((item) => item.key.startsWith("naics_") || item.key === "naics_code").map((item) => item.value).filter((value) => /^\d{6}$/.test(value)))];
      const views = await Promise.all(codes.map((naics) => lookupSize({ data: { naics } }).catch(() => ({ naics, sizeStandard: "Not reported", sourceLabel: "SAM.gov lookup unavailable" }))));
      setSizeViews(Object.fromEntries(views.map((view) => [view.naics, view])));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The requester package could not be read."); }
    finally { setBusy(false); }
  }

  function updateSuggestion(index: number, value: string) {
    setSuggestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value } : item));
  }

  function applySuggestion(item: PackageSuggestion, index: number) {
    const booleanValue = item.value === "true" || item.value === "yes";
    if (item.key.startsWith("gate.") || /^s\d/.test(item.key)) applyAnswers({ [item.key]: item.value.toLowerCase() });
    else if (item.key === "mission_directorate_code") {
      applyFact("mission_directorate_code", item.value);
      const mission = missions.find((candidate) => candidate.mission_directorate_code === item.value);
      if (mission?.mission_directorate_code) applyFact("mission_directorate_name", mission.mission_directorate_code);
    } else if (item.key === "mission_id") {
      applyFact("mission_id", item.value);
      const mission = missions.find((candidate) => candidate.mission_id === item.value);
      if (mission?.mission_directorate_code) applyFact("mission_directorate_code", mission.mission_directorate_code);
    } else if (item.key === "igce_attached" || item.key === "sow_attached") {
      applyFact(item.key, booleanValue);
    } else if (item.key === "commercial_item_indication") {
      applyAnswers({ s6_commercial: booleanValue ? "1" : "0" });
    } else if (item.key === "naics_alternate_1" || item.key === "naics_alternate_2") {
      applyFact("naics_code", item.value);
    } else {
      applyFact(item.key as keyof IntakeFacts, item.value as never);
    }
    setConfirmed((current) => new Set(current).add(index));
    onConfirmedCount(new Set([...confirmed, index]).size);
  }

  function applyAll() {
    suggestions.forEach(applySuggestion);
    onConfirmedCount(suggestions.length);
    if (clins.length) { onClinsConfirmed(clins); setClinConfirmed(true); }
    setConfirmAllOpen(false);
  }

  return <section className="mb-8 border-t border-border pt-6" aria-labelledby="requester-package-title">
    <details className="rounded-lg border border-border bg-background">
      <summary className="cursor-pointer list-none px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex items-center gap-2 text-[18px] font-medium"><Sparkles aria-hidden="true" />Draft from requester package</span>
        <span className="mt-1 block text-[13px] text-muted-foreground">Synthetic or non-sensitive documents only in this environment.</span>
      </summary>
      <div className="border-t border-border p-4">
        <div role="tablist" aria-label="Requester package documents" className="flex flex-wrap gap-2">{kinds.map((kind) => <button key={kind} type="button" role="tab" aria-selected={pasteKind === kind} onClick={() => setPasteKind(kind)} className={`rounded-lg border px-3 py-2 text-[14px] ${pasteKind === kind ? "border-primary text-primary" : "border-border text-foreground"}`}>{kind}</button>)}</div>
        <div role="tabpanel" className="mt-4 rounded-lg border border-border p-3">
          <label className="block text-[14px]">
            <span className="mb-2 flex items-center gap-2 font-medium"><Upload aria-hidden="true" />Upload {pasteKind}</span>
            <input className="block w-full text-[13px]" type="file" accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { const file = event.target.files?.[0]; if (file) void addFile(file, pasteKind); event.target.value = ""; }} />
          </label>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <textarea aria-label={`Paste ${pasteKind} text`} rows={2} className={inputClass} placeholder={`Paste ${pasteKind} text`} value={paste} onChange={(event) => setPaste(event.target.value)} />
            <Button type="button" variant="outline" onClick={addPaste} disabled={!paste.trim()}>Add text</Button>
          </div>
        </div>
        {sources.length ? <ul className="mt-4 space-y-2">{sources.map((source) => <li key={source.id} className="flex items-center justify-between gap-3 border-b border-border pb-2 text-[14px]"><span className="flex min-w-0 items-center gap-2"><FileText aria-hidden="true" /><span className="truncate">{source.kind}: {source.name}</span></span><Button type="button" size="icon" variant="ghost" aria-label={`Remove ${source.name}`} onClick={() => setSources((current) => current.filter((item) => item.id !== source.id))}><X /></Button></li>)}</ul> : null}
        {error ? <p role="alert" className="mt-3 text-[14px] text-destructive">{error}</p> : null}
        <div className="mt-4 flex flex-wrap gap-3"><Button type="button" onClick={() => void runDraft()} disabled={!sources.length || busy}>{busy ? "Reading package" : "Propose intake values"}</Button>{suggestions.length ? <Button type="button" variant="outline" onClick={() => setConfirmAllOpen(true)}>Confirm all</Button> : null}</div>
        {suggestions.length ? <div className="mt-6 max-w-[80ch] space-y-3"><h3 className="text-[16px] font-medium">Proposed values</h3>{suggestions.map((item, index) => <article key={`${item.key}-${index}`} className="border-t border-border py-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><label htmlFor={`suggestion-${index}`} className="text-[14px] font-medium">{item.label}</label><span className="rounded-lg border border-border px-2 py-1 text-[12px]">{item.origin}</span></div>
          <input id={`suggestion-${index}`} className={`${inputClass} mt-2`} value={item.value} onChange={(event) => updateSuggestion(index, event.target.value)} />
          {sizeViews[item.value] ? <p className="mt-1 text-[13px] text-muted-foreground">Size standard: {sizeViews[item.value]?.sizeStandard} · {sizeViews[item.value]?.sourceLabel}</p> : null}
          {item.rationale ? <p className="mt-2 text-[13px] text-muted-foreground">{item.rationale}</p> : null}
          <details className="mt-2 text-[13px]"><summary className="cursor-pointer text-primary">Source: {item.sourceName}</summary><blockquote className="mt-2 border-l-2 border-border pl-3 text-muted-foreground">{item.excerpt}</blockquote></details>
          <Button type="button" size="sm" variant={confirmed.has(index) ? "outline" : "default"} className="mt-3" disabled={confirmed.has(index)} onClick={() => applySuggestion(item, index)}>{confirmed.has(index) ? "Confirmed" : "Confirm"}</Button>
        </article>)}</div> : null}
        {clins.length ? <div className="mt-6 overflow-x-auto"><div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-[16px] font-medium">IGCE builder draft</h3><Button type="button" size="sm" variant="outline" disabled={clinConfirmed} onClick={() => { onClinsConfirmed(clins); setClinConfirmed(true); }}>{clinConfirmed ? "Confirmed" : "Confirm CLINs"}</Button></div><table className="w-full min-w-[760px] border border-border text-[13px]"><thead><tr>{["CLIN","Description","Quantity","Unit","Unit price","Total","Start","End"].map((label) => <th key={label} className="border-b border-border px-2 py-2 text-left">{label}</th>)}</tr></thead><tbody>{clins.map((clin, index) => <tr key={index} className="border-t border-border"><td className="px-2 py-2">{clin.clinNumber}</td><td className="px-2 py-2">{clin.description}</td><td className="px-2 py-2">{clin.quantity || "—"}</td><td className="px-2 py-2">{clin.unit || "—"}</td><td className="px-2 py-2">{clin.unitPrice || "—"}</td><td className="px-2 py-2">{clin.extendedPrice || "—"}</td><td className="px-2 py-2">{clin.periodStart || "—"}</td><td className="px-2 py-2">{clin.periodEnd || "—"}</td></tr>)}</tbody></table></div> : null}
      </div>
    </details>
    <AlertDialog open={confirmAllOpen} onOpenChange={setConfirmAllOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Apply every proposed value?</AlertDialogTitle><AlertDialogDescription>This applies the editable suggestions and IGCE rows to this Intake. You can still revise them before starting the clock.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={applyAll}>Apply all</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}