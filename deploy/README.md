# Deploy NUMORA (server AI Labs)

- Aplikasi dijalankan PM2 dari `ecosystem.config.cjs` (nama `numora`, port 5020).
- Port 80 dan 443 server dipegang container Docker Caddy yang mengurus HTTPS otomatis (Let's Encrypt).
  Domain didaftarkan di `~/ailabs-deploy/Caddyfile`:

      numora.ailabs.or.id {
          encode gzip
          reverse_proxy 172.19.0.1:5020
      }

- Update: unggah kode ke `~/apps/numora`, lalu `npm ci && npm run build && pm2 restart numora`.
- Inisialisasi database sekali: `npm run db:init`.
- Health check: `GET /api/health`.
