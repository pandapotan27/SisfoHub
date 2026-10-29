SISFO HUB — PANDUAN INSTALASI DAN UPDATE
=======================================
Stack: React + Vite, Node.js + Express, MySQL/MariaDB.

FITUR
- Hanya admin membuat/menghapus akun anggota dan menghapus publikasi.
- Semua pengguna login, melihat direktori anggota, membuat informasi/penugasan, dan berkomentar.
- Pembuat publikasi dapat mengedit publikasi sendiri; anggota lain tidak dapat mengubahnya.
- Hanya pembuat penugasan yang dapat mengubah status penugasannya.
- Tombol "Saya sudah membaca" menyimpan waktu baca. Pembuat publikasi dapat melihat daftar siapa yang sudah/belum membaca.
- Foto profil saat admin membuat akun (opsional) dan dapat diganti dari halaman Profil.
- Lampiran PDF, DOC, DOCX, JPG, PNG, GIF, WEBP: maksimal 5 file/publikasi, 10 MB per file. Foto profil maksimal 3 MB.
- Isi publikasi dapat menyertakan tautan URL. Klik tautan dengan menyalin ke browser jika tidak tampil sebagai link otomatis.

INSTALASI BARU
1. Ekstrak ZIP ke folder kerja.
2. Jalankan XAMPP dan aktifkan MySQL.
3. phpMyAdmin > Import > pilih database/setup.sql.
4. Salin server/.env.example menjadi server/.env, lalu sesuaikan DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET.
5. Terminal 1:
   cd server
   npm install
   npm run create-admin -- admin PasswordKuat123! "Administrator Sisfo"
   npm run dev
   Ganti password contoh dengan password kuat milik sendiri.
6. Terminal 2:
   cd client
   npm install
   npm run dev
7. Buka http://localhost:5173

UPDATE DATABASE LAMA
1. Backup database sisfo_hub terlebih dahulu lewat phpMyAdmin > Export.
2. Pilih database sisfo_hub di phpMyAdmin.
3. Import database/update_existing_database.sql SATU KALI. Script ini menambah kolom avatar dan tabel lampiran serta menyederhanakan role menjadi admin/member.
4. Jangan impor setup.sql ke database lama karena setup.sql untuk instalasi baru.

PENTING
- File unggahan disimpan di server/uploads. Folder ini harus dapat ditulis oleh proses Node.js dan perlu ikut dicadangkan.
- Jangan gunakan server development untuk publikasi ke internet. Untuk produksi, tambahkan HTTPS, pembatasan akses file, backup, dan pemeriksaan keamanan upload.
- Jika server sudah berjalan, hentikan (Ctrl+C) lalu jalankan ulang setelah npm install.
- npm.cmd dapat dipakai di PowerShell Windows jika npm.ps1 diblokir kebijakan execution policy.
