import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IUnit {
  tenantId: Types.ObjectId;
  name: string;
  code: string;
}

const UnitSchema = new Schema<IUnit>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, trim: true, uppercase: true, match: /^[A-Z0-9.\-]{1,20}$/ },
  },
  { timestamps: true },
);
UnitSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export const Unit: Model<IUnit> = (models.Unit as Model<IUnit>) || model<IUnit>("Unit", UnitSchema);
