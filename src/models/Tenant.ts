import { Schema, model, models, type Model } from "mongoose";

export interface ITenant {
  name: string;
  slug: string;
  status: "active" | "suspended";
  timeZone: string;
  /** false (default): pemohon tidak boleh menyetujui pengajuannya sendiri. */
  allowSelfApproval: boolean;
}

const TenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9-]{2,40}$/ },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    timeZone: { type: String, default: "Asia/Jakarta" },
    allowSelfApproval: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Tenant: Model<ITenant> = (models.Tenant as Model<ITenant>) || model<ITenant>("Tenant", TenantSchema);
