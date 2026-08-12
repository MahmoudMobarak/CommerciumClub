/* Commercium — shared UI helpers */
(function () {
  'use strict';

  const SITE = {
    name: 'Commercium',
    tagline: 'Mind Your Business',
    instagram: 'https://www.instagram.com/commercium.tws',
    email: 'commerciumclubtws@gmail.com'
  };

  const NAV = [
    { label: 'Home', href: 'index.html' },
    { label: 'Activities', href: 'activities.html' },
    { label: 'Achievements', href: 'achievements.html' },
    { label: 'Commerunity', href: 'commerunity.html' },
    { label: 'Commercipedia', href: 'commercipedia.html' },
    { label: 'Notifications', href: 'notifications.html' }
  ];

  function currentPage() {
    const p = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    return p === '' ? 'index.html' : p;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function esc(s) { return escapeHtml(s); }

  function buildHeader(active) {
    const page = active || currentPage();
    const navHtml = NAV.map(function (n) {
      const cls = n.href === page ? ' active' : '';
      return '<a href="' + n.href + '" class="' + cls.trim() + '">' + n.label + '</a>';
    }).join('');
    return `
    <header class="site-header" id="site-header">
      <div class="container">
        <a class="logo" href="index.html" aria-label="Commercium – home">
          <img src="assets/photos/logo.png" alt="Commercium logo">
        </a>
        <nav class="nav" id="site-nav" aria-label="Site">
          ${navHtml}
          <a class="nav-cta" href="membership.html">Join Now</a>
        </nav>
        <button class="menu-toggle" id="menu-toggle" aria-label="Menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>`;
  }

  function buildFooter() {
    return `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <span class="logo-word">${SITE.name}</span>
            <p>Empowering student entrepreneurs and future business leaders. ${SITE.tagline}.</p>
          </div>
          <div class="footer-col">
            <h4>Explore</h4>
            <ul>
              <li><a href="index.html">Home</a></li>
              <li><a href="activities.html">Activities</a></li>
              <li><a href="achievements.html">Achievements</a></li>
              <li><a href="commerunity.html">Commerunity</a></li>
              <li><a href="membership.html">Membership Form</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>Connect</h4>
            <ul>
              <li><a href="${SITE.instagram}" target="_blank" rel="noopener">Instagram</a></li>
              <li><a href="mailto:${SITE.email}">${SITE.email}</a></li>
              <li><a href="notifications.html">Announcements</a></li>
              <li><a href="commercipedia.html">Commercipedia</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} ${SITE.name} · The Westminster School – Dubai</span>
          <span>79MC+6J School Zone – Baghdad Street – 10th St – Dubai</span>
        </div>
      </div>
    </footer>`;
  }

  /* ---------- swipe page transition ---------- */
  let swipeEl = null;
  const SWIPE_FLAG = 'commercium-swipe';

  function initSwipe() {
    swipeEl = document.createElement('div');
    swipeEl.className = 'page-swipe';
    swipeEl.innerHTML = '<div class="swipe-inner">' +
      '<img src="assets/photos/logo.png" alt="Commercium logo">' +
      '<span>Commercium</span></div>';
    document.body.appendChild(swipeEl);

    // arriving from another page: panel is already covering, just slide it
    // back out to reveal the new page (no re-animation — smooth reveal)
    if (sessionStorage.getItem(SWIPE_FLAG)) {
      sessionStorage.removeItem(SWIPE_FLAG);
      swipeEl.classList.add('notrans', 'cover');      // instantly covering
      void swipeEl.offsetWidth;                       // force reflow
      requestAnimationFrame(function () {
        swipeEl.classList.remove('notrans');
        swipeEl.classList.add('backout');             // sweep on through to the left
      });
      setTimeout(function () {
        // reset without animating back across the screen (no phantom third swipe)
        swipeEl.classList.add('notrans');
        swipeEl.classList.remove('cover', 'backout');
      }, 760);
    }

    // intercept internal link clicks: swipe in, then navigate
    document.addEventListener('click', function (ev) {
      const a = ev.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.indexOf('#') === 0 || href.indexOf('mailto:') === 0 ||
          href.indexOf('http') === 0 || a.target === '_blank') return;
      ev.preventDefault();
      sessionStorage.setItem(SWIPE_FLAG, '1');
      swipeEl.classList.remove('notrans');   // ensure the in-swipe animates
      swipeEl.classList.add('enter');
      // wait for the slower swipe-in to finish before navigating (panel covers screen)
      setTimeout(function () { window.location.href = href; }, 680);
    });
  }

  function initCommon() {
    initSwipe();
    const headerSlot = document.getElementById('header-slot');
    if (headerSlot) headerSlot.innerHTML = buildHeader();
    const footerSlot = document.getElementById('footer-slot');
    if (footerSlot) footerSlot.innerHTML = buildFooter();

    // header scroll state
    const header = document.getElementById('site-header');
    const onScroll = function () {
      if (header) header.classList.toggle('scrolled', window.scrollY > 20);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    // mobile menu
    const toggle = document.getElementById('menu-toggle');
    const nav = document.getElementById('site-nav');
    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        const open = nav.classList.toggle('open');
        toggle.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      nav.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () {
          nav.classList.remove('open');
          toggle.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
        });
      });
    }

    // reveal on scroll
    let revealTimer = null;
    function checkReveals() {
      const vh = window.innerHeight;
      const els = document.querySelectorAll('.reveal:not(.in)');
      els.forEach(function (el) {
        const r = el.getBoundingClientRect();
        // one-way reveal: anything in view OR already scrolled past gets revealed
        if (r.top < vh) el.classList.add('in');
      });
      if (els.length) revealTimer = setTimeout(checkReveals, 300);
    }
    function refreshReveal() {
      document.querySelectorAll('.reveal:not(.in)').forEach(function (el, i) {
        if (!el.dataset.obs) {
          el.dataset.obs = '1';
          el.style.transitionDelay = (i % 4) * 60 + 'ms';
        }
      });
      checkReveals();
    }
    window.addEventListener('scroll', function () {
      if (!revealTimer) revealTimer = setTimeout(function () { revealTimer = null; checkReveals(); }, 60);
    }, { passive: true });
    refreshReveal();

    // hero coins + glow blobs
    const hero = document.querySelector('.hero');
    if (hero) {
      for (let i = 0; i < 12; i++) {
        const c = document.createElement('span');
        c.className = 'coin';
        const size = 6 + Math.random() * 14;
        c.style.width = size + 'px';
        c.style.height = size + 'px';
        c.style.left = Math.random() * 100 + '%';
        c.style.animationDelay = (Math.random() * 12) + 's';
        c.style.animationDuration = (9 + Math.random() * 8) + 's';
        hero.appendChild(c);
      }
      ['b1', 'b2', 'b3'].forEach(function (b) {
        const el = document.createElement('span');
        el.className = 'blob ' + b;
        hero.appendChild(el);
      });
    }

    // cursor glow (desktop)
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      const glow = document.createElement('div');
      glow.className = 'cursor-glow';
      document.body.appendChild(glow);
      let mx = -999, my = -999, tx = -999, ty = -999;
      document.addEventListener('mousemove', function (ev) {
        tx = ev.clientX; ty = ev.clientY;
      });
      (function follow() {
        mx += (tx - mx) * 0.14;
        my += (ty - my) * 0.14;
        glow.style.transform = 'translate(' + mx + 'px, ' + my + 'px) translate(-50%, -50%)';
        requestAnimationFrame(follow);
      })();
    }

    // 3D tilt + glow position on cards (call bindTilt again after dynamic content renders)
    bindTilt();

    // marquee: duplicate content for seamless loop
    const track = document.querySelector('.marquee-track');
    if (track) track.innerHTML += track.innerHTML;

    // CeCe easter egg — small, quiet, fun
    const cece = document.createElement('button');
    cece.className = 'cece-egg';
    cece.setAttribute('aria-label', 'CeCe the mascot');
    cece.title = 'CeCe';
    cece.innerHTML = '<img src="assets/photos/photo-043.png" alt=""><span class="cece-bubble">Mind your business! 🪙</span>';
    document.body.appendChild(cece);
    const bubble = cece.querySelector('.cece-bubble');
    let bubbleTimer = null;
    cece.addEventListener('click', function () {
      cece.classList.add('wiggle');
      bubble.classList.add('show');
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(function () {
        bubble.classList.remove('show');
        cece.classList.remove('wiggle');
      }, 2600);
    });
  }

  /* ---------- data with offline fallback ---------- */
  const DEMO_DB_KEY = 'commercium-demo-db';
  async function getData() {
    try {
      return await api('/api/data');
    } catch (e) {
      // no server (e.g. GitHub Pages): prefer this browser's demo edits,
      // then the embedded snapshot
      try {
        const raw = localStorage.getItem(DEMO_DB_KEY);
        if (raw) return JSON.parse(raw);
      } catch (err) { /* ignore */ }
      if (window.COMMERCIUM_DATA) return window.COMMERCIUM_DATA;
      throw e;
    }
  }

  /* ---------- API ---------- */
  async function api(path, opts) {
    opts = opts || {};
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin'
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty */ }
    if (!res.ok) throw new Error((data && data.error) || ('Request failed (' + res.status + ')'));
    return data;
  }

  /* ---------- reveal refresh (call after dynamic renders) ---------- */
  function refreshReveal() {
    const vh = window.innerHeight;
    document.querySelectorAll('.reveal:not(.in)').forEach(function (el) {
      if (!el.dataset.obs) el.dataset.obs = '1';
      const r = el.getBoundingClientRect();
      if (r.top < vh) el.classList.add('in');
    });
  }

  /* ---------- 3D tilt ---------- */
  const TILT_SEL = '.event-card, .why-card, .ach-card, .ach-mini, .group-card';
  function bindTilt() {
    document.querySelectorAll(TILT_SEL + ':not(.tilt)').forEach(function (card) {
      card.classList.add('tilt');
      card.addEventListener('mousemove', function (ev) {
        const r = card.getBoundingClientRect();
        const px = (ev.clientX - r.left) / r.width;
        const py = (ev.clientY - r.top) / r.height;
        card.style.setProperty('--ry', ((px - 0.5) * 10).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((0.5 - py) * 10).toFixed(2) + 'deg');
        card.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      });
      card.addEventListener('mouseleave', function () {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ---------- toasts ---------- */
  function toast(msg, type) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(function () { t.remove(); }, 3600);
  }

  /* ---------- countdown ---------- */
  function startCountdown(el, dateStr, timeStr) {
    const target = new Date(dateStr + 'T' + (timeStr || '18:00') + ':00');
    if (isNaN(target.getTime())) return;
    const boxes = el.querySelectorAll('.cd-box b');
    const tick = function () {
      let diff = target.getTime() - Date.now();
      if (diff < 0) diff = 0;
      const d = Math.floor(diff / 86400000);
      const h = Math.floor(diff / 3600000) % 24;
      const m = Math.floor(diff / 60000) % 60;
      const s = Math.floor(diff / 1000) % 60;
      if (boxes[0]) boxes[0].textContent = d;
      if (boxes[1]) boxes[1].textContent = String(h).padStart(2, '0');
      if (boxes[2]) boxes[2].textContent = String(m).padStart(2, '0');
      if (boxes[3]) boxes[3].textContent = String(s).padStart(2, '0');
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- date formatting ---------- */
  function formatDate(iso, withYear) {
    if (!iso) return '';
    const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
    if (isNaN(d.getTime())) return iso;
    const opts = { day: 'numeric', month: 'short' };
    if (withYear) opts.year = 'numeric';
    return d.toLocaleDateString('en-GB', opts);
  }

  window.Commercium = {
    SITE, NAV, api, getData, toast, escapeHtml, esc, formatDate, startCountdown,
    buildHeader, buildFooter, initCommon, bindTilt, refreshReveal
  };

  document.addEventListener('DOMContentLoaded', initCommon);
})();
