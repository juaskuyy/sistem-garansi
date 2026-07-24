JUASTORE — WEBSITE GARANSI KE BOT TELEGRAM

HASIL ALUR:
Customer isi website → klik Kirim Pengajuan → data + screenshot masuk ke Telegram admin → customer tetap di website → admin membalas lewat tombol WhatsApp.

PENTING:
Token bot tidak boleh ditaruh di index.html karena akan terlihat publik. Token disimpan sebagai secret Cloudflare Worker.

A. BUAT BOT TELEGRAM
1. Buka @BotFather → /newbot → salin token.
2. Kirim pesan /start ke bot baru.
3. Masukkan bot ke grup admin garansi bila ingin laporan masuk ke grup.
4. Dapatkan Chat ID admin/grup. Cara cepat: kirim pesan ke bot lalu buka:
   https://api.telegram.org/botTOKEN_ANDA/getUpdates
   Cari nilai "chat":{"id":...}

B. DEPLOY CLOUDFLARE WORKER
1. Buat akun Cloudflare dan buka Workers & Pages.
2. Buat Worker bernama juastore-garansi-bot.
3. Tempel isi worker.js sebagai kode Worker lalu deploy.
4. Buka Settings → Variables and Secrets, tambahkan:
   TELEGRAM_BOT_TOKEN = token dari BotFather (Secret)
   TELEGRAM_CHAT_ID = ID akun/grup admin (Secret)
   ALLOWED_ORIGIN = https://juastorepremium.biz.id
5. Salin URL Worker, contoh:
   https://juastore-garansi-bot.username.workers.dev/submit

C. HUBUNGKAN WEBSITE
1. Buka index.html.
2. Cari:
   const API_ENDPOINT = 'https://GANTI-DENGAN-WORKER-ANDA.workers.dev/submit';
3. Ganti dengan URL Worker milik Anda.
4. Upload index.html ke hosting/GitHub Pages.

D. TES
1. Isi form dengan nomor WhatsApp berawalan 62.
2. Upload screenshot maksimal 5 MB.
3. Klik Kirim Pengajuan.
4. Telegram admin menerima pengajuan dan tombol Balas customer via WhatsApp.

CATATAN:
- Customer tidak memerlukan Telegram.
- Balasan admin masih melalui WhatsApp dengan tombol wa.me.
- Untuk balasan WhatsApp otomatis diperlukan WhatsApp Business API resmi.
