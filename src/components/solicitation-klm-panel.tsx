// Sections K, L and M as a first-class workspace on the file.
//
// The method on the record decides the voice: SF 1449 with Part 12/13 language,
// or the Uniform Contract Format with Part 15 language. A sole-source file has
// no competitive Section M, and the panel says so rather than offering factors.
// Everything saved here is what the scaffold and the handoff packet print.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { signedInName } from "@/lib/account-name";
import { RFO_RESERVED_212_NOTE, type PacketClause } from "@/lib/clause-packet";
import {
  awardBasisHint,
  createFactor,
  deleteFactor,
  isLptaBasis,
  loadFactors,
  loadSectionL,
  loadSectionM,
  saveSectionL,
  saveSectionM,
  updateFactor,
  type FactorInput,
  type FactorRow,
  type MethodShell,
} from "@/lib/solicitation-lm";

const field =
  "w-full border border-border bg-background px-2 py-1 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type FactorDraft = { name: string; relative_importance: string; description: string };
const emptyFactor: FactorDraft = { name: "", relative_importance: "", description: "" };
const toFactorInput = (d: FactorDraft): FactorInput => ({
  name: d.name,
  relative_importance: d.relative_importance.trim() || null,
  description: d.description.trim() || null,
});

export function SolicitationKlmPanel({
  acquisitionId,
  shell,
  clauses,
  simplifiedCommercial,
  canWrite,
  actor,
  onBanner,
}: {
  acquisitionId: string;
  shell: MethodShell | null;
  clauses: PacketClause[];
  simplifiedCommercial: boolean;
  canWrite: boolean;
  actor: string;
  onBanner: (s: string) => void;
}) {
  const qc = useQueryClient();
  const lQ = useQuery({
    queryKey: ["section-l", acquisitionId],
    enabled: Boolean(acquisitionId),
    queryFn: () => loadSectionL(acquisitionId),
  });
  const mQ = useQuery({
    queryKey: ["section-m", acquisitionId],
    enabled: Boolean(acquisitionId),
    queryFn: () => loadSectionM(acquisitionId),
  });
  const factorsQ = useQuery({
    queryKey: ["section-m-factors", acquisitionId],
    enabled: Boolean(acquisitionId),
    queryFn: () => loadFactors(acquisitionId),
  });
  const basisQ = useQuery({
    queryKey: ["award-basis-hint", acquisitionId],
    enabled: Boolean(acquisitionId),
    queryFn: () => awardBasisHint(acquisitionId),
  });

  const [lDraft, setLDraft] = useState({
    volumes: "",
    page_limit: "",
    submission_instructions: "",
    response_due_note: "",
  });
  const [lpta, setLpta] = useState(false);
  const [mNotes, setMNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [factorDraft, setFactorDraft] = useState<FactorDraft>(emptyFactor);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<FactorDraft>(emptyFactor);

  useEffect(() => {
    const l = lQ.data;
    if (l) {
      setLDraft({
        volumes: l.volumes ?? "",
        page_limit: l.page_limit ?? "",
        submission_instructions: l.submission_instructions ?? "",
        response_due_note: l.response_due_note ?? "",
      });
    }
  }, [lQ.data]);

  useEffect(() => {
    if (mQ.data) {
      setLpta(mQ.data.lpta);
      setMNotes(mQ.data.notes ?? "");
    } else if (basisQ.data) {
      // Nothing saved yet: the award basis already on the file is offered as a
      // suggestion the officer confirms. It is not written anywhere until saved.
      setLpta(isLptaBasis(basisQ.data));
    }
  }, [mQ.data, basisQ.data]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["section-l", acquisitionId] });
    void qc.invalidateQueries({ queryKey: ["section-m", acquisitionId] });
    void qc.invalidateQueries({ queryKey: ["section-m-factors", acquisitionId] });
  };

  const saveL = useMutation({
    mutationFn: async () => {
      const name = await signedInName(actor);
      await saveSectionL(
        acquisitionId,
        {
          volumes: lDraft.volumes.trim() || null,
          page_limit: lDraft.page_limit.trim() || null,
          submission_instructions: lDraft.submission_instructions.trim() || null,
          response_due_note: lDraft.response_due_note.trim() || null,
        },
        name,
      );
    },
    onSuccess: () => {
      onBanner("The instructions to offerors were saved.");
      invalidate();
    },
    onError: (e: Error) => onBanner(`The instructions were not saved: ${e.message}. Try again.`),
  });

  const saveM = useMutation({
    mutationFn: async () => {
      const name = await signedInName(actor);
      await saveSectionM(acquisitionId, { lpta, notes: mNotes.trim() || null }, name);
    },
    onSuccess: () => {
      onBanner("The evaluation basis was saved.");
      invalidate();
    },
    onError: (e: Error) => onBanner(`The evaluation basis was not saved: ${e.message}. Try again.`),
  });

  const factors = factorsQ.data ?? [];

  const addFactor = useMutation({
    mutationFn: async () => {
      const name = await signedInName(actor);
      await createFactor(acquisitionId, toFactorInput(factorDraft), name, factors.length);
    },
    onSuccess: () => {
      onBanner("The evaluation factor was added.");
      setAdding(false);
      setFactorDraft(emptyFactor);
      invalidate();
    },
    onError: (e: Error) => onBanner(`The factor was not added: ${e.message}. Try again.`),
  });

  const editFactor = useMutation({
    mutationFn: async (row: FactorRow) => {
      const name = await signedInName(actor);
      await updateFactor(row, toFactorInput(editDraft), name);
    },
    onSuccess: () => {
      onBanner("The evaluation factor was saved.");
      setEditingId(null);
      invalidate();
    },
    onError: (e: Error) => onBanner(`The factor was not saved: ${e.message}. Try again.`),
  });

  const removeFactor = useMutation({
    mutationFn: async (row: FactorRow) => {
      const name = await signedInName(actor);
      await deleteFactor(row, name);
    },
    onSuccess: () => {
      onBanner("The evaluation factor was removed.");
      invalidate();
    },
    onError: (e: Error) => onBanner(`The factor was not removed: ${e.message}. Try again.`),
  });

  if (!shell) return null;
  const part15 = shell.partFamily === "15";
  const kClauses = clauses.filter((c) => (c.ucf_section ?? "").trim().toUpperCase() === "K");

  return (
    <div className="mt-3 border border-border p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h4 className="text-[15px] font-medium">Sections K, L and M</h4>
        <span className="text-[13px] text-muted-foreground">
          {shell.methodLabel} · {shell.path === "sf1449" ? "SF 1449" : "Uniform Contract Format"} ·{" "}
          {part15 ? "FAR Part 15" : "FAR Parts 12 and 13"}
        </span>
      </div>
      <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">{shell.formatSource}</p>

      {/* K — the prescribed clause bucket plus a recordable shell. */}
      <section className="mt-4">
        <h5 className="text-[15px] font-medium">
          {part15 ? "K — Representations and certifications (Uniform Contract Format)" : "K — Representations and certifications"}
        </h5>
        <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">
          {part15 ? K_UCF_PATH_NOTE : K_SAM_PATH_NOTE}
        </p>
        <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">{K_HANDOFF_CHIP}</p>

        <h6 className="mt-3 text-[13px] font-medium">Clauses the matrices place in Section K</h6>
        {kClauses.length > 0 ? (
          <ul className="mt-1 list-disc pl-5 text-[13px]">
            {kClauses.map((c) => (
              <li key={c.clause_number}>
                <span data-numeric>{c.clause_number}</span> {c.title}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[13px] text-muted-foreground">
            No clause on this file is placed in Section K by the matrices.
          </p>
        )}

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[13px] text-muted-foreground" htmlFor="sec-k-sam">
              SAM representations status
            </label>
            <select
              id="sec-k-sam"
              className={field}
              disabled={!canWrite}
              value={kSam}
              onChange={(e) => setKSam(e.target.value)}
            >
              {K_SAM_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[13px] text-muted-foreground" htmlFor="sec-k-notes">
              Section K note (optional)
            </label>
            <input
              id="sec-k-notes"
              className={field}
              disabled={!canWrite}
              value={kNotes}
              onChange={(e) => setKNotes(e.target.value)}
            />
          </div>
        </div>

        <table className="mt-3 w-full text-[13px] leading-[18px]">
          <caption className="sr-only">Representations and certifications recorded on this file</caption>
          <thead>
            <tr className="border-y border-border text-left">
              <th scope="col" className="p-2">Representation</th>
              <th scope="col" className="p-2">Status</th>
              <th scope="col" className="p-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {kItems.map((item, idx) => (
              <tr key={item.key} className="border-b border-border align-top">
                <td className="p-2">{item.label}</td>
                <td className="p-2">
                  <label className="sr-only" htmlFor={`k-status-${item.key}`}>
                    Status for {item.label}
                  </label>
                  <select
                    id={`k-status-${item.key}`}
                    className={field}
                    disabled={!canWrite}
                    value={item.status}
                    onChange={(e) =>
                      setKItems(
                        kItems.map((row, i) =>
                          i === idx ? { ...row, status: e.target.value as KItemStatus } : row,
                        ),
                      )
                    }
                  >
                    {(Object.keys(K_STATUS_LABELS) as KItemStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {K_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <label className="sr-only" htmlFor={`k-note-${item.key}`}>
                    Note for {item.label}
                  </label>
                  <input
                    id={`k-note-${item.key}`}
                    className={field}
                    disabled={!canWrite}
                    value={item.note ?? ""}
                    onChange={(e) =>
                      setKItems(
                        kItems.map((row, i) =>
                          i === idx ? { ...row, note: e.target.value || null } : row,
                        ),
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!kAuthored(kQ.data ?? null) ? (
          <p className="mt-2 text-[13px] text-muted-foreground">{K_EMPTY_NOTE}</p>
        ) : null}
        {canWrite ? (
          <button
            type="button"
            onClick={() => saveK.mutate()}
            disabled={saveK.isPending}
            className="mt-3 border border-border px-3 py-1 text-[13px] disabled:opacity-50"
          >
            Save Section K
          </button>
        ) : null}

        <p className="mt-2 max-w-[80ch] text-[13px] text-muted-foreground">
          {simplifiedCommercial
            ? RFO_RESERVED_212_NOTE
            : part15
              ? "Representations ride in Section K of the Uniform Contract Format; the solicitation of record is built in NCMS."
              : "Representations and certifications ride in Section K from the clauses prescribed for this file."}
        </p>
      </section>

      {/* L — authorable instructions. */}
      <section className="mt-4 border-t border-border pt-4">
        <h5 className="text-[15px] font-medium">L — Instructions to offerors</h5>
        <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">
          {part15
            ? "Part 15 voice: proposal volumes, page limits and submission instructions ride in Section L."
            : "Part 12 and 13 voice: quotations are submitted to the contracting officer under the commercial instructions on this file."}{" "}
          Blank fields print “Not recorded”.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[13px] text-muted-foreground" htmlFor="sec-l-volumes">
              Volumes
            </label>
            <input
              id="sec-l-volumes"
              className={field}
              disabled={!canWrite}
              value={lDraft.volumes}
              onChange={(e) => setLDraft({ ...lDraft, volumes: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[13px] text-muted-foreground" htmlFor="sec-l-pages">
              Page limit
            </label>
            <input
              id="sec-l-pages"
              className={field}
              disabled={!canWrite}
              value={lDraft.page_limit}
              onChange={(e) => setLDraft({ ...lDraft, page_limit: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[13px] text-muted-foreground" htmlFor="sec-l-instructions">
              Submission instructions
            </label>
            <textarea
              id="sec-l-instructions"
              rows={3}
              className={field}
              disabled={!canWrite}
              value={lDraft.submission_instructions}
              onChange={(e) => setLDraft({ ...lDraft, submission_instructions: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[13px] text-muted-foreground" htmlFor="sec-l-response">
              Response date note
            </label>
            <input
              id="sec-l-response"
              className={field}
              disabled={!canWrite}
              value={lDraft.response_due_note}
              onChange={(e) => setLDraft({ ...lDraft, response_due_note: e.target.value })}
            />
          </div>
        </div>
        {canWrite ? (
          <button
            type="button"
            onClick={() => saveL.mutate()}
            disabled={saveL.isPending}
            className="mt-3 border border-border px-3 py-1 text-[13px] disabled:opacity-50"
          >
            Save the instructions
          </button>
        ) : null}
      </section>

      {/* M — evaluation, suppressed on a sole-source file. */}
      <section className="mt-4 border-t border-border pt-4">
        <h5 className="text-[15px] font-medium">M — Evaluation for award</h5>
        {!shell.competitive ? (
          <div className="mt-2 max-w-[80ch] border border-border p-3 text-[13px] leading-[18px]">
            <p className="font-medium">Competitive Section M is suppressed on this sole-source file.</p>
            <p className="mt-1 text-muted-foreground">
              The technical evaluation of the single proposal carries the finding, price reasonableness is
              determined in the price negotiation memorandum, and the justification on this file states why
              only one source can meet the need.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">
              {part15
                ? "Part 15 voice: factors and their relative importance are stated to offerors under FAR 15.304, and the evaluation record follows FAR 15.305."
                : "Part 12 and 13 voice: factors are stated in the solicitation and the evaluation of quotations records the result."}
            </p>
            {basisQ.data && !mQ.data ? (
              <p className="mt-2 text-[13px] text-muted-foreground">
                The award basis recorded on this file reads “{basisQ.data}”. Confirm it below; nothing is saved
                until you do.
              </p>
            ) : null}
            <label className="mt-3 flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                disabled={!canWrite}
                checked={lpta}
                onChange={(e) => setLpta(e.target.checked)}
              />
              Lowest price technically acceptable
            </label>
            <div className="mt-3">
              <label className="block text-[13px] text-muted-foreground" htmlFor="sec-m-notes">
                Evaluation note (optional)
              </label>
              <textarea
                id="sec-m-notes"
                rows={2}
                className={field}
                disabled={!canWrite}
                value={mNotes}
                onChange={(e) => setMNotes(e.target.value)}
              />
            </div>
            {canWrite ? (
              <button
                type="button"
                onClick={() => saveM.mutate()}
                disabled={saveM.isPending}
                className="mt-3 border border-border px-3 py-1 text-[13px] disabled:opacity-50"
              >
                Save the evaluation basis
              </button>
            ) : null}

            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2">
                <h6 className="text-[15px] font-medium">Evaluation factors</h6>
                {canWrite ? (
                  <button
                    type="button"
                    onClick={() => setAdding((v) => !v)}
                    className="ml-auto text-[13px] text-primary underline-offset-2 hover:underline"
                  >
                    {adding ? "Cancel" : "Add a factor"}
                  </button>
                ) : null}
              </div>
              {factors.length === 0 ? (
                <p className="mt-1 max-w-[80ch] text-[13px] text-muted-foreground">
                  {lpta
                    ? "No factors are recorded. On a lowest price technically acceptable basis, technical acceptability and price carry the award."
                    : "No factors are recorded yet. Set at least two factors with their relative importance before the notice is posted."}
                </p>
              ) : (
                <table className="mt-2 w-full text-[13px] leading-[18px]">
                  <caption className="sr-only">Evaluation factors for award on this file</caption>
                  <thead>
                    <tr className="border-y border-border text-left">
                      <th scope="col" className="p-2">Factor</th>
                      <th scope="col" className="p-2">Relative importance</th>
                      <th scope="col" className="p-2">Description</th>
                      {canWrite ? <th scope="col" className="p-2">Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {factors.map((f) =>
                      editingId === f.factor_id ? (
                        <tr key={f.factor_id} className="border-b border-border align-top">
                          <td className="p-2">
                            <label className="sr-only" htmlFor={`f-name-${f.factor_id}`}>Factor name</label>
                            <input
                              id={`f-name-${f.factor_id}`}
                              className={field}
                              value={editDraft.name}
                              onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                            />
                          </td>
                          <td className="p-2">
                            <label className="sr-only" htmlFor={`f-imp-${f.factor_id}`}>Relative importance</label>
                            <input
                              id={`f-imp-${f.factor_id}`}
                              className={field}
                              value={editDraft.relative_importance}
                              onChange={(e) =>
                                setEditDraft({ ...editDraft, relative_importance: e.target.value })
                              }
                            />
                          </td>
                          <td className="p-2">
                            <label className="sr-only" htmlFor={`f-desc-${f.factor_id}`}>Description</label>
                            <input
                              id={`f-desc-${f.factor_id}`}
                              className={field}
                              value={editDraft.description}
                              onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                            />
                          </td>
                          <td className="p-2">
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => editFactor.mutate(f)}
                                className="text-primary underline-offset-2 hover:underline"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="text-muted-foreground underline-offset-2 hover:underline"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={f.factor_id} className="border-b border-border align-top">
                          <td className="p-2">{f.name}</td>
                          <td className="p-2">{f.relative_importance?.trim() || "Not recorded"}</td>
                          <td className="p-2">{f.description?.trim() || "Not recorded"}</td>
                          {canWrite ? (
                            <td className="p-2">
                              <div className="flex gap-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(f.factor_id);
                                    setEditDraft({
                                      name: f.name,
                                      relative_importance: f.relative_importance ?? "",
                                      description: f.description ?? "",
                                    });
                                  }}
                                  className="text-primary underline-offset-2 hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Remove the factor ${f.name}?`)) removeFactor.mutate(f);
                                  }}
                                  className="text-destructive underline-offset-2 hover:underline"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              )}
              {canWrite && adding ? (
                <div className="mt-3 grid grid-cols-1 gap-3 border border-border p-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-[13px] text-muted-foreground" htmlFor="new-factor-name">
                      Factor
                    </label>
                    <input
                      id="new-factor-name"
                      className={field}
                      value={factorDraft.name}
                      onChange={(e) => setFactorDraft({ ...factorDraft, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] text-muted-foreground" htmlFor="new-factor-importance">
                      Relative importance
                    </label>
                    <input
                      id="new-factor-importance"
                      className={field}
                      value={factorDraft.relative_importance}
                      onChange={(e) =>
                        setFactorDraft({ ...factorDraft, relative_importance: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] text-muted-foreground" htmlFor="new-factor-description">
                      Description (optional)
                    </label>
                    <input
                      id="new-factor-description"
                      className={field}
                      value={factorDraft.description}
                      onChange={(e) => setFactorDraft({ ...factorDraft, description: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="button"
                      disabled={factorDraft.name.trim().length === 0 || addFactor.isPending}
                      onClick={() => addFactor.mutate()}
                      className="border border-border px-3 py-1 text-[13px] disabled:opacity-50"
                    >
                      Add the factor
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
