/**
 * Executive wording for blocker text. Display only: the stored hold reason, the
 * hold logic and every comparison keep the engine's text; this only rewrites how
 * the Executive page says it, so a leader reads a sentence, not a field code.
 */

// Plain phrasing for the required items that hold files most often.
const ITEM_SENTENCE: [RegExp, string][] = [
  [/^NF 1707 intake, Acquisition Forecast affirmed$/i, "the requester has not confirmed the acquisition forecast (NF 1707)"],
  [/^Funds certified for the period$/i, "funds are not yet certified for the period"],
];

const UNFAVORABLE = /^(No-go|Nonconcur|Disapprove|Not legally sufficient):\s*([^:]+?):\s+([\s\S]+)$/i;
const VERB: Record<string, string> = {
  "no-go": "recorded an unfavorable decision",
  nonconcur: "nonconcurred",
  disapprove: "disapproved",
  "not legally sufficient": "found it not legally sufficient",
};

// "Single-source determination" reads "single-source determination"; a proper
// name such as "Executive Order 14402" or an acronym such as "IGCE" stays as is.
const lowerFirst = (text: string) =>
  /^[A-Z][a-z-]*(\s+[a-z(]|$)/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function executiveBlocker(text: string | null | undefined): string {
  const raw = String(text ?? "").trim();
  if (!raw) return raw;
  const missing = /^(.+?):\s*(.+?)\s+is missing$/i.exec(raw);
  if (missing) {
    const [, phase, item] = missing;
    const known = ITEM_SENTENCE.find(([pattern]) => pattern.test(item!.trim()));
    return `${phase}: ${known ? known[1] : `the ${lowerFirst(item!.trim())} is not on file yet`}`;
  }
  const unfavorable = UNFAVORABLE.exec(raw);
  if (unfavorable) {
    const [, kind, role, rest] = unfavorable;
    const firstSentence = /^[\s\S]*?[.!?](?=\s|$)/.exec(rest!.trim())?.[0] ?? rest!.trim();
    const verb = VERB[kind!.toLowerCase()] ?? "recorded an unfavorable decision";
    // "Nonconcur with the strategy." joins as "Small business nonconcurred with the strategy."
    const echo = new RegExp(`^${kind}\\b\\s*`, "i");
    return echo.test(firstSentence)
      ? `${upperFirst(role!.trim())} ${verb} ${firstSentence.replace(echo, "")}`
      : `${upperFirst(role!.trim())} ${verb}: ${firstSentence}`;
  }
  return raw;
}


/**
 * Lead-time reading. A finished phase's days are the span between the recorded
 * start and the next recorded start, so they can be set beside the plan.
 * A phase still open has only days so far, which is not "ahead of the plan".
 */
export function recordedPaceLabel(row: {
  completeN: number;
  completePlanned: number;
  completeActual: number;
  openN: number;
  openActual: number;
}): string {
  const parts: string[] = [];
  if (row.completeN > 0) {
    const delta = row.completePlanned - row.completeActual;
    const span = `${row.completeActual} days between the recorded dates, against ${row.completePlanned} planned days`;
    parts.push(delta === 0 ? `${span}, on the plan.` : `${span}, ${Math.abs(delta)} days ${delta > 0 ? "shorter" : "longer"} than the plan.`);
  }
  if (row.openN > 0) {
    parts.push(`${row.openActual} days recorded so far. Not compared with the plan until the phase finishes.`);
  }
  return parts.join(" ") || "Not compared";
}
