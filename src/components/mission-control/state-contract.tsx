import { ProvenanceChip } from "./primitives";

const CONTRACT_ROWS = [
  "Launched, T+ and Awarded require a recorded Launched audit event.",
  "Before award, T− uses the target date; a forecast may stand in when no target is recorded.",
  "A stored launched clock state does not establish an award.",
  "Administration and Closeout begin only after an actual award is recorded.",
  "Every acquisition resolves to one readiness bucket: GO, WATCH, HOLD or LAUNCHED.",
  "Featured and scan identity facts come from the same acquisition record.",
] as const;

export function StateModelNote() {
  return (
    <aside className="mc-model-note" aria-label="Readiness model">
      <div>
        <ProvenanceChip kind="FACT" />
        <ProvenanceChip kind="RULE" />
      </div>
      <p>
        Recorded status resolves to one readiness bucket and each gate resolves to READY,
        ATTENTION or BLOCKED. The file remains pre-award until a Launched audit event;
        T− uses the target or recorded forecast, while T+ and Administration begin only
        after actual award.
      </p>
    </aside>
  );
}

export function StateContractPanel() {
  return (
    <section className="mc-state-contract" aria-labelledby="state-contract-heading">
      <div className="mc-state-contract-heading">
        <div>
          <div className="flex items-center gap-2">
            <ProvenanceChip kind="RULE" light />
            <p className="mc-label-light">Reconciliation foundation</p>
          </div>
          <h2 id="state-contract-heading">State contract</h2>
        </div>
        <p>One derivation across readiness, trajectory, clocks and file views.</p>
      </div>
      <ol>
        {CONTRACT_ROWS.map((row, index) => (
          <li key={row}>
            <span data-numeric>{String(index + 1).padStart(2, "0")}</span>
            <p>{row}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
