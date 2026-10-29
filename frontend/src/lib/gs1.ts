/**
 * GS1 2D codes: the square DataMatrix (or QR) that Coop and Migros print on counter and scale
 * labels next to the price. Unlike the price barcode beside it, it carries the product's own GTIN,
 * the same on every pack, plus the net weight of this pack. Mirrors gs1_scan in
 * backend/app/services/barcode_service.py.
 */

export interface Gs1Scan {
  /** The product code, as the 13 digit EAN when it has a leading zero (how packs print it). */
  gtin: string;
  /** Net weight of this pack in grams (AI 310n), when the code has one. */
  grams?: number;
}

const GS = "\u001d";
// Element strings with a fixed length (GS1 General Specifications, figure 5.10.1-2). Every other
// one runs to the next separator.
const FIXED: Record<string, number> = {
  "00": 18, "01": 14, "02": 14, "11": 6, "12": 6, "13": 6, "15": 6, "16": 6, "17": 6, "20": 2,
};

function weightAi(ai: string): boolean {
  return /^310[0-5]$/.test(ai);
}

function shortGtin(gtin: string): string {
  return gtin.length === 14 && gtin.startsWith("0") ? gtin.slice(1) : gtin;
}

function fromPairs(pairs: [string, string][]): Gs1Scan | null {
  const gtin = pairs.find(([ai]) => ai === "01")?.[1];
  if (!gtin || !/^\d{14}$/.test(gtin)) return null;
  const weight = pairs.find(([ai]) => weightAi(ai));
  const scan: Gs1Scan = { gtin: shortGtin(gtin) };
  if (weight && /^\d{6}$/.test(weight[1])) {
    const kg = Number(weight[1]) / 10 ** Number(weight[0][3]);
    if (kg > 0 && kg <= 10) scan.grams = Math.round(kg * 10000) / 10;
  }
  return scan;
}

/** "(01)07610819523015(3103)000162" as printed under the code. */
function parseBracketed(text: string): Gs1Scan | null {
  const pairs = [...text.matchAll(/\((\d{2,4})\)([^(]*)/g)].map((m) => [m[1], m[2].trim()] as [string, string]);
  return pairs.length ? fromPairs(pairs) : null;
}

/** How many digits the AI at the start of `text` has, and its value length when fixed. */
function aiAt(text: string): { len: number; fixed?: number } {
  const two = text.slice(0, 2);
  if (two in FIXED) return { len: 2, fixed: FIXED[two] };
  if (/^3[1-6]/.test(two)) return { len: 4, fixed: 6 }; // measures: 3103 = net kg, 3 decimals
  if (/^41/.test(two)) return { len: 3, fixed: 13 }; // GLNs
  if (/^(2[3-5]|4[02-9])/.test(two)) return { len: 3 };
  if (/^(39|7\d|8\d)/.test(two)) return { len: 4 };
  return { len: 2 }; // 10 lot, 21 serial, 30 count, 37, 90-99 company internal
}

/** The raw element string a scanner returns: AIs back to back, variable ones ended by GS. */
function parseRaw(text: string): Gs1Scan | null {
  const pairs: [string, string][] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === GS) { i++; continue; }
    const { len, fixed } = aiAt(text.slice(i));
    const ai = text.slice(i, i + len);
    if (fixed !== undefined) {
      pairs.push([ai, text.slice(i + len, i + len + fixed)]);
      i += len + fixed;
      continue;
    }
    const end = text.indexOf(GS, i + len);
    pairs.push([ai, text.slice(i + len, end === -1 ? undefined : end)]);
    i = end === -1 ? text.length : end + 1;
  }
  return fromPairs(pairs);
}

/** GS1 Digital Link: https://id.gs1.org/01/07610819523015?3103=000162 (newer QR codes). */
function parseDigitalLink(text: string): Gs1Scan | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  const pairs: [string, string][] = [];
  for (let k = 0; k + 1 < parts.length; k++) {
    if (/^\d{2,4}$/.test(parts[k])) pairs.push([parts[k], parts[k + 1]]);
  }
  url.searchParams.forEach((v, k) => { if (/^\d{2,4}$/.test(k)) pairs.push([k, v]); });
  return fromPairs(pairs);
}

/**
 * Coop's reduced-price sticker ("Verwenden statt Verschwenden") covers the pack's EAN with a
 * Code 128 of its own: "27", the pack's EAN-13, one digit and the new price in centimes, e.g.
 * 277627535898389400000200 for 7627535898389 at 2.00.
 */
const MARKDOWN_LABEL = /^27(\d{13})\d(\d{8})$/;

/**
 * The GTIN and weight in a GS1 2D code, or the GTIN in a Coop reduced-price sticker; null when the
 * text is something else (a plain EAN, a web link).
 */
export function parseGs1(raw: string): Gs1Scan | null {
  let text = raw.trim();
  const markdown = MARKDOWN_LABEL.exec(text);
  if (markdown) return { gtin: markdown[1] };
  // Symbology prefixes some decoders keep: ]d2 DataMatrix, ]Q3 QR, ]C1 GS1-128.
  text = text.replace(/^\][A-Za-z]\d/, "");
  if (text.startsWith(GS)) text = text.slice(1);
  if (text.startsWith("(")) return parseBracketed(text);
  if (/^https?:\/\//i.test(text)) return parseDigitalLink(text);
  // A plain EAN is not an element string; a GS1 one starts with an AI and is longer.
  if (!/^\d/.test(text) || /^\d{8,14}$/.test(text)) return null;
  return parseRaw(text);
}
