import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { pool, query } from './db.js';
import { authRequired, roles, signToken } from './auth.js';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

dotenv.config();

const app = express();

app.use(
    cors({
        origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
            .split(',')
            .map(s => s.trim())
    })
);

app.use(express.json({ limit: '2mb' }));

const uploadRoot = path.resolve('uploads');

fs.mkdirSync(uploadRoot, { recursive: true });

app.use('/uploads', express.static(uploadRoot));

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadRoot),
    filename: (_req, file, cb) =>
        cb(
            null,
            `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`
        )
});

const allowedMime = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
]);

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 5
    },
    fileFilter: (_req, file, cb) => cb(null, allowedMime.has(file.mimetype))
});

const uploadAvatar = multer({
    storage,
    limits: {
        fileSize: 3 * 1024 * 1024,
        files: 1
    },
    fileFilter: (_req, file, cb) =>
        cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
});

const publicFile = f => `/uploads/${f.filename}`;

const asyncRoute = fn =>
    (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const safeUser = u => ({
    id: Number(u.id),
    name: u.name,
    username: u.username,
    role: u.role,
    avatar_url: u.avatar_url || null
});

const isAdmin = req => req.user?.role === 'admin';

// ==================================================
// HEALTH CHECK
// ==================================================

app.get(
    '/api/health',
    asyncRoute(async(req, res) => {
        await query('SELECT 1');

        res.json({
            status: 'OK',
            message: 'Sisfo Hub API dan database terhubung',
            database: process.env.DB_NAME || 'sisfo_hub'
        });
    })
);

// ==================================================
// AUTHENTICATION
// ==================================================

app.post(
    '/api/auth/login',
    asyncRoute(async(req, res) => {
        const { username, password } = req.body || {};

        if (!username || !password) {
            return res.status(400).json({
                message: 'Username dan password wajib diisi.'
            });
        }

        const rows = await query(
            'SELECT * FROM users WHERE username=? AND is_active=1 LIMIT 1', [String(username).trim()]
        );

        if (!rows.length ||
            !(await bcrypt.compare(String(password), rows[0].password_hash))
        ) {
            return res.status(401).json({
                message: 'Username atau password salah.'
            });
        }

        await query('UPDATE users SET last_login=NOW() WHERE id=?', [
            rows[0].id
        ]);

        const user = safeUser(rows[0]);

        res.json({
            token: signToken(user),
            user
        });
    })
);

app.get(
    '/api/auth/me',
    authRequired,
    asyncRoute(async(req, res) => {
        const rows = await query(
            'SELECT id,name,username,role,is_active,avatar_url FROM users WHERE id=? AND is_active=1', [req.user.id]
        );

        if (!rows.length) {
            return res.status(401).json({
                message: 'Akun tidak aktif atau tidak ditemukan.'
            });
        }

        res.json({
            user: safeUser(rows[0])
        });
    })
);

// ==================================================
// PROFILE
// ==================================================

app.patch(
    '/api/profile',
    authRequired,
    asyncRoute(async(req, res) => {
        const { name, username } = req.body || {};

        if (!name ?.trim() || !username ?.trim()) {
            return res.status(400).json({
                message: 'Nama dan username wajib diisi.'
            });
        }

        try {
            await query(
                'UPDATE users SET name=?,username=? WHERE id=?', [name.trim(), username.trim(), req.user.id]
            );

            const rows = await query(
                'SELECT id,name,username,role,avatar_url FROM users WHERE id=?', [req.user.id]
            );

            res.json({
                message: 'Profil berhasil diperbarui.',
                user: safeUser(rows[0])
            });
        } catch (e) {
            if (e.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    message: 'Username sudah digunakan.'
                });
            }

            throw e;
        }
    })
);

app.post(
    '/api/profile/avatar',
    authRequired,
    uploadAvatar.single('avatar'),
    asyncRoute(async(req, res) => {
        if (!req.file) {
            return res.status(400).json({
                message: 'Pilih foto JPG, PNG, atau WEBP maksimal 3 MB.'
            });
        }

        const avatarUrl = publicFile(req.file);

        await query('UPDATE users SET avatar_url=? WHERE id=?', [
            avatarUrl,
            req.user.id
        ]);

        const rows = await query(
            'SELECT id,name,username,role,avatar_url FROM users WHERE id=?', [req.user.id]
        );

        res.json({
            message: 'Foto profil berhasil diperbarui.',
            user: safeUser(rows[0])
        });
    })
);

// ==================================================
// CHANGE PASSWORD
// ==================================================

app.post(
    '/api/auth/change-password',
    authRequired,
    asyncRoute(async(req, res) => {
        const { currentPassword, newPassword } = req.body || {};

        if (!currentPassword ||
            !newPassword ||
            String(newPassword).length < 8
        ) {
            return res.status(400).json({
                message: 'Isi password saat ini dan password baru minimal 8 karakter.'
            });
        }

        const rows = await query(
            'SELECT password_hash FROM users WHERE id=?', [req.user.id]
        );

        if (!rows.length ||
            !(await bcrypt.compare(currentPassword, rows[0].password_hash))
        ) {
            return res.status(400).json({
                message: 'Password saat ini tidak sesuai.'
            });
        }

        await query(
            'UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(newPassword, 12), req.user.id]
        );

        res.json({
            message: 'Password berhasil diubah.'
        });
    })
);

// ==================================================
// USERS
// ==================================================

app.get(
    '/api/users',
    authRequired,
    asyncRoute(async(req, res) => {
        const rows = await query(
            'SELECT id,name,username,role,avatar_url,is_active,created_at,last_login FROM users WHERE is_active=1 ORDER BY name'
        );

        res.json({
            users: rows
        });
    })
);

app.post(
    '/api/users',
    authRequired,
    roles('admin'),
    uploadAvatar.single('avatar'),
    asyncRoute(async(req, res) => {
        const { name, username, password } = req.body || {};

        if (!name ?.trim() ||
            !username ?.trim() ||
            !password ||
            String(password).length < 8
        ) {
            return res.status(400).json({
                message: 'Nama, username, dan password minimal 8 karakter wajib diisi.'
            });
        }

        try {
            const avatarUrl = req.file ? publicFile(req.file) : null;

            const result = await query(
                `INSERT INTO users
        (name,username,avatar_url,password_hash,role,is_active)
        VALUES(?,?,?,?,'member',1)`, [
                    name.trim(),
                    username.trim(),
                    avatarUrl,
                    await bcrypt.hash(password, 12)
                ]
            );

            await query(
                'INSERT IGNORE INTO post_recipients(post_id,user_id) SELECT id,? FROM posts WHERE author_id<>?', [result.insertId, result.insertId]
            );

            res.status(201).json({
                message: 'Akun anggota berhasil dibuat.',
                user: {
                    id: result.insertId,
                    name: name.trim(),
                    username: username.trim(),
                    avatar_url: avatarUrl,
                    role: 'member',
                    is_active: 1
                }
            });
        } catch (e) {
            if (e.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    message: 'Username sudah digunakan.'
                });
            }

            throw e;
        }
    })
);

app.delete(
    '/api/users/:id',
    authRequired,
    roles('admin'),
    asyncRoute(async(req, res) => {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({
                message: 'ID pengguna tidak valid.'
            });
        }

        if (id === Number(req.user.id)) {
            return res.status(400).json({
                message: 'Admin tidak dapat menghapus akunnya sendiri.'
            });
        }

        const target = await query(
            'SELECT id,role FROM users WHERE id=?', [id]
        );

        if (!target.length) {
            return res.status(404).json({
                message: 'Pengguna tidak ditemukan.'
            });
        }

        if (target[0].role === 'admin') {
            return res.status(403).json({
                message: 'Akun admin tidak dapat dihapus dari menu anggota.'
            });
        }

        const conn = await pool.getConnection();

        try {
            await conn.beginTransaction();

            const [authored] = await conn.execute(
                'SELECT id FROM posts WHERE author_id=?', [id]
            );

            for (const p of authored) {
                await conn.execute(
                    'DELETE FROM comments WHERE post_id=?', [p.id]
                );

                await conn.execute(
                    'DELETE FROM posts WHERE id=?', [p.id]
                );
            }

            await conn.execute(
                'DELETE FROM comments WHERE user_id=?', [id]
            );

            await conn.execute(
                'DELETE FROM activity_logs WHERE user_id=?', [id]
            );

            await conn.execute(
                'DELETE FROM users WHERE id=?', [id]
            );

            await conn.commit();

            res.json({
                message: 'Akun pengguna berhasil dihapus.'
            });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    })
);

// ==================================================
// POSTS: LIST
// ==================================================

app.get(
    '/api/posts',
    authRequired,
    asyncRoute(async(req, res) => {
        const { type, status, search, unread, from, to } = req.query;

        let sql = `
      SELECT
        p.*,
        p.published_at AS created_at,
        u.name AS author_name,
        u.username AS author_username,
        u.avatar_url AS author_avatar,
        pr.read_at AS my_read_at,
        (
          SELECT COUNT(*)
          FROM comments c
          WHERE c.post_id=p.id AND c.deleted_at IS NULL
        ) AS comment_count,
        (
          SELECT COUNT(*)
          FROM post_recipients r
          WHERE r.post_id=p.id
        ) AS recipient_count
      FROM posts p
      JOIN users u ON u.id=p.author_id
      LEFT JOIN post_recipients pr
        ON pr.post_id=p.id AND pr.user_id=?
      WHERE
    `;

        const args = [req.user.id];

        if (isAdmin(req)) {
            sql += '1=1';
        } else {
            sql += '(p.author_id=? OR pr.user_id IS NOT NULL)';
            args.push(req.user.id);
        }

        if (type && ['info', 'task'].includes(type)) {
            sql += ' AND p.type=?';
            args.push(type);
        }

        if (status && ['pending', 'in_progress', 'completed'].includes(status)) {
            sql += ' AND p.status=?';
            args.push(status);
        }

        if (search) {
            sql += ' AND (p.title LIKE ? OR p.body LIKE ? OR u.name LIKE ?)';
            args.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (unread === '1') {
            sql += ' AND p.author_id<>? AND pr.read_at IS NULL';
            args.push(req.user.id);
        }

        if (from) {
            sql += ' AND DATE(p.published_at)>=?';
            args.push(from);
        }

        if (to) {
            sql += ' AND DATE(p.published_at)<=?';
            args.push(to);
        }

        sql += ' ORDER BY p.published_at DESC LIMIT 250';

        const posts = await query(sql, args);

        const ids = posts.map(p => p.id);
        const recipients = {};

        if (ids.length) {
            const rs = await query(
                `SELECT pr.post_id,pr.user_id,pr.read_at,u.name
         FROM post_recipients pr
         JOIN users u ON u.id=pr.user_id
         WHERE pr.post_id IN (${ids.map(() => '?').join(',')})`,
                ids
            );

            for (const r of rs) {
                (recipients[r.post_id] ??= []).push({
                    id: r.user_id,
                    name: r.name,
                    read_at: r.read_at
                });
            }
        }

        const attachments = {};

        if (ids.length) {
            const ats = await query(
                `SELECT id,post_id,original_name,file_url,mime_type,file_size
         FROM post_attachments
         WHERE post_id IN (${ids.map(() => '?').join(',')})
         ORDER BY id`,
                ids
            );

            for (const a of ats) {
                (attachments[a.post_id] ??= []).push(a);
            }
        }

        res.json({
            posts: posts.map(p => ({
                ...p,
                attachments: attachments[p.id] || [],
                recipients: recipients[p.id] || [],
                is_author: Number(p.author_id) === Number(req.user.id)
            }))
        });
    })
);

// ==================================================
// POSTS: CREATE
// ==================================================

app.post(
    '/api/posts',
    authRequired,
    upload.array('files', 5),
    asyncRoute(async(req, res) => {
        const {
            type = 'info',
                title,
                body,
                priority = 'medium',
                due_date
        } = req.body || {};

        if (!['info', 'task'].includes(type)) {
            return res.status(400).json({
                message: 'Jenis post tidak valid.'
            });
        }

        if (!title ?.trim() || !body ?.trim()) {
            return res.status(400).json({
                message: 'Judul dan isi wajib diisi.'
            });
        }

        if (!['low', 'medium', 'high'].includes(priority)) {
            return res.status(400).json({
                message: 'Prioritas tidak valid.'
            });
        }

        const conn = await pool.getConnection();

        try {
            await conn.beginTransaction();

            const [result] = await conn.execute(
                `INSERT INTO posts
        (author_id,type,title,body,priority,status,due_date,published_at)
        VALUES(?,?,?,?,?,?,?,NOW())`, [
                    req.user.id,
                    type,
                    title.trim(),
                    body.trim(),
                    priority,
                    'pending',
                    due_date || null
                ]
            );

            const postId = result.insertId;

            for (const f of req.files || []) {
                await conn.execute(
                    `INSERT INTO post_attachments
          (post_id,uploaded_by,original_name,file_url,mime_type,file_size)
          VALUES(?,?,?,?,?,?)`, [
                        postId,
                        req.user.id,
                        f.originalname,
                        publicFile(f),
                        f.mimetype,
                        f.size
                    ]
                );
            }

            const [all] = await conn.query(
                'SELECT id FROM users WHERE is_active=1 AND id<>?', [req.user.id]
            );

            for (const u of all) {
                await conn.execute(
                    'INSERT IGNORE INTO post_recipients(post_id,user_id) VALUES(?,?)', [postId, u.id]
                );

                await conn.execute(
                    `INSERT INTO notifications
          (user_id,post_id,type,title,message)
          VALUES(?,?,?,?,?)`, [
                        u.id,
                        postId,
                        'new_post',
                        `${type === 'task' ? 'Penugasan' : 'Informasi'} baru: ${title.trim()}`,
                        `${req.user.username} membagikan ${type === 'task' ? 'penugasan' : 'informasi'} baru.`
                    ]
                );
            }

            await conn.execute(
                'INSERT INTO activity_logs(user_id,post_id,action,description) VALUES(?,?,?,?)', [req.user.id, postId, 'post_created', title.trim()]
            );

            await conn.commit();

            res.status(201).json({
                message: 'Publikasi berhasil dibuat.',
                id: postId
            });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    })
);

// ==================================================
// POSTS: UPDATE
// ==================================================

app.patch(
    '/api/posts/:id',
    authRequired,
    upload.array('files', 5),
    asyncRoute(async(req, res) => {
        const {
            title,
            body,
            type,
            priority = 'medium',
            due_date
        } = req.body || {};

        const rows = await query(
            'SELECT id,author_id,type FROM posts WHERE id=?', [req.params.id]
        );

        if (!rows.length) {
            return res.status(404).json({
                message: 'Publikasi tidak ditemukan.'
            });
        }

        if (Number(rows[0].author_id) !== Number(req.user.id)) {
            return res.status(403).json({
                message: 'Hanya pembuat publikasi yang dapat mengeditnya.'
            });
        }

        if (!title ?.trim() ||
            !body ?.trim() ||
            !['info', 'task'].includes(type) ||
            !['low', 'medium', 'high'].includes(priority)
        ) {
            return res.status(400).json({
                message: 'Periksa judul, isi, jenis, dan prioritas publikasi.'
            });
        }

        await query(
            'UPDATE posts SET title=?,body=?,type=?,priority=?,due_date=? WHERE id=?', [
                title.trim(),
                body.trim(),
                type,
                priority,
                due_date || null,
                req.params.id
            ]
        );

        for (const f of req.files || []) {
            await query(
                `INSERT INTO post_attachments
        (post_id,uploaded_by,original_name,file_url,mime_type,file_size)
        VALUES(?,?,?,?,?,?)`, [
                    req.params.id,
                    req.user.id,
                    f.originalname,
                    publicFile(f),
                    f.mimetype,
                    f.size
                ]
            );
        }

        await query(
            'INSERT INTO activity_logs(user_id,post_id,action,description) VALUES(?,?,?,?)', [req.user.id, req.params.id, 'post_updated', title.trim()]
        );

        res.json({
            message: 'Publikasi berhasil diperbarui.'
        });
    })
);

// ==================================================
// POSTS: DELETE
// ==================================================

app.delete(
    '/api/posts/:id',
    authRequired,
    roles('admin'),
    asyncRoute(async(req, res) => {
        const result = await query(
            'DELETE FROM posts WHERE id=?', [req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                message: 'Informasi atau penugasan tidak ditemukan.'
            });
        }

        res.json({
            message: 'Informasi atau penugasan berhasil dihapus.'
        });
    })
);

// ==================================================
// POSTS: DETAIL
// ==================================================

app.get(
    '/api/posts/:id',
    authRequired,
    asyncRoute(async(req, res) => {
        const accessSql = isAdmin(req) ?
            'p.id=?' :
            '(p.author_id=? OR pr.user_id IS NOT NULL) AND p.id=?';

        const join = isAdmin(req) ?
            '' :
            'LEFT JOIN post_recipients pr ON pr.post_id=p.id AND pr.user_id=?';

        const args = isAdmin(req) ? [req.params.id] : [req.user.id, req.user.id, req.params.id];

        const rows = await query(
            `SELECT
        p.*,
        p.published_at AS created_at,
        u.name AS author_name,
        u.avatar_url AS author_avatar,
        u.username AS author_username
       FROM posts p
       JOIN users u ON u.id=p.author_id
       ${join}
       WHERE ${accessSql}`,
            args
        );

        if (!rows.length) {
            return res.status(404).json({
                message: 'Post tidak ditemukan atau kamu tidak memiliki akses.'
            });
        }

        const comments = await query(
            `SELECT
        c.id,c.body,c.created_at,c.user_id,
        u.name AS user_name,
        u.avatar_url AS user_avatar
       FROM comments c
       JOIN users u ON u.id=c.user_id
       WHERE c.post_id=? AND c.deleted_at IS NULL
       ORDER BY c.created_at`, [req.params.id]
        );

        const attachments = await query(
            `SELECT id,post_id,original_name,file_url,mime_type,file_size
       FROM post_attachments
       WHERE post_id=?
       ORDER BY id`, [req.params.id]
        );

        const readers =
            isAdmin(req) ||
            Number(rows[0].author_id) === Number(req.user.id) ?
            await query(
                `SELECT
              u.id,u.name,u.username,u.avatar_url,pr.read_at
             FROM post_recipients pr
             JOIN users u ON u.id=pr.user_id
             WHERE pr.post_id=?
             ORDER BY pr.read_at IS NULL,pr.read_at DESC,u.name`, [req.params.id]
            ) : [];

        res.json({
            post: rows[0],
            comments,
            attachments,
            readers
        });
    })
);

// ==================================================
// POSTS: MARK AS READ
// ==================================================

app.post(
    '/api/posts/:id/read',
    authRequired,
    asyncRoute(async(req, res) => {
        const posts = await query(
            'SELECT id,author_id FROM posts WHERE id=?', [req.params.id]
        );

        if (!posts.length) {
            return res.status(404).json({
                message: 'Post tidak ditemukan.'
            });
        }

        if (!isAdmin(req) &&
            Number(posts[0].author_id) !== Number(req.user.id)
        ) {
            const access = await query(
                'SELECT post_id FROM post_recipients WHERE post_id=? AND user_id=?', [req.params.id, req.user.id]
            );

            if (!access.length) {
                return res.status(403).json({
                    message: 'Kamu tidak memiliki akses ke informasi ini.'
                });
            }
        }

        if (Number(posts[0].author_id) !== Number(req.user.id)) {
            await query(
                'UPDATE post_recipients SET read_at=NOW() WHERE post_id=? AND user_id=?', [req.params.id, req.user.id]
            );
        }

        await query(
            'INSERT INTO activity_logs(user_id,post_id,action,description) VALUES(?,?,?,?)', [
                req.user.id,
                req.params.id,
                'post_read',
                'Konfirmasi sudah membaca'
            ]
        );

        await query(
            'UPDATE notifications SET is_read=1 WHERE user_id=? AND post_id=?', [req.user.id, req.params.id]
        );

        res.json({
            message: 'Konfirmasi membaca berhasil dicatat.'
        });
    })
);

// ==================================================
// POSTS: UPDATE STATUS
// ==================================================

app.patch(
    '/api/posts/:id/status',
    authRequired,
    asyncRoute(async(req, res) => {
        const { status } = req.body || {};

        if (!['pending', 'in_progress', 'completed'].includes(status)) {
            return res.status(400).json({
                message: 'Status tidak valid.'
            });
        }

        const posts = await query(
            'SELECT id,author_id,type FROM posts WHERE id=?', [req.params.id]
        );

        if (!posts.length) {
            return res.status(404).json({
                message: 'Penugasan tidak ditemukan.'
            });
        }

        if (posts[0].type !== 'task') {
            return res.status(400).json({
                message: 'Status hanya berlaku untuk penugasan.'
            });
        }

        if (Number(posts[0].author_id) !== Number(req.user.id)) {
            return res.status(403).json({
                message: 'Hanya pembuat penugasan yang dapat mengubah status.'
            });
        }

        await query(
            'UPDATE posts SET status=? WHERE id=?', [status, req.params.id]
        );

        await query(
            'INSERT INTO activity_logs(user_id,post_id,action,description) VALUES(?,?,?,?)', [req.user.id, req.params.id, 'status_changed', status]
        );

        res.json({
            message: 'Status penugasan diperbarui.'
        });
    })
);

// ==================================================
// COMMENTS: CREATE
// ==================================================

app.post(
    '/api/posts/:id/comments',
    authRequired,
    asyncRoute(async(req, res) => {
        const { body } = req.body || {};

        if (!body ?.trim()) {
            return res.status(400).json({
                message: 'Komentar tidak boleh kosong.'
            });
        }

        const post = await query(
            'SELECT id,author_id FROM posts WHERE id=?', [req.params.id]
        );

        if (!post.length) {
            return res.status(404).json({
                message: 'Post tidak ditemukan.'
            });
        }

        if (!isAdmin(req) &&
            Number(post[0].author_id) !== Number(req.user.id)
        ) {
            const access = await query(
                'SELECT post_id FROM post_recipients WHERE post_id=? AND user_id=?', [req.params.id, req.user.id]
            );

            if (!access.length) {
                return res.status(403).json({
                    message: 'Kamu tidak memiliki akses ke informasi ini.'
                });
            }
        }

        const r = await query(
            'INSERT INTO comments(post_id,user_id,body) VALUES(?,?,?)', [req.params.id, req.user.id, body.trim()]
        );

        await query(
            'INSERT INTO activity_logs(user_id,post_id,action,description) VALUES(?,?,?,?)', [
                req.user.id,
                req.params.id,
                'comment_added',
                'Komentar ditambahkan'
            ]
        );

        res.status(201).json({
            id: r.insertId,
            message: 'Komentar ditambahkan.'
        });
    })
);

// ==================================================
// COMMENTS: DELETE
// ==================================================

app.delete(
    '/api/comments/:id',
    authRequired,
    asyncRoute(async(req, res) => {
        const c = await query(
            `SELECT c.id,c.user_id,p.author_id
       FROM comments c
       JOIN posts p ON p.id=c.post_id
       WHERE c.id=? AND c.deleted_at IS NULL`, [req.params.id]
        );

        if (!c.length) {
            return res.status(404).json({
                message: 'Komentar tidak ditemukan.'
            });
        }

        if (!isAdmin(req) &&
            Number(c[0].user_id) !== Number(req.user.id)
        ) {
            return res.status(403).json({
                message: 'Kamu hanya dapat menghapus komentar sendiri.'
            });
        }

        await query(
            'UPDATE comments SET deleted_at=NOW() WHERE id=?', [req.params.id]
        );

        res.json({
            message: 'Komentar dihapus.'
        });
    })
);

// ==================================================
// NOTIFICATIONS
// ==================================================

app.get(
    '/api/notifications',
    authRequired,
    asyncRoute(async(req, res) => {
        const rows = await query(
            `SELECT id,post_id,type,title,message,is_read,created_at
       FROM notifications
       WHERE user_id=?
       ORDER BY created_at DESC
       LIMIT 100`, [req.user.id]
        );

        res.json({
            notifications: rows
        });
    })
);

app.patch(
    '/api/notifications/read-all',
    authRequired,
    asyncRoute(async(req, res) => {
        await query(
            'UPDATE notifications SET is_read=1 WHERE user_id=?', [req.user.id]
        );

        res.json({
            message: 'Notifikasi ditandai dibaca.'
        });
    })
);

// ==================================================
// ACTIVITY LOG
// ==================================================

app.get(
    '/api/activity',
    authRequired,
    asyncRoute(async(req, res) => {
        const rows = await query(
            `SELECT
        a.id,a.action,a.description,a.created_at,
        u.name AS user_name,
        p.title AS post_title
       FROM activity_logs a
       LEFT JOIN users u ON u.id=a.user_id
       LEFT JOIN posts p ON p.id=a.post_id
       ORDER BY a.created_at DESC
       LIMIT 200`
        );

        res.json({
            activity: rows
        });
    })
);

// ==================================================
// DASHBOARD
// ==================================================

app.get(
    '/api/dashboard',
    authRequired,
    asyncRoute(async(req, res) => {
        const unread = await query(
            'SELECT COUNT(*) AS n FROM post_recipients WHERE user_id=? AND read_at IS NULL', [req.user.id]
        );

        const tasks = await query(
            `SELECT COUNT(DISTINCT p.id) AS n
       FROM posts p
       LEFT JOIN post_recipients r
         ON r.post_id=p.id AND r.user_id=?
       WHERE p.type='task'
         AND p.status<>'completed'
         AND (p.author_id=? OR r.user_id IS NOT NULL)`, [req.user.id, req.user.id]
        );

        const notifs = await query(
            'SELECT COUNT(*) AS n FROM notifications WHERE user_id=? AND is_read=0', [req.user.id]
        );

        res.json({
            unread: Number(unread[0].n),
            activeTasks: Number(tasks[0].n),
            unreadNotifications: Number(notifs[0].n)
        });
    })
);

// ==================================================
// ERROR HANDLER
// ==================================================

app.use((err, req, res, next) => {
    console.error(err);

    if (
        err.code === 'ER_NO_SUCH_TABLE' ||
        err.code === 'ER_BAD_FIELD_ERROR'
    ) {
        return res.status(500).json({
            message: 'Struktur database tidak sesuai. Impor sisfo_hub.sql atau periksa database/setup.sql agar tabel dan kolom sesuai.'
        });
    }

    res.status(500).json({
        message: 'Terjadi kesalahan pada server.',
        detail: process.env.NODE_ENV === 'development' ?
            err.message : undefined
    });
});

// ==================================================
// START SERVER
// ==================================================

const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
    console.log(`Sisfo Hub API berjalan di http://localhost:${port}`);
});


