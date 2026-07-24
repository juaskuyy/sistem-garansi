# Pasang Perbaikan Garansi JuaStore

1. Ganti `worker.js` lama dengan file ini lalu commit ke GitHub.
2. Buka Cloudflare D1 → `juastore-garansi-db` → Console.
3. Jalankan seluruh isi `schema.sql`.
4. Pastikan Worker memiliki:
   - DB binding → `juastore-garansi-db`
   - ALLOWED_ORIGIN = `https://juastore.biz.id` atau `*`
   - TELEGRAM_BOT_TOKEN
   - TELEGRAM_CHAT_ID
   - TELEGRAM_WEBHOOK_SECRET
5. Upload `cek.html` ke folder yang sama dengan `index.html`.
6. Pastikan `index.html` mengirim POST ke:
   `https://garansi-api.jhonyoga01.workers.dev/api/claims`
7. Pasang webhook Telegram. Ganti TOKEN dan SECRET:
   `https://api.telegram.org/botTOKEN/setWebhook?url=https%3A%2F%2Fgaransi-api.jhonyoga01.workers.dev%2Ftelegram-webhook%3Fkey%3DSECRET`
8. Hasil benar:
   `{"ok":true,"result":true,"description":"Webhook was set"}`

Tombol Telegram:
- Terima → Diterima
- Proses → Diproses
- Tolak → Ditolak
- Balas WhatsApp → membuka chat customer
