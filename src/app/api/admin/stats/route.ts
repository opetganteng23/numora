import { requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { Letter, Tenant, User } from "@/models";

/** Analitik lintas instansi. Hanya angka agregat: tidak ada perihal, tujuan, atau isi dokumen. */
export const GET = handle(async () => {
  await requireUser(["super_admin"]);
  const since = new Date(Date.now() - 29 * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);

  const [tenants, usersByTenant, usersByRole, mfa, lettersByTenant, daily, docs] = await Promise.all([
    Tenant.find().select("name slug status createdAt").sort({ createdAt: 1 }).lean(),
    User.aggregate([{ $match: { tenantId: { $ne: null } } }, { $group: { _id: "$tenantId", total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } }, lastLogin: { $max: "$lastLoginAt" } } }]),
    User.aggregate([{ $match: { tenantId: { $ne: null } } }, { $group: { _id: "$role", n: { $sum: 1 } } }]),
    User.aggregate([{ $match: { tenantId: { $ne: null }, status: "active" } }, { $group: { _id: "$mfaEnabled", n: { $sum: 1 } } }]),
    Letter.aggregate([{ $group: { _id: { t: "$tenantId", s: "$status" }, n: { $sum: 1 }, last: { $max: "$createdAt" } } }]),
    Letter.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Jakarta" } }, n: { $sum: 1 } } },
    ]),
    Letter.aggregate([{ $unwind: "$documents" }, { $group: { _id: null, n: { $sum: 1 }, bytes: { $sum: "$documents.size" } } }]),
  ]);

  const status = { pending: 0, approved: 0, rejected: 0, cancelled: 0 } as Record<string, number>;
  const perTenant = tenants.map((t) => {
    const u = usersByTenant.find((x) => String(x._id) === String(t._id));
    const rows = lettersByTenant.filter((x) => String(x._id.t) === String(t._id));
    const byStatus = Object.fromEntries(rows.map((r) => [r._id.s, r.n])) as Record<string, number>;
    for (const [k, v] of Object.entries(byStatus)) status[k] = (status[k] ?? 0) + v;
    const lastLetter = rows.reduce<Date | null>((m, r) => (!m || r.last > m ? r.last : m), null);
    return {
      id: String(t._id),
      name: t.name,
      slug: t.slug,
      status: t.status,
      users: u?.total ?? 0,
      activeUsers: u?.active ?? 0,
      letters: Object.values(byStatus).reduce((a, b) => a + b, 0),
      pending: byStatus.pending ?? 0,
      approved: byStatus.approved ?? 0,
      lastLogin: u?.lastLogin ?? null,
      lastLetter,
    };
  });

  const days: { date: string; n: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    days.push({ date: d, n: daily.find((x) => x._id === d)?.n ?? 0 });
  }

  const mfaOn = mfa.find((m) => m._id === true)?.n ?? 0;
  const mfaTotal = mfa.reduce((a, b) => a + b.n, 0);
  return json({
    totals: {
      tenants: tenants.length,
      activeTenants: tenants.filter((t) => t.status === "active").length,
      users: usersByRole.reduce((a, b) => a + b.n, 0),
      letters: Object.values(status).reduce((a, b) => a + b, 0),
      documents: docs[0]?.n ?? 0,
      documentBytes: docs[0]?.bytes ?? 0,
      mfaOn,
      mfaTotal,
    },
    status,
    roles: Object.fromEntries(usersByRole.map((r) => [r._id, r.n])),
    days,
    perTenant,
  });
});
