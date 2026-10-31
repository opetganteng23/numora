import { Schema, model, models, type Model, type Types } from "mongoose";

export const ROLES = ["super_admin", "tenant_admin", "unit_admin", "staff", "auditor"] as const;
export type Role = (typeof ROLES)[number];

export interface IUser {
  /** null hanya untuk super_admin */
  tenantId: Types.ObjectId | null;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  unitId: Types.ObjectId | null;
  status: "active" | "disabled";
  failedLogins: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  /** Rahasia TOTP terenkripsi; baru berlaku bila mfaEnabled. */
  mfaSecret?: string;
  mfaEnabled?: boolean;
  /** Langkah TOTP terakhir yang dipakai, agar satu kode tidak bisa dipakai dua kali. */
  mfaLastStep?: number;
  /** Hash kode pemulihan yang belum terpakai. */
  mfaRecovery?: string[];
}

const UserSchema = new Schema<IUser>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // Email unik global (satu akun = satu instansi) agar login cukup email + password.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    unitId: { type: Schema.Types.ObjectId, ref: "Unit", default: null },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
    failedLogins: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    mfaSecret: { type: String, select: false },
    mfaEnabled: { type: Boolean, default: false },
    mfaLastStep: { type: Number, select: false },
    mfaRecovery: { type: [String], select: false, default: undefined },
  },
  { timestamps: true },
);

export const User: Model<IUser> = (models.User as Model<IUser>) || model<IUser>("User", UserSchema);
