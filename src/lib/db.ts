import mongoose from "mongoose";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const g = globalThis as unknown as { __numoraMongoose?: Cache };
const cache: Cache = (g.__numoraMongoose ??= { conn: null, promise: null });

/**
 * Koneksi di-cache di globalThis agar hot-reload (dev) dan serverless
 * tidak membuka koneksi baru di setiap request.
 *
 * autoIndex sengaja dimatikan: index dibuat lewat `npm run db:init` supaya
 * pembuatan index tidak bentrok dengan transaksi pertama.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI belum diset");

  mongoose.set("autoIndex", false);
  cache.promise ??= mongoose.connect(uri, {
    bufferCommands: false,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000,
  });
  try {
    cache.conn = await cache.promise;
  } catch (e) {
    cache.promise = null;
    throw e;
  }
  return cache.conn;
}
