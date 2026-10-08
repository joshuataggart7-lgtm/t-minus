/**
 * "a" or "an" for generated prose, by how the next word is spoken.
 * Acronyms read letter by letter take the article of the first letter's name
 * (an FFP, an IGCE, an NF, an SF, an RFO; a CO, a BPA, a T&M). Acronyms read
 * as words (NASA, SAM, NAICS) take the article of the word.
 */
const SPOKEN_AS_WORDS = new Set(["NASA", "NAICS", "SAM", "SEWP", "GWAC", "FAR", "NASCAR"]);
const AN_LETTERS = new Set(["A", "E", "F", "H", "I", "L", "M", "N", "O", "R", "S", "X"]);

export function indefiniteArticle(phrase: string): "a" | "an" {
  const text = String(phrase ?? "").trim();
  const first = /^[A-Za-z0-9&().-]+/.exec(text)?.[0] ?? "";
  if (!first) return "a";
  if (/^\d/.test(first)) {
    // eight, eleven, eighteen, eighty
    return /^(8|11(?!\d)|18(?!\d))/.test(first) ? "an" : "a";
  }
  const core = first.replace(/[().-]+$/, "");
  const lettersOnly = core.replace(/[^A-Za-z]/g, "");
  const isAcronym = lettersOnly.length >= 2 && lettersOnly === lettersOnly.toUpperCase() && !SPOKEN_AS_WORDS.has(lettersOnly);
  if (isAcronym || (lettersOnly.length === 1 && lettersOnly === lettersOnly.toUpperCase() && core.length <= 2)) {
    return AN_LETTERS.has(lettersOnly.charAt(0)) ? "an" : "a";
  }
  const lower = core.toLowerCase();
  if (/^(hour|honest|honor|heir)/.test(lower)) return "an";
  if (/^(uni|use|usu|ura|eu|one|once|ubiq)/.test(lower)) return "a";
  return /^[aeiou]/.test(lower) ? "an" : "a";
}

/** The phrase with its article in front: withArticle("FFP buy") is "an FFP buy". */
export function withArticle(phrase: string, capitalize = false): string {
  const art = indefiniteArticle(phrase);
  const lead = capitalize ? art.charAt(0).toUpperCase() + art.slice(1) : art;
  return `${lead} ${phrase}`;
}
