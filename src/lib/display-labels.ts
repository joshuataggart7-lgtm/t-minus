/** Display labels shared by reporting and document exports; stored values stay raw. */
export function competitionLabel(value: string): string {
  const key = value.trim().toLowerCase();
  const known: Record<string, string> = {
    competitive: "Competitive",
    "sole source": "Sole source",
    "sole-source": "Sole source",
    "full and open": "Full and open",
    "full and open competition": "Full and open competition",
    "full and open after exclusion of sources": "Full and open after exclusion of sources",
  };
  if (known[key]) return known[key];
  if (value === key && value) return value.charAt(0).toUpperCase() + value.slice(1);
  return value;
}
