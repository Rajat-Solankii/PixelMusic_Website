// Birthday mode for the PixelMusic landing page.
// Shows a celebration banner, the wishes wall, a "Send a wish" form and a gift button at the top
// of the page when birthday mode is active:
//   - mode "auto" (default): only on the celebration date set by the team (MM-DD, every year,
//     visitor's local date; December 14th unless changed)
//   - mode "on" / "off": set by the team from /wishes/admin.html
//   - ?birthday in the URL previews it on any day
(function () {
  'use strict';
  var API = '/api/wishes';
  var ACCENTS = ['a-purple', 'a-pink', 'a-blue', 'a-green', 'a-yellow', 'a-orange', 'a-teal', 'a-red'];
  var forced = /[?&]birthday\b/.test(location.search);

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var celebration = '12-14';
  function isBirthdayToday(mmdd) {
    var p = String(mmdd || '12-14').split('-'), d = new Date();
    return d.getMonth() + 1 === +p[0] && d.getDate() === +p[1];
  }
  function dateLabel(mmdd) { var p = mmdd.split('-'); return MONTHS[+p[0] - 1] + ' ' + (+p[1]); }

  fetch(API + '?config=1', { cache: 'no-cache', headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : { mode: 'auto' }; })
    .catch(function () { return { mode: 'auto' }; })
    .then(function (c) {
      var mode = c && c.mode;
      if (c && /^\d{2}-\d{2}$/.test(c.date)) celebration = c.date;
      var on = forced || mode === 'on' || (mode !== 'off' && isBirthdayToday(celebration));
      if (!on) return;
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
      else start();
    });

  function start() {
    var main = document.getElementById('main');
    if (!main || document.getElementById('wishes')) return;

    // Build the section only once its stylesheet is ready, so it never flashes unstyled.
    var built = false;
    function once() { if (!built) { built = true; build(main); } }
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/birthday/birthday.css';
    css.onload = once;
    css.onerror = once;
    document.head.appendChild(css);
    setTimeout(once, 2500);
  }

  function build(main) {
    document.documentElement.classList.add('bd-on');

    // Static markup only; user-written text is added later with textContent.
    var section = document.createElement('section');
    section.id = 'wishes';
    section.className = 'bd';
    section.setAttribute('aria-labelledby', 'bd-title');
    section.innerHTML =
      '<div class="wrap bd-hero">' +
        '<canvas aria-hidden="true"></canvas>' +
        '<div class="bd-badge" aria-hidden="true"><svg viewBox="0 0 200 200"><defs><linearGradient id="bd-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7aa8"/><stop offset=".5" stop-color="#ffc94d"/><stop offset="1" stop-color="#b388ff"/></linearGradient></defs><path fill="url(#bd-g)" d="M100 6c12 0 20 13 32 16s26-3 34 6 3 24 8 35 18 19 18 37-13 24-18 36-1 26-8 34-23 4-34 8-19 18-32 18-21-13-32-17-27 0-34-9-3-23-8-34S6 115 6 100s13-25 18-36 1-27 8-35 23-3 34-7S88 6 100 6Z"/></svg><span>🎂</span></div>' +
        '<span class="bd-eyebrow">' + dateLabel(celebration) + ' · A little surprise</span>' +
        '<h2 class="bd-title" id="bd-title">Celebrating the birthday of <span class="hl">Anshul Yadav</span>! 🎉</h2>' +
        '<p class="bd-lead">He has been working tirelessly on PixelMusic for the past 12 months. To appreciate his dedication and motivate the team, we’ve planned a little surprise. Leave him a wish!</p>' +
        '<div class="bd-actions">' +
          '<span class="bd-count a-pink" aria-live="polite"><b id="bd-count">–</b><span id="bd-count-label">wishes so far</span></span>' +
          '<a class="btn filled" href="#bd-form">Send a wish</a>' +
          '<button class="btn ter" type="button" id="bd-gift-top">Give a gift</button>' +
        '</div>' +
      '</div>' +
      '<div class="wrap bd-layout">' +
        '<aside class="bd-side">' +
          '<form class="bd-panel a-purple" id="bd-form" novalidate>' +
            '<h3><span class="bd-dot" aria-hidden="true">💌</span>Send a wish</h3>' +
            '<p class="bd-sub">Your wish shows up on the wall for everyone, including Anshul.</p>' +
            '<div class="bd-field"><label for="bd-name">Your name <span style="font-weight:500;color:var(--on-sv)">(optional)</span></label>' +
              '<input type="text" id="bd-name" maxlength="40" autocomplete="nickname" placeholder="A PixelMusic listener"></div>' +
            '<div class="bd-field"><label for="bd-msg">Your wish</label>' +
              '<textarea id="bd-msg" maxlength="280" required placeholder="Happy birthday, Anshul! Thank you for PixelMusic…"></textarea>' +
              '<div class="bd-meta"><span>Be kind · no links</span><span id="bd-counter">0 / 280</span></div></div>' +
            '<div class="bd-hp" aria-hidden="true"><label for="bd-website">Website</label><input type="text" id="bd-website" tabindex="-1" autocomplete="off"></div>' +
            '<button class="btn filled bd-wide" id="bd-submit" type="submit" disabled>Send wish</button>' +
            '<p class="bd-status" id="bd-status" role="status"></p>' +
          '</form>' +
          '<div class="bd-panel a-yellow">' +
            '<h3><span class="bd-dot" aria-hidden="true">🎁</span>Give a gift</h3>' +
            '<p class="bd-sub">Treat him to a coffee or a slice of cake with Ko-fi or UPI. Every gift supports Anshul and PixelMusic.</p>' +
            '<button class="btn ter bd-wide" type="button" id="bd-gift">Choose Ko-fi or UPI</button>' +
          '</div>' +
        '</aside>' +
        '<div>' +
          '<div class="bd-wall-head"><h3>The wishes wall</h3><span class="bd-live"><i aria-hidden="true"></i>Live</span></div>' +
          '<div class="bd-wall" id="bd-wall" aria-live="polite"><div class="bd-skel"></div><div class="bd-skel" style="height:160px"></div><div class="bd-skel"></div></div>' +
        '</div>' +
      '</div>';
    main.insertBefore(section, main.firstChild);

    var nav = document.getElementById('menu');
    if (nav) {
      var link = document.createElement('a');
      link.href = '#wishes'; link.className = 'bd-nav'; link.textContent = '🎂 Wishes';
      nav.insertBefore(link, nav.firstChild);
    }

    wireGift();
    wireWall();
    wireForm();
    confetti(section.querySelector('canvas'));
    if (location.hash === '#wishes') setTimeout(function () { section.scrollIntoView(); }, 60);
  }

  // ---- gift: reuse the page's own Support dialog (Ko-fi + UPI), like the app reuses Donate.
  function wireGift() {
    function openGift() {
      var supportBtn = document.getElementById('support-btn');
      if (supportBtn) supportBtn.click();
      else window.open('https://ko-fi.com/ianshulyadav', '_blank', 'noopener');
    }
    document.getElementById('bd-gift').addEventListener('click', openGift);
    document.getElementById('bd-gift-top').addEventListener('click', openGift);
  }

  // ---- wall
  var known = {}, total = 0, firstLoad = true, wall;
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  var rtf = window.Intl && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }) : null;
  function ago(ts) {
    var s = Math.round((ts - Date.now()) / 1000), a = Math.abs(s);
    if (!rtf) return new Date(ts).toLocaleString();
    if (a < 45) return 'just now';
    if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
    if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
    return rtf.format(Math.round(s / 86400), 'day');
  }
  function card(w, isNew) {
    var el = document.createElement('article');
    el.className = 'bd-wish ' + ACCENTS[hash(w.id) % ACCENTS.length] + (isNew ? ' new' : '');
    el.dataset.id = w.id;
    var p = document.createElement('p'); p.textContent = w.message;
    var who = document.createElement('div'); who.className = 'bd-who';
    var av = document.createElement('span'); av.className = 'bd-av'; av.setAttribute('aria-hidden', 'true');
    av.textContent = (Array.from(w.name || '?')[0] || '?').toUpperCase();
    var t = document.createElement('span'); t.className = 'bd-who-t';
    var b = document.createElement('b'); b.textContent = w.name;
    var small = document.createElement('small');
    small.dataset.ts = w.createdAt;
    small.dataset.src = w.platform === 'android' ? 'from the app' : 'from the web';
    small.textContent = small.dataset.src + ' · ' + ago(w.createdAt);
    t.appendChild(b); t.appendChild(small);
    who.appendChild(av); who.appendChild(t);
    el.appendChild(p); el.appendChild(who);
    return el;
  }
  function setCount(n) {
    total = n;
    document.getElementById('bd-count').textContent = n;
    document.getElementById('bd-count-label').textContent = n === 1 ? 'wish so far' : 'wishes so far';
  }
  function emptyState(text) {
    wall.textContent = '';
    var d = document.createElement('div'); d.className = 'bd-empty';
    var big = document.createElement('span'); big.textContent = '🎈';
    d.appendChild(big); d.appendChild(document.createTextNode(text));
    wall.appendChild(d);
  }
  function render(list, count) {
    if (firstLoad) wall.textContent = '';
    var ids = {}; list.forEach(function (w) { ids[w.id] = 1; });
    Array.prototype.slice.call(wall.querySelectorAll('.bd-wish')).forEach(function (el) {
      if (!ids[el.dataset.id]) { el.remove(); delete known[el.dataset.id]; }
    });
    var fresh = list.filter(function (w) { return !known[w.id]; });
    for (var i = fresh.length - 1; i >= 0; i--) {
      known[fresh[i].id] = 1;
      wall.insertBefore(card(fresh[i], !firstLoad), wall.firstChild);
    }
    var empty = wall.querySelector('.bd-empty');
    if (list.length && empty) empty.remove();
    if (!wall.querySelector('.bd-wish')) emptyState('No wishes yet. Be the first to wish Anshul a happy birthday!');
    setCount(count);
    firstLoad = false;
  }
  function load() {
    return fetch(API, { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { render(d.wishes || [], d.count || 0); })
      .catch(function () { if (firstLoad) { emptyState('The wishes wall is warming up. Please check back in a moment.'); firstLoad = false; } });
  }
  function refreshTimes() {
    Array.prototype.forEach.call(wall.querySelectorAll('small[data-ts]'), function (s) {
      s.textContent = s.dataset.src + ' · ' + ago(+s.dataset.ts);
    });
  }
  function wireWall() {
    wall = document.getElementById('bd-wall');
    var started = Date.now();
    load();
    // Gentle polling: every 30s while visible, stopping after 20 minutes of one visit.
    setInterval(function () {
      if (document.hidden || Date.now() - started > 20 * 60 * 1000) return;
      load(); refreshTimes();
    }, 30000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { started = Date.now(); load(); } });
  }

  // ---- form
  var ERRORS = {
    message_required: 'Please write a short wish first.',
    not_kind: 'Please keep it kind. 💜',
    no_links: 'Links aren’t allowed in wishes.',
    slow_down: 'You’ve sent a few wishes already. Please try again later.',
    not_configured: 'Wishes aren’t open yet. Please try again a little later.'
  };
  function wireForm() {
    var form = document.getElementById('bd-form'), msg = document.getElementById('bd-msg'),
        nameEl = document.getElementById('bd-name'), submit = document.getElementById('bd-submit'),
        statusEl = document.getElementById('bd-status'), counter = document.getElementById('bd-counter');
    function update() { counter.textContent = msg.value.length + ' / 280'; submit.disabled = msg.value.trim().length < 2; }
    msg.addEventListener('input', update); update();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submit.disabled) return;
      submit.disabled = true; statusEl.className = 'bd-status'; statusEl.textContent = 'Sending…';
      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name: nameEl.value, message: msg.value, platform: 'web', website: document.getElementById('bd-website').value })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; });
      }).then(function (res) {
        if (!res.ok) throw new Error((res.d && res.d.error) || 'server_error');
        if (res.d.wish) {
          known[res.d.wish.id] = 1;
          var empty = wall.querySelector('.bd-empty'); if (empty) empty.remove();
          wall.insertBefore(card(res.d.wish, true), wall.firstChild);
          setCount(total + 1);
        }
        msg.value = ''; update();
        statusEl.className = 'bd-status ok'; statusEl.textContent = 'Wish sent! Thank you for being part of the surprise. 💌';
        burst();
      }).catch(function (err) {
        statusEl.className = 'bd-status err';
        statusEl.textContent = ERRORS[err.message] || 'Couldn’t send your wish. Please check your connection and try again.';
        update();
      });
    });
  }

  // ---- confetti over the celebration banner (off for reduced motion)
  var burst = function () {};
  function confetti(cv) {
    var ctx = cv && cv.getContext && cv.getContext('2d');
    if (!ctx || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    var colors = ['#ff7aa8', '#ffc94d', '#b388ff', '#6ee7c8', '#78527c', '#fdaca7'], pieces = [];
    function size() { var r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1; cv.width = r.width * d; cv.height = r.height * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
    function spawn(n, fromTop) {
      var w = cv.clientWidth, h = cv.clientHeight;
      for (var i = 0; i < n; i++) pieces.push({
        x: Math.random() * w, y: fromTop ? -10 - Math.random() * h * 0.5 : Math.random() * h,
        vx: (Math.random() - 0.5) * 0.6, vy: 0.5 + Math.random() * 1.2, s: 4 + Math.random() * 6,
        r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.2, c: colors[i % colors.length], round: Math.random() < 0.35
      });
    }
    function tick() {
      var w = cv.clientWidth, h = cv.clientHeight;
      ctx.clearRect(0, 0, w, h);
      pieces.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        if (p.y > h + 10 && pieces.length <= 60) { p.y = -10; p.x = Math.random() * w; }
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p.y / h) * 0.9; ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2.4, 0, 6.28); ctx.fill(); } else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      });
      pieces = pieces.filter(function (p) { return p.y <= h + 10; });
      requestAnimationFrame(tick);
    }
    size(); addEventListener('resize', size); spawn(45, false); tick();
    burst = function () { spawn(70, true); };
  }
})();
