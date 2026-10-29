
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  House, ClipboardList, Bell, History, UserRound, Plus, Search,
  CalendarDays, MessageSquare, CheckCircle2, Clock3, ArrowRight, X,
  LogOut, Eye, Users, Trash2, Settings, ShieldCheck, RefreshCw,
  Send, LockKeyhole
} from 'lucide-react';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const parseDate = value => {
  if (!value) return null;
  if (value instanceof Date) return value;

  const raw = String(value);
  const localDateTime = raw.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/
  );

  if (localDateTime) {
    return new Date(
      `${localDateTime[1]}T${localDateTime[2]}:${localDateTime[3] || '00'}`
    );
  }

  return new Date(raw);
};

const dateText = value => {
  if (!value) return '—';

  const date = parseDate(value);

  return Number.isNaN(date?.getTime())
    ? '—'
    : date.toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
};

const toDateTimeLocal = value => {
  if (!value) return '';

  const raw = String(value);

  if (
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(raw) &&
    !/(Z|[+-]\d{2}:?\d{2})$/i.test(raw)
  ) {
    return raw.replace(' ', 'T').slice(0, 16);
  }

  const date = parseDate(raw);

  if (Number.isNaN(date?.getTime())) return '';

  const pad = n => String(n).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const statusText = value => ({
  pending: 'Belum dikerjakan',
  in_progress: 'Sedang dikerjakan',
  completed: 'Selesai'
}[value] || value);

const initials = name =>
  (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map(x => x[0])
    .join('')
    .toUpperCase();

const avatarUrl = value =>
  value ? `${API.replace(/\/api$/, '')}${value}` : '';

const renderBody = text =>
  (text || '')
    .split(/(https?:\/\/[^\s]+)/g)
    .map((part, i) =>
      /^https?:\/\//i.test(part)
        ? (
          <a key={i} href={part} target="_blank" rel="noreferrer">
            {part}
          </a>
        )
        : part
    );

function Avatar({ name, url, className = 'mini-avatar' }) {
  return url
    ? (
      <img
        className={`${className} avatar-image`}
        src={avatarUrl(url)}
        alt={`Foto ${name || 'pengguna'}`}
      />
    )
    : <span className={className}>{initials(name)}</span>;
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const r = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const d = await r.json();

      if (!r.ok) throw new Error(d.message || 'Login gagal.');

      onLogin(d);
    } catch (e) {
      setError(e.message || 'Server tidak dapat dihubungi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <section className="login-left">
        <div className="login-box">
          <img
            className="logo-login"
            src="/logo-rsb.png"
            alt="Logo RS Santo Borromeus"
          />

          <div className="overline">SISTEM INFORMASI INTERNAL</div>
          <h1>Selamat datang.</h1>

          <p className="login-desc">
            Masuk ke Sisfo Hub untuk mengakses informasi, penugasan,
            dan aktivitas tim.
          </p>

          <form onSubmit={submit}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Masukkan username"
              autoComplete="username"
              required
            />

            <div className="pass-label">
              <label htmlFor="password">Password</label>
              <button type="button" onClick={() => setShow(!show)}>
                {show ? 'Sembunyikan' : 'Tampilkan'}
              </button>
            </div>

            <input
              id="password"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Masukkan password"
              autoComplete="current-password"
              required
            />

            {error && <p className="error">{error}</p>}

            <button className="login-btn" disabled={busy}>
              {busy ? 'Memeriksa...' : 'Masuk ke Sisfo Hub'}
              <ArrowRight size={17} />
            </button>
          </form>

          <p className="login-foot">
            <i /> Akses khusus anggota internal Sisfo
          </p>
        </div>
      </section>

      <aside className="login-right">
        <div className="right-content">
          <span>SISFO HUB</span>
          <h2>Informasi tim,<br />dalam satu tempat.</h2>
          <p>
            Ruang kerja internal untuk berbagi informasi, memantau tugas,
            dan memastikan setiap hal penting mendapat tindak lanjut.
          </p>
          <div className="rule" />
          <small>RS Santo Borromeus · Bandung</small>
        </div>
        <label>SISFO / 01</label>
      </aside>
    </main>
  );
}

function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('sisfo-session') || 'null');
    } catch {
      return null;
    }
  });

  const [page, setPage] = useState('home');
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activity, setActivity] = useState([]);
  const [dashboard, setDashboard] = useState({
    unread: 0,
    activeTasks: 0,
    unreadNotifications: 0
  });

  const [filter, setFilter] = useState('Semua');
  const [search, setSearch] = useState('');
  const [compose, setCompose] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [avatarFile, setAvatarFile] = useState(null);
  const [kind, setKind] = useState('info');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [due, setDue] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [priority, setPriority] = useState('medium');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState('');
  const [recipientMode, setRecipientMode] = useState('all');
  const [recipientIds, setRecipientIds] = useState([]);

  // Pencarian anggota penerima
  const [recipientSearch, setRecipientSearch] = useState('');

  const [mentionTarget, setMentionTarget] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserAvatar, setNewUserAvatar] = useState(null);

  const user = session?.user;
  const admin = user?.role === 'admin';

  const notify = msg => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2800);
  };

  const api = useCallback(async (path, options = {}) => {
    const isForm =
      typeof FormData !== 'undefined' && options.body instanceof FormData;

    const headers = {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(session?.token
        ? { Authorization: `Bearer ${session.token}` }
        : {}),
      ...(options.headers || {})
    };

    const r = await fetch(`${API}${path}`, { ...options, headers });
    const data = await r.json().catch(() => ({}));

    if (r.status === 401) {
      sessionStorage.removeItem('sisfo-session');
      setSession(null);
    }

    if (!r.ok) throw new Error(data.message || 'Permintaan gagal.');

    return data;
  }, [session?.token]);

  const load = useCallback(async () => {
    if (!session?.token) return;

    try {
      const [p, d, n] = await Promise.all([
        api('/posts'),
        api('/dashboard'),
        api('/notifications')
      ]);

      setPosts(p.posts || []);
      setDashboard(d);
      setNotifications(n.notifications || []);

      const u = await api('/users');
      setUsers(u.users || []);

      if (page === 'history') {
        const a = await api('/activity');
        setActivity(a.activity || []);
      }
    } catch (e) {
      notify(e.message);
    }
  }, [session?.token, api, page]);

  useEffect(() => {
    if (session?.token) {
      sessionStorage.setItem('sisfo-session', JSON.stringify(session));
      setProfileName(session.user.name);
      setProfileUsername(session.user.username);
      load();
    } else {
      sessionStorage.removeItem('sisfo-session');
    }
  }, [session?.token]);

  useEffect(() => {
    if (session?.token) load();
  }, [page]);

  async function login(data) {
    sessionStorage.setItem('sisfo-session', JSON.stringify(data));
    setSession(data);
    setPage('home');
  }

  function logout() {
    sessionStorage.removeItem('sisfo-session');
    setSession(null);
    setPage('home');
    setPosts([]);
  }

  const nav = [
    ['home', 'Beranda', House],
    ['tasks', 'Penugasan', ClipboardList],
    ['members', 'Anggota', Users],
    ['notifications', 'Notifikasi', Bell],
    ['history', 'Riwayat', History],
    ['profile', 'Profil', UserRound],
    ...(admin ? [['users', 'Kelola anggota', Settings]] : [])
  ];

  const visible = useMemo(() => posts.filter(p => {
  const isTask = p.type === 'task';
  const isAuthor = Number(p.author_id) === Number(user?.id);

  const recipients = Array.isArray(p.recipients)
    ? p.recipients
    : [];

  const isRecipient = recipients.some(r =>
    Number(typeof r === 'object' ? r.id : r) === Number(user?.id)
  );

  // Penugasan hanya terlihat oleh pembuat dan penerima yang dituju.
  const canSeeTask = !isTask || isAuthor || isRecipient;

  const matchesPage =
    page !== 'tasks' || (isTask && canSeeTask);

  const matchesFilter =
    filter === 'Semua' ||
    (filter === 'Informasi' && p.type === 'info') ||
    (filter === 'Penugasan' && isTask && canSeeTask) ||
    (
      filter === 'Belum dibaca' &&
      !p.my_read_at &&
      !isAuthor
    );

  const matchesSearch =
    `${p.title || ''} ${p.body || ''} ${p.author_name || ''}`
      .toLowerCase()
      .includes(search.toLowerCase());

  return matchesPage && matchesFilter && matchesSearch;
}), [posts, page, filter, search, user?.id]);
  async function publish(e) {
    e.preventDefault();
    setBusy(true);

    try {
      const fd = new FormData();

      fd.append('type', kind);
      fd.append('title', title);
      fd.append('body', body);
      fd.append('priority', priority);
      fd.append('due_date', kind === 'task' ? due : scheduledAt);
      fd.append('recipient_mode', recipientMode);
      fd.append('recipient_ids', JSON.stringify(recipientIds));

      selectedFiles.forEach(f => fd.append('files', f));

      await api(
        editing ? `/posts/${editing.id}` : '/posts',
        {
          method: editing ? 'PATCH' : 'POST',
          body: fd
        }
      );

      setTitle('');
      setBody('');
      setDue('');
      setScheduledAt('');
      setPriority('medium');
      setRecipientMode('all');
      setRecipientIds([]);
      setRecipientSearch('');
      setSelectedFiles([]);
      setEditing(null);
      setCompose(false);
      setPage(kind === 'task' ? 'tasks' : 'home');

      await load();

      notify(
        `${kind === 'task' ? 'Penugasan' : 'Informasi'} berhasil ${
          editing ? 'diperbarui' : 'dipublikasikan'
        }.`
      );
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }

  function editPost(p) {
    setEditing(p);
    setKind(p.type);
    setTitle(p.title);
    setBody(p.body);
    setDue(p.type === 'task' ? toDateTimeLocal(p.due_date) : '');
    setScheduledAt(p.type === 'info' ? toDateTimeLocal(p.due_date) : '');
    setPriority(p.priority || 'medium');
    setRecipientMode(p.recipients?.length ? 'selected' : 'all');
    setRecipientIds((p.recipients || []).map(r => Number(r.id)));
    setRecipientSearch('');
    setSelectedFiles([]);
    setSelected(null);
    setCompose(true);
  }

  async function saveAvatar(e) {
    e.preventDefault();
    if (!avatarFile) return;

    const fd = new FormData();
    fd.append('avatar', avatarFile);

    try {
      const d = await api('/profile/avatar', {
        method: 'POST',
        body: fd
      });

      const next = { ...session, user: d.user };
      setSession(next);
      sessionStorage.setItem('sisfo-session', JSON.stringify(next));
      setAvatarFile(null);
      notify('Foto profil diperbarui.');
      await load();
    } catch (err) {
      notify(err.message);
    }
  }

  async function removePost(p) {
    if (!confirm(
      `Hapus ${p.type === 'task' ? 'penugasan' : 'informasi'} “${p.title}”? Tindakan ini tidak dapat dibatalkan.`
    )) return;

    try {
      await api(`/posts/${p.id}`, { method: 'DELETE' });
      setSelected(null);
      await load();
      notify('Publikasi berhasil dihapus.');
    } catch (e) {
      notify(e.message);
    }
  }

  async function removeUser(u) {
    if (!confirm(
      `Hapus akun ${u.name} (@${u.username})? Publikasi yang dibuat akun ini juga akan dihapus.`
    )) return;

    try {
      await api(`/users/${u.id}`, { method: 'DELETE' });
      await load();
      notify('Akun anggota berhasil dihapus.');
    } catch (e) {
      notify(e.message);
    }
  }

  async function readPost(p) {
    try {
      await api(`/posts/${p.id}/read`, { method: 'POST' });
      await load();

      if (selected?.id === p.id) {
        setSelected({ ...selected, my_read_at: new Date().toISOString() });
      }

      notify('Konfirmasi sudah membaca berhasil dicatat.');
    } catch (e) {
      notify(e.message);
    }
  }

  async function openPost(p) {
    try {
      const d = await api(`/posts/${p.id}`);

      setSelected({
        ...d.post,
        comments: d.comments || [],
        attachments: d.attachments || [],
        readers: d.readers || []
      });
    } catch (e) {
      notify(e.message);
    }
  }

  function insertMention() {
    if (!mentionTarget) return;

    setComment(prev =>
      `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}@${mentionTarget} `
    );

    setMentionTarget('');
  }

  async function sendComment(e) {
    e.preventDefault();

    if (!selected || !comment.trim()) return;

    try {
      await api(`/posts/${selected.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: comment })
      });

      const d = await api(`/posts/${selected.id}`);

      setSelected({
        ...d.post,
        comments: d.comments || []
      });

      setComment('');
      await load();
    } catch (e) {
      notify(e.message);
    }
  }

  async function saveProfile(e) {
    e.preventDefault();

    try {
      const d = await api('/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: profileName,
          username: profileUsername
        })
      });

      const next = { ...session, user: d.user };

      setSession(next);
      sessionStorage.setItem('sisfo-session', JSON.stringify(next));
      notify('Profil berhasil diperbarui.');
    } catch (e) {
      notify(e.message);
    }
  }

  async function savePassword(e) {
    e.preventDefault();

    try {
      const d = await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      setCurrentPassword('');
      setNewPassword('');
      notify(d.message);
    } catch (e) {
      notify(e.message);
    }
  }

  async function createUser(e) {
    e.preventDefault();

    try {
      const fd = new FormData();
      fd.append('name', newName);
      fd.append('username', newUsername);
      fd.append('password', newUserPassword);

      if (newUserAvatar) fd.append('avatar', newUserAvatar);

      await api('/users', { method: 'POST', body: fd });

      setNewName('');
      setNewUsername('');
      setNewUserPassword('');
      setNewUserAvatar(null);

      await load();
      notify('Akun anggota berhasil dibuat.');
    } catch (e) {
      notify(e.message);
    }
  }

  if (!session?.token) return <Login onLogin={login} />;

  return (
    <div className="app">
      <header className="top">
        <div className="top-inner">
          <div className="brand">
            <img src="/logo-rsb.png" alt="Logo" />
            <div>
              <b>Sisfo Hub</b>
              <small>RS Santo Borromeus</small>
            </div>
          </div>

          <div className="top-right">
            <span className="user-chip">
              <Avatar name={user?.name} url={user?.avatar_url} />
              <span>
                <b>{user?.name}</b>
                <small>{admin ? 'Administrator' : 'Anggota Sisfo'}</small>
              </span>
            </span>

            <button
              className="bell"
              aria-label="Notifikasi"
              onClick={() => setPage('notifications')}
            >
              <Bell size={19} />
              {dashboard.unreadNotifications > 0 && <i />}
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="heading">
          <div>
            <div className="date">RUANG KERJA INTERNAL · SISFO</div>
            <h1>
              {page === 'home'
                ? `Halo, ${(user?.name || '').split(' ')[0]}.`
                : nav.find(n => n[0] === page)?.[1] || 'Sisfo Hub'}
            </h1>
            <p>
              {page === 'home'
                ? 'Informasi dan penugasan terbaru tim Sisfo.'
                : page === 'tasks'
                ? 'Pantau penugasan dan tindak lanjut tim.'
                : page === 'users'
                ? 'Kelola akun yang dapat mengakses Sisfo Hub.'
                : page === 'profile'
                ? 'Perbarui informasi akun dan keamanan login.'
                : 'Pantau pembaruan di ruang kerja Sisfo.'}
            </p>
          </div>

          <button
            className="create desktop"
            onClick={() => {
              setEditing(null);
              setSelectedFiles([]);
              setKind('info');
              setTitle('');
              setBody('');
              setDue('');
              setScheduledAt('');
              setCompose(true);
            }}
          >
            <Plus size={17} /> Buat publikasi
          </button>
        </div>

        {page === 'home' && (
          <div className="stats">
            <div>
              <span>Belum dibaca <Eye size={16} /></span>
              <strong>{String(dashboard.unread || 0).padStart(2, '0')}</strong>
              <small>Menunggu konfirmasi</small>
            </div>
            <div>
              <span>Penugasan aktif <ClipboardList size={16} /></span>
              <strong>{String(dashboard.activeTasks || 0).padStart(2, '0')}</strong>
              <small>Belum selesai</small>
            </div>
            <div>
              <span>Notifikasi baru <Bell size={16} /></span>
              <strong>{String(dashboard.unreadNotifications || 0).padStart(2, '0')}</strong>
              <small>Perlu diperiksa</small>
            </div>
          </div>
        )}

        {(page === 'home' || page === 'tasks') && (
          <>
            <div className="toolbar">
              <div className="section-title">
                <h2>{page === 'tasks' ? 'Daftar penugasan' : 'Informasi & Penugasan'}</h2>
                <span>{visible.length} item</span>
              </div>

              <div className="search">
                <Search size={16} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cari judul, isi, atau pembuat..."
                />
                <button
                  aria-label="Bersihkan pencarian"
                  onClick={() => setSearch('')}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="filters">
              {['Semua', 'Informasi', 'Penugasan', 'Belum dibaca'].map(f => (
                <button
                  key={f}
                  className={filter === f ? 'active' : ''}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
              <button className="refresh" onClick={load}>
                <RefreshCw size={13} /> Muat ulang
              </button>
            </div>

            <div className="posts">
              {visible.map(p => (
                <article className="post" key={p.id}>
                  <div className={`accent ${p.type}`} />
                  <div className="post-inner">
                    <div className="post-top">
                      <span className={`type ${p.type}`}>
                        {p.type === 'task'
                          ? <ClipboardList size={14} />
                          : <MessageSquare size={14} />}
                        {p.type === 'task' ? 'Penugasan' : 'Informasi'}
                      </span>

                      <time>{dateText(p.published_at || p.created_at)}</time>

                      {Number(p.author_id) === Number(user.id) && (
                        <button
                          className="icon-btn"
                          title="Edit publikasi"
                          onClick={() => editPost(p)}
                        >
                          <Settings size={16} />
                        </button>
                      )}

                      {admin && (
                        <button
                          className="icon-btn danger"
                          title="Hapus publikasi"
                          onClick={() => removePost(p)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    <button className="post-title" onClick={() => openPost(p)}>
                      {p.title}
                    </button>

                    <p className="body">{renderBody(p.body)}</p>

                    <div className="post-foot">
                      <div className="meta">
                        <span>
                          <Avatar name={p.author_name || 'Pengguna'} url={p.author_avatar} />
                          {p.author_name || 'Pengguna'}
                        </span>

                        {p.type === 'info' && p.due_date && (
                          <span>
                            <CalendarDays size={14} />
                            Pelaksanaan: {dateText(p.due_date)}
                          </span>
                        )}

                        {p.type === 'task' && p.due_date && (
                          <span>
                            <CalendarDays size={14} />
                            Deadline: {dateText(p.due_date)}
                          </span>
                        )}

                        {p.type === 'task' && (
                          <span className={`status ${p.status}`}>
                            <Clock3 size={13} /> {statusText(p.status)}
                          </span>
                        )}
                      </div>

                      <div className="actions">
                        <button className="comment-link" onClick={() => openPost(p)}>
                          <MessageSquare size={14} /> {p.comment_count || 0} komentar
                        </button>

                        {Number(p.author_id) !== Number(user.id) && !p.my_read_at
                          ? (
                            <button onClick={() => readPost(p)}>
                              <CheckCircle2 size={14} /> Saya sudah membaca
                            </button>
                          )
                          : (
                            <span className="read">
                              <CheckCircle2 size={15} />
                              {Number(p.author_id) === Number(user.id)
                                ? 'Dibuat oleh saya'
                                : 'Sudah dibaca'}
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}

              {!visible.length && (
                <div className="empty">
                  <Search size={24} />
                  <h3>Belum ada publikasi</h3>
                  <p>Informasi atau penugasan yang sesuai pencarian akan tampil di sini.</p>
                  <button className="create" onClick={() => setCompose(true)}>
                    <Plus size={15} /> Buat publikasi
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {page === 'profile' && (
          <div className="profile-layout">
            <section className="panel profile-summary">
              <Avatar name={user?.name} url={user?.avatar_url} className="avatar" />
              <div>
                <h2>{user?.name}</h2>
                <p>@{user?.username}</p>
                <span className="role-pill">
                  <ShieldCheck size={13} />
                  {admin ? 'Administrator' : 'Anggota Sisfo'}
                </span>
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Foto profil</h2>
                  <p>Foto akan terlihat pada informasi, penugasan, dan komentar yang kamu buat.</p>
                </div>
              </div>

              <form className="form-grid" onSubmit={saveAvatar}>
                <label>
                  Pilih foto (JPG/PNG/WEBP, maks. 3 MB)
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={e => setAvatarFile(e.target.files?.[0] || null)}
                    required
                  />
                </label>
                <div className="form-actions">
                  <button className="create" disabled={!avatarFile}>Simpan foto</button>
                </div>
              </form>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Informasi profil</h2>
                  <p>Nama dan username yang digunakan untuk masuk.</p>
                </div>
              </div>

              <form className="form-grid" onSubmit={saveProfile}>
                <label>
                  Nama lengkap
                  <input
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Username
                  <input
                    value={profileUsername}
                    onChange={e => setProfileUsername(e.target.value)}
                    required
                  />
                </label>
                <div className="form-actions">
                  <button className="create">Simpan profil</button>
                </div>
              </form>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Keamanan akun</h2>
                  <p>Gunakan password minimal 8 karakter.</p>
                </div>
                <LockKeyhole size={19} />
              </div>

              <form className="form-grid" onSubmit={savePassword}>
                <label>
                  Password saat ini
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Password baru
                  <input
                    type="password"
                    minLength="8"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                  />
                </label>
                <div className="form-actions">
                  <button className="create">Ubah password</button>
                </div>
              </form>
            </section>

            <button className="logout-btn" onClick={logout}>
              <LogOut size={16} /> Keluar dari akun
            </button>
          </div>
        )}

        {page === 'members' && (
          <section className="panel users-panel">
            <div className="panel-heading">
              <div>
                <h2>Anggota Unit Sisfo</h2>
                <p>{users.length} pengguna aktif · Semua anggota dapat melihat daftar ini.</p>
              </div>
              <button className="subtle-btn" onClick={load}>
                <RefreshCw size={14} /> Perbarui
              </button>
            </div>

            <div className="member-grid">
              {users.map(u => (
                <div className="member-card" key={u.id}>
                  <Avatar name={u.name} url={u.avatar_url} className="member-avatar" />
                  <div>
                    <b>{u.name}</b>
                    <small>@{u.username}</small>
                    <span>{u.role === 'admin' ? 'Administrator' : 'Anggota Sisfo'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {page === 'users' && admin && (
          <>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Buat akun anggota</h2>
                  <p>Hanya admin yang dapat membuat akun baru. Semua akun baru memiliki hak akses anggota.</p>
                </div>
                <Users size={20} />
              </div>

              <form className="form-grid three" onSubmit={createUser}>
                <label>
                  Nama lengkap
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Nama anggota"
                    required
                  />
                </label>
                <label>
                  Username
                  <input
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value)}
                    placeholder="username"
                    required
                  />
                </label>
                <label>
                  Password awal
                  <input
                    type="password"
                    minLength="8"
                    value={newUserPassword}
                    onChange={e => setNewUserPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    required
                  />
                </label>
                <label>
                  Foto profil (opsional)
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={e => setNewUserAvatar(e.target.files?.[0] || null)}
                  />
                </label>
                <div className="form-actions">
                  <button className="create">
                    <Plus size={15} /> Buat akun
                  </button>
                </div>
              </form>
            </section>

            <section className="panel users-panel">
              <div className="panel-heading">
                <div>
                  <h2>Daftar anggota</h2>
                  <p>{users.length} akun terdaftar</p>
                </div>
                <button className="subtle-btn" onClick={load}>
                  <RefreshCw size={14} /> Perbarui
                </button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Pengguna</th>
                      <th>Username</th>
                      <th>Status</th>
                      <th>Bergabung</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div className="user-cell">
                            <Avatar name={u.name} url={u.avatar_url} />
                            <span>
                              <b>{u.name}</b>
                              <small>{u.role === 'admin' ? 'Administrator' : 'Anggota Sisfo'}</small>
                            </span>
                          </div>
                        </td>
                        <td>@{u.username}</td>
                        <td>
                          <span className={`state ${Number(u.is_active) ? 'active' : 'inactive'}`}>
                            {Number(u.is_active) ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td>{dateText(u.created_at)}</td>
                        <td>
                          {Number(u.id) !== Number(user.id) && u.role !== 'admin'
                            ? (
                              <button
                                className="icon-btn danger"
                                title={`Hapus ${u.name}`}
                                onClick={() => removeUser(u)}
                              >
                                <Trash2 size={16} />
                              </button>
                            )
                            : <span className="muted">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {page === 'notifications' && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Notifikasi</h2>
                <p>Informasi dan penugasan yang dibagikan ke akunmu.</p>
              </div>
              <button
                className="subtle-btn"
                onClick={async () => {
                  try {
                    await api('/notifications/read-all', { method: 'PATCH' });
                    await load();
                    notify('Semua notifikasi ditandai dibaca.');
                  } catch (e) {
                    notify(e.message);
                  }
                }}
              >
                Tandai dibaca
              </button>
            </div>

            <div className="notification-list">
              {notifications.map(n => (
                <button
                  className={`notification ${Number(n.is_read) ? '' : 'unread'}`}
                  key={n.id}
                  onClick={() => {
                    const p = posts.find(x => Number(x.id) === Number(n.post_id));
                    if (p) openPost(p);
                    else setPage('home');
                  }}
                >
                  <span className="notification-icon"><Bell size={17} /></span>
                  <span>
                    <b>{n.title}</b>
                    <small>{n.message}</small>
                    <time>{dateText(n.created_at)}</time>
                  </span>
                  {!Number(n.is_read) && <i />}
                </button>
              ))}

              {!notifications.length && (
                <div className="empty">
                  <Bell size={24} />
                  <h3>Belum ada notifikasi</h3>
                  <p>Notifikasi baru akan muncul saat ada informasi atau penugasan.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {page === 'history' && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Riwayat aktivitas</h2>
                <p>Aktivitas terbaru di Sisfo Hub.</p>
              </div>
              <button className="subtle-btn" onClick={load}>
                <RefreshCw size={14} /> Perbarui
              </button>
            </div>

            <div className="activity-list">
              {activity.map(a => (
                <div className="activity-row" key={a.id}>
                  <span className="activity-dot" />
                  <div>
                    <b>{a.user_name || 'Pengguna'}</b>
                    <p>
                      {a.description || a.action}
                      {a.post_title ? ` · ${a.post_title}` : ''}
                    </p>
                    <time>{dateText(a.created_at)}</time>
                  </div>
                </div>
              ))}

              {!activity.length && (
                <div className="empty">
                  <History size={24} />
                  <h3>Riwayat kosong</h3>
                  <p>Aktivitas akan tercatat di sini.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <button
        className="mobile-add"
        aria-label="Buat publikasi"
        onClick={() => {
          setEditing(null);
          setSelectedFiles([]);
          setKind('info');
          setTitle('');
          setBody('');
          setDue('');
          setScheduledAt('');
          setRecipientMode('all');
          setRecipientIds([]);
          setRecipientSearch('');
          setCompose(true);
        }}
      >
        <Plus size={23} />
      </button>

      <nav className="nav">
        {nav.map(([id, label, Icon]) => (
          <button
            className={page === id ? 'current' : ''}
            key={id}
            onClick={() => {
              setPage(id);
              setFilter('Semua');
              if (id === 'history') load();
            }}
          >
            <Icon size={19} />
            <span>{label}</span>
            {id === 'notifications' && dashboard.unreadNotifications > 0 && <i />}
          </button>
        ))}
      </nav>

      {compose && (
        <div
          className="shade"
          onMouseDown={e => e.target === e.currentTarget && setCompose(false)}
        >
          <form className="modal" onSubmit={publish}>
            <div className="modal-head">
              <div>
                <small>RUANG SISFO</small>
                <h2>{editing ? 'Edit publikasi' : 'Buat publikasi'}</h2>
              </div>
              <button
                type="button"
                className="close"
                onClick={() => {
                  setCompose(false);
                  setEditing(null);
                  setSelectedFiles([]);
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="switch">
              {[
                ['info', 'Informasi'],
                ['task', 'Penugasan']
              ].map(([k, v]) => (
                <button
                  type="button"
                  className={kind === k ? 'on' : ''}
                  onClick={() => setKind(k)}
                  key={k}
                >
                  {v}
                </button>
              ))}
            </div>

            <label>Judul</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Contoh: Pemeliharaan perangkat"
              maxLength="200"
              required
            />

            <label>Detail informasi atau tautan</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows="4"
              placeholder="Tuliskan informasi atau instruksi dengan jelas..."
              required
            />

            <label>
              Lampiran (PDF, Word, atau gambar; maksimal 5 file, masing-masing 10 MB)
            </label>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,image/jpeg,image/png,image/gif,image/webp"
              onChange={e =>
                setSelectedFiles(Array.from(e.target.files || []).slice(0, 5))
              }
            />

            {selectedFiles.length > 0 && (
              <p className="note">
                {selectedFiles.map(f => f.name).join(', ')}
              </p>
            )}

            <label>Prioritas</label>
            <select value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="low">Rendah</option>
              <option value="medium">Normal</option>
              <option value="high">Tinggi</option>
            </select>

            {kind === 'info' && (
              <>
                <label>Tanggal dan jam pelaksanaan (opsional)</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                />
                <p className="note">
                  Isi untuk jadwal rapat, kegiatan, sosialisasi, atau pelaksanaan lainnya.
                </p>
              </>
            )}

            {kind === 'task' && (
              <>
                <label>Deadline penugasan (opsional)</label>
                <input
                  type="datetime-local"
                  value={due}
                  onChange={e => setDue(e.target.value)}
                />
                <p className="note">
                  Tentukan tanggal dan jam maksimal penyelesaian tugas.
                </p>
              </>
            )}

            <div className="recipient-section">
              <label>Publikasi ditujukan kepada</label>

              <div className="switch recipient-switch">
                {[
                  ['all', 'Semua anggota'],
                  ['selected', 'Anggota tertentu']
                ].map(([v, label]) => (
                  <button
                    type="button"
                    key={v}
                    className={recipientMode === v ? 'on' : ''}
                    onClick={() => {
                      setRecipientMode(v);
                      setRecipientSearch('');
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {recipientMode === 'selected' && (
                <div className="recipient-picker-wrap">
                  {/* Kolom pencarian saja, tanpa daftar anggota awal */}
                  <div className="recipient-search">
                    <Search size={18} />

                    <input
                      type="text"
                      value={recipientSearch}
                      onChange={e => setRecipientSearch(e.target.value)}
                      placeholder="Cari nama atau username anggota..."
                      aria-label="Cari anggota penerima"
                    />

                    {recipientSearch && (
                      <button
                        type="button"
                        className="recipient-search-clear"
                        onClick={() => setRecipientSearch('')}
                        aria-label="Hapus pencarian"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* Chip anggota yang telah dipilih */}
                  {recipientIds.length > 0 && (
                    <div className="recipient-selected">
                      <div className="recipient-selected-heading">
                        <span>Anggota terpilih</span>
                        <span className="recipient-count">
                          {recipientIds.length} anggota
                        </span>
                      </div>

                      <div className="recipient-chips">
                        {users
                          .filter(u => recipientIds.includes(Number(u.id)))
                          .map(u => (
                            <span className="recipient-chip" key={u.id}>
                              {u.name}

                              <button
                                type="button"
                                onClick={() =>
                                  setRecipientIds(prev =>
                                    prev.filter(id => id !== Number(u.id))
                                  )
                                }
                                aria-label={`Hapus ${u.name} dari penerima`}
                              >
                                <X size={13} />
                              </button>
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Hasil hanya muncul jika pengguna mulai mengetik */}
                  {recipientSearch.trim() && (
                    <div className="recipient-picker">
                      {users
                        .filter(u => Number(u.id) !== Number(user.id))
                        .filter(u =>
                          `${u.name || ''} ${u.username || ''}`
                            .toLowerCase()
                            .includes(recipientSearch.trim().toLowerCase())
                        )
                        .map(u => (
                          <label className="recipient-option" key={u.id}>
                            <input
                              type="checkbox"
                              checked={recipientIds.includes(Number(u.id))}
                              onChange={e =>
                                setRecipientIds(prev =>
                                  e.target.checked
                                    ? [...prev, Number(u.id)]
                                    : prev.filter(id => id !== Number(u.id))
                                )
                              }
                            />

                            <span className="recipient-option-info">
                              <strong>{u.name}</strong>
                              <small>@{u.username}</small>
                            </span>

                            {recipientIds.includes(Number(u.id)) && (
                              <CheckCircle2
                                className="recipient-check"
                                size={18}
                              />
                            )}
                          </label>
                        ))}

                      {users.filter(u =>
                        Number(u.id) !== Number(user.id) &&
                        `${u.name || ''} ${u.username || ''}`
                          .toLowerCase()
                          .includes(recipientSearch.trim().toLowerCase())
                      ).length === 0 && (
                        <div className="recipient-empty">
                          <Search size={20} />
                          <span>Anggota tidak ditemukan.</span>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="note">
                    Ketik nama atau username untuk mencari anggota.
                    Hanya anggota yang dipilih yang menjadi penerima publikasi.
                  </p>
                </div>
              )}
            </div>

            <p className="note">
              Nama pembuat dan waktu publikasi tercatat otomatis.
            </p>

            <button className="create submit" disabled={busy}>
              {busy
                ? 'Menyimpan...'
                : editing
                ? 'Simpan perubahan'
                : 'Publikasikan'}
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      )}

      {selected && (
        <div
          className="shade"
          onMouseDown={e => e.target === e.currentTarget && setSelected(null)}
        >
          <section className="modal detail-modal">
            <div className="modal-head">
              <div>
                <small>
                  {selected.type === 'task' ? 'PENUGASAN' : 'INFORMASI'} ·
                  {' '}{dateText(selected.published_at || selected.created_at)}
                </small>
                <h2>{selected.title}</h2>
              </div>
              <button
                type="button"
                className="close"
                onClick={() => setSelected(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="detail-meta">
              <span>
                <Avatar name={selected.author_name} url={selected.author_avatar} />
                <b>{selected.author_name}</b>
              </span>
              <span>
                Dipublikasikan {dateText(selected.published_at || selected.created_at)}
              </span>
            </div>

            <p className="detail-body">{renderBody(selected.body)}</p>

            {selected.attachments?.length > 0 && (
              <div className="attachment-list">
                <h3>Lampiran</h3>
                {selected.attachments.map(a => (
                  <a
                    key={a.id}
                    href={avatarUrl(a.file_url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {a.original_name} · {(a.file_size / 1024).toFixed(0)} KB
                  </a>
                ))}
              </div>
            )}

            <div className="detail-meta">
              {selected.type === 'info' && selected.due_date && (
                <span>
                  <CalendarDays size={15} />
                  Pelaksanaan: {dateText(selected.due_date)}
                </span>
              )}
              {selected.type === 'task' && selected.due_date && (
                <span>
                  <CalendarDays size={15} />
                  Deadline: {dateText(selected.due_date)}
                </span>
              )}
            </div>

            {selected.type === 'task' && (
              <div className="task-status">
                <b>Status: {statusText(selected.status)}</b>

                {Number(selected.author_id) === Number(user.id) && (
                  <select
                    value={selected.status}
                    onChange={async e => {
                      try {
                        await api(`/posts/${selected.id}/status`, {
                          method: 'PATCH',
                          body: JSON.stringify({ status: e.target.value })
                        });
                        await openPost(selected);
                        await load();
                        notify('Status penugasan diperbarui.');
                      } catch (err) {
                        notify(err.message);
                      }
                    }}
                  >
                    <option value="pending">Belum dikerjakan</option>
                    <option value="in_progress">Sedang dikerjakan</option>
                    <option value="completed">Selesai</option>
                  </select>
                )}
              </div>
            )}

            {(admin || Number(selected.author_id) === Number(user.id)) && (
              <div className="readers-area">
                <h3>
                  Siapa yang sudah membaca ({
                    (selected.readers || []).filter(r => r.read_at).length
                  })
                </h3>

                <div className="reader-list">
                  {(selected.readers || []).map(r => (
                    <span
                      key={r.id}
                      className={r.read_at ? 'reader-done' : 'reader-pending'}
                    >
                      <Avatar name={r.name} url={r.avatar_url} />
                      <span>
                        {r.name} — {r.read_at
                          ? `Dibaca ${dateText(r.read_at)}`
                          : 'Belum membaca'}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="comments-area">
              <h3>
                <MessageSquare size={16} /> Komentar ({selected.comments?.length || 0})
              </h3>

              {selected.comments?.map(c => (
                <div className="comment" key={c.id}>
                  <Avatar name={c.user_name} url={c.user_avatar} />
                  <div>
                    <b>{c.user_name}</b>
                    <time>{dateText(c.created_at)}</time>
                    <p>{c.body}</p>
                  </div>
                </div>
              ))}

              <div className="mention-tools">
                <select
                  aria-label="Pilih anggota untuk ditandai"
                  value={mentionTarget}
                  onChange={e => setMentionTarget(e.target.value)}
                >
                  <option value="">Tag anggota (@username)</option>
                  {users
                    .filter(u => Number(u.id) !== Number(user.id))
                    .map(u => (
                      <option key={u.id} value={u.username}>
                        {u.name} (@{u.username})
                      </option>
                    ))}
                </select>

                <button
                  type="button"
                  className="subtle-btn"
                  onClick={insertMention}
                  disabled={!mentionTarget}
                >
                  Sisipkan @
                </button>
              </div>

              <form className="comment-form" onSubmit={sendComment}>
                <input
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Tulis komentar atau ketik @username..."
                  required
                />
                <button className="create" aria-label="Kirim komentar">
                  <Send size={16} />
                </button>
              </form>

              <p className="note">
                Pilih anggota di atas atau ketik @username. Anggota yang disebut
                akan menerima notifikasi.
              </p>
            </div>

            {Number(selected.author_id) !== Number(user.id) && (
              <button className="read-confirm" onClick={() => readPost(selected)}>
                <CheckCircle2 size={16} /> Saya sudah membaca informasi ini
              </button>
            )}

            {Number(selected.author_id) === Number(user.id) && (
              <button className="read-confirm" onClick={() => editPost(selected)}>
                <Settings size={15} /> Edit publikasi
              </button>
            )}

            {admin && (
              <button
                className="delete-detail"
                onClick={() => removePost(selected)}
              >
                <Trash2 size={15} /> Hapus publikasi
              </button>
            )}
          </section>
        </div>
      )}

      {toast && (
        <div className="toast">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
