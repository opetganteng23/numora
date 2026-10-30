import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IPasswordReset {
  userId: Types.ObjectId;
  /** SHA-256 dari token; token mentah hanya ada di email. */
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

const PasswordResetSchema = new Schema<IPasswordReset>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
// Hapus otomatis 1 hari setelah kedaluwarsa
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });
PasswordResetSchema.index({ userId: 1, createdAt: -1 });

export const PasswordReset: Model<IPasswordReset> =
  (models.PasswordReset as Model<IPasswordReset>) || model<IPasswordReset>("PasswordReset", PasswordResetSchema);
