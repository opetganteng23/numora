import { Schema, model, models, type Model, type Types } from "mongoose";
import { DEFAULT_PATTERN, type ResetPolicy } from "@/lib/numbering";

/** Jenis surat (MoU, Surat Kuasa, SK, ...). Counter dipisah per jenis surat. */
export interface ILetterType {
  tenantId: Types.ObjectId;
  name: string;
  code: string;
  formatPattern: string;
  padding: number;
  resetPolicy: ResetPolicy;
  /** true = urutan dipisah per unit kerja */
  perUnit: boolean;
  /** Approver per jenis surat (tenant_admin selalu boleh menyetujui) */
  approverIds: Types.ObjectId[];
  /** Naik setiap format berubah; disimpan di tiap nomor sebagai jejak. */
  formatVersion: number;
  active: boolean;
}

const LetterTypeSchema = new Schema<ILetterType>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, trim: true, uppercase: true, match: /^[A-Z0-9.\-]{1,20}$/ },
    formatPattern: { type: String, required: true, default: DEFAULT_PATTERN, maxlength: 120 },
    padding: { type: Number, default: 3, min: 1, max: 8 },
    resetPolicy: { type: String, enum: ["yearly", "monthly", "never"], default: "yearly" },
    perUnit: { type: Boolean, default: false },
    approverIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    formatVersion: { type: Number, default: 1 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
LetterTypeSchema.index({ tenantId: 1, code: 1 }, { unique: true });
LetterTypeSchema.index({ tenantId: 1, approverIds: 1 });

export const LetterType: Model<ILetterType> =
  (models.LetterType as Model<ILetterType>) || model<ILetterType>("LetterType", LetterTypeSchema);
