const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function main() {
    const username = process.argv[2];
    const password = process.argv[3];
    const fullName = process.argv[4] || username;

    if (!username || !password) {
        console.log(
            'Penggunaan: node create-admin.js <username> <password> "<nama lengkap>"'
        );
        process.exitCode = 1;
        return;
    }

    if (password.length < 8) {
        console.error('Password minimal 8 karakter.');
        process.exitCode = 1;
        return;
    }

    let connection;

    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT || 3306),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'sisfo_hub'
        });

        const passwordHash = await bcrypt.hash(password, 10);

        const [existingUsers] = await connection.execute(
            'SELECT id FROM users WHERE username = ? LIMIT 1', [username]
        );

        if (existingUsers.length > 0) {
            console.log(
                `Username "${username}" sudah ada. Tidak ada akun yang diubah.`
            );
            return;
        }

        const [columns] = await connection.execute(
            'SHOW COLUMNS FROM users'
        );

        const columnNames = columns.map(column => column.Field);
        const requiredColumns = ['username', 'password'];

        for (const column of requiredColumns) {
            if (!columnNames.includes(column)) {
                throw new Error(
                    `Kolom "${column}" tidak ditemukan pada tabel users.`
                );
            }
        }

        const fields = ['username', 'password'];
        const values = [username, passwordHash];

        if (columnNames.includes('name')) {
            fields.push('name');
            values.push(fullName);
        } else if (columnNames.includes('full_name')) {
            fields.push('full_name');
            values.push(fullName);
        }

        if (columnNames.includes('role')) {
            fields.push('role');
            values.push('admin');
        }

        if (columnNames.includes('status')) {
            fields.push('status');
            values.push('active');
        }

        const placeholders = fields.map(() => '?').join(', ');
        const sql = `INSERT INTO users (${fields.join(', ')}) VALUES (${placeholders})`;

        const [result] = await connection.execute(sql, values);

        console.log('Akun admin berhasil dibuat.');
        console.log(`Username: ${username}`);
        console.log(`Nama: ${fullName}`);
        console.log(`ID pengguna: ${result.insertId}`);
        console.log('Silakan simpan password dengan aman.');

    } catch (error) {
        console.error('Gagal membuat akun admin:', error.message);
        process.exitCode = 1;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

main();