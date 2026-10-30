/**
 * Antrean per kunci di dalam satu proses.
 *
 * Mengapa: penerbitan nomor menaikkan satu dokumen counter. Bila puluhan persetujuan masuk
 * bersamaan, transaksi MongoDB saling bentrok (WriteConflict) dan terus mengulang sampai
 * waktunya habis. Dengan mengantre persetujuan per instansi di proses ini, bentrokan hilang
 * pada deployment satu instance PM2.
 *
 * Ini optimasi, BUKAN pengganti jaminan keunikan: keunikan tetap dijaga transaksi atomik
 * dan unique index di database, sehingga aman walau nanti dijalankan banyak instance.
 */
const tails = new Map<string, Promise<unknown>>();

export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (process.env.NUMORA_NO_LOCK === "1") return fn(); // hanya untuk menguji jaminan di tingkat database
  const prev = tails.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.catch(() => undefined);
  tails.set(key, tail);
  try {
    return await run;
  } finally {
    if (tails.get(key) === tail) tails.delete(key);
  }
}
