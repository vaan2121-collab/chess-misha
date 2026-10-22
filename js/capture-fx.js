// Анимация взятия: у каждой фигуры своя атака, у съеденной — крестики в глазах,
// и она рассыпается на кубики. Всё рисуется копиями фигур в отдельном слое поверх
// страницы, поэтому сама доска и правила ничего не знают об анимации.
window.CaptureFX = (function () {
  // Где глаза на картинке фигуры: [x%, y%, расстояние между глазами %]. 0 — один глаз (кони в профиль).
  const EYES = {
    wK: [55, 34, 8], wQ: [50, 30, 7], wR: [60, 45, 8], wB: [52, 40, 7], wN: [58, 34, 0], wP: [50, 42, 9],
    bK: [52, 34, 8], bQ: [45, 32, 7], bR: [40, 43, 11], bB: [45, 40, 7], bN: [46, 32, 0], bP: [45, 43, 10]
  };
  const WORDS = ['БАХ!', 'БУМ!', 'ХРЯСЬ!', 'БДЫЩ!', 'ТРАХ!'];
  const DUST = { w: ['#f3e6c4', '#d9c49a', '#fff8e6'], b: ['#5a3f78', '#3a2850', '#7d5a9e'] };
  const GRID = 6; // кубиков по стороне

  let layer = null;
  const getLayer = () => {
    if (!layer || !layer.isConnected) {
      layer = document.createElement('div');
      layer.className = 'fx-layer';
      document.body.appendChild(layer);
    }
    return layer;
  };
  const speed = () => (CONFIG.captureFx && CONFIG.captureFx.speed) || 1;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms / speed()));
  const rand = (a, b) => a + Math.random() * (b - a);
  const T = (x, y, extra) => 'translate(' + x + 'px,' + y + 'px) ' + (extra || '');

  function anim(el, frames, ms, opts) {
    const a = el.animate(frames, Object.assign({ duration: ms / speed(), fill: 'forwards', easing: 'ease-in-out' }, opts));
    return a.finished.catch(() => {});
  }

  function enabled() {
    const c = CONFIG.captureFx || {};
    if (c.enabled === false) return false;
    return !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // Копия фигуры в «обёртке» поверх страницы — её и двигаем.
  function cloneAt(el, rect) {
    const wrap = document.createElement('div');
    wrap.className = 'fx-piece';
    Object.assign(wrap.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
    const c = el.cloneNode(true);
    c.classList.remove('landed');
    c.style.cssText = 'width:100%;height:100%;position:static;inset:auto;animation:none;visibility:visible;font-size:' + getComputedStyle(el).fontSize;
    wrap.appendChild(c);
    getLayer().appendChild(wrap);
    return wrap;
  }

  // Картинка жертвы: у фигур — <img>, у врагов из уроков — фон значка.
  function imageOf(el) {
    if (el.tagName === 'IMG') return el.src;
    const m = getComputedStyle(el).backgroundImage.match(/url\("?(.*?)"?\)/);
    return m ? m[1] : null;
  }

  // ---------- Мелкие эффекты ----------
  function popAt(cls, rect, size, frames, ms) {
    const el = document.createElement('div');
    el.className = cls;
    const s = size || rect.width;
    Object.assign(el.style, {
      left: rect.left + rect.width / 2 - s / 2 + 'px',
      top: rect.top + rect.height / 2 - s / 2 + 'px',
      width: s + 'px', height: s + 'px'
    });
    getLayer().appendChild(el);
    anim(el, frames, ms, { easing: 'ease-out' }).then(() => el.remove());
    return el;
  }

  function word(rect, words) {
    const el = document.createElement('div');
    el.className = 'fx-word';
    el.textContent = words[Math.floor(Math.random() * words.length)];
    el.style.left = rect.left + rect.width / 2 + 'px';
    el.style.top = rect.top + 'px';
    el.style.fontSize = Math.max(18, rect.width * 0.42) + 'px';
    getLayer().appendChild(el);
    anim(el, [
      { transform: 'translate(-50%,-30%) scale(0.3) rotate(-12deg)', opacity: 1 },
      { transform: 'translate(-50%,-90%) scale(1.15) rotate(-6deg)', opacity: 1, offset: 0.3 },
      { transform: 'translate(-50%,-130%) scale(1) rotate(-4deg)', opacity: 0 }
    ], 750).then(() => el.remove());
  }

  function particles(rect, colors, count, power) {
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'fx-bit';
      const s = rect.width * rand(0.06, 0.12);
      Object.assign(p.style, { left: cx - s / 2 + 'px', top: cy - s / 2 + 'px', width: s + 'px', height: s + 'px', background: colors[i % colors.length] });
      getLayer().appendChild(p);
      const a = rand(0, Math.PI * 2), d = rect.width * rand(0.4, 1) * power;
      anim(p, [
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        { transform: T(Math.cos(a) * d, Math.sin(a) * d - rect.width * 0.2, 'rotate(' + rand(-180, 180) + 'deg)'), opacity: 0 }
      ], rand(350, 600), { easing: 'ease-out' }).then(() => p.remove());
    }
  }

  function shakeBoard(boardEl) {
    if (!boardEl) return;
    anim(boardEl, [
      { transform: 'translate(0,0)' }, { transform: 'translate(-5px,3px)' }, { transform: 'translate(5px,-3px)' },
      { transform: 'translate(-3px,2px)' }, { transform: 'translate(0,0)' }
    ], 240, { fill: 'none' });
  }

  // ---------- Атаки ----------
  // c: { atk, dx, dy, ux, uy, cell, stop(d), hit(), ... }. Возвращает конечную позицию атакующего.
  const ATTACKS = {
    // Ладья — таран: подъезжает, откатывается и врезается.
    r: async (c) => {
      const s = c.stop(0.85);
      await anim(c.atk, [{ transform: T(0, 0) }, { transform: T(s.x, s.y) }], 280);
      const b = { x: s.x - c.ux * c.cell * 0.28, y: s.y - c.uy * c.cell * 0.28 };
      await anim(c.atk, [{ transform: T(s.x, s.y) }, { transform: T(b.x, b.y, 'scale(0.9,1.07)') }], 170);
      const h = c.stop(0.35);
      await anim(c.atk, [{ transform: T(b.x, b.y, 'scale(0.9,1.07)') }, { transform: T(h.x, h.y, 'scale(1.1,0.94)') }], 90, { easing: 'ease-in' });
      c.hit('hitR');
      c.knock(0.22);
      particles(c.vRect, ['#9e9e9e', '#c8c8c8', '#6d6d6d'], 10, 0.9);
      await anim(c.atk, [{ transform: T(h.x, h.y, 'scale(1.1,0.94)') }, { transform: T(s.x, s.y) }], 140);
      return s;
    },

    // Слон — бьёт издалека: поднимает посох, светится, и в жертву бьёт молния с неба.
    b: async (c) => {
      const s = c.stand(1.3);
      if (s.x || s.y) await anim(c.atk, [{ transform: T(0, 0) }, { transform: T(s.x, s.y) }], 260);
      const glow = 'drop-shadow(0 0 10px #ffd54a) brightness(1.25)';
      const up = T(s.x, s.y - c.cell * 0.35, 'scale(1.15) rotate(-8deg)');
      await anim(c.atk, [{ transform: T(s.x, s.y), filter: 'none' }, { transform: up, filter: glow }], 260, { easing: 'ease-out' });
      await bolt(c);
      c.hit('hitB');
      c.knock(0.12);
      particles(c.vRect, ['#ffd54a', '#fff59d', '#ffffff', '#ffb300'], 20, 1.2);
      await anim(c.atk, [{ transform: up, filter: glow }, { transform: T(s.x, s.y), filter: 'none' }], 180);
      return s;
    },

    // Конь — прыжок дугой и удар копытами сверху.
    n: async (c) => {
      const s = c.stop(0.55);
      const peak = T(s.x * 0.5, Math.min(0, s.y * 0.5) - c.cell * 1.2, 'rotate(-12deg)');
      const above = T(s.x, s.y - c.cell * 0.7, 'rotate(10deg)');
      await anim(c.atk, [{ transform: T(0, 0) }, { transform: peak, offset: 0.5 }, { transform: above }], 420, { easing: 'ease-out' });
      const land = T(s.x, s.y, 'scale(1.14,0.86)');
      await anim(c.atk, [{ transform: above }, { transform: land }], 100, { easing: 'ease-in' });
      c.hit('hitN');
      c.knock(0.15);
      particles(c.vRect, ['#bfa27a', '#e0cfa8', '#8d7350'], 14, 0.8);
      await anim(c.atk, [{ transform: land }, { transform: T(s.x, s.y) }], 120);
      return s;
    },

    // Ферзь — светится и пускает волшебный шар.
    q: async (c) => {
      const s = c.stop(Math.min(1.4, c.dist / c.cell * 0.6));
      await anim(c.atk, [{ transform: T(0, 0) }, { transform: T(s.x, s.y) }], 260);
      const glow = 'drop-shadow(0 0 10px #ff6ad5) brightness(1.3)';
      await anim(c.atk, [{ transform: T(s.x, s.y), filter: 'none' }, { transform: T(s.x, s.y, 'scale(1.12)'), filter: glow }], 220);
      // шар летит от ферзя к жертве
      const orb = document.createElement('div');
      orb.className = 'fx-orb';
      const os = c.cell * 0.4;
      Object.assign(orb.style, { left: c.aRect.left + c.aRect.width / 2 - os / 2 + 'px', top: c.aRect.top + c.aRect.height / 2 - os / 2 + 'px', width: os + 'px', height: os + 'px' });
      getLayer().appendChild(orb);
      await anim(orb, [{ transform: T(s.x, s.y, 'scale(0.4)') }, { transform: T(c.dx, c.dy, 'scale(1.2)') }], 200, { easing: 'ease-in' });
      orb.remove();
      c.hit('hitQ');
      c.knock(0.18);
      particles(c.vRect, ['#ff8be0', '#ffd1f5', '#b388ff', '#ffffff'], 18, 1.2);
      await anim(c.atk, [{ transform: T(s.x, s.y, 'scale(1.12)'), filter: glow }, { transform: T(s.x, s.y), filter: 'none' }], 150);
      return s;
    },

    // Пешка — отходит, приседает и бьёт щитом два раза: «бонк-БОНК».
    p: async (c) => {
      const s = c.stand(0.9);
      const tilt = c.ux >= 0 ? 1 : -1;
      const back = { x: s.x - c.ux * c.cell * 0.32, y: s.y - c.uy * c.cell * 0.32 };
      const crouch = T(back.x, back.y, 'scale(1.12,0.84)');
      await anim(c.atk, [{ transform: T(0, 0) }, { transform: crouch }], 180);
      const h = c.stop(0.45);
      const bash1 = T(h.x, h.y, 'rotate(' + 12 * tilt + 'deg) scale(1.05)');
      await anim(c.atk, [{ transform: crouch }, { transform: bash1 }], 100, { easing: 'ease-in' });
      c.hit('hitP');
      c.knock(0.14);
      ring(c, '#cfd8dc');
      const mid = T(h.x - c.ux * c.cell * 0.25, h.y - c.uy * c.cell * 0.25, 'scale(1.1,0.88)');
      await anim(c.atk, [{ transform: bash1 }, { transform: mid }], 130);
      const bash2 = T(h.x, h.y, 'rotate(' + -14 * tilt + 'deg) scale(1.14)');
      await anim(c.atk, [{ transform: mid }, { transform: bash2 }], 90, { easing: 'ease-in' });
      Sound.play('hitP');
      c.knock(0.24);
      ring(c, '#ffffff');
      particles(c.vRect, ['#cfd8dc', '#ffffff', '#90a4ae'], 14, 1);
      await anim(c.atk, [{ transform: bash2 }, { transform: T(s.x, s.y) }], 150);
      return s;
    },

    // Король — большой замах и два удара мечом крест-накрест: «вжик-вжик».
    k: async (c) => {
      const s = c.stand(0.95);
      const side = c.ux >= 0 ? 1 : -1;
      if (s.x || s.y) await anim(c.atk, [{ transform: T(0, 0) }, { transform: T(s.x, s.y) }], 240);
      const wind = T(s.x - c.ux * c.cell * 0.22, s.y - c.uy * c.cell * 0.22 - c.cell * 0.28, 'rotate(' + -35 * side + 'deg) scale(1.12)');
      await anim(c.atk, [{ transform: T(s.x, s.y) }, { transform: wind }], 240, { easing: 'ease-out' });
      // удар 1: сверху вниз
      slash(c, side, -60);
      const cut1 = T(s.x + c.ux * c.cell * 0.28, s.y + c.uy * c.cell * 0.28, 'rotate(' + 32 * side + 'deg)');
      await anim(c.atk, [{ transform: wind }, { transform: cut1 }], 90, { easing: 'ease-in' });
      c.hit('hitK');
      c.knock(0.15);
      // удар 2: обратным взмахом
      const wind2 = T(s.x, s.y - c.cell * 0.18, 'rotate(' + -20 * side + 'deg) scale(1.08)');
      await anim(c.atk, [{ transform: cut1 }, { transform: wind2 }], 130);
      slash(c, -side, 30);
      const cut2 = T(s.x + c.ux * c.cell * 0.3, s.y + c.uy * c.cell * 0.3, 'rotate(' + 24 * side + 'deg)');
      await anim(c.atk, [{ transform: wind2 }, { transform: cut2 }], 80, { easing: 'ease-in' });
      Sound.play('hitK');
      c.knock(0.22);
      particles(c.vRect, ['#ffffff', '#ffe082', '#e0e0e0'], 16, 1.1);
      await anim(c.atk, [{ transform: cut2 }, { transform: T(s.x, s.y) }], 150);
      return s;
    }
  };

  // Светящаяся дуга меча по жертве. start — с какого угла начинается взмах.
  function slash(c, side, start) {
    popAt('fx-slash', c.vRect, c.cell * 1.6, [
      { transform: 'rotate(' + start * side + 'deg) scale(0.5)', opacity: 0 },
      { transform: 'rotate(' + (start + 60) * side + 'deg) scale(1)', opacity: 1, offset: 0.45 },
      { transform: 'rotate(' + (start + 130) * side + 'deg) scale(1.15)', opacity: 0 }
    ], 300);
  }

  // Ударная волна от щита.
  function ring(c, color) {
    const el = popAt('fx-ring', c.vRect, c.cell * 0.9, [
      { transform: 'scale(0.3)', opacity: 1 }, { transform: 'scale(1.6)', opacity: 0 }
    ], 320);
    el.style.borderColor = color;
  }

  // Молния слона: с неба в центр жертвы, мигает.
  function bolt(c) {
    const el = document.createElement('div');
    el.className = 'fx-bolt';
    const w = c.cell * 0.8, h = c.vRect.top + c.vRect.height / 2 + 10; // от верха экрана до жертвы
    Object.assign(el.style, {
      left: c.vRect.left + c.vRect.width / 2 - w / 2 + 'px',
      top: c.vRect.top + c.vRect.height / 2 - h + 'px',
      width: w + 'px', height: h + 'px'
    });
    el.innerHTML =
      '<svg viewBox="0 0 20 100" preserveAspectRatio="none" width="100%" height="100%">' +
      '<polyline points="12,0 6,22 14,30 5,55 13,62 8,82 10,100" fill="none" stroke="#ffd54a" stroke-width="5" stroke-linejoin="bevel"/>' +
      '<polyline points="12,0 6,22 14,30 5,55 13,62 8,82 10,100" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="bevel"/>' +
      '</svg>';
    getLayer().appendChild(el);
    return anim(el, [
      { opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0.2, offset: 0.35 },
      { opacity: 1, offset: 0.55 }, { opacity: 0 }
    ], 320, { easing: 'linear' }).then(() => el.remove());
  }

  // ---------- Наборы фигур со своими атаками ----------
  // Снаряд летит от атакующего (точка from) к жертве (точка to; по умолчанию её центр).
  // Координаты — смещения от центра клетки атакующего. arc — высота дуги в клетках.
  function shot(c, cls, sizeK, from, to, ms, arc, rot) {
    const el = document.createElement('div');
    el.className = cls;
    const s = c.cell * sizeK;
    Object.assign(el.style, {
      left: c.aRect.left + c.aRect.width / 2 - s / 2 + 'px',
      top: c.aRect.top + c.aRect.height / 2 - s / 2 + 'px',
      width: s + 'px', height: s + 'px'
    });
    getLayer().appendChild(el);
    to = to || { x: c.dx, y: c.dy };
    const frames = [];
    const n = arc ? 10 : 1;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t - 4 * (arc || 0) * c.cell * t * (1 - t);
      frames.push({ transform: T(x, y, 'rotate(' + (rot || 0) * (arc ? t : 1) + 'deg)') });
    }
    return anim(el, frames, ms, { easing: 'linear' }).then(() => el.remove());
  }

  // Картинки растений смотрят вправо — разворачиваем, если бить влево.
  function face(c) {
    if (c.ux < -0.2) c.atk.firstChild.style.transform = 'scaleX(-1)';
  }

  // Прямоугольник клетки атакующего, сдвинутый на p (для частиц у атакующего).
  const rectAt = (c, p) => ({ left: c.aRect.left + p.x, top: c.aRect.top + p.y, width: c.aRect.width, height: c.aRect.height });
  const moveTo = (c, s, ms) => (s.x || s.y ? anim(c.atk, [{ transform: T(0, 0) }, { transform: T(s.x, s.y) }], ms) : Promise.resolve());

  const PVZ_PLANTS = {
    // Подсолнух — крутится, светится и бросает солнышко.
    p: async (c) => {
      const s = c.stand(1.2);
      await moveTo(c, s, 240);
      const glow = 'drop-shadow(0 0 12px #ffd54a) brightness(1.2)';
      const up = T(s.x, s.y - c.cell * 0.15, 'rotate(360deg) scale(1.1)');
      await anim(c.atk, [{ transform: T(s.x, s.y, 'rotate(0deg)'), filter: 'none' }, { transform: up, filter: glow }], 380);
      await shot(c, 'fx-sun', 0.5, { x: s.x, y: s.y - c.cell * 0.3 }, null, 360, 0.7, 180);
      c.hit('pvzSun');
      c.knock(0.18);
      particles(c.vRect, ['#ffd54a', '#fff59d', '#ffb300', '#ffffff'], 18, 1.1);
      await anim(c.atk, [{ transform: up, filter: glow }, { transform: T(s.x, s.y), filter: 'none' }], 160);
      return s;
    },

    // Горохострел — стоит и стреляет тремя горошинами, с отдачей.
    r: async (c) => {
      face(c);
      const s = c.stand(1.8);
      await moveTo(c, s, 260);
      const mouth = { x: s.x + c.ux * c.cell * 0.3, y: s.y + c.uy * c.cell * 0.3 - c.cell * 0.12 };
      for (let i = 0; i < 3; i++) {
        const recoil = T(s.x - c.ux * c.cell * 0.12, s.y - c.uy * c.cell * 0.12, 'scale(1.08,0.94)');
        anim(c.atk, [{ transform: T(s.x, s.y) }, { transform: recoil, offset: 0.3 }, { transform: T(s.x, s.y) }], 180);
        Sound.play('pvzPea');
        await shot(c, 'fx-pea', 0.28, mouth, null, 200);
        if (i === 0) c.hit('pvzPea');
        c.knock(i === 2 ? 0.22 : 0.1);
        particles(c.vRect, ['#7ed957', '#3f8f2a', '#c5f59d'], 8, 0.8);
      }
      return s;
    },

    // Кусачка — прыгает и проглатывает жертву целиком.
    n: async (c) => {
      face(c);
      const s = c.stop(0.6);
      const peak = T(s.x * 0.5, Math.min(0, s.y * 0.5) - c.cell * 1.1, 'rotate(-10deg)');
      await anim(c.atk, [{ transform: T(0, 0) }, { transform: peak, offset: 0.5 }, { transform: T(s.x, s.y, 'scale(1.1,0.9)') }], 420, { easing: 'ease-out' });
      const bite = T(s.x + c.ux * c.cell * 0.3, s.y + c.uy * c.cell * 0.3, 'scale(1.25,0.9)');
      await anim(c.atk, [{ transform: T(s.x, s.y, 'scale(1.1,0.9)') }, { transform: bite }], 110, { easing: 'ease-in' });
      c.hit('pvzChomp');
      c.knock(0.1);
      particles(c.vRect, ['#b04bd6', '#7ed957', '#ffffff'], 12, 0.9);
      await anim(c.atk, [{ transform: bite }, { transform: T(s.x, s.y) }], 140);
      c.gulp = true;
      return s;
    },

    // Стенорех — катится, как шар в боулинге, и отскакивает.
    b: async (c) => {
      const side = c.ux >= 0 ? 1 : -1;
      const s = c.stop(0.45);
      const spin = side * 360 * Math.max(1, Math.round(c.dist / c.cell / 1.5));
      const wind = T(-c.ux * c.cell * 0.15, -c.uy * c.cell * 0.15, 'rotate(' + -20 * side + 'deg)');
      await anim(c.atk, [{ transform: T(0, 0) }, { transform: wind }], 180);
      await anim(c.atk, [{ transform: wind }, { transform: T(s.x, s.y, 'rotate(' + spin + 'deg)') }], 160 + (c.dist / c.cell) * 70, { easing: 'ease-in' });
      c.hit('pvzRoll');
      c.knock(0.3);
      particles(c.vRect, ['#c98a3f', '#8b5a2b', '#e0b77a'], 16, 1.1);
      const rb = { x: s.x - c.ux * c.cell * 0.25, y: s.y - c.uy * c.cell * 0.25 };
      await anim(c.atk, [
        { transform: T(s.x, s.y, 'rotate(' + spin + 'deg)') },
        { transform: T((s.x + rb.x) / 2, (s.y + rb.y) / 2 - c.cell * 0.25, 'rotate(' + (spin - 30 * side) + 'deg)') },
        { transform: T(rb.x, rb.y, 'rotate(' + (spin - 360 * side) + 'deg)') }
      ], 260, { easing: 'ease-out' });
      return rb;
    },

    // Кактус — надувается и стреляет иголками.
    q: async (c) => {
      const s = c.stand(1.6);
      await moveTo(c, s, 260);
      const puff = T(s.x, s.y, 'scale(1.15)');
      await anim(c.atk, [{ transform: T(s.x, s.y), filter: 'none' }, { transform: puff, filter: 'brightness(1.25)' }], 200);
      const ang = Math.atan2(c.dy - s.y, c.dx - s.x) * 180 / Math.PI;
      Sound.play('pvzSpike');
      const shots = [];
      for (let i = 0; i < 5; i++) {
        const from = { x: s.x + rand(-0.15, 0.15) * c.cell, y: s.y + rand(-0.3, 0.05) * c.cell };
        const to = { x: c.dx + rand(-0.15, 0.15) * c.cell, y: c.dy + rand(-0.2, 0.1) * c.cell };
        shots.push(wait(60 * i).then(() => shot(c, 'fx-spike', 0.4, from, to, 200, 0, ang)));
      }
      await Promise.all(shots);
      c.hit('pvzSpike');
      c.knock(0.16);
      particles(c.vRect, ['#f5e9a8', '#7ed957', '#ffffff'], 14, 1);
      await anim(c.atk, [{ transform: puff, filter: 'brightness(1.25)' }, { transform: T(s.x, s.y), filter: 'none' }], 150);
      return s;
    },

    // Арбуз-король — замахивается и швыряет арбуз, тот разлетается брызгами.
    k: async (c) => {
      const side = c.ux >= 0 ? 1 : -1;
      const s = c.stand(1.4);
      await moveTo(c, s, 240);
      const wind = T(s.x - c.ux * c.cell * 0.15, s.y - c.cell * 0.1, 'rotate(' + -15 * side + 'deg) scale(1.1)');
      await anim(c.atk, [{ transform: T(s.x, s.y) }, { transform: wind }], 220, { easing: 'ease-out' });
      const fling = T(s.x + c.ux * c.cell * 0.1, s.y + c.uy * c.cell * 0.1, 'rotate(' + 10 * side + 'deg)');
      anim(c.atk, [{ transform: wind }, { transform: fling }, { transform: T(s.x, s.y) }], 300);
      await shot(c, 'fx-melon', 0.45, { x: s.x, y: s.y - c.cell * 0.4 }, null, 440, Math.max(0.8, c.dist / c.cell * 0.35), 540 * side);
      c.hit('pvzSplat');
      c.knock(0.22);
      particles(c.vRect, ['#e53935', '#ff8a80', '#43a047', '#1b5e20', '#ffffff'], 26, 1.4);
      return s;
    }
  };

  const PVZ_ZOMBIES = {
    // Обычный зомби — ковыляет, качаясь, и кусает: «ням-ням».
    p: async (c) => {
      const side = c.ux >= 0 ? 1 : -1;
      const s = c.stop(0.55);
      const steps = [];
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        steps.push({ transform: T(s.x * t, s.y * t - (i % 2) * c.cell * 0.06, 'rotate(' + (i === 0 || i === 4 ? 0 : i % 2 ? 7 : -7) + 'deg)') });
      }
      await anim(c.atk, steps, 560, { easing: 'linear' });
      for (let i = 0; i < 2; i++) {
        const bite = T(s.x + c.ux * c.cell * 0.15, s.y + c.uy * c.cell * 0.15, 'rotate(' + 10 * side + 'deg) scale(1.05)');
        await anim(c.atk, [{ transform: T(s.x, s.y) }, { transform: bite }], 90, { easing: 'ease-in' });
        if (i === 0) c.hit('pvzBite'); else Sound.play('pvzBite');
        c.knock(0.12 + i * 0.08);
        particles(c.vRect, ['#7d9b6a', '#c5e1a5', '#ffffff'], 8, 0.8);
        await anim(c.atk, [{ transform: bite }, { transform: T(s.x, s.y) }], 110);
      }
      return s;
    },

    // Зомби с конусом — откидывается назад и бодается конусом.
    r: async (c) => {
      const side = c.ux >= 0 ? 1 : -1;
      const s = c.stop(0.8);
      await moveTo(c, s, 300);
      const back = T(s.x - c.ux * c.cell * 0.2, s.y - c.uy * c.cell * 0.2, 'rotate(' + -15 * side + 'deg)');
      await anim(c.atk, [{ transform: T(s.x, s.y) }, { transform: back }], 180);
      const h = c.stop(0.3);
      const butt = T(h.x, h.y, 'rotate(' + 25 * side + 'deg)');
      await anim(c.atk, [{ transform: back }, { transform: butt }], 100, { easing: 'ease-in' });
      c.hit('pvzCone');
      c.knock(0.25);
      particles(c.vRect, ['#ff9800', '#ffb74d', '#e65100'], 14, 1);
      await anim(c.atk, [{ transform: butt }, { transform: T(s.x, s.y) }], 160);
      return s;
    },

    // Зомби с шестом — разбег, упирается шестом и прыгает прямо на жертву.
    n: async (c) => {
      const run = c.stand(1.3);
      await moveTo(c, run, 240);
      const plant = T(run.x, run.y, 'scale(1.1,0.85)');
      await anim(c.atk, [{ transform: T(run.x, run.y) }, { transform: plant }], 120);
      const s = c.stop(0.35);
      const peak = T((run.x + s.x) / 2, Math.min(run.y, s.y) - c.cell * 1.6, 'rotate(' + (c.ux >= 0 ? 20 : -20) + 'deg)');
      const above = T(s.x, s.y - c.cell * 0.5);
      await anim(c.atk, [{ transform: plant }, { transform: peak, offset: 0.5 }, { transform: above }], 480, { easing: 'ease-out' });
      const land = T(s.x, s.y, 'scale(1.15,0.85)');
      await anim(c.atk, [{ transform: above }, { transform: land }], 90, { easing: 'ease-in' });
      c.hit('pvzVault');
      c.knock(0.18);
      particles(c.vRect, ['#8d6e63', '#bdbdbd', '#6d4c41'], 14, 0.9);
      await anim(c.atk, [{ transform: land }, { transform: T(s.x, s.y) }], 120);
      return s;
    },

    // Регбист — приседает и делает мощный подкат.
    b: async (c) => {
      const side = c.ux >= 0 ? 1 : -1;
      const crouch = T(-c.ux * c.cell * 0.2, -c.uy * c.cell * 0.2, 'scale(1.1,0.85) rotate(' + -8 * side + 'deg)');
      await anim(c.atk, [{ transform: T(0, 0) }, { transform: crouch }], 200);
      particles(c.aRect, ['#bdbdbd', '#9e9e9e', '#e0e0e0'], 10, 0.7);
      const h = c.stop(0.3);
      const tackle = T(h.x, h.y, 'rotate(' + 18 * side + 'deg)');
      await anim(c.atk, [{ transform: crouch }, { transform: tackle }], 140 + (c.dist / c.cell) * 40, { easing: 'ease-in' });
      c.hit('pvzTackle');
      c.knock(0.35);
      shakeBoard(c.boardEl);
      particles(c.vRect, ['#e53935', '#ffffff', '#bdbdbd'], 16, 1.2);
      const s = c.stop(0.6);
      await anim(c.atk, [{ transform: tackle }, { transform: T(s.x, s.y) }], 180);
      return s;
    },

    // Зомби-королева — кружится в искрах и бросает зелёную слизь.
    q: async (c) => {
      const s = c.stand(1.4);
      await moveTo(c, s, 260);
      const glow = 'drop-shadow(0 0 10px #ce93d8) brightness(1.2)';
      particles(rectAt(c, s), ['#ce93d8', '#f3e5f5', '#ffd54a'], 12, 0.8);
      await anim(c.atk, [{ transform: T(s.x, s.y, 'rotate(0deg)'), filter: 'none' }, { transform: T(s.x, s.y, 'rotate(360deg) scale(1.1)'), filter: glow }], 380);
      await shot(c, 'fx-goo', 0.4, s, null, 260);
      c.hit('pvzGoo');
      c.knock(0.18);
      particles(c.vRect, ['#9ccc65', '#c5e1a5', '#558b2f', '#e1bee7'], 20, 1.2);
      await anim(c.atk, [{ transform: T(s.x, s.y, 'scale(1.1)'), filter: glow }, { transform: T(s.x, s.y), filter: 'none' }], 160);
      return s;
    },

    // Зомби-король — высокий прыжок и удар ногами о землю: волны расходятся.
    k: async (c) => {
      const s = c.stop(0.5);
      const peak = T(s.x * 0.5, Math.min(0, s.y * 0.5) - c.cell * 1.3, 'scale(1.15)');
      const above = T(s.x, s.y - c.cell * 0.6, 'scale(1.1)');
      await anim(c.atk, [{ transform: T(0, 0) }, { transform: peak, offset: 0.55 }, { transform: above }], 460, { easing: 'ease-out' });
      const land = T(s.x, s.y, 'scale(1.2,0.8)');
      await anim(c.atk, [{ transform: above }, { transform: land }], 90, { easing: 'ease-in' });
      c.hit('pvzStomp');
      c.knock(0.25);
      shakeBoard(c.boardEl);
      ring(c, '#ffd54a');
      setTimeout(() => ring(c, '#ffffff'), 120 / speed());
      particles(c.vRect, ['#9e9e9e', '#757575', '#ffd54a'], 18, 1.1);
      await anim(c.atk, [{ transform: land }, { transform: T(s.x, s.y) }], 140);
      return s;
    }
  };

  // Свои атаки, слова, глаза и пыль для наборов фигур (id из PIECE_SETS).
  const SETS = {
    pvz: {
      attacks: { w: PVZ_PLANTS, b: PVZ_ZOMBIES },
      words: { w: ['ПУФ!', 'ХРУМ!', 'ШМЯК!', 'БАХ!'], b: ['НЯМ!', 'ГРРР!', 'МОЗГИ!', 'БУМ!'] },
      dust: { w: ['#6fcf3a', '#3f8f2a', '#8b5a2b'], b: ['#7d9b6a', '#5a4636', '#8a8a8a'] },
      eyes: {
        wK: [61, 40, 7], wQ: [50, 38, 8], wR: [42, 26, 0], wB: [59, 42, 7], wN: [56, 18, 0], wP: [49, 32, 8],
        bK: [53, 30, 6], bQ: [50, 33, 6], bR: [49, 42, 7], bB: [54, 37, 6], bN: [57, 24, 6], bP: [49, 35, 7]
      }
    }
  };

  // Проглатывание (кусачка): жертва уменьшается и улетает в рот, атакующий жуёт.
  async function gulp(c, vic, end) {
    Sound.play('pvzChomp');
    anim(vic, [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: T(end.x - c.dx, end.y - c.dy, 'scale(0.1)'), opacity: 0 }
    ], 260, { easing: 'ease-in' });
    await wait(200);
    const chew = [];
    for (let i = 0; i < 6; i++) chew.push({ transform: T(end.x, end.y, i % 2 ? 'scale(1.08,0.92)' : 'scale(0.95,1.06)') });
    chew.push({ transform: T(end.x, end.y) });
    await anim(c.atk, chew, 420, { easing: 'linear' });
    vic.remove();
  }

  // ---------- Жертва: крестики и кубики ----------
  function addCrosses(vic, code, eyeMap) {
    const [x, y, gap] = eyeMap[code] || [50, 38, 8];
    const eyes = gap ? [x - gap / 2, x + gap / 2] : [x];
    const size = gap ? 17 : 21;
    for (const ex of eyes) {
      const el = document.createElement('span');
      el.className = 'fx-x';
      Object.assign(el.style, { left: ex - size / 2 + '%', top: y - size / 2 + '%', width: size + '%', height: size + '%' });
      vic.appendChild(el);
      anim(el, [{ transform: 'scale(0)' }, { transform: 'scale(1.3)', offset: 0.6 }, { transform: 'scale(1)' }], 160);
    }
  }

  function shatter(vic, src, rect, color, dustSet) {
    const dust = dustSet[color] || dustSet.b;
    particles(rect, dust, 10, 1.3);
    if (!src) {
      anim(vic, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.2)', opacity: 0 }], 300).then(() => vic.remove());
      return;
    }
    vic.remove();
    const s = rect.width / GRID;
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const f = document.createElement('div');
        f.className = 'fx-frag';
        const left = rect.left + gx * s, top = rect.top + gy * s;
        Object.assign(f.style, {
          left: left + 'px', top: top + 'px', width: Math.ceil(s) + 'px', height: Math.ceil(s) + 'px',
          backgroundImage: 'url("' + src + '")',
          backgroundSize: rect.width + 'px ' + rect.height + 'px',
          backgroundPosition: -gx * s + 'px ' + -gy * s + 'px'
        });
        getLayer().appendChild(f);
        // кубики разлетаются от центра, подскакивают и падают вниз
        const ox = (left + s / 2 - cx) * rand(1.2, 2.6) + rand(-10, 10);
        const oy = (top + s / 2 - cy) * rand(0.8, 1.6);
        anim(f, [
          { transform: 'translate(0,0) rotate(0)', opacity: 1 },
          { transform: T(ox * 0.6, oy * 0.6 - rect.height * rand(0.3, 0.6), 'rotate(' + rand(-120, 120) + 'deg)'), opacity: 1, offset: 0.35 },
          { transform: T(ox, oy + rect.height * rand(1.2, 2), 'rotate(' + rand(-300, 300) + 'deg)'), opacity: 0 }
        ], rand(650, 900), { easing: 'cubic-bezier(.25,.6,.45,1)' }).then(() => f.remove());
      }
    }
  }

  // ---------- Главная функция ----------
  // o: { attackerEl, victimEl, attackerType, victimCode, boardEl }
  async function play(o) {
    const aRect = o.attackerEl.getBoundingClientRect();
    const vRect = o.victimEl.getBoundingClientRect();
    const atk = cloneAt(o.attackerEl, aRect);
    const vic = cloneAt(o.victimEl, vRect);
    const src = imageOf(o.victimEl);
    o.attackerEl.style.visibility = 'hidden';
    o.victimEl.style.visibility = 'hidden';

    // смещение центра атакующего к центру жертвы
    const dx = vRect.left + vRect.width / 2 - (aRect.left + aRect.width / 2);
    const dy = vRect.top + vRect.height / 2 - (aRect.top + aRect.height / 2);
    const dist = Math.hypot(dx, dy) || 1;
    const cell = vRect.width;
    // у набора фигур могут быть свои атаки; атакует цвет, противоположный жертве
    const set = SETS[window.PieceSets ? PieceSets.current() : ''];
    const atkColor = (o.victimCode || 'b')[0] === 'w' ? 'b' : 'w';
    const attacks = set ? set.attacks[atkColor] : ATTACKS;
    const words = set ? set.words[atkColor] : WORDS;
    const c = {
      atk, dx, dy, dist, cell, aRect, vRect, boardEl: o.boardEl,
      ux: dx / dist, uy: dy / dist,
      // точка на линии атаки, не доходя d клеток до жертвы
      stop(d) {
        const k = Math.max(0, 1 - (d * cell) / dist);
        return { x: dx * k, y: dy * k };
      },
      // где встать перед атакой: если жертва уже рядом — остаёмся на месте
      stand(d) {
        return dist <= cell * (d + 0.15) ? { x: 0, y: 0 } : this.stop(d);
      },
      // жертву отбрасывает от удара
      knock(power) {
        const side = dx >= 0 ? 1 : -1;
        anim(vic, [
          { transform: 'translate(0,0) rotate(0)' },
          { transform: T(this.ux * cell * power, this.uy * cell * power, 'rotate(' + 14 * side + 'deg)'), offset: 0.35 },
          { transform: 'translate(0,0) rotate(0)' }
        ], 260, { fill: 'none', easing: 'ease-out' });
      },
      hit(sound) {
        Sound.play(sound);
        word(vRect, words);
        popAt('fx-flash', vRect, cell * 1.1, [{ transform: 'scale(0.2)', opacity: 1 }, { transform: 'scale(1.5)', opacity: 0 }], 300);
        shakeBoard(o.boardEl);
      }
    };

    try {
      Sound.play('whoosh');
      const type = attacks[o.attackerType] ? o.attackerType : 'p';
      const end = await attacks[type](c);

      // жертва: крестики в глазах, шатается…
      addCrosses(vic, o.victimCode, set ? set.eyes : EYES);
      Sound.play('dizzy');
      await anim(vic, [
        { transform: 'rotate(0)' }, { transform: 'rotate(-9deg)' }, { transform: 'rotate(8deg)' },
        { transform: 'rotate(-6deg)' }, { transform: 'rotate(0)' }
      ], 420);

      // …и рассыпается на кубики (или её проглатывают), а атакующий занимает клетку
      if (c.gulp) await gulp(c, vic, end);
      else {
        Sound.play('crumble');
        shatter(vic, src, vRect, (o.victimCode || 'b')[0], set ? set.dust : DUST);
        await wait(120);
      }
      await anim(atk, [{ transform: T(end.x, end.y) }, { transform: T(dx, dy) }], 200);
      await anim(atk, [{ transform: T(dx, dy, 'scale(1.1,0.9)') }, { transform: T(dx, dy) }], 110);
    } finally {
      atk.remove();
      if (vic.isConnected) vic.remove();
    }
  }

  return { play, enabled };
})();
