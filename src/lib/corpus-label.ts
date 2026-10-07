/** Display names for the regulation text corpora. Query keys are unchanged. */
export const CORPUS_LABEL: Record<string, string> = {
  far_rfo: "FAR (RFO)",
  nfs: "NFS",
  pcd: "PCD",
  far_companion: "FAR Companion",
  nfs_companion: "NFS Companion Guide",
  buying_guide: "Buying guide",
};

/** The display name for a corpus key; an unknown key reads in sentence case. */
export function corpusLabel(key: string | null | undefined): string {
  const k = (key ?? "").trim();
  if (!k) return "Unnamed source";
  const known = CORPUS_LABEL[k];
  if (known) return known;
  const words = k.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
