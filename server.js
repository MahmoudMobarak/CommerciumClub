#!/usr/bin/env node
/**
 * Commercium site server
 * Zero dependencies — runs with plain Node.js.
 *
 *   node server.js            (serves on http://localhost:4173)
 *   PORT=8080 node server.js  (custom port)
 *
 * First run creates data/credentials.json with default login:
 *   username: admin
 *   password: commercium2026   (change it from the admin Settings tab!)
 *
 * Content lives in data/db.json and uploaded images in data/uploads/.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 4173;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const CREDS_FILE = path.join(DATA_DIR, 'credentials.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

/* ------------------------------------------------------------------ */
/*  Storage helpers                                                    */
/* ------------------------------------------------------------------ */

let db = null;
function loadDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { db = null; }
  }
  if (!db || typeof db !== 'object') {
    db = seedDb();
    saveDb();
  }
}
function saveDb() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
  // keep the offline fallback snapshot in sync so double-clicking index.html
  // shows the latest content even without the server running
  try {
    const fallback = '/* Commercium embedded data (fallback when no server) */\nwindow.COMMERCIUM_DATA = ' +
      JSON.stringify(db) + ';\n';
    fs.writeFileSync(path.join(ROOT, 'assets', 'js', 'data.js'), fallback);
  } catch (e) { /* non-fatal */ }
}

/* ------------------------------------------------------------------ */
/*  Credentials (scrypt hash)                                          */
/* ------------------------------------------------------------------ */

let creds = null;
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}
function loadCredentials() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(CREDS_FILE)) {
    try { creds = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8')); } catch (e) { creds = null; }
  }
  if (!creds || !creds.salt || !creds.hash) {
    const salt = crypto.randomBytes(16).toString('hex');
    creds = {
      username: 'admin',
      salt,
      hash: hashPassword('commercium2026', salt),
      created: new Date().toISOString()
    };
    fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2));
    console.log('Created default admin credentials: admin / commercium2026');
    console.log('  >>> Change the password from the admin Settings tab. <<<');
  }
}
function verifyPassword(password) {
  const hash = hashPassword(password, creds.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(creds.hash, 'hex'));
}

/* ------------------------------------------------------------------ */
/*  Sessions (in-memory, HMAC-signed cookie)                           */
/* ------------------------------------------------------------------ */

const SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const sessions = new Map(); // token -> { username, expires }
const SESSION_TTL = 1000 * 60 * 60 * 12; // 12h

function createSession() {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { username: creds.username, expires: Date.now() + SESSION_TTL });
  return token;
}
function getSession(req) {
  const header = req.headers.cookie || '';
  const m = header.match(/(?:^|;\s*)commercium_session=([^;]+)/);
  if (!m) return null;
  const token = m[1];
  const s = sessions.get(token);
  if (!s) return null;
  if (s.expires < Date.now()) { sessions.delete(token); return null; }
  return s;
}

/* ------------------------------------------------------------------ */
/*  HTTP helpers                                                       */
/* ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req, limit = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/* ------------------------------------------------------------------ */
/*  Routing                                                            */
/* ------------------------------------------------------------------ */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  const method = req.method;

  try {
    /* ---- API: public ---- */
    if (pathname === '/api/data' && method === 'GET') {
      return sendJson(res, 200, db);
    }

    /* ---- API: auth ---- */
    if (pathname === '/api/login' && method === 'POST') {
      const body = JSON.parse(await readBody(req, 1024 * 1024));
      if (!verifyPassword(String(body.password || '')) || String(body.username || '') !== creds.username) {
        return sendJson(res, 401, { error: 'Invalid username or password.' });
      }
      const token = createSession();
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': `commercium_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL / 1000}`
      });
      return res.end(JSON.stringify({ ok: true, username: creds.username }));
    }

    if (pathname === '/api/logout' && method === 'POST') {
      const s = getSession(req);
      if (s) {
        const header = req.headers.cookie || '';
        const m = header.match(/(?:^|;\s*)commercium_session=([^;]+)/);
        if (m) sessions.delete(m[1]);
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': 'commercium_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'
      });
      return res.end(JSON.stringify({ ok: true }));
    }

    if (pathname === '/api/me' && method === 'GET') {
      const s = getSession(req);
      return s ? sendJson(res, 200, { username: s.username }) : sendJson(res, 401, { error: 'Not logged in.' });
    }

    /* ---- API: admin ---- */
    if (pathname.startsWith('/api/')) {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { error: 'Authentication required.' });
      return await handleAdmin(req, res, pathname, method, s);
    }

    /* ---- Static files ---- */
    return serveStatic(req, res, pathname);
  } catch (err) {
    return sendJson(res, 500, { error: String(err && err.message || err) });
  }
});

/* ------------------------------------------------------------------ */
/*  Admin API                                                          */
/* ------------------------------------------------------------------ */

async function handleAdmin(req, res, pathname, method) {
  // account management
  if (pathname === '/api/admin/account' && method === 'PUT') {
    const body = JSON.parse(await readBody(req));
    if (!verifyPassword(String(body.currentPassword || ''))) {
      return sendJson(res, 400, { error: 'Current password is incorrect.' });
    }
    if (body.username) creds.username = String(body.username).trim() || creds.username;
    if (body.newPassword && String(body.newPassword).length >= 6) {
      creds.salt = crypto.randomBytes(16).toString('hex');
      creds.hash = hashPassword(String(body.newPassword), creds.salt);
    }
    fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2));
    return sendJson(res, 200, { ok: true });
  }

  // site settings
  if (pathname === '/api/admin/site' && method === 'PUT') {
    const body = JSON.parse(await readBody(req));
    const allowed = ['heroTitle', 'heroSubtitle', 'aboutTitle', 'aboutText', 'aboutGoal', 'contactEmail', 'instagram'];
    allowed.forEach((k) => { if (typeof body[k] === 'string') db.site[k] = body[k]; });
    saveDb();
    return sendJson(res, 200, { ok: true, site: db.site });
  }

  // photo upload
  if (pathname === '/api/admin/upload' && method === 'POST') {
    const body = JSON.parse(await readBody(req, 25 * 1024 * 1024));
    const dataUrl = String(body.dataUrl || '');
    const m = dataUrl.match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/);
    if (!m) return sendJson(res, 400, { error: 'Please provide a valid image (PNG, JPG, WEBP or GIF).' });
    const ext = m[1] === 'image/jpeg' ? '.jpg' : m[1].replace('image/', '.');
    const name = 'u-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext;
    fs.writeFileSync(path.join(UPLOADS_DIR, name), Buffer.from(m[2], 'base64'));
    return sendJson(res, 200, { ok: true, path: '/uploads/' + name });
  }

  // gallery reorder
  let m2 = pathname.match(/^\/api\/admin\/gallery\/([^/]+)\/move$/);
  if (m2 && method === 'POST') {
    const body = JSON.parse(await readBody(req));
    const id = m2[1];
    const idx = db.gallery.findIndex((g) => g.id === id);
    if (idx < 0) return sendJson(res, 404, { error: 'Not found.' });
    const dir = body.dir === 'up' ? -1 : 1;
    const swap = idx + dir;
    if (swap < 0 || swap >= db.gallery.length) return sendJson(res, 200, { ok: true });
    const t = db.gallery[idx]; db.gallery[idx] = db.gallery[swap]; db.gallery[swap] = t;
    saveDb();
    return sendJson(res, 200, { ok: true });
  }

  // CRUD on collections
  const collections = ['events', 'posts', 'announcements', 'articles', 'achievements', 'gallery'];
  const m = pathname.match(/^\/api\/admin\/(events|posts|announcements|articles|achievements|gallery)(?:\/([^/]+))?$/);
  if (m) {
    const coll = m[1];
    const id = m[2];
    if (!id && method === 'POST') {
      const body = JSON.parse(await readBody(req));
      let item;
      if (coll === 'gallery') {
        if (!body.src || !body.alt) return sendJson(res, 400, { error: 'Gallery items need a src and alt.' });
        item = { id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), src: body.src, alt: body.alt, caption: body.caption || '' };
        db.gallery.push(item);
      } else {
        if (typeof body !== 'object' || body === null) return sendJson(res, 400, { error: 'Invalid payload.' });
        item = { id: coll.slice(0, 1) + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...body };
        db[coll].unshift(item);
      }
      saveDb();
      return sendJson(res, 200, { ok: true, item });
    }
    if (id && method === 'PUT') {
      const body = JSON.parse(await readBody(req));
      const item = db[coll].find((x) => x.id === id);
      if (!item) return sendJson(res, 404, { error: 'Not found.' });
      Object.assign(item, body);
      saveDb();
      return sendJson(res, 200, { ok: true, item });
    }
    if (id && method === 'DELETE') {
      const before = db[coll].length;
      db[coll] = db[coll].filter((x) => x.id !== id);
      if (db[coll].length === before) return sendJson(res, 404, { error: 'Not found.' });
      saveDb();
      return sendJson(res, 200, { ok: true });
    }
  }

  return sendJson(res, 404, { error: 'Unknown admin route.' });
}

/* ------------------------------------------------------------------ */
/*  Static files                                                       */
/* ------------------------------------------------------------------ */

function serveStatic(req, res, pathname) {
  // directory-ish root paths map to index.html
  let file = pathname === '/' ? '/index.html' : pathname;
  const safe = path.normalize(file).replace(/^(\.\.[/\\])+/, '');
  let abs = path.join(ROOT, safe);
  if (!abs.startsWith(ROOT)) abs = path.join(ROOT, 'index.html');

  fs.stat(abs, (err, st) => {
    if (!err && st.isDirectory()) abs = path.join(abs, 'index.html');
    fs.readFile(abs, (err2, data) => {
      if (err2) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Not found');
      }
      const ext = path.extname(abs).toLowerCase();
      const nocache = ext === '.html' || ext === '.css' || ext === '.js';
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': nocache ? 'no-cache' : 'public, max-age=3600'
      });
      res.end(data);
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

function seedDb() {
  return {
    site: {
      heroTitle: 'Welcome to Commercium!',
      heroSubtitle: 'Join the Commerce Club and immerse yourself in the world of business and entrepreneurship.',
      aboutTitle: 'About Commercium',
      aboutText: 'Commercium is a community for students who want to explore the world of business beyond the classroom. We combine finance, entrepreneurship, and strategy through interactive events, competitions, workshops, and real-world experiences.',
      aboutGoal: "Our goal is simple: help students develop the confidence, skills, and mindset to succeed—whether that's in business, university, or wherever their ambitions take them.",
      contactEmail: 'commerciumclubtws@gmail.com',
      instagram: 'https://www.instagram.com/commercium.tws'
    },
    gallery: [
      { id: 'g1', src: 'assets/photos/photo-002.jpg', alt: 'Commercium event photo', caption: 'Market Day fun' },
      { id: 'g2', src: 'assets/photos/photo-003.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g3', src: 'assets/photos/photo-004.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g4', src: 'assets/photos/photo-005.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g5', src: 'assets/photos/photo-006.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g6', src: 'assets/photos/photo-007.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g7', src: 'assets/photos/photo-008.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g8', src: 'assets/photos/photo-009.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g9', src: 'assets/photos/photo-010.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g10', src: 'assets/photos/photo-011.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g11', src: 'assets/photos/photo-012.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g12', src: 'assets/photos/photo-013.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g13', src: 'assets/photos/photo-014.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g14', src: 'assets/photos/photo-015.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g15', src: 'assets/photos/photo-016.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g16', src: 'assets/photos/photo-017.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g17', src: 'assets/photos/photo-018.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g18', src: 'assets/photos/photo-019.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g19', src: 'assets/photos/photo-020.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g20', src: 'assets/photos/photo-021.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g21', src: 'assets/photos/photo-022.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g22', src: 'assets/photos/photo-023.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g23', src: 'assets/photos/photo-024.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g24', src: 'assets/photos/photo-025.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g25', src: 'assets/photos/photo-026.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g26', src: 'assets/photos/photo-027.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g27', src: 'assets/photos/photo-028.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g28', src: 'assets/photos/photo-029.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g29', src: 'assets/photos/photo-030.jpg', alt: 'Commercium event photo', caption: '' },
      { id: 'g30', src: 'assets/photos/photo-031.jpg', alt: 'Commercium event photo', caption: '' }
    ],
    events: [
      { id: 'e1', title: 'Annual Commerce Gala Night', date: '2026-07-29', time: '19:00', location: 'Commerce Auditorium', description: 'Dress to impress and enjoy a formal evening with fellow commerce enthusiasts. Keynote speeches will highlight the evening.' },
      { id: 'e2', title: 'Negotiation Skills Workshop', date: '2026-07-29', time: '15:00', location: 'Meeting Room A', description: 'Learn the art of negotiation with interactive sessions to enhance your skills and techniques in negotiating deals.' },
      { id: 'e3', title: 'Next Year Project Brainstorming', date: '2026-07-29', time: '13:00', location: 'Commerce Hall 101', description: 'Join us for a brainstorming session on innovative commerce project ideas for the next year. Be ready to share and collaborate.' }
    ],
    posts: [
      { id: 'p1', author: 'Commercium Club', date: '2026-06-29', group: 'Alumni Network', body: 'Welcome to our group Alumni Network! A home for former Commercium members and leaders who have graduated, moved on, or completed their time at the club but still want to stay connected. Share university experiences, career opportunities, advice for current students, and continue being part of the Commercium community.', views: 16 },
      { id: 'p2', author: 'Commercium Club', date: '2026-06-29', group: 'Public Community', body: 'Welcome to our group Public Community! This is the official community space for everyone who wants to be part of Commercium. Whether you\u2019re a commerce student, a supporter of the club, a teacher, a future member, or simply curious about what we do, this is the place to stay connected. Expect event announcements, club updates, business discussions, opportunities, and community conversations.', views: 10 }
    ],
    announcements: [
      { id: 'a1', title: 'Welcome to the new Commercium site!', date: '2026-08-12', body: 'This is where the club will post official announcements. Check back regularly for event reminders, deadlines, and club news.' }
    ],
    articles: [
      { id: 'r1', title: 'Getting Started in Business', date: '2026-08-12', author: 'Commercium Club', body: 'Every great venture starts with a single idea. This first article introduces the mindset and first steps for young entrepreneurs.' }
    ],
    achievements: [
      { id: 'h1', title: 'Market Day 2026', year: '2026', category: 'Events', description: 'Our flagship student market day — months of planning, dozens of student businesses, and a school community that showed up in force.', icon: '🏪' },
      { id: 'h2', title: 'Basics of Starting a Business Workshop', year: '2026', category: 'Workshops', description: 'Students took part in the Basics of Starting a Business workshop with Professor Stoyan Stoyanov of HW Dubai.', icon: '🎓' },
      { id: 'h3', title: 'Money Management & Budgeting', year: '2026', category: 'Workshops', description: 'Money Management & Budgeting workshop delivered in collaboration with HW Dubai.', icon: '💰' },
      { id: 'h4', title: 'Certified Entrepreneurship Modules', year: '2026', category: 'Partnerships', description: 'In collaboration with Injaz UAE, Commercium introduced certified online entrepreneurship modules focused on project management and building sustainable, socially responsible businesses.', icon: '🤝' }
    ]
  };
}

/* ------------------------------------------------------------------ */
/*  Boot                                                               */
/* ------------------------------------------------------------------ */

/* Keep the process alive even if a stray request errors */
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err && err.stack || err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err && err.stack || err);
});

loadCredentials();
loadDb();
server.listen(PORT, () => {
  console.log('Commercium site running at http://localhost:' + PORT);
});
