"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

/** Pendaftaran dan pencabutan autentikasi dua langkah (TOTP). */
export function MfaCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);

  useEffect(() => {
    api<{ enabled: boolean }>("/api/auth/mfa").then((d) => setEnabled(d.enabled)).catch(() => setEnabled(false));
  }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const start = () =>
    run(async () => {
      setSetup(await api<{ secret: string; qr: string }>("/api/auth/mfa/setup", { json: {} }));
    });

  const confirm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = new FormData(e.currentTarget).get("code");
    return run(async () => {
      const d = await api<{ recoveryCodes: string[] }>("/api/auth/mfa/enable", { json: { code } });
      setEnabled(true);
      setSetup(null);
      setCodes(d.recoveryCodes);
      setMsg({ ok: true, text: "Autentikasi dua langkah aktif. Mulai sekarang login meminta kode." });
    });
  };

  const disable = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    return run(async () => {
      await api("/api/auth/mfa/disable", { json: { password: f.get("password"), code: f.get("code") } });
      setEnabled(false);
      setMsg({ ok: true, text: "Autentikasi dua langkah dimatikan." });
    });
  };

  if (enabled === null) return null;

  return (
    <div className="card" style={{ maxWidth: 480, marginTop: 18 }}>
      <h3>Autentikasi dua langkah</h3>
      {msg && <p className={`flash ${msg.ok ? "ok" : "bad"}`}>{msg.text}</p>}
      {!enabled && !setup && (
        <>
          <p className="muted small">Tambahkan lapisan keamanan dengan kode 6 angka dari aplikasi autentikator (Google Authenticator, Microsoft Authenticator, dan sejenisnya).</p>
          <button type="button" className="btn-sm" disabled={busy} onClick={start}>
            Aktifkan
          </button>
        </>
      )}
      {!enabled && setup && (
        <form onSubmit={confirm}>
          <p className="small">1. Pindai kode ini dengan aplikasi autentikator.</p>
          <div dangerouslySetInnerHTML={{ __html: setup.qr }} style={{ width: 180, height: 180 }} />
          <p className="muted small">Atau masukkan manual: <span className="mono">{setup.secret}</span></p>
          <label htmlFor="mc">2. Masukkan kode 6 angka yang tampil</label>
          <input id="mc" name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="one-time-code" />
          <button type="submit" className="btn-sm" disabled={busy}>
            Konfirmasi
          </button>
        </form>
      )}
      {codes && (
        <div className="card" style={{ marginBottom: 14 }}>
          <p className="small">
            <b>Simpan kode pemulihan ini sekarang.</b> Tiap kode hanya berlaku sekali dan tidak akan ditampilkan lagi. Pakai saat ponsel Anda hilang.
          </p>
          <p className="mono" style={{ lineHeight: 1.9 }}>
            {codes.map((c) => (
              <span key={c} style={{ display: "block" }}>{c}</span>
            ))}
          </p>
        </div>
      )}
      {enabled && (
        <form onSubmit={disable}>
          <p className="small">Status: aktif. Untuk mematikan, masukkan password dan kode saat ini.</p>
          <label htmlFor="dp">Password</label>
          <input id="dp" name="password" type="password" autoComplete="current-password" required />
          <label htmlFor="dc">Kode autentikator</label>
          <input id="dc" name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="one-time-code" />
          <button type="submit" className="btn-sm btn-ghost" disabled={busy}>
            Matikan
          </button>
        </form>
      )}
    </div>
  );
}
