import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sisfo_hub',

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    // Zona waktu Indonesia Barat (WIB / UTC+7)
    timezone: '+07:00'
});

export async function query(sql, params = []) {
    const [rows] = await pool.execute(sql, params);
    return rows;
}