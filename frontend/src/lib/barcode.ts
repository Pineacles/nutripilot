/** Mirrors barcode_problem in backend/app/services/barcode_service.py. */

/** GTIN check digit (EAN-8, UPC-A, EAN-13, GTIN-14); false means a bar was misread. */
function checkDigitOk(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return true;
  const digits = [...code].map(Number);
  const body = digits.slice(0, -1).reverse();
  const total = body.reduce((sum, d, i) => sum + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (total % 10)) % 10 === digits[digits.length - 1];
}

/** Why a code that wasn't found never will be: a shop's counter label, or a misread scan. */
export function barcodeProblem(code: string): "store_label" | "misread" | null {
  if (/^2\d{12}$/.test(code)) return "store_label";
  return checkDigitOk(code) ? null : "misread";
}

export const BARCODE_PROBLEM_TEXT = {
  store_label: "This is the shop's own label from the counter or the scale (Migros, Coop and others print them). It changes with every pack, so search the food by name instead.",
  misread: "This code doesn't add up, so the scan probably misread a bar. Scan again, or type the numbers under the barcode.",
} as const;
