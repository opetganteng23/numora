import { Schema, model, models, type Model, type Types } from "mongoose";

export const LETTER_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type LetterStatus = (typeof LETTER_STATUSES)[number];

export interface ILetterNumber {
  seq: number;
  period: string;
  counterKey: string;
  full: string;
  formatVersion: number;
  issuedAt: Date;
}

export interface ILetterDocument {
  version: number;
  fileName: string;
  mime: string;
  size: number;
  sha256: string;
  storageKey: string;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
}

const DocumentSchema = new Schema<ILetterDocument>(
  {
    version: { type: Number, required: true },
    fileName: { type: String, required: true, maxlength: 200 },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    sha256: { type: String, required: true },
    storageKey: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    uploadedAt: { type: Date, required: true },
  },
  { _id: false },
);

/**
 * Alur status:  pending -> approved -> cancelled
 *                       -> rejected
 * Nomor HANYA dibuat saat approved. Permintaan pembatalan dicatat di
 * `cancelRequest` (status tetap approved sampai admin membatalkan).
 * Nomor yang batal tidak pernah dihapus / dipakai ulang.
 */
export interface ILetter {
  tenantId: Types.ObjectId;
  letterTypeId: Types.ObjectId;
  unitId: Types.ObjectId | null;
  requesterId: Types.ObjectId;
  subject: string;
  recipient: string;
  letterDate: Date;
  status: LetterStatus;
  number?: ILetterNumber;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectedBy?: Types.ObjectId;
  rejectedAt?: Date;
  rejectReason?: string;
  cancelRequest?: { by: Types.ObjectId; reason: string; at: Date };
  cancelledBy?: Types.ObjectId;
  cancelledAt?: Date;
  cancelReason?: string;
  fileUrl?: string;
  /** Versi dokumen final. Versi lama tidak pernah dihapus. */
  documents?: ILetterDocument[];
  /** Pengelompokan bebas (Surat Tugas, Surat Keluar, ...). Tidak memengaruhi urutan nomor. */
  category?: string;
  /** Jejak data impor dari spreadsheet lama. */
  legacy?: { sheetNo?: number; creator?: string; note?: string };
}

const NumberSchema = new Schema<ILetterNumber>(
  {
    seq: { type: Number, required: true },
    period: { type: String, required: true },
    counterKey: { type: String, required: true },
    full: { type: String, required: true },
    formatVersion: { type: Number, required: true },
    issuedAt: { type: Date, required: true },
  },
  { _id: false },
);

const LetterSchema = new Schema<ILetter>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    letterTypeId: { type: Schema.Types.ObjectId, ref: "LetterType", required: true },
    unitId: { type: Schema.Types.ObjectId, ref: "Unit", default: null },
    requesterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true, trim: true, maxlength: 300 },
    recipient: { type: String, required: true, trim: true, maxlength: 300 },
    letterDate: { type: Date, required: true },
    status: { type: String, enum: LETTER_STATUSES, default: "pending" },
    number: { type: NumberSchema, required: false },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    rejectedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectedAt: Date,
    rejectReason: { type: String, maxlength: 500 },
    cancelRequest: {
      type: new Schema({ by: Schema.Types.ObjectId, reason: String, at: Date }, { _id: false }),
      required: false,
    },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelledAt: Date,
    cancelReason: { type: String, maxlength: 500 },
    fileUrl: { type: String, maxlength: 500 },
    documents: { type: [DocumentSchema], default: undefined },
    category: { type: String, trim: true, maxlength: 60 },
    legacy: {
      type: new Schema({ sheetNo: Number, creator: String, note: String }, { _id: false }),
      required: false,
    },
  },
  { timestamps: true },
);

// Pengaman terakhir terhadap duplikat (selain counter atomik):
LetterSchema.index(
  { tenantId: 1, "number.full": 1 },
  { unique: true, partialFilterExpression: { "number.full": { $type: "string" } } },
);
LetterSchema.index(
  { tenantId: 1, "number.counterKey": 1, "number.seq": 1 },
  { unique: true, partialFilterExpression: { "number.counterKey": { $type: "string" } } },
);
LetterSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
LetterSchema.index({ tenantId: 1, requesterId: 1, createdAt: -1 });
LetterSchema.index({ tenantId: 1, letterTypeId: 1, status: 1 });
LetterSchema.index({ tenantId: 1, category: 1, createdAt: -1 });

export const Letter: Model<ILetter> = (models.Letter as Model<ILetter>) || model<ILetter>("Letter", LetterSchema);
