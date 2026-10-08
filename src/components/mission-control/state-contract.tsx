const CONTRACT_ROWS = [
  "A file shows Launched, T+ and Awarded only after its award is recorded in the audit log.",
  "Before award, T− counts down to the target award date. When no target is set, the forecast stands in and is labeled as a forecast.",
  "A clock marked launched without a recorded award does not count as an award.",
  "Administration and Closeout open only after the actual award is recorded.",
  "Every file sits in exactly one group: GO, WATCH, HOLD or LAUNCHED.",
  "The featured file, the scan below and the file page all read the same record.",
] as const;

export function StateModelNote() {
  return (
    <aside className="mc-model-note" aria-label="How the groups are counted">
      <p>
        <strong>How the groups are counted.</strong> GO is on track. WATCH needs attention. HOLD is
        stopped by a recorded hold or missing required evidence. LAUNCHED means the award is
        recorded; a file stays pre-award until then. Before award the clock counts down to the
        target award date (or the forecast when no target is set); after award it counts days
        since award.
      </p>
    </aside>
  );
}

export function StateContractPanel() {
  return (
    <details className="mc-state-contract">
      <summary>
        <span className="mc-label-light">How this page reads the record</span>
        <span className="mc-state-contract-hint">Six rules every count, clock and status on this page follows</span>
      </summary>
      <ol>
        {CONTRACT_ROWS.map((row, index) => (
          <li key={row}>
            <span data-numeric>{String(index + 1).padStart(2, "0")}</span>
            <p>{row}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}
