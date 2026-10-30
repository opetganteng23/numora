import { Schema, model, models, type Model } from "mongoose";

export interface ITenant {
  name: string;
  slug: string;
  status: "active" | "suspended";
  timeZone: string;
}

const TenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9-]{2,40}$/ },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    timeZone: { type: String, default: "Asia/Jakarta" },
  },
  { timestamps: true },
);

export const Tenant: Model<ITenant> = (models.Tenant as Model<ITenant>) || model<ITenant>("Tenant", TenantSchema);
