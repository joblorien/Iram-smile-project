/* ============================================================
   MAGICAL BIRTHDAY CARD — script.js
   ============================================================ */
(function () {
  'use strict';

  /* ── DOM refs ─────────────────────────────────────────────── */
  const envelopeWrap = document.getElementById('envelopeWrap');
  const envelope     = document.getElementById('envelope');
  const envFlapTop   = document.getElementById('envFlapTop');
  const cardScene    = document.getElementById('cardScene');
  const cardBook     = document.getElementById('cardBook');
  const pageFront    = document.getElementById('pageFront');
  const pageInner    = document.getElementById('pageInner');
  const swipeHint    = document.getElementById('swipeHint');
  const hint         = document.getElementById('hint');
  const canvas       = document.getElementById('particleCanvas');
  const ctx          = canvas.getContext('2d');
  const bgHearts     = document.getElementById('bg-hearts');

  /* ── State ────────────────────────────────────────────────── */
  let envelopeOpened  = false;
  let cardOpened      = false;
  let explosionFired  = false;
  let dragActive      = false;
  let dragStartX      = 0;
  let currentAngle    = 0;   // current rotation of front page (0 = closed, -180 = open)
  let targetAngle     = 0;
  let particles       = [];
  let ambientHearts   = [];
  let animFrame;

  /* ── Resize canvas ────────────────────────────────────────── */
  function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  /* ================================================================
     BACKGROUND FLOATING HEARTS
  ================================================================ */
  const HEART_CHARS = ['💗', '💕', '💖', '💓', '🌸', '✨', '💝'];
  const BG_COUNT    = 28;

  function createBgHeart() {
    const el = document.createElement('span');
    el.className = 'bg-heart';
    el.textContent = HEART_CHARS[Math.floor(Math.random() * HEART_CHARS.length)];
    el.style.left     = Math.random() * 100 + 'vw';
    el.style.fontSize = (0.8 + Math.random() * 1.6) + 'rem';
    const dur  = 7 + Math.random() * 10;
    const del  = Math.random() * 12;
    el.style.animationDuration = dur + 's';
    el.style.animationDelay   = del + 's';
    bgHearts.appendChild(el);
  }
  for (let i = 0; i < BG_COUNT; i++) createBgHeart();

  /* ================================================================
     ENVELOPE CLICK
  ================================================================ */
  envelopeWrap.addEventListener('click', openEnvelope);
  envelopeWrap.addEventListener('touchend', e => { e.preventDefault(); openEnvelope(); }, { passive: false });

  function openEnvelope() {
    if (envelopeOpened) return;
    envelopeOpened = true;

    hint.classList.add('hidden');
    envelopeWrap.style.cursor = 'default';
    envelopeWrap.classList.add('clicked');

    // Pop effect then open flap
    setTimeout(() => {
      envelopeWrap.classList.remove('clicked');
      envelope.classList.add('open');
    }, 150);

    // After flap opens, slide card out
    setTimeout(() => {
      slideCardOut();
    }, 900);
  }

  function slideCardOut() {
    // Position card scene over envelope
    cardScene.style.transition = 'none';
    cardScene.style.opacity    = '0';
    cardScene.style.transform  = 'translateY(30px) scale(0.9)';
    cardScene.classList.add('visible');

    // Fade envelope out simultaneously
    envelopeWrap.style.transition = 'opacity 0.6s, transform 0.6s';
    envelopeWrap.style.opacity    = '0';
    envelopeWrap.style.transform  = 'translateY(20px) scale(0.9)';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        cardScene.style.transition = 'opacity 0.6s, transform 0.6s cubic-bezier(0.2, 0, 0.2, 1)';
        cardScene.style.opacity    = '1';
        cardScene.style.transform  = 'translateY(0) scale(1)';
      });
    });

    // Show new hint
    setTimeout(() => {
      hint.classList.remove('hidden');
      hint.querySelector('span').textContent = '← Swipe card to open →';
    }, 800);

    // Start ambient canvas loop
    startAmbientLoop();
  }

  /* ================================================================
     CARD SWIPE INTERACTION
  ================================================================ */
  // The front page rotates around its LEFT edge (transform-origin: left center)
  // angle 0 = closed (facing user), angle -180 = fully open (flipped left)

  pageFront.style.transformOrigin = 'left center';
  pageFront.style.transform       = 'perspective(1200px) rotateY(0deg)';
  pageFront.style.transition      = 'none';
  pageFront.style.zIndex          = '3';

  // Book needs perspective
  cardBook.style.perspective      = '1200px';
  cardBook.style.perspectiveOrigin = 'center center';

  /* Mouse */
  pageFront.addEventListener('mousedown',  onDragStart);
  window.addEventListener  ('mousemove',  onDragMove);
  window.addEventListener  ('mouseup',    onDragEnd);

  /* Touch */
  pageFront.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener  ('touchmove',  onTouchMove,  { passive: false });
  window.addEventListener  ('touchend',   onTouchEnd,   { passive: true });

  function onDragStart(e) {
    if (!envelopeOpened) return;
    dragActive = true;
    dragStartX = e.clientX;
    pageFront.style.transition = 'none';
    e.preventDefault();
  }
  function onTouchStart(e) {
    if (!envelopeOpened) return;
    dragActive = true;
    dragStartX = e.touches[0].clientX;
    pageFront.style.transition = 'none';
  }

  function onDragMove(e) {
    if (!dragActive) return;
    const clientX = e.clientX;
    handleMove(clientX);
  }
  function onTouchMove(e) {
    if (!dragActive) return;
    e.preventDefault();
    handleMove(e.touches[0].clientX);
  }

  function handleMove(clientX) {
    const cardW   = cardBook.offsetWidth;
    const delta   = clientX - dragStartX;
    // Map drag distance to angle: dragging full card width = -180deg
    const dragAngle = (delta / (cardW * 0.7)) * -180;
    let raw = currentAngle + dragAngle;
    raw = Math.max(-180, Math.min(0, raw));
    applyAngle(raw);

    // Show inner content as card opens
    const progress = Math.abs(raw) / 180; // 0–1
    if (progress > 0.15) {
      swipeHint.classList.add('hidden');
      hint.classList.add('hidden');
    }
    if (progress > 0.5 && !explosionFired) {
      explosionFired = true;
      triggerHeartExplosion();
      const rect2 = cardBook.getBoundingClientRect();
      spawnStarBurst(rect2.left + rect2.width * 0.5, rect2.top + rect2.height * 0.5);
    }
  }

  function onDragEnd() {
    if (!dragActive) return;
    dragActive = false;
    snapCard();
  }
  function onTouchEnd() {
    if (!dragActive) return;
    dragActive = false;
    snapCard();
  }

  function applyAngle(angle) {
    targetAngle = angle;
    // Add a subtle 3D lift as it opens
    const lift  = Math.sin(Math.abs(angle) / 180 * Math.PI) * 12;
    pageFront.style.transform =
      `perspective(1200px) rotateY(${angle}deg) translateZ(${lift}px)`;

    // Dynamic shadow
    const progress = Math.abs(angle) / 180;
    pageFront.style.boxShadow = `
      ${-8 * progress}px 0 ${20 * progress + 10}px rgba(200,40,100,${0.15 + 0.2 * progress}),
      0 12px 40px rgba(233,30,140,0.18)
    `;
  }

  function snapCard() {
    pageFront.style.transition = 'transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94), box-shadow 0.45s';
    const progress = Math.abs(targetAngle) / 180;

    if (progress > 0.45) {
      // Snap open
      applyAngle(-180);
      currentAngle = -180;
      if (!cardOpened) {
        cardOpened = true;
        onCardFullyOpen();
      }
    } else {
      // Snap closed
      applyAngle(0);
      currentAngle = 0;
      cardOpened = false;
    }
  }

  function onCardFullyOpen() {
    pageFront.classList.add('opened');
  }

  /* ================================================================
     HEART EXPLOSION PARTICLES
  ================================================================ */
  const HEART_GLYPHS = ['💗', '💖', '💕', '💓', '💝', '✨', '🌸'];

  function triggerHeartExplosion() {
    const rect   = cardBook.getBoundingClientRect();
    const cx     = rect.left + rect.width  * 0.5;
    const cy     = rect.top  + rect.height * 0.5;
    const count  = 32;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.4;
      const speed = 3.5 + Math.random() * 5.5;
      const size  = 14 + Math.random() * 22;

      particles.push({
        x:      cx,
        y:      cy,
        vx:     Math.cos(angle) * speed,
        vy:     Math.sin(angle) * speed - 2,
        size:   size,
        alpha:  1,
        glyph:  HEART_GLYPHS[Math.floor(Math.random() * HEART_GLYPHS.length)],
        trail:  [],
        life:   1,
        decay:  0.012 + Math.random() * 0.012,
        spark:  Math.random() > 0.55,
        phase: 'burst',
      });
    }
  }

  /* ================================================================
     AMBIENT CARD HEARTS (after open)
  ================================================================ */
  let ambientTimer = null;

  function spawnAmbientHeart() {
    if (!envelopeOpened) return;
    const rect  = cardBook.getBoundingClientRect();
    const x     = rect.left + rect.width * 0.3 + Math.random() * rect.width * 0.4;
    const y     = rect.top  + rect.height * 0.4 + Math.random() * rect.height * 0.2;
    const size  = 10 + Math.random() * 14;

    ambientHearts.push({
      x, y,
      vx:    (Math.random() - 0.5) * 1.2,
      vy:    -(0.8 + Math.random() * 1.4),
      size,
      alpha: 0.85,
      glyph: HEART_GLYPHS[Math.floor(Math.random() * 5)],
      decay: 0.007 + Math.random() * 0.006,
    });
  }

  function startAmbientLoop() {
    ambientTimer = setInterval(spawnAmbientHeart, 600);
    loop();
  }

  /* ================================================================
     CANVAS ANIMATION LOOP
  ================================================================ */
  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateParticles();
    updateAmbient();
    animFrame = requestAnimationFrame(loop);
  }

  function updateParticles() {
    particles = particles.filter(p => p.alpha > 0.02);
    for (const p of particles) {
      // Phase: burst → float
      if (p.phase === 'burst') {
        p.vx *= 0.91;
        p.vy *= 0.91;
        if (Math.abs(p.vx) < 0.5 && Math.abs(p.vy) < 0.5) p.phase = 'float';
      } else {
        p.vx *= 0.97;
        p.vy  = p.vy * 0.97 - 0.08; // gentle upward float
      }

      // Trail
      if (p.spark) {
        p.trail.push({ x: p.x, y: p.y, a: p.alpha });
        if (p.trail.length > 6) p.trail.shift();
        for (let i = 0; i < p.trail.length; i++) {
          const t = p.trail[i];
          const ta = (i / p.trail.length) * t.a * 0.35;
          drawSparkle(t.x, t.y, 3 * (i / p.trail.length), ta);
        }
      }

      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      p.size  *= 0.998;

      drawGlyph(ctx, p.glyph, p.x, p.y, p.size, p.alpha);
    }
  }

  function updateAmbient() {
    ambientHearts = ambientHearts.filter(h => h.alpha > 0.02);
    for (const h of ambientHearts) {
      h.x += h.vx;
      h.y += h.vy;
      h.vy  -= 0.025;
      h.vx  += (Math.random() - 0.5) * 0.04;
      h.alpha -= h.decay;
      drawGlyph(ctx, h.glyph, h.x, h.y, h.size, h.alpha);
    }
  }

  function drawGlyph(context, glyph, x, y, size, alpha) {
    context.save();
    context.globalAlpha = Math.max(0, alpha);
    context.font = `${size}px serif`;
    context.textAlign    = 'center';
    context.textBaseline = 'middle';
    // Glow
    context.shadowColor = 'rgba(255,100,160,0.8)';
    context.shadowBlur  = size * 0.6;
    context.fillText(glyph, x, y);
    context.restore();
  }

  function drawSparkle(x, y, size, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = '#ffe4ef';
    ctx.shadowColor = '#ff6eb4';
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const r = i % 2 === 0 ? size : size * 0.3;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* ================================================================
     EXTRA MAGIC TOUCHES
  ================================================================ */

  // Twinkling stars overlay on card open
  function spawnStarBurst(originX, originY) {
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 / 12) * i;
      particles.push({
        x: originX, y: originY,
        vx: Math.cos(a) * (2 + Math.random() * 3),
        vy: Math.sin(a) * (2 + Math.random() * 3),
        size: 8 + Math.random() * 10,
        alpha: 1,
        glyph: '✨',
        trail: [], spark: false,
        life: 1, decay: 0.025,
        phase: 'burst',
      });
    }
  }

  /* ================================================================
     MUSIC/AUDIO — subtle chime on envelope open (Web Audio)
  ================================================================ */
  function playChime() {
    try {
      const ac  = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6
      notes.forEach((freq, i) => {
        const osc  = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ac.currentTime + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.12, ac.currentTime + i * 0.12 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.12 + 0.6);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(ac.currentTime + i * 0.12);
        osc.stop(ac.currentTime + i * 0.12 + 0.7);
      });
    } catch (_) { /* audio not available */ }
  }

  envelopeWrap.addEventListener('click', playChime, { once: true });
  envelopeWrap.addEventListener('touchend', playChime, { once: true });

  /* ================================================================
     KEYBOARD accessibility — Enter/Space opens envelope
  ================================================================ */
  envelopeWrap.setAttribute('tabindex', '0');
  envelopeWrap.setAttribute('role', 'button');
  envelopeWrap.setAttribute('aria-label', 'Open birthday card envelope');
  envelopeWrap.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEnvelope(); }
  });

})();
