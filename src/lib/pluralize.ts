/** "day" when the count is exactly 1, otherwise "days". Display only; never changes a number. */
export function dayWord(n: number | null | undefined): "day" | "days" {
  return n === 1 ? "day" : "days";
}
