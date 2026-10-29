import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import {pool,query} from './db.js';
dotenv.config();
const username=(process.argv[2]||'admin').trim();
const password=process.argv[3];
const name=(process.argv[4]||'Administrator Sisfo').trim();
if(!password || password.length<8) {
  console.error('Cara pakai: npm.cmd run create-admin -- admin PASSWORD_MINIMAL_8_KARAKTER "Nama Admin"');
  process.exit(1);
}
try {
  const hash=await bcrypt.hash(password,12);
  const existing=await query('SELECT id FROM users WHERE username=?',[username]);
  if(existing.length) {
    await query('UPDATE users SET name=?, password_hash=?, role="admin", is_active=1 WHERE id=?',[name,hash,existing[0].id]);
    console.log(`Akun admin "${username}" diperbarui.`);
  } else {
    await query('INSERT INTO users (name,username,password_hash,role,is_active) VALUES (?,?,?,"admin",1)',[name,username,hash]);
    console.log(`Akun admin "${username}" berhasil dibuat.`);
  }
} catch(e) { console.error('Gagal membuat admin:',e.message); process.exitCode=1; }
finally { await pool.end(); }
