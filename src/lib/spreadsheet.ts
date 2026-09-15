/** Spreadsheet reading for requester packages: .xlsx, .xls and .csv into IGCE rows. */

export type SheetColumnKey =
  | "clinNumber" | "description" | "quantity" | "unit" | "unitPrice" | "extendedPrice" | "periodStart" | "periodEnd";

export type SheetMapping = Partial<Record<SheetColumnKey, number>>;

export type SheetRead = {
  sheetNames: string[];
  sheetName: string;
  headerRowIndex: number;
  headers: string[];
  rows: string[][];
  mapping: SheetMapping;
  total: string;
  totalLabel: string;
  text: string;
};

export const sheetColumnLabels: Record<SheetColumnKey, string> = {
  clinNumber: "CLIN",
  description: "Description",
  quantity: "Quantity",
  unit: "Unit",
  unitPrice: "Unit price",
  extendedPrice: "Extended price",
  periodStart: "Period start",
  periodEnd: "Period end",
};

const patterns: Record<SheetColumnKey, RegExp[]> = {
  clinNumber: [/^clin/i, /line\s*item/i, /^item\s*(no|number|#)?$/i, /^slin/i],
  description: [/desc/i, /^item\s*desc/i, /supplies|services/i, /deliverable/i, /^task/i],
  quantity: [/^qty/i, /quantity/i, /^hours?$/i, /^units?$/i, /level of effort|^loe$/i],
  unit: [/unit of (issue|measure)/i, /^u\/?i$/i, /^uom$/i, /^unit$/i],
  unitPrice: [/unit\s*(price|cost|rate)/i, /^rate$/i, /price per/i, /hourly/i],
  extendedPrice: [/extend/i, /^amount$/i, /^total/i, /line\s*total/i, /estimated\s*(cost|price|value)/i],
  periodStart: [/start/i, /period\s*from/i, /^from$/i, /begin/i],
  periodEnd: [/end/i, /period\s*to/i, /^to$/i, /through/i],
};

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function scoreHeaderRow(row: string[]): number {
  let score = 0;
  for (const key of Object.keys(patterns) as SheetColumnKey[]) {
    if (row.some((cell) => cell && patterns[key].some((pattern) => pattern.test(cell)))) score += 1;
  }
  return score;
}

function detectMapping(headers: string[]): SheetMapping {
  const mapping: SheetMapping = {};
  const used = new Set<number>();
  for (const key of Object.keys(patterns) as SheetColumnKey[]) {
    for (const pattern of patterns[key]) {
      const index = headers.findIndex((header, position) => !used.has(position) && header && pattern.test(header));
      if (index >= 0) { mapping[key] = index; used.add(index); break; }
    }
  }
  return mapping;
}

function numeric(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** True when the file name or type looks like a spreadsheet we can parse. */
export function isSpreadsheetFile(file: File): boolean {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ["xlsx", "xlsm", "xlsb", "xls", "csv", "tsv"].includes(extension)
    || file.type.includes("spreadsheet") || file.type === "application/vnd.ms-excel" || file.type === "text/csv";
}

export async function readSpreadsheet(file: File, sheetName?: string): Promise<SheetRead> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheetNames = workbook.SheetNames;
  const chosen = sheetName && sheetNames.includes(sheetName) ? sheetName : (sheetNames[0] ?? "");
  const sheet = chosen ? workbook.Sheets[chosen] : undefined;
  if (!sheet) throw new Error(`${file.name} has no readable sheet. Tried Excel and CSV reading.`);
  const grid = (XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][])
    .map((row) => row.map(cellText));

  let headerRowIndex = -1;
  let best = 0;
  grid.slice(0, 25).forEach((row, index) => {
    const score = scoreHeaderRow(row);
    if (score > best) { best = score; headerRowIndex = index; }
  });
  if (headerRowIndex < 0) headerRowIndex = grid.findIndex((row) => row.some((cell) => cell !== ""));
  if (headerRowIndex < 0) throw new Error(`${file.name} is empty. Tried Excel and CSV reading.`);

  const headers = (grid[headerRowIndex] ?? []).map((header, index) => header || `Column ${index + 1}`);
  const mapping = detectMapping(grid[headerRowIndex] ?? []);

  let total = "";
  let totalLabel = "";
  const body: string[][] = [];
  for (const row of grid.slice(headerRowIndex + 1)) {
    if (!row.some((cell) => cell !== "")) continue;
    const label = row.find((cell) => /total/i.test(cell));
    if (label) {
      const numbers = row.map(numeric).filter((value): value is number => value !== null);
      const last = numbers[numbers.length - 1];
      if (last !== undefined) { total = String(last); totalLabel = label; }
      continue;
    }
    body.push(row);
  }
  if (!total && mapping.extendedPrice !== undefined) {
    const sum = body.reduce((running, row) => running + (numeric(row[mapping.extendedPrice!] ?? "") ?? 0), 0);
    if (sum > 0) { total = String(sum); totalLabel = "Sum of extended prices"; }
  }

  const text = grid.map((row) => row.join("\t")).join("\n");
  return { sheetNames, sheetName: chosen, headerRowIndex, headers, rows: body, mapping, total, totalLabel, text };
}

export type SheetClin = {
  clinNumber: string; description: string; quantity: string; unit: string;
  unitPrice: string; extendedPrice: string; periodStart: string; periodEnd: string;
  sourceId: string; excerpt: string;
};

export function clinsFromSheet(read: SheetRead, mapping: SheetMapping, sourceId: string): SheetClin[] {
  const pick = (row: string[], key: SheetColumnKey) => {
    const index = mapping[key];
    return index === undefined ? "" : (row[index] ?? "").trim();
  };
  return read.rows
    .filter((row) => pick(row, "clinNumber") || pick(row, "description"))
    .map((row, index) => ({
      clinNumber: pick(row, "clinNumber") || String(index + 1).padStart(4, "0"),
      description: pick(row, "description"),
      quantity: pick(row, "quantity"),
      unit: pick(row, "unit"),
      unitPrice: pick(row, "unitPrice"),
      extendedPrice: pick(row, "extendedPrice"),
      periodStart: pick(row, "periodStart"),
      periodEnd: pick(row, "periodEnd"),
      sourceId,
      excerpt: row.filter(Boolean).join(" · ").slice(0, 300),
    }));
}
