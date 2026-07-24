# Sistem Garansi Baru

Gunakan nama baru berikut:

- Repository GitHub: `sistem-garansi`
- Worker: `garansi-api`
- Database D1: `garansi-db`
- URL Worker: `https://garansi-api.jhonyoga01.workers.dev`

Jangan gunakan Worker lama `juastore-garansi-api`.

## Urutan pemasangan

1. Buat repository GitHub baru bernama `sistem-garansi`.
2. Upload seluruh file paket ini.
3. Cloudflare D1: buat database `garansi-db`.
4. Jalankan seluruh isi `schema.sql`.
5. Salin Database ID.
6. Ganti `GANTI_DENGAN_DATABASE_ID_ASLI` di `wrangler.toml`.
7. Commit ke branch `main`.
8. Cloudflare Workers & Pages: Create → Import a repository.
9. Pilih repository `sistem-garansi`.
10. Build command: kosong.
11. Deploy command: `npx wrangler deploy`.
12. Root directory: `/`.
13. Tambahkan binding D1:
    - Variable name: `DB`
    - Database: `garansi-db`
14. Tambahkan variable:
    - `ALLOWED_ORIGIN` = `*`
15. Commit perubahan kecil di GitHub agar deployment berjalan.
16. Buka `https://garansi-api.jhonyoga01.workers.dev`.

Hasil benar:
`{"success":true,"message":"Sistem Garansi API aktif."}`
