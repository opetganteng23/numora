/**
 * Logika murni penomoran (tanpa database) supaya mudah diuji.
 *
 * Token format yang didukung:
 *   {urut}          nomor urut, di-pad sesuai `padding` (001)
 *   {jenis}         kode jenis surat (MOU, SK, SKU)
 *   {unit}          kode unit kerja
 *   {bulan}         bulan 2 digit (10)
 *   {bulan_romawi}  bulan romawi (X)
 *   {tahun}         tahun 4 digit (2026)
 */

export type ResetPolicy = "yearly" | "monthly" | "never";

export const PATTERN_TOKENS = ["urut", "jenis", "unit", "bulan", "bulan_romawi", "tahun"] as const;
export type PatternToken = (typeof PATTERN_TOKENS)[number];

export const DEFAULT_PATTERN = "{urut}/{jenis}/{bulan_romawi}/{tahun}";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"] as const;

export function toRoman(month: number): string {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`Bulan tidak valid: ${month}`);
  }
  return ROMAN[month - 1];
}

export interface DateParts {
  year: number;
  month: number; // 1-12
  day: number;
}

/** Ambil tahun/bulan/hari pada zona waktu tertentu (penting: 31 Des 23:00 UTC sudah 1 Jan di WIB). */
export function getDateParts(date: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

/** Kunci periode untuk counter: menentukan kapan urutan kembali ke 1. */
export function periodKey(policy: ResetPolicy, p: DateParts): string {
  switch (policy) {
    case "yearly":
      return String(p.year);
    case "monthly":
      return `${p.year}-${String(p.month).padStart(2, "0")}`;
    case "never":
      return "all";
  }
}

export interface FormatInput {
  seq: number;
  padding: number;
  typeCode: string;
  unitCode?: string | null;
  parts: DateParts;
}

export function formatNumber(pattern: string, input: FormatInput): string {
  return pattern.replace(/\{([^{}]*)\}/g, (_match, token: string) => {
    switch (token) {
      case "urut":
        return String(input.seq).padStart(input.padding, "0");
      case "jenis":
        return input.typeCode;
      case "unit":
        if (!input.unitCode) throw new Error("Token {unit} dipakai tetapi kode unit kosong");
        return input.unitCode;
      case "bulan":
        return String(input.parts.month).padStart(2, "0");
      case "bulan_romawi":
        return toRoman(input.parts.month);
      case "tahun":
        return String(input.parts.year);
      default:
        throw new Error(`Token tidak dikenal: {${token}}`);
    }
  });
}

export function extractTokens(pattern: string): string[] {
  return [...pattern.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]);
}

/**
 * Validasi konfigurasi format. Mengembalikan daftar pesan error (kosong = valid).
 * Aturan ini mencegah dua nomor berbeda menghasilkan teks yang sama
 * (mis. reset tahunan tetapi format tidak memuat {tahun}).
 */
export function validatePattern(pattern: string, policy: ResetPolicy, perUnit: boolean): string[] {
  const errors: string[] = [];
  const tokens = extractTokens(pattern);

  const unknown = tokens.filter((t) => !(PATTERN_TOKENS as readonly string[]).includes(t));
  if (unknown.length) errors.push(`Token tidak dikenal: ${unknown.map((t) => `{${t}}`).join(", ")}`);

  if (pattern.replace(/\{[^{}]*\}/g, "").match(/[{}]/)) errors.push("Tanda kurung kurawal tidak seimbang");
  if (pattern.length === 0 || pattern.length > 120) errors.push("Panjang format harus 1-120 karakter");

  const urutCount = tokens.filter((t) => t === "urut").length;
  if (urutCount !== 1) errors.push("Format wajib memuat {urut} tepat satu kali");

  if (policy === "yearly" && !tokens.includes("tahun")) {
    errors.push("Reset tahunan mewajibkan token {tahun} di format");
  }
  if (policy === "monthly") {
    if (!tokens.includes("tahun")) errors.push("Reset bulanan mewajibkan token {tahun}");
    if (!tokens.includes("bulan") && !tokens.includes("bulan_romawi")) {
      errors.push("Reset bulanan mewajibkan token {bulan} atau {bulan_romawi}");
    }
  }
  if (perUnit && !tokens.includes("unit")) {
    errors.push("Urutan terpisah per unit mewajibkan token {unit} di format");
  }
  return errors;
}

export function patternUsesUnit(pattern: string): boolean {
  return extractTokens(pattern).includes("unit");
}
