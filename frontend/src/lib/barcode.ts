/** Mirrors barcode_problem in backend/app/services/barcode_service.py. */

/** A short US UPC-E code written out as the 12 digit UPC-A it stands for. */
function upcEToA(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const [ns, d, check] = [code[0], code.slice(1, 7), code[7]];
  const last = Number(d[5]);
  const body =
    last <= 2 ? d.slice(0, 2) + d[5] + "0000" + d.slice(2, 5)
    : last === 3 ? d.slice(0, 3) + "00000" + d.slice(3, 5)
    : last === 4 ? d.slice(0, 4) + "00000" + d[4]
    : d.slice(0, 5) + "0000" + d[5];
  return ns + body + check;
}

function gtinOk(code: string): boolean {
  const digits = [...code].map(Number);
  const body = digits.slice(0, -1).reverse();
  const total = body.reduce((sum, d, i) => sum + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (total % 10)) % 10 === digits[digits.length - 1];
}

/** GTIN check digit (EAN-8, UPC-E, UPC-A, EAN-13, GTIN-14); false means a bar was misread. */
export function checkDigitOk(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return true;
  if (gtinOk(code)) return true;
  const upcA = upcEToA(code);
  return upcA != null && gtinOk(upcA);
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
