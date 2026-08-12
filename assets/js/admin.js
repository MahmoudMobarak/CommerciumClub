/* Commercium admin dashboard */
(function () {
  'use strict';
  const C = window.Commercium;
  let data = null;

  const COLLECTIONS = {
    events: {
      label: 'Event',
      fields: [
        { n: 'title', l: 'Title', t: 'text', req: true },
        { n: 'date', l: 'Date', t: 'date', req: true },
        { n: 'time', l: 'Time (e.g. 15:00)', t: 'time' },
        { n: 'location', l: 'Location', t: 'text' },
        { n: 'image', l: 'Photo (optional)', t: 'image', hint: 'Add a photo of the event — leave empty to show no photo.' },
        { n: 'description', l: 'Description', t: 'textarea', req: true }
      ],
      summary: function (e) { return (e.date || '') + ' · ' + (e.location || 'No location'); }
    },
    achievements: {
      label: 'Achievement',
      fields: [
        { n: 'title', l: 'Title', t: 'text', req: true },
        { n: 'year', l: 'Year', t: 'text' },
        { n: 'category', l: 'Category', t: 'text' },
        { n: 'icon', l: 'Icon (emoji)', t: 'text' },
        { n: 'image', l: 'Photo (optional)', t: 'image', hint: 'Upload a photo of the achievement — it appears at the top of the trophy card.' },
        { n: 'description', l: 'Description', t: 'textarea', req: true }
      ],
      summary: function (a) { return (a.category || '') + (a.year ? ' · ' + a.year : ''); }
    },
    posts: {
      label: 'Post',
      fields: [
        { n: 'author', l: 'Author', t: 'text', req: true },
        { n: 'date', l: 'Date', t: 'date', req: true },
        { n: 'group', l: 'Posted in group', t: 'text' },
        { n: 'views', l: 'Views', t: 'number' },
        { n: 'image', l: 'Photo (optional)', t: 'image', hint: 'Attach a photo to the post — leave empty for text only.' },
        { n: 'body', l: 'Post text', t: 'textarea', req: true }
      ],
      summary: function (p) { return (p.group || 'General') + ' · ' + (p.views || 0) + ' views'; }
    },
    announcements: {
      label: 'Announcement',
      fields: [
        { n: 'title', l: 'Title', t: 'text', req: true },
        { n: 'date', l: 'Date', t: 'date', req: true },
        { n: 'image', l: 'Photo (optional)', t: 'image', hint: 'Attach a photo or flyer — leave empty for text only.' },
        { n: 'body', l: 'Text', t: 'textarea', req: true }
      ],
      summary: function () { return ''; }
    },
    articles: {
      label: 'Article',
      fields: [
        { n: 'title', l: 'Title', t: 'text', req: true },
        { n: 'author', l: 'Author', t: 'text', req: true },
        { n: 'date', l: 'Date', t: 'date', req: true },
        { n: 'image', l: 'Cover photo (optional)', t: 'image', hint: 'Add a cover image — leave empty for text only.' },
        { n: 'body', l: 'Article text', t: 'textarea', req: true }
      ],
      summary: function (a) { return a.author || ''; }
    }
  };

  const el = function (id) { return document.getElementById(id); };

  /* ================================================================
     DEMO MODE — runs fully in the browser when there's no server
     (e.g. GitHub Pages). Data lives in localStorage so edits show up
     on the public pages in the same browser. Not for real deployment.
     ================================================================ */
  const DB_KEY = 'commercium-demo-db';
  const CRED_KEY = 'commercium-demo-cred';
  const SESSION_KEY = 'commercium-demo-in';
  let DEMO = false;

  function loadDemoDb() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return JSON.parse(JSON.stringify(window.COMMERCIUM_DATA || {
      site: {}, gallery: [], events: [], posts: [], announcements: [], articles: [], achievements: []
    }));
  }
  function saveDemoDb(db) { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { C.toast('Storage full — demo edits limited.', 'err'); } }
  function loadDemoCreds() {
    try {
      const raw = localStorage.getItem(CRED_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return { username: 'admin', password: 'commercium2026' };
  }
  function saveDemoCreds(c) { try { localStorage.setItem(CRED_KEY, JSON.stringify(c)); } catch (e) { /* ignore */ } }

  function newId(prefix) { return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function demoApi(path, opts) {
    opts = opts || {};
    const method = (opts.method || 'GET').toUpperCase();
    const db = loadDemoDb();
    const loggedIn = sessionStorage.getItem(SESSION_KEY) === '1';
    return new Promise(function (resolve, reject) {
      const ok = function (body) { resolve(body || { ok: true }); };
      const fail = function (msg, code) { const e = new Error(msg || 'Request failed'); e.status = code || 400; reject(e); };
      setTimeout(function () {
        /* auth */
        if (path === '/api/me') return loggedIn ? ok({ username: loadDemoCreds().username }) : fail('Not logged in.', 401);
        if (path === '/api/login' && method === 'POST') {
          const c = loadDemoCreds();
          if (opts.body.username === c.username && opts.body.password === c.password) {
            sessionStorage.setItem(SESSION_KEY, '1');
            return ok({ username: c.username });
          }
          return fail('Invalid username or password.', 401);
        }
        if (path === '/api/logout') { sessionStorage.removeItem(SESSION_KEY); return ok(); }
        if (!loggedIn) return fail('Not logged in.', 401);

        /* data */
        if (path === '/api/data') return ok(db);
        if (path === '/api/admin/site' && method === 'PUT') {
          db.site = Object.assign({}, db.site, opts.body || {});
          saveDemoDb(db);
          return ok();
        }
        if (path === '/api/admin/account' && method === 'PUT') {
          const b = opts.body || {};
          const c = loadDemoCreds();
          if (b.currentPassword && b.currentPassword !== c.password) return fail('Current password is incorrect.', 400);
          c.username = b.username || c.username;
          if (b.newPassword) c.password = b.newPassword;
          saveDemoCreds(c);
          sessionStorage.setItem(SESSION_KEY, '1');
          return ok({ username: c.username });
        }
        if (path === '/api/admin/upload' && method === 'POST') {
          // keep the image inline (data URL) so the demo works with zero files
          return ok({ path: (opts.body || {}).dataUrl || '' });
        }

        /* gallery */
        let m = path.match(/^\/api\/admin\/gallery\/([^/]+)\/move$/);
        if (m && method === 'POST') {
          const arr = db.gallery || (db.gallery = []);
          const i = arr.findIndex(function (g) { return g.id === m[1]; });
          if (i < 0) return fail('Not found.', 404);
          const j = (opts.body || {}).dir === 'up' ? i - 1 : i + 1;
          if (j >= 0 && j < arr.length) { var t = arr[i]; arr[i] = arr[j]; arr[j] = t; saveDemoDb(db); }
          return ok();
        }
        m = path.match(/^\/api\/admin\/gallery\/([^/]+)$/);
        if (m) {
          const arr = db.gallery || (db.gallery = []);
          const i = arr.findIndex(function (g) { return g.id === m[1]; });
          if (i < 0) return fail('Not found.', 404);
          if (method === 'DELETE') { arr.splice(i, 1); saveDemoDb(db); return ok(); }
          if (method === 'PUT') { Object.assign(arr[i], opts.body || {}); saveDemoDb(db); return ok(); }
        }
        if (path === '/api/admin/gallery' && method === 'POST') {
          (db.gallery = db.gallery || []).push(Object.assign({ id: newId('g') }, opts.body || {}));
          saveDemoDb(db);
          return ok();
        }

        /* generic collections */
        m = path.match(/^\/api\/admin\/(events|achievements|posts|announcements|articles)(?:\/([^/]+))?$/);
        if (m) {
          const coll = m[1], id = m[2];
          const arr = db[coll] || (db[coll] = []);
          if (!id && method === 'POST') {
            arr.push(Object.assign({ id: newId(coll.charAt(0)) }, opts.body || {}));
            saveDemoDb(db);
            return ok();
          }
          if (id) {
            const i = arr.findIndex(function (x) { return x.id === id; });
            if (i < 0) return fail('Not found.', 404);
            if (method === 'PUT') { Object.assign(arr[i], opts.body || {}); saveDemoDb(db); return ok(); }
            if (method === 'DELETE') { arr.splice(i, 1); saveDemoDb(db); return ok(); }
          }
        }
        return fail('Unknown admin route.', 404);
      }, 80);
    });
  }

  /* ---------- boot ---------- */
  C.api('/api/me').then(function (me) {
    setWho(me.username);
    enterAdmin();
  }).catch(function () {
    // no server: switch the whole admin to browser demo mode
    DEMO = true;
    C.api = demoApi;
    showLogin();
  });

  function showLogin() {
    el('login-view').style.display = 'flex';
    el('admin-view').classList.remove('ready');
  }
  function enterAdmin() {
    el('login-view').style.display = 'none';
    el('admin-view').classList.add('ready');
    const badge = el('demo-badge');
    if (badge) badge.style.display = DEMO ? 'inline-flex' : 'none';
    refresh();
  }
  function setWho(name) { if (name) el('who').textContent = name; }

  /* ---------- auth ---------- */
  el('login-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    el('login-error').textContent = '';
    C.api('/api/login', {
      method: 'POST',
      body: { username: el('lg-user').value.trim(), password: el('lg-pass').value }
    }).then(function (res) {
      setWho(res.username);
      enterAdmin();
    }).catch(function (err) {
      el('login-error').textContent = err.message;
    });
  });

  el('logout-btn').addEventListener('click', function () {
    C.api('/api/logout', { method: 'POST' }).finally(function () {
      location.reload();
    });
  });

  /* ---------- panel switching ---------- */
  el('admin-nav').addEventListener('click', function (ev) {
    const btn = ev.target.closest('button[data-panel]');
    if (!btn) return;
    document.querySelectorAll('.admin-nav button').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    document.querySelectorAll('.admin-panel').forEach(function (p) { p.classList.remove('active'); });
    el('panel-' + btn.dataset.panel).classList.add('active');
  });

  /* ---------- data refresh ---------- */
  function refresh() {
    C.api('/api/data').then(function (d) {
      data = d;
      renderStats();
      renderGallery();
      renderList('events');
      renderList('achievements');
      renderList('posts');
      renderList('announcements');
      renderList('articles');
      fillSiteForm();
      el('ac-user').value = d.site && '' ? '' : '';
    });
  }

  function renderStats() {
    const stats = [
      [data.events.length, 'Upcoming Events'],
      [data.achievements.length, 'Achievements'],
      [data.gallery.length, 'Gallery Photos'],
      [data.posts.length, 'Community Posts']
    ];
    el('stats-grid').innerHTML = stats.map(function (s) {
      return '<div class="stat-card"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>';
    }).join('');
  }

  /* ---------- gallery ---------- */
  function renderGallery() {
    el('gallery-list').innerHTML = data.gallery.map(function (g, i) {
      return '<div class="admin-item">' +
        '<img class="thumb" src="' + C.esc(g.src) + '" alt="">' +
        '<div class="info"><b>' + C.esc(g.caption || g.alt || 'Photo') + '</b><span>' + C.esc(g.src) + '</span></div>' +
        '<div class="actions">' +
        '<button class="icon-btn" data-act="up" data-id="' + g.id + '" title="Move up" ' + (i === 0 ? 'disabled style="opacity:.3"' : '') + '>↑</button>' +
        '<button class="icon-btn" data-act="down" data-id="' + g.id + '" title="Move down" ' + (i === data.gallery.length - 1 ? 'disabled style="opacity:.3"' : '') + '>↓</button>' +
        '<button class="icon-btn" data-act="edit" data-id="' + g.id + '" title="Edit caption">✏️</button>' +
        '<button class="icon-btn danger" data-act="del" data-id="' + g.id + '" title="Delete">🗑</button>' +
        '</div></div>';
    }).join('');
  }

  el('gallery-list').addEventListener('click', function (ev) {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.act === 'up' || btn.dataset.act === 'down') {
      C.api('/api/admin/gallery/' + id + '/move', { method: 'POST', body: { dir: btn.dataset.act } })
        .then(function () { C.toast('Gallery reordered'); refresh(); })
        .catch(function (e) { C.toast(e.message, 'err'); });
    } else if (btn.dataset.act === 'del') {
      if (!confirm('Delete this photo from the gallery?')) return;
      C.api('/api/admin/gallery/' + id, { method: 'DELETE' })
        .then(function () { C.toast('Photo removed'); refresh(); })
        .catch(function (e) { C.toast(e.message, 'err'); });
    } else if (btn.dataset.act === 'edit') {
      const item = data.gallery.find(function (g) { return g.id === id; });
      const alt = prompt('Caption for this photo:', item.caption || item.alt || '');
      if (alt === null) return;
      C.api('/api/admin/gallery/' + id, { method: 'PUT', body: { caption: alt, alt: alt } })
        .then(function () { C.toast('Caption updated'); refresh(); })
        .catch(function (e) { C.toast(e.message, 'err'); });
    }
  });

  el('gallery-add').addEventListener('click', function () { el('gallery-files').click(); });

  el('gallery-files').addEventListener('change', function () {
    const files = Array.from(this.files || []);
    if (!files.length) return;
    const btn = el('gallery-add');
    btn.disabled = true;
    btn.textContent = 'Uploading…';
    let chain = Promise.resolve();
    files.forEach(function (file) {
      if (!file.type.startsWith('image/')) return;
      chain = chain.then(function () {
        return new Promise(function (resolve) {
          const reader = new FileReader();
          reader.onload = function () {
            C.api('/api/admin/upload', { method: 'POST', body: { dataUrl: reader.result } })
              .then(function (res) {
                return C.api('/api/admin/gallery', { method: 'POST', body: { src: res.path, alt: file.name, caption: '' } });
              })
              .then(resolve)
              .catch(function (e) { C.toast(e.message, 'err'); resolve(); });
          };
          reader.readAsDataURL(file);
        });
      });
    });
    chain.then(function () {
      btn.disabled = false;
      btn.textContent = '＋ Add Photos';
      C.toast('Photos uploaded');
      refresh();
    });
    this.value = '';
  });

  /* ---------- generic CRUD lists ---------- */
  function renderList(coll) {
    const cfg = COLLECTIONS[coll];
    const items = data[coll] || [];
    const wrap = el(coll + '-list');
    if (!items.length) {
      wrap.innerHTML = '<p style="color:var(--muted);font-size:14px">No ' + cfg.label.toLowerCase() + 's yet — add your first one.</p>';
      return;
    }
    wrap.innerHTML = items.map(function (it) {
      return '<div class="admin-item">' +
        (it.image ? '<img class="thumb" src="' + C.esc(it.image) + '" alt="">' : '<div class="thumb" style="display:flex;align-items:center;justify-content:center;background:rgba(245,198,69,.15);border-radius:8px"><span>' + C.esc(it.icon || '🖼') + '</span></div>') +
        '<div class="info"><b>' + C.esc(it.title || it.author || 'Item') + '</b><span>' + C.esc(cfg.summary(it)) + '</span></div>' +
        '<div class="actions">' +
        '<button class="icon-btn" data-edit="' + it.id + '" title="Edit">✏️</button>' +
        '<button class="icon-btn danger" data-del="' + it.id + '" title="Delete">🗑</button>' +
        '</div></div>';
    }).join('');
    wrap.addEventListener('click', function (ev) {
      const ed = ev.target.closest('button[data-edit]');
      const dl = ev.target.closest('button[data-del]');
      if (ed) { openForm(coll, ed.dataset.edit); }
      if (dl) {
        if (!confirm('Delete this ' + cfg.label.toLowerCase() + '?')) return;
        C.api('/api/admin/' + coll + '/' + dl.dataset.del, { method: 'DELETE' })
          .then(function () { C.toast(cfg.label + ' deleted'); refresh(); })
          .catch(function (e) { C.toast(e.message, 'err'); });
      }
    });
  }

  /* ---------- generic form ---------- */
  function formHtml(cfg, item) {
    return '<div class="admin-form"><h3>' + (item ? 'Edit ' : 'New ') + cfg.label + '</h3>' +
      cfg.fields.map(function (fd) {
        const v = item ? (item[fd.n] || '') : '';
        const req = fd.req ? ' <span class="req">*</span>' : '';
        if (fd.t === 'textarea') {
          return '<div class="field"><label>' + C.esc(fd.l) + req + '</label><textarea data-f="' + fd.n + '" rows="4">' + C.esc(v) + '</textarea></div>';
        }
        if (fd.t === 'image') {
          return '<div class="field"><label>' + C.esc(fd.l) + req + '</label>' +
            '<input type="file" accept="image/*" data-img="' + fd.n + '" style="width:100%">' +
            (fd.hint ? '<p style="font-size:12px;color:var(--muted);margin-top:6px">' + C.esc(fd.hint) + '</p>' : '') +
            (v ? '<div style="margin-top:10px"><img src="' + C.esc(v) + '" data-preview="' + fd.n + '" style="max-width:200px;border-radius:10px;border:1px solid var(--line)"></div>' : '') +
            '</div>';
        }
        return '<div class="field"><label>' + C.esc(fd.l) + req + '</label><input type="' + fd.t + '" data-f="' + fd.n + '" value="' + C.esc(v) + '"></div>';
      }).join('') +
      '<div style="display:flex;gap:10px">' +
      '<button class="btn btn-primary" data-save>Save</button>' +
      '<button class="btn btn-ghost" data-cancel>Cancel</button>' +
      '</div></div>';
  }

  function openForm(coll, id) {
    const cfg = COLLECTIONS[coll];
    const item = id ? (data[coll] || []).find(function (x) { return x.id === id; }) : null;
    const slot = el(coll + '-form');
    slot.innerHTML = formHtml(cfg, item);
    slot.scrollIntoView({ behavior: 'smooth', block: 'center' });

    slot.querySelector('[data-cancel]').addEventListener('click', function () { slot.innerHTML = ''; });

    // image fields: upload on selection
    slot.querySelectorAll('[data-img]').forEach(function (fileInput) {
      const key = fileInput.dataset.img;
      fileInput.addEventListener('change', function () {
        const file = this.files && this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
          C.api('/api/admin/upload', { method: 'POST', body: { dataUrl: reader.result } })
            .then(function (res) {
              const prev = slot.querySelector('[data-preview="' + key + '"]');
              if (prev) prev.src = res.path;
              else {
                const box = document.createElement('div');
                box.style.marginTop = '10px';
                box.innerHTML = '<img src="' + C.esc(res.path) + '" data-preview="' + key + '" style="max-width:200px;border-radius:10px;border:1px solid var(--line)">';
                fileInput.parentNode.appendChild(box);
              }
              fileInput.dataset.uploaded = res.path;
              C.toast('Photo uploaded');
            })
            .catch(function (e) { C.toast(e.message, 'err'); });
        };
        reader.readAsDataURL(file);
      });
    });

    slot.querySelector('[data-save]').addEventListener('click', function () {
      const payload = {};
      cfg.fields.forEach(function (fd) {
        if (fd.t === 'image') {
          const inp = slot.querySelector('[data-img="' + fd.n + '"]');
          if (inp && inp.dataset.uploaded) payload[fd.n] = inp.dataset.uploaded;
          else if (item && item[fd.n]) payload[fd.n] = item[fd.n];
        } else {
          payload[fd.n] = slot.querySelector('[data-f="' + fd.n + '"]').value.trim();
        }
      });
      const missing = cfg.fields.filter(function (fd) { return fd.req && !payload[fd.n]; });
      if (missing.length) { C.toast('Please fill in: ' + missing.map(function (m) { return m.l; }).join(', '), 'err'); return; }
      const req = item
        ? C.api('/api/admin/' + coll + '/' + item.id, { method: 'PUT', body: payload })
        : C.api('/api/admin/' + coll, { method: 'POST', body: payload });
      req.then(function () { C.toast(cfg.label + ' saved'); slot.innerHTML = ''; refresh(); })
        .catch(function (e) { C.toast(e.message, 'err'); });
    });
  }

  ['events', 'achievements', 'posts', 'announcements', 'articles'].forEach(function (coll) {
    el(coll + '-add').addEventListener('click', function () { openForm(coll, null); });
  });

  /* ---------- settings ---------- */
  function fillSiteForm() {
    const s = data.site || {};
    ['heroTitle', 'heroSubtitle', 'aboutTitle', 'aboutText', 'aboutGoal', 'contactEmail', 'instagram'].forEach(function (k) {
      el('s-' + k).value = s[k] || '';
    });
  }

  el('save-site').addEventListener('click', function () {
    const body = {};
    ['heroTitle', 'heroSubtitle', 'aboutTitle', 'aboutText', 'aboutGoal', 'contactEmail', 'instagram'].forEach(function (k) {
      body[k] = el('s-' + k).value.trim();
    });
    C.api('/api/admin/site', { method: 'PUT', body: body })
      .then(function () { C.toast('Site text saved'); })
      .catch(function (e) { C.toast(e.message, 'err'); });
  });

  el('save-account').addEventListener('click', function () {
    const body = {
      username: el('ac-user').value.trim(),
      newPassword: el('ac-newpass').value,
      currentPassword: el('ac-curpass').value
    };
    C.api('/api/admin/account', { method: 'PUT', body: body })
      .then(function () {
        C.toast('Credentials updated');
        el('ac-newpass').value = '';
        el('ac-curpass').value = '';
        el('who').textContent = body.username;
      })
      .catch(function (e) { C.toast(e.message, 'err'); });
  });
})();
