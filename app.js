/* Fauxtruc — outils plein écran. Aucune dépendance. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, attrs = {}, html = '') => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'style') e.style.cssText = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    if (html) e.innerHTML = html;
    return e;
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const stage = $('#stage'), wrap = $('#canvasWrap'), panel = $('#panel'), hint = $('#hint');

  /* ---------------- Données ---------------- */
  const COLORS = [
    ['Blanc', '#ffffff'], ['Noir', '#000000'], ['Rouge', '#ff0000'], ['Vert', '#00c000'],
    ['Bleu', '#0050ff'], ['Jaune', '#ffe600'], ['Orange', '#ff8a00'], ['Rose', '#ff6fb5'],
    ['Violet', '#8a2be2'], ['Cyan', '#00e5ff'], ['Magenta', '#ff00ff'], ['Gris', '#808080'],
    ['Crème', '#fff4dc'], ['Bleu nuit', '#0b1840'], ['Vert incrust.', '#00b140'], ['Bleu incrust.', '#0047bb'],
  ];

  const CARDS = {
    toolsGrid: [
      ['light', '💡', 'Lumière visio', 'Éclairage doux pour tes appels vidéo, avec température de couleur réglable.'],
      ['pixels', '🔍', 'Test pixels morts', 'Fais défiler des couleurs pleines pour repérer les pixels défectueux.'],
      ['clock', '⏱️', 'Horloge & minuteur', 'Grande horloge, compte à rebours ou chronomètre lisible de loin.'],
      ['prompter', '📜', 'Prompteur', 'Colle ton texte, règle la vitesse, lis face caméra. Mode miroir inclus.'],
      ['noise', '🌊', 'Bruit blanc', 'Bruit blanc, rose ou brun pour se concentrer ou s\'endormir.'],
      ['gradient', '🌈', 'Dégradé animé', 'Un fond qui change doucement de teinte, parfait en ambiance.'],
    ],
    funGrid: [
      ['update', '🔄', 'Fausse mise à jour', 'Un écran de mise à jour qui n\'en finit pas. Idéal pour une pause tranquille.'],
      ['broken', '💥', 'Écran cassé', 'Des fissures de verre réalistes. Clique pour en ajouter.'],
      ['hacker', '👨‍💻', 'Hacker express', 'Tape n\'importe quoi, du « code » défile comme dans les films.'],
      ['matrix', '🟩', 'Pluie de code', 'Des caractères qui tombent en cascade, couleur réglable.'],
      ['nosignal', '📺', 'Pas de signal', 'Mire de barres ou neige télé, comme un vieux téléviseur.'],
      ['bounce', '📀', 'Logo rebondissant', 'Un texte qui rebondit d\'un bord à l\'autre. Touchera-t-il le coin ?'],
    ],
  };

  /* ---------------- Page d'accueil ---------------- */
  const sw = $('#swatches');
  for (const [name, hex] of COLORS) {
    const dark = lum(hex) < 0.45;
    sw.append(el('a', {
      class: 'swatch', href: '#/color/' + hex.slice(1),
      style: `background:${hex};color:${dark ? '#fff' : '#111'}`,
    }, name));
  }
  for (const [gridId, list] of Object.entries(CARDS)) {
    const g = $('#' + gridId);
    for (const [id, ico, title, desc] of list) {
      g.append(el('a', { class: 'card', href: '#/' + id, style: 'text-decoration:none;display:block' },
        `<div class="ico">${ico}</div><h3>${title}</h3><p>${desc}</p>`));
    }
  }
  $('[data-open="color"].big').addEventListener('click', () => { location.hash = '#/color/ffffff'; });
  $('#customOpen').addEventListener('click', () => { location.hash = '#/color/' + $('#customColor').value.slice(1); });

  function lum(hex) {
    const n = parseInt(hex.slice(1), 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  }

  /* ---------------- Gestion de la scène ---------------- */
  let cleanup = null, current = null, hideTimer = 0, wakeLock = null, panelLocked = false;

  function route() {
    const m = location.hash.match(/^#\/([a-z]+)(?:\/(.*))?$/);
    if (m && TOOLS[m[1]]) open(m[1], m[2]);
    else close(false);
  }

  function open(id, arg) {
    teardown();
    current = TOOLS[id];
    stage.hidden = false;
    stage.style.background = '#000';
    document.body.style.overflow = 'hidden';
    wrap.innerHTML = ''; panel.innerHTML = '';
    cleanup = current.start({ wrap, panel, arg }) || null;
    panel.append(
      el('button', { class: 'ghost', title: 'Plein écran (F)', onclick: toggleFs }, '⛶ Plein écran'),
      el('button', { class: 'ghost', title: 'Fermer (Échap)', onclick: () => close(true) }, '✕'),
    );
    showPanel();
    hint.classList.add('show'); setTimeout(() => hint.classList.remove('show'), 2500);
    requestWake();
  }

  function teardown() {
    if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { console.error(e); } }
    cleanup = null; current = null;
  }

  function close(updateHash) {
    if (stage.hidden) return;
    teardown();
    stage.hidden = true;
    wrap.innerHTML = ''; panel.innerHTML = '';
    document.body.style.overflow = '';
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
    if (updateHash) history.pushState(null, '', location.pathname + location.search);
  }

  function toggleFs() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else (stage.requestFullscreen || stage.webkitRequestFullscreen || (() => {})).call(stage);
  }

  async function requestWake() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch { /* ignoré */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (!stage.hidden && document.visibilityState === 'visible' && !wakeLock) requestWake();
  });

  function showPanel() {
    panel.classList.remove('hide'); stage.classList.remove('nocursor');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (panelLocked || panel.matches(':hover') || panel.contains(document.activeElement) && document.activeElement !== document.body) return;
      panel.classList.add('hide'); stage.classList.add('nocursor');
    }, 3000);
  }
  stage.addEventListener('mousemove', showPanel);
  stage.addEventListener('touchstart', showPanel, { passive: true });
  panel.addEventListener('mouseleave', showPanel);
  panel.addEventListener('focusout', showPanel);

  document.addEventListener('keydown', (e) => {
    if (stage.hidden) return;
    const typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
    if (e.key === 'Escape' && !document.fullscreenElement) { close(true); return; }
    if (typing) return;
    if (current && current.onKey && current.onKey(e)) { e.preventDefault(); return; }
    if (current && current.captureKeys) return;
    if (e.key === 'f' || e.key === 'F') toggleFs();
    else if (e.key === 'h' || e.key === 'H') {
      if (panel.classList.contains('hide')) showPanel(); else { panel.classList.add('hide'); stage.classList.add('nocursor'); }
    }
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('popstate', route);

  /* ---------------- Aides ---------------- */
  function canvas(container, onResize) {
    const c = el('canvas'); container.append(c);
    const ctx = c.getContext('2d');
    const o = { c, ctx, w: 0, h: 0, dpr: 1 };
    const fit = () => {
      o.dpr = Math.min(window.devicePixelRatio || 1, 2);
      o.w = container.clientWidth; o.h = container.clientHeight;
      c.width = Math.round(o.w * o.dpr); c.height = Math.round(o.h * o.dpr);
      ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
      onResize && onResize(o);
    };
    const ro = new ResizeObserver(fit); ro.observe(container); fit();
    o.stop = () => ro.disconnect();
    return o;
  }
  function loop(fn) {
    let id = 0, last = performance.now();
    const tick = (t) => { const dt = Math.min(0.1, (t - last) / 1000); last = t; fn(dt, t); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }
  const range = (label, min, max, val, step, on) => {
    const i = el('input', { type: 'range', min, max, value: val, step });
    i.addEventListener('input', () => on(+i.value));
    const l = el('label', {}, label); l.append(i); return l;
  };
  const select = (label, opts, val, on) => {
    const s = el('select');
    for (const [v, t] of opts) s.append(el('option', { value: v }, t));
    s.value = val; s.addEventListener('change', () => on(s.value));
    const l = el('label', {}, label); l.append(s); return l;
  };
  const colorInput = (label, val, on) => {
    const i = el('input', { type: 'color', value: val });
    i.addEventListener('input', () => on(i.value));
    const l = el('label', {}, label); l.append(i); return l;
  };
  const button = (text, on) => el('button', { onclick: on }, text);

  // Kelvin -> RGB (approximation de Tanner Helland)
  function kelvin(k) {
    const t = k / 100; let r, g, b;
    if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
    else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
    if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    return [r, g, b].map((v) => Math.round(clamp(v, 0, 255)));
  }

  let audioCtx = null;
  function beep(times = 3) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < times; i++) {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        const t0 = audioCtx.currentTime + i * 0.35;
        o.frequency.value = 880; g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
        o.connect(g).connect(audioCtx.destination); o.start(t0); o.stop(t0 + 0.3);
      }
    } catch { /* pas de son */ }
  }

  /* ---------------- Outils ---------------- */
  const TOOLS = {};

  // Écran de couleur unie
  TOOLS.color = {
    start({ wrap, panel, arg }) {
      let color = /^[0-9a-f]{6}$/i.test(arg || '') ? '#' + arg : '#ffffff';
      let dim = 0;
      const fill = el('div', { class: 'fill' }); const shade = el('div', { class: 'fill', style: 'background:#000;opacity:0;pointer-events:none' });
      wrap.append(fill, shade);
      const apply = () => { fill.style.background = color; shade.style.opacity = dim; stage.style.background = color; };
      apply();
      let timer = 0;
      panel.append(
        colorInput('Couleur', color, (v) => { color = v; apply(); history.replaceState(null, '', '#/color/' + v.slice(1)); }),
        range('Luminosité', 10, 100, 100, 1, (v) => { dim = 1 - v / 100; apply(); }),
        select('Arrêt auto', [['0', 'jamais'], ['1', '1 min'], ['5', '5 min'], ['15', '15 min'], ['30', '30 min'], ['60', '1 h']], '0', (v) => {
          clearTimeout(timer); if (+v) timer = setTimeout(() => close(true), v * 60000);
        }),
      );
      return () => clearTimeout(timer);
    },
  };

  // Lumière pour visio
  TOOLS.light = {
    start({ wrap, panel }) {
      let k = 5200, bright = 100, mode = 'plein';
      const fill = el('div', { class: 'fill' }); wrap.append(fill);
      const apply = () => {
        const [r, g, b] = kelvin(k).map((v) => Math.round(v * bright / 100));
        const c = `rgb(${r},${g},${b})`;
        fill.style.background = mode === 'plein' ? c
          : `radial-gradient(circle at 50% 50%, #000 0 28%, ${c} 38% 60%, #000 70%)`;
        if (mode === 'cadre') fill.style.background = `linear-gradient(#000,#000) center/70% 70% no-repeat, ${c}`;
      };
      apply();
      panel.append(
        range('Chaud ↔ Froid', 2200, 9000, k, 100, (v) => { k = v; apply(); }),
        range('Intensité', 10, 100, 100, 1, (v) => { bright = v; apply(); }),
        select('Forme', [['plein', 'Plein écran'], ['cadre', 'Cadre'], ['anneau', 'Anneau']], mode, (v) => { mode = v; apply(); }),
      );
    },
  };

  // Test de pixels morts
  TOOLS.pixels = {
    start({ wrap, panel }) {
      const seq = [['Rouge', '#ff0000'], ['Vert', '#00ff00'], ['Bleu', '#0000ff'], ['Blanc', '#ffffff'], ['Noir', '#000000'],
        ['Cyan', '#00ffff'], ['Magenta', '#ff00ff'], ['Jaune', '#ffff00'], ['Gris 50 %', '#808080']];
      let i = 0, auto = 0;
      const fill = el('div', { class: 'fill' }); wrap.append(fill);
      const label = el('span', { style: 'min-width:80px;text-align:center' });
      const show = () => { fill.style.background = seq[i][1]; label.textContent = `${i + 1}/${seq.length} · ${seq[i][0]}`; };
      const next = (d = 1) => { i = (i + d + seq.length) % seq.length; show(); };
      fill.addEventListener('click', () => next());
      const autoBtn = button('▶ Auto', () => {
        if (auto) { clearInterval(auto); auto = 0; autoBtn.textContent = '▶ Auto'; }
        else { auto = setInterval(() => next(), 2000); autoBtn.textContent = '⏸ Auto'; }
      });
      panel.append(button('◀', () => next(-1)), label, button('▶', () => next()), autoBtn);
      show();
      this.onKey = (e) => {
        if (e.key === 'ArrowRight' || e.key === ' ') { next(); return true; }
        if (e.key === 'ArrowLeft') { next(-1); return true; }
      };
      return () => clearInterval(auto);
    },
  };

  // Pas de signal : barres ou neige
  TOOLS.nosignal = {
    start({ wrap, panel }) {
      let mode = 'barres';
      const cv = canvas(wrap);
      const off = document.createElement('canvas'); const octx = off.getContext('2d');
      let bx = 40, by = 40, vx = 90, vy = 70;
      const stop = loop((dt) => {
        const { ctx, w, h } = cv;
        if (mode === 'barres') {
          const top = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
          const mid = ['#0000c0', '#131313', '#c000c0', '#131313', '#00c0c0', '#131313', '#c0c0c0'];
          const bw = w / 7;
          top.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * bw, 0, bw + 1, h * 0.67); });
          mid.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * bw, h * 0.67, bw + 1, h * 0.08); });
          const bot = ['#00214c', '#ffffff', '#32006a', '#131313', '#090909', '#131313', '#1d1d1d', '#131313'];
          const wb = [1.25, 1.25, 1.25, 1.25, 1 / 3, 1 / 3, 1 / 3, 1].map((x) => x * bw);
          let x = 0; bot.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x, h * 0.75, wb[i] + 1, h * 0.25); x += wb[i]; });
        } else {
          const sw = Math.ceil(w / 3), sh = Math.ceil(h / 3);
          if (off.width !== sw || off.height !== sh) { off.width = sw; off.height = sh; }
          const img = octx.createImageData(sw, sh); const d = img.data;
          for (let p = 0; p < d.length; p += 4) { const v = Math.random() * 255 | 0; d[p] = d[p + 1] = d[p + 2] = v; d[p + 3] = 255; }
          octx.putImageData(img, 0, 0);
          ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, w, h);
        }
        // boîte « PAS DE SIGNAL » qui flotte
        const fs = Math.max(18, Math.min(w, h) * 0.06);
        ctx.font = `700 ${fs}px system-ui, sans-serif`;
        const tw = ctx.measureText('PAS DE SIGNAL').width + fs, th = fs * 1.8;
        bx += vx * dt; by += vy * dt;
        if (bx < 0 || bx + tw > w) { vx = -vx; bx = clamp(bx, 0, Math.max(0, w - tw)); }
        if (by < 0 || by + th > h) { vy = -vy; by = clamp(by, 0, Math.max(0, h - th)); }
        ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(bx, by, tw, th);
        ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText('PAS DE SIGNAL', bx + fs / 2, by + th / 2);
      });
      panel.append(select('Mode', [['barres', 'Mire de barres'], ['neige', 'Neige télé']], mode, (v) => { mode = v; }));
      return () => { stop(); cv.stop(); };
    },
  };

  // Logo rebondissant
  TOOLS.bounce = {
    start({ wrap, panel }) {
      let text = 'Fauxtruc', hue = 0, x = 50, y = 50, vx = 160, vy = 120, corners = 0, speed = 1;
      const cv = canvas(wrap);
      const counter = el('span', {}, 'Coins : 0');
      const stop = loop((dt) => {
        const { ctx, w, h } = cv;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        const fs = Math.max(28, Math.min(w, h) * 0.09);
        ctx.font = `900 italic ${fs}px system-ui, sans-serif`;
        const tw = ctx.measureText(text).width + fs * 0.6, th = fs * 1.4;
        x += vx * dt * speed; y += vy * dt * speed;
        let hx = false, hy = false;
        if (x <= 0 || x + tw >= w) { vx = -vx; x = clamp(x, 0, Math.max(0, w - tw)); hx = true; }
        if (y <= 0 || y + th >= h) { vy = -vy; y = clamp(y, 0, Math.max(0, h - th)); hy = true; }
        if (hx || hy) hue = (hue + 67) % 360;
        if (hx && hy) { corners++; counter.textContent = 'Coins : ' + corners + ' 🎉'; }
        const col = `hsl(${hue} 90% 60%)`;
        ctx.strokeStyle = col; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(x + tw / 2, y + th / 2, tw / 2, th / 2, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, x + tw / 2, y + th / 2);
      });
      const inp = el('input', { type: 'text', value: text, maxlength: 24, style: 'width:120px' });
      inp.addEventListener('input', () => { text = inp.value || ' '; });
      const l = el('label', {}, 'Texte'); l.append(inp);
      panel.append(l, range('Vitesse', 0.3, 4, 1, 0.1, (v) => { speed = v; }), counter);
      return () => { stop(); cv.stop(); };
    },
  };

  // Pluie de code
  TOOLS.matrix = {
    start({ wrap, panel }) {
      const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789ABCDEF<>{}=+*';
      let color = '#2bff6a', speed = 1, cols = [], fs = 18;
      const cv = canvas(wrap, (o) => {
        fs = Math.max(14, Math.round(o.w / 80));
        cols = Array.from({ length: Math.ceil(o.w / fs) }, () => Math.random() * -o.h / fs);
        o.ctx.fillStyle = '#000'; o.ctx.fillRect(0, 0, o.w, o.h);
      });
      let acc = 0;
      const stop = loop((dt) => {
        acc += dt * speed; if (acc < 0.05) return; acc = 0;
        const { ctx, w, h } = cv;
        ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(0, 0, w, h);
        ctx.font = `${fs}px ui-monospace, monospace`;
        cols.forEach((yy, i) => {
          const ch = chars[Math.random() * chars.length | 0];
          ctx.fillStyle = Math.random() < 0.05 ? '#fff' : color;
          ctx.fillText(ch, i * fs, yy * fs);
          cols[i] = yy * fs > h && Math.random() > 0.975 ? 0 : yy + 1;
        });
      });
      panel.append(colorInput('Couleur', color, (v) => { color = v; }), range('Vitesse', 0.3, 3, 1, 0.1, (v) => { speed = v; }));
      return () => { stop(); cv.stop(); };
    },
  };

  // Fausse mise à jour (générique, sans marque)
  TOOLS.update = {
    start({ wrap, panel }) {
      let pct = 0, rate = 1, bg = '#0d3b66';
      const box = el('div', { class: 'center update' },
        '<div class="spin"></div><h1>Mise à jour en cours <span class="p">0</span> %</h1>' +
        '<p>Ne pas éteindre votre ordinateur.</p><p>Cela peut prendre un certain temps.</p>');
      wrap.append(box);
      const p = $('.p', box);
      const tick = setInterval(() => {
        // progression volontairement irrégulière et de plus en plus lente
        if (Math.random() < 0.55) pct = Math.min(99, pct + Math.random() * rate * (1 - pct / 110));
        p.textContent = Math.floor(pct);
      }, 1200);
      const apply = () => { box.style.background = bg; };
      apply();
      panel.append(
        select('Rythme', [['0.3', 'Escargot'], ['1', 'Normal'], ['4', 'Rapide']], '1', (v) => { rate = +v; }),
        select('Fond', [['#0d3b66', 'Bleu'], ['#000000', 'Noir'], ['#1e1e1e', 'Gris foncé']], bg, (v) => { bg = v; apply(); }),
        button('Remettre à 0', () => { pct = 0; p.textContent = 0; }),
      );
      return () => clearInterval(tick);
    },
  };

  // Écran cassé
  TOOLS.broken = {
    start({ wrap, panel }) {
      let bg = '#050505';
      const cracks = [];
      let cv = null;
      cv = canvas(wrap, () => cv && draw());
      function rnd(a, b) { return a + Math.random() * (b - a); }
      function makeCrack(x, y) {
        const rays = [], rings = [], n = 10 + (Math.random() * 8 | 0);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + rnd(-0.2, 0.2);
          const pts = [[x, y]]; let px = x, py = y, ang = a;
          const len = rnd(150, Math.max(cv.w, cv.h) * 0.9);
          for (let d = 0; d < len;) {
            const step = rnd(15, 60); d += step; ang += rnd(-0.35, 0.35);
            px += Math.cos(ang) * step; py += Math.sin(ang) * step; pts.push([px, py]);
            if (Math.random() < 0.12) { // petite branche
              const b = [[px, py]]; let bx = px, by = py, ba = ang + rnd(-1, 1);
              for (let k = 0; k < 4; k++) { bx += Math.cos(ba) * rnd(10, 40); by += Math.sin(ba) * rnd(10, 40); ba += rnd(-0.4, 0.4); b.push([bx, by]); }
              rays.push({ pts: b, w: 0.7 });
            }
          }
          rays.push({ pts, w: rnd(0.8, 1.8) });
        }
        for (let r = 1; r <= 3; r++) {
          const rad = r * rnd(25, 55);
          rings.push({ rad, start: rnd(0, Math.PI * 2), span: rnd(Math.PI, Math.PI * 2) });
        }
        cracks.push({ x, y, rays, rings });
      }
      function draw() {
        const { ctx, w, h } = cv;
        ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
        const lightBg = lum(bg) > 0.5;
        for (const c of cracks) {
          const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 60);
          g.addColorStop(0, lightBg ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, 60, 0, Math.PI * 2); ctx.fill();
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          for (const pass of [0, 1]) {
            ctx.strokeStyle = pass ? (lightBg ? 'rgba(40,40,40,.85)' : 'rgba(230,235,240,.85)') : (lightBg ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.6)');
            for (const r of c.rays) {
              ctx.lineWidth = r.w + (pass ? 0 : 1.5);
              ctx.beginPath(); ctx.moveTo(r.pts[0][0], r.pts[0][1]);
              for (const [px, py] of r.pts) ctx.lineTo(px + (pass ? 0 : 0.6), py + (pass ? 0 : 0.6));
              ctx.stroke();
            }
            ctx.lineWidth = pass ? 1 : 2.5;
            for (const rg of c.rings) { ctx.beginPath(); ctx.arc(c.x, c.y, rg.rad, rg.start, rg.start + rg.span); ctx.stroke(); }
          }
        }
      }
      const onClick = (e) => { const r = wrap.getBoundingClientRect(); makeCrack(e.clientX - r.left, e.clientY - r.top); draw(); };
      wrap.addEventListener('click', onClick);
      makeCrack(cv.w * rnd(0.3, 0.7), cv.h * rnd(0.3, 0.7)); draw();
      panel.append(
        select('Fond', [['#050505', 'Noir'], ['#f4f4f4', 'Blanc'], ['#0d3b66', 'Bleu']], bg, (v) => { bg = v; draw(); }),
        button('Réparer', () => { cracks.length = 0; draw(); }),
      );
      return () => { wrap.removeEventListener('click', onClick); cv.stop(); };
    },
  };

  // Hacker express
  const CODE = `#include <stdio.h>
#include <stdlib.h>
#include "noyau/reseau.h"

/* Initialisation du module de contournement du pare-feu */
static int sonde_ports(const char *hote, int debut, int fin) {
    int ouverts = 0;
    for (int p = debut; p <= fin; ++p) {
        socket_t s = socket_ouvrir(hote, p, DELAI_MS(40));
        if (socket_valide(s)) { journal("[+] port %d ouvert", p); ++ouverts; }
        socket_fermer(s);
    }
    return ouverts;
}

int dechiffrer_bloc(uint8_t *bloc, size_t n, const cle_t *k) {
    for (size_t i = 0; i < n; i += 16) {
        aes_tour_inverse(bloc + i, k->sous_cles, 14);
        xor_vecteur(bloc + i, k->iv, 16);
    }
    return verifier_somme(bloc, n) == k->empreinte ? 0 : -EACCES;
}

void injecter_charge(session_t *ses) {
    tampon_t *t = tampon_allouer(0x4000);
    t->entete.magique = 0xDEADBEEF;
    t->entete.version = PROTO_V3;
    memcpy(t->donnees, charge_utile, taille_charge);
    if (envoyer(ses, t) < 0) panique("liaison rompue");
    attendre_ack(ses, 3000);
}

int main(int argc, char **argv) {
    printf("Connexion au serveur principal...\\n");
    session_t *ses = connecter(argv[1], 443, TLS_FORCE);
    int n = sonde_ports(argv[1], 1, 65535);
    printf("%d ports ouverts trouves\\n", n);
    cle_t *k = negocier_cle(ses, RSA_4096);
    while (!acces_accorde(ses)) {
        forcer_mot_de_passe(ses, dictionnaire, ++tentatives);
        if (tentatives % 1000 == 0) afficher_progression(tentatives);
    }
    injecter_charge(ses);
    dechiffrer_bloc(ses->tampon, ses->taille, k);
    printf("ACCES ACCORDE\\n");
    return EXIT_SUCCESS;
}
`;
  TOOLS.hacker = {
    captureKeys: true,
    start({ wrap, panel }) {
      let pos = 0, speed = 4;
      const box = el('div', { class: 'fill hacker' });
      const out = el('span'); const cur = el('span', { class: 'cur' }, '&nbsp;');
      const inner = el('div'); inner.append(out, cur); box.append(inner); wrap.append(box);
      let banner = null;
      const type = () => {
        if (banner) { banner.remove(); banner = null; }
        const chunk = CODE.slice(pos, pos + speed); pos = (pos + speed) % CODE.length;
        out.textContent += chunk;
        if (out.textContent.length > 6000) out.textContent = out.textContent.slice(-4000);
      };
      const showBanner = (ok) => {
        if (banner) banner.remove();
        banner = el('div', { class: 'banner ' + (ok ? 'ok' : 'no') }, ok ? 'ACCÈS AUTORISÉ' : 'ACCÈS REFUSÉ');
        box.append(banner);
      };
      this.onKey = (e) => {
        if (e.ctrlKey || e.metaKey || e.key === 'Escape') return false;
        if (e.key === 'Enter' && e.altKey) { showBanner(true); return true; }
        if (e.key === 'Backspace' && e.altKey) { showBanner(false); return true; }
        type(); return true;
      };
      box.addEventListener('pointerdown', type);
      panel.append(
        range('Caractères/touche', 1, 12, speed, 1, (v) => { speed = v; }),
        button('Accès autorisé', () => showBanner(true)),
        button('Accès refusé', () => showBanner(false)),
        button('Effacer', () => { out.textContent = ''; pos = 0; }),
      );
    },
  };

  // Prompteur
  TOOLS.prompter = {
    start({ wrap, panel }) {
      let saved = '';
      try { saved = localStorage.getItem('fauxtruc-prompteur') || ''; } catch { /* ignoré */ }
      let size = 48, speed = 40, mirror = false, playing = false, y = 0;
      const box = el('div', { class: 'fill prompter' });
      const txt = el('div', { class: 'txt' }); const guide = el('div', { class: 'guide' });
      box.append(txt, guide); wrap.append(box);
      const area = el('textarea', { rows: 2, style: 'width:220px', placeholder: 'Colle ton texte ici…' });
      area.value = saved || 'Bonjour à toutes et à tous !\n\nColle ton propre texte dans la case des réglages, choisis la taille et la vitesse, puis appuie sur Espace pour lancer le défilement.\n\nFlèches haut et bas : ajuster la vitesse.\nR : revenir au début.';
      const render = () => {
        txt.textContent = area.value; txt.style.fontSize = size + 'px';
        txt.style.transform = `translateY(${-y}px)` + (mirror ? ' scaleX(-1)' : '');
      };
      const reset = () => { y = -wrap.clientHeight * 0.38; render(); };
      area.addEventListener('input', () => { try { localStorage.setItem('fauxtruc-prompteur', area.value); } catch { /* ignoré */ } render(); });
      const playBtn = button('▶ Lire', () => toggle());
      const toggle = () => { playing = !playing; playBtn.textContent = playing ? '⏸ Pause' : '▶ Lire'; };
      const stop = loop((dt) => { if (playing) { y += speed * dt; if (y > txt.scrollHeight) playing = false, playBtn.textContent = '▶ Lire'; render(); } });
      const mirrorChk = el('input', { type: 'checkbox' });
      mirrorChk.addEventListener('change', () => { mirror = mirrorChk.checked; render(); });
      const ml = el('label', {}, 'Miroir'); ml.append(mirrorChk);
      panel.append(area, range('Taille', 24, 120, size, 2, (v) => { size = v; render(); }),
        range('Vitesse', 5, 200, speed, 5, (v) => { speed = v; }), ml, playBtn, button('⟲', reset));
      this.onKey = (e) => {
        if (e.key === ' ') { toggle(); return true; }
        if (e.key === 'ArrowUp') { speed = Math.min(300, speed + 10); return true; }
        if (e.key === 'ArrowDown') { speed = Math.max(0, speed - 10); return true; }
        if (e.key === 'r' || e.key === 'R') { reset(); return true; }
      };
      requestAnimationFrame(reset);
      return () => stop();
    },
  };

  // Horloge, minuteur, chronomètre
  TOOLS.clock = {
    start({ wrap, panel }) {
      let mode = 'horloge', end = 0, remaining = 5 * 60000, running = false, chronoStart = 0, chronoAcc = 0;
      const box = el('div', { class: 'center clock' }, '<div class="big"></div><div class="sub"></div>');
      wrap.append(box);
      const big = $('.big', box), sub = $('.sub', box);
      const fmt = (ms, tenths) => {
        const s = Math.max(0, ms) / 1000, h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = Math.floor(s % 60);
        const p = (n) => String(n).padStart(2, '0');
        return (h ? h + ':' + p(m) : p(m)) + ':' + p(ss) + (tenths ? '.' + Math.floor((s * 10) % 10) : '');
      };
      const minInput = el('input', { type: 'number', min: 1, max: 600, value: 5, style: 'width:64px' });
      const ml = el('label', {}, 'Minutes'); ml.append(minInput);
      const startBtn = button('▶ Démarrer', () => toggle());
      const resetBtn = button('⟲', () => reset());
      const toggle = () => {
        if (mode === 'minuteur') {
          if (running) { remaining = end - Date.now(); running = false; }
          else { if (remaining <= 0) remaining = +minInput.value * 60000; end = Date.now() + remaining; running = true; box.classList.remove('done'); }
        } else if (mode === 'chrono') {
          if (running) { chronoAcc += Date.now() - chronoStart; running = false; } else { chronoStart = Date.now(); running = true; }
        }
        startBtn.textContent = running ? '⏸ Pause' : '▶ Démarrer';
      };
      const reset = () => {
        running = false; remaining = +minInput.value * 60000; chronoAcc = 0; box.classList.remove('done');
        startBtn.textContent = '▶ Démarrer';
      };
      minInput.addEventListener('change', reset);
      const layout = () => {
        ml.style.display = mode === 'minuteur' ? '' : 'none';
        startBtn.style.display = resetBtn.style.display = mode === 'horloge' ? 'none' : '';
        reset();
      };
      const stop = loop(() => {
        const now = new Date();
        if (mode === 'horloge') {
          big.textContent = now.toLocaleTimeString('fr-FR');
          sub.textContent = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        } else if (mode === 'minuteur') {
          const left = running ? end - Date.now() : remaining;
          big.textContent = fmt(left + 999); sub.textContent = 'Compte à rebours';
          if (running && left <= 0) { running = false; remaining = 0; startBtn.textContent = '▶ Démarrer'; box.classList.add('done'); beep(4); }
        } else {
          const t = chronoAcc + (running ? Date.now() - chronoStart : 0);
          big.textContent = fmt(t, true); sub.textContent = 'Chronomètre';
        }
      });
      panel.append(select('Mode', [['horloge', 'Horloge'], ['minuteur', 'Minuteur'], ['chrono', 'Chronomètre']], mode, (v) => { mode = v; layout(); }),
        ml, startBtn, resetBtn);
      layout();
      this.onKey = (e) => { if (e.key === ' ' && mode !== 'horloge') { toggle(); return true; } };
      return () => stop();
    },
  };

  // Bruit blanc / rose / brun
  TOOLS.noise = {
    start({ wrap, panel }) {
      let type = 'rose', vol = 0.4, ctx = null, src = null, gain = null;
      const box = el('div', { class: 'center noise' }, '<div class="ring"></div><h2 style="margin:0;font-weight:300">Respire…</h2><p style="opacity:.6">Inspire quand le cercle grandit, expire quand il rétrécit.</p>');
      wrap.append(box);
      const buffer = (kind) => {
        const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          if (kind === 'blanc') d[i] = w * 0.5;
          else if (kind === 'brun') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
          else {
            b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
            b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
            d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
          }
        }
        return buf;
      };
      const play = () => {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        stopSound();
        gain = ctx.createGain(); gain.gain.value = vol; gain.connect(ctx.destination);
        src = ctx.createBufferSource(); src.buffer = buffer(type); src.loop = true; src.connect(gain); src.start();
        ctx.resume(); btn.textContent = '⏹ Stop';
      };
      const stopSound = () => { if (src) { try { src.stop(); } catch { /* ignoré */ } src.disconnect(); src = null; } btn.textContent = '▶ Écouter'; };
      const btn = button('▶ Écouter', () => (src ? stopSound() : play()));
      panel.append(btn,
        select('Type', [['blanc', 'Blanc'], ['rose', 'Rose'], ['brun', 'Brun']], type, (v) => { type = v; if (src) play(); }),
        range('Volume', 0, 1, vol, 0.01, (v) => { vol = v; if (gain) gain.gain.value = v; }));
      return () => { stopSound(); if (ctx) ctx.close(); };
    },
  };

  // Dégradé animé
  TOOLS.gradient = {
    start({ wrap, panel }) {
      let speed = 1, h = Math.random() * 360;
      const fill = el('div', { class: 'fill' }); wrap.append(fill);
      const stop = loop((dt) => {
        h = (h + dt * 12 * speed) % 360;
        fill.style.background = `linear-gradient(${h}deg, hsl(${h} 80% 55%), hsl(${(h + 70) % 360} 80% 50%), hsl(${(h + 160) % 360} 75% 45%))`;
      });
      panel.append(range('Vitesse', 0.1, 6, 1, 0.1, (v) => { speed = v; }));
      return () => stop();
    },
  };

  route();
})();
