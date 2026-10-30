import { describe, expect, it } from "vitest";
import {
  DEFAULT_PATTERN,
  formatNumber,
  getDateParts,
  periodKey,
  toRoman,
  validatePattern,
} from "@/lib/numbering";

const parts = { year: 2026, month: 10, day: 30 };

describe("toRoman", () => {
  it("mengubah bulan 1-12", () => {
    expect([1, 4, 9, 10, 12].map(toRoman)).toEqual(["I", "IV", "IX", "X", "XII"]);
  });
  it("menolak bulan di luar rentang", () => {
    expect(() => toRoman(0)).toThrow(RangeError);
    expect(() => toRoman(13)).toThrow(RangeError);
  });
});

describe("formatNumber", () => {
  it("format default", () => {
    expect(formatNumber(DEFAULT_PATTERN, { seq: 12, padding: 3, typeCode: "MOU", parts })).toBe("012/MOU/X/2026");
  });
  it("memakai unit, bulan angka, dan padding", () => {
    expect(
      formatNumber("{jenis}-{unit}/{urut}/{bulan}/{tahun}", { seq: 7, padding: 5, typeCode: "SK", unitCode: "KEU", parts }),
    ).toBe("SK-KEU/00007/10/2026");
  });
  it("seq melebihi padding tidak dipotong", () => {
    expect(formatNumber("{urut}", { seq: 12345, padding: 3, typeCode: "X", parts })).toBe("12345");
  });
  it("gagal bila {unit} dipakai tanpa kode unit", () => {
    expect(() => formatNumber("{urut}/{unit}", { seq: 1, padding: 3, typeCode: "X", parts })).toThrow();
  });
});

describe("periodKey", () => {
  it("sesuai kebijakan reset", () => {
    expect(periodKey("yearly", parts)).toBe("2026");
    expect(periodKey("monthly", parts)).toBe("2026-10");
    expect(periodKey("never", parts)).toBe("all");
  });
});

describe("zona waktu", () => {
  it("31 Des 20:00 UTC sudah 1 Jan di WIB (tahun berganti)", () => {
    const d = new Date("2026-12-31T20:00:00Z");
    expect(getDateParts(d, "UTC").year).toBe(2026);
    expect(getDateParts(d, "Asia/Jakarta")).toEqual({ year: 2027, month: 1, day: 1 });
  });
});

describe("validatePattern", () => {
  it("menerima format default", () => {
    expect(validatePattern(DEFAULT_PATTERN, "yearly", false)).toEqual([]);
  });
  it("wajib ada {urut}", () => {
    expect(validatePattern("{jenis}/{tahun}", "yearly", false).join()).toMatch(/\{urut\}/);
  });
  it("menolak token tidak dikenal", () => {
    expect(validatePattern("{urut}/{foo}/{tahun}", "yearly", false).join()).toMatch(/\{foo\}/);
  });
  it("reset tahunan wajib {tahun}", () => {
    expect(validatePattern("{urut}/{jenis}", "yearly", false).join()).toMatch(/\{tahun\}/);
  });
  it("reset bulanan wajib {tahun} dan bulan", () => {
    expect(validatePattern("{urut}/{tahun}", "monthly", false).join()).toMatch(/bulan/);
    expect(validatePattern("{urut}/{bulan}/{tahun}", "monthly", false)).toEqual([]);
  });
  it("per unit wajib {unit}", () => {
    expect(validatePattern("{urut}/{jenis}/{tahun}", "yearly", true).join()).toMatch(/\{unit\}/);
  });
  it("menolak {urut} ganda dan kurung tak seimbang", () => {
    expect(validatePattern("{urut}/{urut}/{tahun}", "yearly", false).length).toBeGreaterThan(0);
    expect(validatePattern("{urut}/{tahun", "yearly", false).length).toBeGreaterThan(0);
  });
});
