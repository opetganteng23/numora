import { Schema, model, models, type Model, type Types } from "mongoose";
import { ROLES, type Role } from "./User";

export interface IInvitation {
  tenantId: Types.ObjectId;
  email: string;
  name: string;
  role: Role;
  unitId: Types.ObjectId | null;
  /** SHA-256 dari token; token mentah hanya ada di email. */
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  invitedBy: Types.ObjectId | null;
}

const InvitationSchema = new Schema<IInvitation>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    role: { type: String, enum: ROLES, required: true },
    unitId: { type: Schema.Types.ObjectId, ref: "Unit", default: null },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);
// Hapus otomatis 30 hari setelah kedaluwarsa
InvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
InvitationSchema.index({ tenantId: 1, email: 1 });

export const Invitation: Model<IInvitation> =
  (models.Invitation as Model<IInvitation>) || model<IInvitation>("Invitation", InvitationSchema);
