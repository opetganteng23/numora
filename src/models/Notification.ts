import { Schema, model, models, type Model, type Types } from "mongoose";

export interface INotification {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  type: "pending" | "approved" | "rejected";
  letterId: Types.ObjectId;
  text: string;
  readAt: Date | null;
}

const NotificationSchema = new Schema<INotification>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["pending", "approved", "rejected"], required: true },
    letterId: { type: Schema.Types.ObjectId, ref: "Letter", required: true },
    text: { type: String, required: true, maxlength: 400 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);
NotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
// Hapus otomatis setelah 90 hari
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const Notification: Model<INotification> =
  (models.Notification as Model<INotification>) || model<INotification>("Notification", NotificationSchema);
