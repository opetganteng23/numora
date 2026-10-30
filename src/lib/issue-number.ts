import type { ClientSession, Types } from "mongoose";
import { AppError } from "./errors";
import { formatNumber, getDateParts, patternUsesUnit, periodKey } from "./numbering";
import { Counter, type ILetterNumber, type ILetterType, type IUnit } from "@/models";

interface IssueArgs {
  /** WAJIB: panggil di dalam transaksi yang sama dengan perubahan status surat. */
  session: ClientSession;
  tenantId: Types.ObjectId;
  type: ILetterType & { _id: Types.ObjectId };
  unit: (IUnit & { _id: Types.ObjectId }) | null;
  now: Date;
  timeZone: string;
}

/**
 * Mesin penomoran.
 *
 * 1. Tentukan periode (tahun/bulan/all) pada zona waktu instansi.
 * 2. `findOneAndUpdate({key}, {$inc: {seq: 1}}, {upsert})` = kenaikan atomik di server:
 *    dua permintaan bersamaan tidak mungkin mendapat seq yang sama.
 * 3. Karena berada dalam transaksi yang sama dengan perubahan status surat,
 *    bila transaksi gagal/rollback maka seq ikut batal -> tidak ada nomor bolong.
 */
export async function issueNumber({ session, tenantId, type, unit, now, timeZone }: IssueArgs): Promise<ILetterNumber> {
  const needsUnit = type.perUnit || patternUsesUnit(type.formatPattern);
  if (needsUnit && !unit) {
    throw new AppError(422, "Jenis surat ini memerlukan unit kerja pada pengajuan");
  }

  const parts = getDateParts(now, timeZone);
  const period = periodKey(type.resetPolicy, parts);
  const unitForCounter = type.perUnit ? unit : null;
  const counterKey = [String(tenantId), String(type._id), unitForCounter ? String(unitForCounter._id) : "-", period].join(":");

  const counter = await Counter.findOneAndUpdate(
    { key: counterKey },
    {
      $inc: { seq: 1 },
      $setOnInsert: {
        tenantId,
        letterTypeId: type._id,
        unitId: unitForCounter ? unitForCounter._id : null,
        period,
      },
    },
    { upsert: true, new: true, session },
  );
  if (!counter) throw new AppError(500, "Gagal mengambil nomor urut");

  const full = formatNumber(type.formatPattern, {
    seq: counter.seq,
    padding: type.padding,
    typeCode: type.code,
    unitCode: unit?.code ?? null,
    parts,
  });

  return { seq: counter.seq, period, counterKey, full, formatVersion: type.formatVersion, issuedAt: now };
}
