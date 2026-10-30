import { Schema, model, models, type Model, type Types } from "mongoose";

/**
 * Satu dokumen = satu urutan. `key` = tenant : jenis surat : (unit | -) : periode.
 * Kenaikan seq dilakukan dengan findOneAndUpdate + $inc (atomik) di dalam
 * transaksi yang sama dengan penerbitan nomor.
 */
export interface ICounter {
  key: string;
  tenantId: Types.ObjectId;
  letterTypeId: Types.ObjectId;
  unitId: Types.ObjectId | null;
  period: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  key: { type: String, required: true, unique: true },
  tenantId: { type: Schema.Types.ObjectId, required: true },
  letterTypeId: { type: Schema.Types.ObjectId, required: true },
  unitId: { type: Schema.Types.ObjectId, default: null },
  period: { type: String, required: true },
  // Tanpa default: default + $inc pada upsert menimbulkan konflik path.
  seq: { type: Number, required: true },
});

export const Counter: Model<ICounter> = (models.Counter as Model<ICounter>) || model<ICounter>("Counter", CounterSchema);
