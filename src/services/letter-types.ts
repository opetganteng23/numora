import { Types } from "mongoose";
import { AppError } from "@/lib/errors";
import { User } from "@/models";

/** Pastikan semua approver adalah user aktif di instansi yang sama. */
export async function assertApprovers(tenantId: string, ids: string[]): Promise<Types.ObjectId[]> {
  if (!ids.length) return [];
  const unique = [...new Set(ids)];
  const found = await User.countDocuments({ _id: { $in: unique }, tenantId, status: "active" });
  if (found !== unique.length) throw new AppError(422, "Ada approver yang tidak valid");
  return unique.map((i) => new Types.ObjectId(i));
}
