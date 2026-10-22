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

  // Светящаяся дуга меча по жертве. start — с какого угла начинается взмах; color — цвет дуги.
  function slash(c, side, start, color) {
    const el = popAt('fx-slash', c.vRect, c.cell * 1.6, [
      { transform: 'rotate(' + start * side + 'deg) scale(0.5)', opacity: 0 },
      { transform: 'rotate(' + (start + 60) * side + 'deg) scale(1)', opacity: 1, offset: 0.45 },
      { transform: 'rotate(' + (start + 130) * side + 'deg) scale(1.15)', opacity: 0 }
    ], 300);
    if (color) { el.style.borderTopColor = color; el.style.borderRightColor = color; }
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
  // text — значок-эмодзи вместо нарисованного снаряда (гаечный ключ, ракета, бомба).
  function shot(c, cls, sizeK, from, to, ms, arc, rot, text) {
    const el = document.createElement('div');
    el.className = cls;
    const s = c.cell * sizeK;
    if (text) { el.textContent = text; el.style.fontSize = s * 0.85 + 'px'; }
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

  // Эмодзи, вспыхивающий над клеткой (молот, взрыв).
  function emojiPop(rect, ch, sizeK, frames, ms) {
    const el = popAt('fx-emoji', rect, rect.width * sizeK, frames, ms);
    el.textContent = ch;
    el.style.fontSize = rect.width * sizeK * 0.85 + 'px';
    return el;
  }

  // Колечки вылетают из героя, когда его бьёт злодей (как в игре про Соника),
  // красные сферы — из демона, которого победил герой (как в Devil May Cry).
  const ringsOut = (rect, n) => spray(rect, n, 'fx-goldring', 'sonicRings');
  const redOrbs = (rect, n) => spray(rect, n, 'fx-redorb', 'dmcOrbs');

  function spray(rect, n, cls, sound) {
    Sound.play(sound);
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = cls;
      const s = rect.width * 0.22;
      Object.assign(el.style, { left: cx - s / 2 + 'px', top: cy - s / 2 + 'px', width: s + 'px', height: s + 'px', borderWidth: Math.max(2, s * 0.18) + 'px' });
      getLayer().appendChild(el);
      const a = -Math.PI / 2 + rand(-1.3, 1.3), d = rect.width * rand(0.6, 1.2);
      anim(el, [
        { transform: 'translate(0,0) scale(0.5)', opacity: 1 },
        { transform: T(Math.cos(a) * d, Math.sin(a) * d, 'scale(1)'), opacity: 1, offset: 0.45 },
        { transform: T(Math.cos(a) * d * 1.3, Math.sin(a) * d + rect.height * 0.9, 'scale(0.9)'), opacity: 0 }
      ], rand(700, 950), { easing: 'ease-out' }).then(() => el.remove());
    }
  }

  // Призрачный след атакующего в точке p (рывок Метал Соника, пике демона).
  function ghost(c, p, color) {
    const g = c.atk.cloneNode(true);
    g.getAnimations && g.getAnimations().forEach((a) => a.cancel());
    Object.assign(g.style, { transform: T(p.x, p.y), opacity: 0.5, filter: 'drop-shadow(0 0 6px ' + (color || '#448aff') + ')' });
    getLayer().appendChild(g);
    anim(g, [{ opacity: 0.5 }, { opacity: 0 }], 260).then(() => g.remove());
  }

  const SONIC_HEROES = {
    // Соник — раскручивается в шар на месте (спин-дэш) и врезается.
    p: async (c) => {
      const side = c.ux >= 0 ? 1 : -1;
      const ball = 'drop-shadow(0 0 10px #4fc3f7) brightness(1.15)';
      const b = { x: -c.ux * c.cell * 0.1, y: -c.uy * c.cell * 0.1 };
      const rev = [{ transform: T(0, 0, 'rotate(0deg) scale(1)'), filter: 'none' }];
      for (let i = 1; i <= 6; i++) rev.push({ transform: T(b.x, b.y, 'rotate(' + side * i * 180 + 'deg) scale(0.8)'), filter: ball });
      Sound.play('sonicSpin');
      const dust = setInterval(() => particles(c.aRect, ['#e0e0e0', '#bdbdbd', '#ffffff'], 3, 0.6), 90 / speed());
      await anim(c.atk, rev, 450, { easing: 'linear' });
      clearInterval(dust);
      const s = c.stop(0.3), spin = side * 1080;
      await anim(c.atk, [
        { transform: T(b.x, b.y, 'rotate(0deg) scale(0.8)'), filter: ball },
        { transform: T(s.x, s.y, 'rotate(' + spin + 'deg) scale(0.8)'), filter: ball }
      ], 120 + (c.dist / c.cell) * 35, { easing: 'ease-in' });
      c.hit('sonicSpin');
      c.knock(0.3);
      particles(c.vRect, ['#1e63e9', '#4fc3f7', '#ffffff'], 18, 1.2);
      const back = c.stop(0.7);
      await anim(c.atk, [
        { transform: T(s.x, s.y, 'rotate(' + spin + 'deg) scale(0.8)'), filter: ball },
        { transform: T((s.x + back.x) / 2, (s.y + back.y) / 2 - c.cell * 0.4, 'rotate(' + (spin + side * 180) + 'deg) scale(0.9)'), filter: 'none', offset: 0.5 },
        { transform: T(back.x, back.y), filter: 'none' }
      ], 300, { easing: 'ease-out' });
      return back;
    },

    // Тейлз — взлетает, крутя хвостами, и бросает гаечный ключ.
    r: async (c) => {
      const s = c.stand(1.5);
      const hover = { x: s.x, y: s.y - c.cell * 0.4 };
      const fly = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        fly.push({ transform: T(hover.x * t, hover.y * t, 'rotate(' + (i % 2 ? 6 : -6) * (i < 8 ? 1 : 0) + 'deg)') });
      }
      Sound.play('whoosh');
      await anim(c.atk, fly, 420, { easing: 'linear' });
      await shot(c, 'fx-emoji', 0.45, hover, null, 380, Math.max(0.5, c.dist / c.cell * 0.25), 720, '🔧');
      c.hit('sonicWrench');
      c.knock(0.2);
      particles(c.vRect, ['#9e9e9e', '#ffd54a', '#ffffff'], 14, 1);
      await anim(c.atk, [{ transform: T(hover.x, hover.y) }, { transform: T(s.x, s.y) }], 200);
      return s;
    },

    // Наклз — планирует к жертве и бьёт кулаками дважды.
    n: async (c) => {
      const side = c.ux >= 0 ? 1 : -1;
      const s = c.stop(0.6);
      const peak = T(s.x * 0.5, s.y * 0.5 - c.cell * 0.5, 'rotate(' + 10 * side + 'deg)');
      await anim(c.atk, [{ transform: T(0, 0) }, { transform: peak, offset: 0.45 }, { transform: T(s.x, s.y) }], 380, { easing: 'ease-out' });
      for (let i = 0; i < 2; i++) {
        const jab = T(s.x + c.ux * c.cell * 0.25, s.y + c.uy * c.cell * 0.25, 'scale(1.1,0.95)');
        await anim(c.atk, [{ transform: T(s.x, s.y) }, { transform: jab }], 80, { easing: 'ease-in' });
        if (i === 0) c.hit('sonicPunch'); else Sound.play('sonicPunch');
        c.knock(0.12 + i * 0.12);
        ring(c, i ? '#ff5252' : '#ffffff');
        await anim(c.atk, [{ transform: jab }, { transform: T(s.x, s.y) }], 100);
      }
      particles(c.vRect, ['#8d6e63', '#bdbdbd', '#e53935'], 16, 1.1);
      return s;
    },

    // Сильвер — светится бирюзовым, поднимает жертву силой мысли и роняет.
    b: async (c) => {
      const s = c.stand(1.5);
      await moveTo(c, s, 240);
      const glow = 'drop-shadow(0 0 12px #4dd0e1) brightness(1.2)';
      const psy = 'drop-shadow(0 0 10px #4dd0e1)';
      const up = T(s.x, s.y - c.cell * 0.1, 'scale(1.08)');
      await anim(c.atk, [{ transform: T(s.x, s.y), filter: 'none' }, { transform: up, filter: glow }], 260);
      Sound.play('sonicPsy');
      particles(c.vRect, ['#4dd0e1', '#b2ebf2', '#ffffff'], 10, 0.6);
      await anim(c.vic, [
        { transform: 'translate(0,0) rotate(0deg)', filter: 'none' },
        { transform: T(0, -c.cell * 0.5, 'rotate(-8deg)'), filter: psy, offset: 0.6 },
        { transform: T(0, -c.cell * 0.55, 'rotate(8deg)'), filter: psy }
      ], 420);
      await anim(c.vic, [{ transform: T(0, -c.cell * 0.55, 'rotate(8deg)'), filter: psy }, { transform: 'translate(0,0) rotate(0deg)', filter: 'none' }], 110, { easing: 'ease-in' });
      c.hit('sonicPsy');
      c.knock(0.1);
      particles(c.vRect, ['#4dd0e1', '#b2ebf2', '#ffffff', '#9e9e9e'], 18, 1.1);
      await anim(c.atk, [{ transform: up, filter: glow }, { transform: T(s.x, s.y), filter: 'none' }], 160);
      return s;
    },

    // Эми — подпрыгивает и бьёт огромным молотом, летят сердечки.
    q: async (c) => {
      const side = c.ux >= 0 ? 1 : -1;
      const s = c.stop(0.6);
      const air = T(s.x, s.y - c.cell * 0.4, 'rotate(' + -15 * side + 'deg)');
      await anim(c.atk, [{ transform: T(0, 0) }, { transform: T(s.x * 0.5, s.y * 0.5 - c.cell * 0.8), offset: 0.5 }, { transform: air }], 380, { easing: 'ease-out' });
      const hammer = emojiPop(c.vRect, '🔨', 1, [
        { transform: 'translate(0,-40%) rotate(' + 70 * side + 'deg) scale(0.6)', opacity: 1 },
        { transform: 'translate(0,-15%) rotate(' + -35 * side + 'deg) scale(1.1)', opacity: 1, offset: 0.4 },
        { transform: 'translate(0,-15%) rotate(' + -35 * side + 'deg) scale(1.1)', opacity: 0 }
      ], 420);
      hammer.style.transformOrigin = '80% 80%';
      await wait(160);
      anim(c.atk, [{ transform: air }, { transform: T(s.x, s.y) }], 100);
      c.hit('sonicHammer');
      c.knock(0.25);
      for (let i = 0; i < 5; i++) {
        const a = rand(-Math.PI, 0), d = c.cell * rand(0.5, 1);
        emojiPop(c.vRect, '💗', 0.3, [
          { transform: 'translate(0,0) scale(0.4)', opacity: 1 },
          { transform: T(Math.cos(a) * d, Math.sin(a) * d, 'scale(1)'), opacity: 0 }
        ], rand(500, 750));
      }
      particles(c.vRect, ['#f48fb1', '#ff4081', '#ffd54a'], 14, 1.1);
      await wait(120);
      return s;
    },

    // Шадоу — «Хаос-контроль»: исчезает во вспышке, появляется рядом и рубит мечом крест-накрест.
    k: async (c) => {
      const side = c.ux >= 0 ? 1 : -1;
      const s = c.stop(0.65);
      const bright = 'drop-shadow(0 0 14px #ffd54a) brightness(1.6)';
      Sound.play('sonicChaos');
      await anim(c.atk, [{ transform: T(0, 0), opacity: 1, filter: 'none' }, { transform: T(0, 0, 'scale(1.1)'), opacity: 0, filter: bright }], 220);
      const flash = [{ transform: 'scale(0.2)', opacity: 1 }, { transform: 'scale(1.5)', opacity: 0 }];
      popAt('fx-flash', c.aRect, c.cell * 1.2, flash, 300);
      popAt('fx-flash', rectAt(c, s), c.cell * 1.2, flash, 300);
      await wait(120);
      await anim(c.atk, [{ transform: T(s.x, s.y, 'scale(1.1)'), opacity: 0, filter: bright }, { transform: T(s.x, s.y), opacity: 1, filter: 'none' }], 180);
      slash(c, side, -60);
      const cut1 = T(s.x + c.ux * c.cell * 0.25, s.y + c.uy * c.cell * 0.25, 'rotate(' + 20 * side + 'deg)');
      await anim(c.atk, [{ transform: T(s.x, s.y) }, { transform: cut1 }], 90, { easing: 'ease-in' });
      c.hit('sonicChaos');
      c.knock(0.15);
      slash(c, -side, 30);
      await anim(c.atk, [{ transform: cut1 }, { transform: T(s.x, s.y, 'rotate(' + -10 * side + 'deg)') }], 110);
      Sound.play('hitK');
      c.knock(0.22);
      particles(c.vRect, ['#ffd54a', '#e53935', '#212121'], 18, 1.2);
      await anim(c.atk, [{ transform: T(s.x, s.y, 'rotate(' + -10 * side + 'deg)') }, { transform: T(s.x, s.y) }], 120);
      return s;
    }
  };

  const SONIC_VILLAINS = {
    // Бадник — скачет тремя прыжками и бодается.
    p: async (c) => {
      const s = c.stop(0.5);
      const hops = [];
      for (let i = 0; i <= 24; i++) {
        const u = i / 24;
        hops.push({ transform: T(s.x * u, s.y * u - Math.abs(Math.sin(3 * Math.PI * u)) * c.cell * 0.3) });
      }
      Sound.play('sonicBonk');
      await anim(c.atk, hops, 540, { easing: 'linear' });
      const butt = T(s.x + c.ux * c.cell * 0.2, s.y + c.uy * c.cell * 0.2, 'scale(1.1,0.9)');
      await anim(c.atk, [{ transform: T(s.x, s.y) }, { transform: butt }], 90, { easing: 'ease-in' });
      c.hit('sonicBonk');
      c.knock(0.2);
      ringsOut(c.vRect, 5);
      particles(c.vRect, ['#e53935', '#ffd54a', '#ffffff'], 12, 1);
      await anim(c.atk, [{ transform: butt }, { transform: T(s.x, s.y) }], 120);
      return s;
    },

    // Робот-страж — заряжает пушку и стреляет ракетой: взрыв.
    r: async (c) => {
      const s = c.stand(1.8);
      await moveTo(c, s, 300);
      const charge = T(s.x - c.ux * c.cell * 0.08, s.y - c.uy * c.cell * 0.08, 'scale(1.05)');
      await anim(c.atk, [{ transform: T(s.x, s.y), filter: 'none' }, { transform: charge, filter: 'brightness(1.3)' }], 220);
      const ang = Math.atan2(c.dy - s.y, c.dx - s.x) * 180 / Math.PI;
      Sound.play('sonicCannon');
      anim(c.atk, [{ transform: charge, filter: 'brightness(1.3)' }, { transform: T(s.x - c.ux * c.cell * 0.2, s.y - c.uy * c.cell * 0.2), filter: 'none', offset: 0.3 }, { transform: T(s.x, s.y), filter: 'none' }], 320);
      await shot(c, 'fx-emoji', 0.4, { x: s.x + c.ux * c.cell * 0.25, y: s.y - c.cell * 0.05 }, null, 300, 0, ang + 45, '🚀');
      c.hit('sonicBoom');
      emojiPop(c.vRect, '💥', 1.3, [{ transform: 'scale(0.3)', opacity: 1 }, { transform: 'scale(1.2)', opacity: 0 }], 450);
      c.knock(0.3);
      shakeBoard(c.boardEl);
      ringsOut(c.vRect, 6);
      particles(c.vRect, ['#ff9800', '#ffd54a', '#e53935', '#616161'], 24, 1.4);
      return s;
    },

    // Метал Соник — загорается красным и проносится рывком, оставляя призрачный след.
    n: async (c) => {
      const side = c.ux >= 0 ? 1 : -1;
      const s = c.stop(0.35);
      const red = 'drop-shadow(0 0 10px #ff1744)';
      const lean = T(-c.ux * c.cell * 0.12, -c.uy * c.cell * 0.12, 'rotate(' + 15 * side + 'deg)');
      await anim(c.atk, [{ transform: T(0, 0), filter: 'none' }, { transform: lean, filter: red }], 220);
      Sound.play('sonicDash');
      const ms = 150 + (c.dist / c.cell) * 30;
      for (let i = 1; i <= 4; i++) setTimeout(() => ghost(c, { x: s.x * i / 5, y: s.y * i / 5 }), (ms * i / 5) / speed());
      await anim(c.atk, [{ transform: lean, filter: red }, { transform: T(s.x, s.y, 'rotate(' + 15 * side + 'deg)'), filter: red }], ms, { easing: 'ease-in' });
      c.hit('sonicDash');
      c.knock(0.3);
      ringsOut(c.vRect, 5);
      particles(c.vRect, ['#1e63e9', '#ff1744', '#ffffff'], 16, 1.2);
      await anim(c.atk, [{ transform: T(s.x, s.y, 'rotate(' + 15 * side + 'deg)'), filter: red }, { transform: T(s.x, s.y), filter: 'none' }], 160);
      return s;
    },

    // Руж — взлетает, хлопая крыльями, и пикирует с ударом ногой в штопоре.
    b: async (c) => {
      const side = c.ux >= 0 ? 1 : -1;
      const s = c.stop(0.5);
      const up = { x: -c.ux * c.cell * 0.1, y: -c.cell * 0.6 };
      const flap = [{ transform: T(0, 0) }];
      for (let i = 1; i <= 6; i++) {
        const t = i / 6;
        flap.push({ transform: T(up.x * t, up.y * t, i % 2 ? 'scale(1.08,0.95)' : 'scale(0.95,1.04)') });
      }
      Sound.play('whoosh');
      await anim(c.atk, flap, 360, { easing: 'linear' });
      await anim(c.atk, [{ transform: T(up.x, up.y, 'rotate(0deg)') }, { transform: T(s.x, s.y, 'rotate(' + 360 * side + 'deg)') }], 200, { easing: 'ease-in' });
      c.hit('sonicKick');
      c.knock(0.25);
      ringsOut(c.vRect, 5);
      for (let i = 0; i < 3; i++) {
        const a = rand(-Math.PI, 0), d = c.cell * rand(0.4, 0.9);
        emojiPop(c.vRect, '💎', 0.28, [{ transform: 'translate(0,0) scale(0.4)', opacity: 1 }, { transform: T(Math.cos(a) * d, Math.sin(a) * d, 'rotate(180deg)'), opacity: 0 }], 600);
      }
      particles(c.vRect, ['#ce93d8', '#e040fb', '#ffffff'], 14, 1);
      return s;
    },

    // Инфинит — силой Фантомного рубина стягивает к жертве красные кубики, и они взрываются.
    q: async (c) => {
      const s = c.stand(1.6);
      await moveTo(c, s, 260);
      const glitch = 'drop-shadow(0 0 10px #ff1744) hue-rotate(-20deg) brightness(1.2)';
      const shake = [];
      for (let i = 0; i <= 6; i++) shake.push({ transform: T(s.x + (i % 2 ? 4 : -4) * (i < 6 ? 1 : 0), s.y), filter: glitch });
      Sound.play('sonicRuby');
      anim(c.atk, shake, 320, { easing: 'linear' });
      const cx = c.vRect.left + c.vRect.width / 2, cy = c.vRect.top + c.vRect.height / 2;
      for (let i = 0; i < 12; i++) {
        const cube = document.createElement('div');
        cube.className = 'fx-bit';
        const sz = c.cell * rand(0.1, 0.18), a = (i / 12) * Math.PI * 2, d = c.cell * rand(0.7, 1);
        Object.assign(cube.style, { left: cx - sz / 2 + 'px', top: cy - sz / 2 + 'px', width: sz + 'px', height: sz + 'px', background: i % 3 ? '#e53935' : '#212121' });
        getLayer().appendChild(cube);
        anim(cube, [
          { transform: T(Math.cos(a) * d, Math.sin(a) * d, 'rotate(0deg)'), opacity: 0 },
          { transform: T(Math.cos(a) * d * 0.7, Math.sin(a) * d * 0.7, 'rotate(90deg)'), opacity: 1, offset: 0.3 },
          { transform: 'translate(0,0) rotate(270deg)', opacity: 1 }
        ], 340, { easing: 'ease-in' }).then(() => cube.remove());
      }
      await wait(340);
      c.hit('sonicRuby');
      c.knock(0.2);
      ringsOut(c.vRect, 5);
      particles(c.vRect, ['#e53935', '#212121', '#ff8a80'], 24, 1.4);
      await anim(c.atk, [{ transform: T(s.x, s.y), filter: glitch }, { transform: T(s.x, s.y), filter: 'none' }], 160);
      return s;
    },

    // Доктор Эггман — подлетает на своей капсуле и сбрасывает три бомбы.
    k: async (c) => {
      const p = { x: c.dx, y: c.dy - c.cell * 1.1 };
      const float = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        float.push({ transform: T(p.x * t, p.y * t + Math.sin(t * Math.PI * 2) * c.cell * 0.05) });
      }
      Sound.play('whoosh');
      await anim(c.atk, float, 460, { easing: 'ease-in-out' });
      for (let i = 0; i < 3; i++) {
        await shot(c, 'fx-emoji', 0.35, { x: p.x + (i - 1) * c.cell * 0.2, y: p.y + c.cell * 0.3 }, { x: c.dx + (i - 1) * c.cell * 0.15, y: c.dy }, 200, 0, 0, '💣');
        if (i === 0) c.hit('sonicBomb'); else Sound.play('sonicBomb');
        popAt('fx-flash', c.vRect, c.cell * 1.2, [{ transform: 'scale(0.2)', opacity: 1 }, { transform: 'scale(1.5)', opacity: 0 }], 280);
        c.knock(0.12 + i * 0.05);
        particles(c.vRect, ['#ff9800', '#ffd54a', '#616161'], 10, 1.1);
      }
      ringsOut(c.vRect, 6);
      return p;
    }
  };

  // Столп света с неба на жертву (молитва Кирии).
  function beam(c) {
    const el = document.createElement('div');
    el.className = 'fx-beam';
    const w = c.cell * 0.9, bottom = c.vRect.top + c.vRect.height * 0.8;
    Object.assign(el.style, { left: c.vRect.left + c.vRect.width / 2 - w / 2 + 'px', top: '0px', width: w + 'px', height: bottom + 'px' });
    getLayer().appendChild(el);
    return anim(el, [
      { opacity: 0, transform: 'scaleX(0.3)' }, { opacity: 1, transform: 'scaleX(1)', offset: 0.3 },
      { opacity: 0.6, transform: 'scaleX(1)', offset: 0.55 }, { opacity: 1, transform: 'scaleX(1.1)', offset: 0.75 },
      { opacity: 0, transform: 'scaleX(1.3)' }
    ], 480, { easing: 'linear' }).then(() => el.remove());
  }

  const DMC_HEROES = {
    // Неро — два выстрела из револьвера, потом «Дьявольская рука» хватает демона и бьёт о землю.
    p: async (c) => {
      const s = c.stand(1.4);
      await moveTo(c, s, 240);
      const muzzle = { x: s.x + c.ux * c.cell * 0.3, y: s.y - c.cell * 0.1 };
      for (let i = 0; i < 2; i++) {
        Sound.play('dmcGun');
        anim(c.atk, [{ transform: T(s.x, s.y) }, { transform: T(s.x - c.ux * c.cell * 0.06, s.y - c.uy * c.cell * 0.06), offset: 0.3 }, { transform: T(s.x, s.y) }], 140);
        await shot(c, 'fx-bullet', 0.14, muzzle, null, 130);
        c.knock(0.06);
        particles(c.vRect, ['#ffd54a', '#ffffff'], 5, 0.6);
      }
      const arm = 'drop-shadow(0 0 12px #448aff) brightness(1.2)';
      await anim(c.atk, [{ transform: T(s.x, s.y), filter: 'none' }, { transform: T(s.x, s.y, 'scale(1.1)'), filter: arm }], 200);
      Sound.play('dmcBuster');
      const held = T(-c.ux * c.cell * 0.35, -c.uy * c.cell * 0.35 - c.cell * 0.3, 'rotate(-10deg)');
      await anim(c.vic, [{ transform: 'translate(0,0) rotate(0deg)', filter: 'none' }, { transform: held, filter: 'drop-shadow(0 0 8px #448aff)' }], 220, { easing: 'ease-out' });
      await anim(c.vic, [{ transform: held, filter: 'drop-shadow(0 0 8px #448aff)' }, { transform: 'translate(0,0) rotate(0deg)', filter: 'none' }], 110, { easing: 'ease-in' });
      c.hit('dmcBuster');
      c.knock(0.15);
      ring(c, '#64b5f6');
      particles(c.vRect, ['#448aff', '#bbdefb', '#ffffff'], 16, 1.1);
      redOrbs(c.vRect, 5);
      await anim(c.atk, [{ transform: T(s.x, s.y, 'scale(1.1)'), filter: arm }, { transform: T(s.x, s.y), filter: 'none' }], 160);
      return s;
    },

    // Леди — прицеливается и стреляет ракетой из базуки «Калина Энн».
    r: async (c) => {
      const s = c.stand(1.8);
      await moveTo(c, s, 280);
      const aim = T(s.x - c.ux * c.cell * 0.05, s.y - c.uy * c.cell * 0.05, 'scale(1.04)');
      await anim(c.atk, [{ transform: T(s.x, s.y) }, { transform: aim }], 220);
      const ang = Math.atan2(c.dy - s.y, c.dx - s.x) * 180 / Math.PI;
      Sound.play('dmcRocket');
      anim(c.atk, [{ transform: aim }, { transform: T(s.x - c.ux * c.cell * 0.25, s.y - c.uy * c.cell * 0.25), offset: 0.3 }, { transform: T(s.x, s.y) }], 340);
      particles(rectAt(c, s), ['#bdbdbd', '#eeeeee', '#9e9e9e'], 8, 0.6);
      await shot(c, 'fx-emoji', 0.4, { x: s.x + c.ux * c.cell * 0.3, y: s.y - c.cell * 0.15 }, null, 320, 0, ang + 45, '🚀');
      c.hit('dmcBoom');
      emojiPop(c.vRect, '💥', 1.4, [{ transform: 'scale(0.3)', opacity: 1 }, { transform: 'scale(1.2)', opacity: 0 }], 450);
      c.knock(0.3);
      shakeBoard(c.boardEl);
      particles(c.vRect, ['#ff9800', '#ffd54a', '#e53935', '#616161'], 24, 1.4);
      redOrbs(c.vRect, 5);
      return s;
    },

    // Данте — подпрыгивает с разворотом и поливает демона градом пуль из двух пистолетов.
    n: async (c) => {
      const side = c.ux >= 0 ? 1 : -1;
      const s = c.stand(1.3);
      await moveTo(c, s, 240);
      const up = T(s.x, s.y - c.cell * 0.6, 'rotate(' + 360 * side + 'deg)');
      await anim(c.atk, [{ transform: T(s.x, s.y, 'rotate(0deg)') }, { transform: up }], 300, { easing: 'ease-out' });
      const shots = [];
      for (let i = 0; i < 6; i++) {
        const from = { x: s.x + (i % 2 ? 0.2 : -0.2) * c.cell, y: s.y - c.cell * 0.6 };
        const to = { x: c.dx + rand(-0.2, 0.2) * c.cell, y: c.dy + rand(-0.2, 0.2) * c.cell };
        shots.push(wait(55 * i).then(() => { Sound.play('dmcGun'); return shot(c, 'fx-bullet', 0.13, from, to, 110); }));
      }
      await Promise.all(shots);
      c.hit('dmcGun');
      c.knock(0.2);
      particles(c.vRect, ['#ffd54a', '#e53935', '#ffffff'], 18, 1.1);
      redOrbs(c.vRect, 5);
      await anim(c.atk, [{ transform: up }, { transform: T(s.x, s.y, 'scale(1.1,0.9)'), offset: 0.7 }, { transform: T(s.x, s.y) }], 200);
      return s;
    },

    // Кирия — молится, сияя золотом, и на демона падает столп святого света.
    b: async (c) => {
      const s = c.stand(1.2);
      await moveTo(c, s, 240);
      const glow = 'drop-shadow(0 0 14px #ffe082) brightness(1.25)';
      await anim(c.atk, [{ transform: T(s.x, s.y), filter: 'none' }, { transform: T(s.x, s.y, 'scale(1.05)'), filter: glow }], 300);
      Sound.play('dmcHoly');
      await beam(c);
      c.hit('dmcHoly');
      c.knock(0.15);
      particles(c.vRect, ['#ffe082', '#ffffff', '#fff59d', '#ffd54a'], 22, 1.2);
      redOrbs(c.vRect, 5);
      await anim(c.atk, [{ transform: T(s.x, s.y, 'scale(1.05)'), filter: glow }, { transform: T(s.x, s.y), filter: 'none' }], 200);
      return s;
    },

    // Вергилий — призрачные мечи со всех сторон, потом «Judgement Cut»: синие разрезы прямо в воздухе.
    q: async (c) => {
      const s = c.stand(1.6);
      await moveTo(c, s, 260);
      const aura = 'drop-shadow(0 0 12px #448aff)';
      await anim(c.atk, [{ transform: T(s.x, s.y), filter: 'none' }, { transform: T(s.x, s.y), filter: aura }], 200);
      Sound.play('dmcSwords');
      const swords = [];
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + (i - 1.5) * 0.7;
        const from = { x: c.dx + Math.cos(a) * c.cell * 1.1, y: c.dy + Math.sin(a) * c.cell * 1.1 };
        const ang = Math.atan2(c.dy - from.y, c.dx - from.x) * 180 / Math.PI;
        swords.push(wait(70 * i).then(() => shot(c, 'fx-sword', 0.5, from, null, 200, 0, ang)));
      }
      await Promise.all(swords);
      c.knock(0.1);
      // вложил катану в ножны — вспышка, и пространство разрезано
      await anim(c.atk, [{ transform: T(s.x, s.y), filter: aura }, { transform: T(s.x, s.y), filter: aura + ' brightness(1.6)', offset: 0.5 }, { transform: T(s.x, s.y), filter: aura }], 160);
      Sound.play('dmcJudge');
      [-80, 10, 100].forEach((st, i) => setTimeout(() => slash(c, i % 2 ? -1 : 1, st, '#64b5f6'), (70 * i) / speed()));
      await wait(220);
      c.hit('dmcJudge');
      c.knock(0.25);
      particles(c.vRect, ['#448aff', '#bbdefb', '#ffffff'], 20, 1.2);
      redOrbs(c.vRect, 6);
      await anim(c.atk, [{ transform: T(s.x, s.y), filter: aura }, { transform: T(s.x, s.y), filter: 'none' }], 160);
      return s;
    },

    // Спарда — с красной демонической аурой заносит огромный меч и рубит сверху.
    k: async (c) => {
      const side = c.ux >= 0 ? 1 : -1;
      const s = c.stop(0.75);
      const red = 'drop-shadow(0 0 14px #ff1744) brightness(1.2)';
      await anim(c.atk, [{ transform: T(0, 0), filter: 'none' }, { transform: T(s.x, s.y), filter: red }], 260);
      const wind = T(s.x - c.ux * c.cell * 0.15, s.y - c.cell * 0.35, 'rotate(' + -25 * side + 'deg) scale(1.15)');
      await anim(c.atk, [{ transform: T(s.x, s.y), filter: red }, { transform: wind, filter: red }], 280, { easing: 'ease-out' });
      slash(c, side, -90, '#ff5252');
      setTimeout(() => slash(c, side, -70), 60 / speed());
      const strike = T(s.x + c.ux * c.cell * 0.3, s.y + c.uy * c.cell * 0.3, 'rotate(' + 25 * side + 'deg) scale(1.1)');
      await anim(c.atk, [{ transform: wind, filter: red }, { transform: strike, filter: red }], 100, { easing: 'ease-in' });
      c.hit('dmcGreat');
      c.knock(0.3);
      shakeBoard(c.boardEl);
      ring(c, '#ff1744');
      setTimeout(() => ring(c, '#ffffff'), 120 / speed());
      particles(c.vRect, ['#ff1744', '#ffd54a', '#212121'], 24, 1.4);
      redOrbs(c.vRect, 7);
      await anim(c.atk, [{ transform: strike, filter: red }, { transform: T(s.x, s.y), filter: 'none' }], 180);
      return s;
    }
  };

  const DMC_DEMONS = {
    // Бес — подлетает, трепеща крылышками, и тычет трезубцем три раза.
    p: async (c) => {
      const s = c.stop(0.5);
      const fly = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        fly.push({ transform: T(s.x * t, s.y * t - Math.abs(Math.sin(t * Math.PI * 4)) * c.cell * 0.12) });
      }
      await anim(c.atk, fly, 420, { easing: 'linear' });
      for (let i = 0; i < 3; i++) {
        const jab = T(s.x + c.ux * c.cell * 0.15, s.y + c.uy * c.cell * 0.15, 'scale(1.05)');
        await anim(c.atk, [{ transform: T(s.x, s.y) }, { transform: jab }], 60, { easing: 'ease-in' });
        if (i === 0) c.hit('dmcStab'); else Sound.play('dmcStab');
        c.knock(i === 2 ? 0.18 : 0.08);
        particles(c.vRect, ['#ff1744', '#ff9800'], 6, 0.7);
        await anim(c.atk, [{ transform: jab }, { transform: T(s.x, s.y) }], 70);
      }
      return s;
    },

    // Демонический страж — тяжёлые шаги (доска трясётся) и удар щитом.
    r: async (c) => {
      const s = c.stop(0.6);
      const steps = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        steps.push({ transform: T(s.x * t, s.y * t - (i % 2) * c.cell * 0.08) });
      }
      [1, 2, 3].forEach((i) => setTimeout(() => shakeBoard(c.boardEl), (520 * i / 3) / speed()));
      await anim(c.atk, steps, 520, { easing: 'linear' });
      const back = T(s.x - c.ux * c.cell * 0.15, s.y - c.uy * c.cell * 0.15, 'scale(0.95,1.05)');
      await anim(c.atk, [{ transform: T(s.x, s.y) }, { transform: back }], 160);
      const h = c.stop(0.3);
      const bash = T(h.x, h.y, 'scale(1.08)');
      await anim(c.atk, [{ transform: back }, { transform: bash }], 100, { easing: 'ease-in' });
      c.hit('dmcShield');
      c.knock(0.3);
      ring(c, '#9e9e9e');
      particles(c.vRect, ['#ff1744', '#424242', '#9e9e9e'], 18, 1.2);
      await anim(c.atk, [{ transform: bash }, { transform: T(s.x, s.y) }], 160);
      return s;
    },

    // Демонический рыцарь — взмывает на крыльях и пикирует с копьём, оставляя красный след.
    n: async (c) => {
      const side = c.ux >= 0 ? 1 : -1;
      const s = c.stop(0.4);
      const up = { x: -c.ux * c.cell * 0.3, y: -c.cell * 1.3 };
      const flap = [{ transform: T(0, 0) }];
      for (let i = 1; i <= 6; i++) {
        const t = i / 6;
        flap.push({ transform: T(up.x * t, up.y * t, i % 2 ? 'scale(1.08,0.95)' : 'scale(0.95,1.04)') });
      }
      Sound.play('whoosh');
      await anim(c.atk, flap, 320, { easing: 'ease-out' });
      const ms = 180;
      for (let i = 1; i <= 3; i++) setTimeout(() => ghost(c, { x: up.x + (s.x - up.x) * i / 4, y: up.y + (s.y - up.y) * i / 4 }, '#ff1744'), (ms * i / 4) / speed());
      const dive = T(s.x, s.y, 'rotate(' + 30 * side + 'deg)');
      await anim(c.atk, [{ transform: T(up.x, up.y, 'rotate(0deg)') }, { transform: dive }], ms, { easing: 'ease-in' });
      c.hit('dmcDive');
      c.knock(0.28);
      particles(c.vRect, ['#ff1744', '#212121', '#ff8a80'], 18, 1.2);
      await anim(c.atk, [{ transform: dive }, { transform: T(s.x, s.y) }], 140);
      return s;
    },

    // Демонический жрец — рисует под героем магический круг, и тот взрывается тьмой.
    b: async (c) => {
      const s = c.stand(1.6);
      await moveTo(c, s, 260);
      const cast = 'drop-shadow(0 0 12px #d500f9) brightness(1.15)';
      await anim(c.atk, [{ transform: T(s.x, s.y), filter: 'none' }, { transform: T(s.x, s.y - c.cell * 0.08, 'scale(1.06)'), filter: cast }], 240);
      Sound.play('dmcCurse');
      popAt('fx-circle', c.vRect, c.cell * 1.3, [
        { transform: 'scale(0.2) rotate(0deg)', opacity: 0 },
        { transform: 'scale(1) rotate(180deg)', opacity: 1, offset: 0.5 },
        { transform: 'scale(1.05) rotate(360deg)', opacity: 1, offset: 0.85 },
        { transform: 'scale(1.3) rotate(420deg)', opacity: 0 }
      ], 700);
      await wait(520);
      c.hit('dmcCurse');
      c.knock(0.2);
      particles(c.vRect, ['#6a1b9a', '#d500f9', '#212121', '#ff1744'], 24, 1.3);
      await anim(c.atk, [{ transform: T(s.x, s.y - c.cell * 0.08, 'scale(1.06)'), filter: cast }, { transform: T(s.x, s.y), filter: 'none' }], 180);
      return s;
    },

    // Повелительница демонов — пускает три красные сферы одну за другой.
    q: async (c) => {
      const s = c.stand(1.6);
      await moveTo(c, s, 260);
      const glow = 'drop-shadow(0 0 12px #ff1744)';
      await anim(c.atk, [{ transform: T(s.x, s.y), filter: 'none' }, { transform: T(s.x, s.y, 'scale(1.05)'), filter: glow }], 200);
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i - 1) * 0.9;
        const from = { x: s.x + Math.cos(a) * c.cell * 0.4, y: s.y + Math.sin(a) * c.cell * 0.4 };
        Sound.play('dmcOrb');
        await shot(c, 'fx-redorb', 0.3, from, null, 200);
        if (i === 0) c.hit('dmcOrb');
        c.knock(i === 2 ? 0.22 : 0.1);
        particles(c.vRect, ['#ff1744', '#ff8a80', '#ffffff'], 8, 0.9);
      }
      await anim(c.atk, [{ transform: T(s.x, s.y, 'scale(1.05)'), filter: glow }, { transform: T(s.x, s.y), filter: 'none' }], 160);
      return s;
    },

    // Владыка демонов — ревёт (доска трясётся) и обрушивает на героя огненный дождь.
    k: async (c) => {
      const s = c.stand(1.4);
      await moveTo(c, s, 260);
      const fire = 'drop-shadow(0 0 14px #ff6d00) brightness(1.2)';
      await anim(c.atk, [{ transform: T(s.x, s.y), filter: 'none' }, { transform: T(s.x, s.y, 'scale(1.15)'), filter: fire }], 280);
      shakeBoard(c.boardEl);
      Sound.play('dmcFire');
      const drops = [];
      for (let i = 0; i < 5; i++) {
        const from = { x: c.dx + rand(-0.4, 0.4) * c.cell, y: c.dy - c.cell * 1.8 };
        const to = { x: c.dx + rand(-0.2, 0.2) * c.cell, y: c.dy };
        drops.push(wait(70 * i).then(() => shot(c, 'fx-emoji', 0.4, from, to, 240, 0, 0, '🔥')));
      }
      await Promise.all(drops);
      c.hit('dmcFire');
      emojiPop(c.vRect, '🔥', 1.4, [{ transform: 'scale(0.3)', opacity: 1 }, { transform: 'scale(1.2)', opacity: 0 }], 450);
      c.knock(0.3);
      shakeBoard(c.boardEl);
      ring(c, '#ff6d00');
      particles(c.vRect, ['#ff6d00', '#ffd54a', '#ff1744'], 26, 1.4);
      await anim(c.atk, [{ transform: T(s.x, s.y, 'scale(1.15)'), filter: fire }, { transform: T(s.x, s.y), filter: 'none' }], 180);
      return s;
    }
  };

  // ---------- «Мама против Хлеба»: мама съедает хлеб ----------
  const CRUMBS = ['#d7a35c', '#8d5524', '#f3e0b5'];

  // Путь к жертве шагами с подпрыгиванием: steps шагов, высота шага h клеток.
  function stepsTo(c, s, steps, h, ms) {
    const frames = [];
    for (let i = 0; i <= steps * 2; i++) {
      const t = i / (steps * 2);
      frames.push({ transform: T(s.x * t, s.y * t - (i % 2) * c.cell * h) });
    }
    return anim(c.atk, frames, ms, { easing: 'linear' });
  }

  // Мама подходит (каждая фигура по-своему), дважды откусывает — «хрум», «хрум» —
  // жертва с каждым укусом уменьшается, потом мама доедает её и жуёт: «хрум-хрум».
  function momEats(approach) {
    return async (c) => {
      const s = c.stop(0.55);
      await approach(c, s);
      for (let i = 0; i < 2; i++) {
        const bite = T(s.x + c.ux * c.cell * 0.18, s.y + c.uy * c.cell * 0.18, 'scale(1.12,0.92)');
        await anim(c.atk, [{ transform: T(s.x, s.y) }, { transform: bite }], 110, { easing: 'ease-in' });
        const from = 1 - 0.2 * i, to = from - 0.2;
        anim(c.vic, [
          { transform: 'scale(' + from + ')' },
          { transform: 'scale(' + to + ') rotate(' + (i ? 6 : -6) + 'deg)', offset: 0.4 },
          { transform: 'scale(' + to + ')' }
        ], 180);
        if (i === 0) c.hit('momCrunch'); else Sound.play('momCrunch');
        particles(c.vRect, CRUMBS, 10, 0.8);
        await anim(c.atk, [{ transform: bite }, { transform: T(s.x, s.y) }], 160);
      }
      c.eaten = true;
      c.vicScale = 0.6;
      c.gulpSound = 'momChew';
      return s;
    };
  }

  const MOM = {
    // со скалкой — бодро шагает
    p: momEats((c, s) => stepsTo(c, s, 3, 0.08, 420)),
    // в башне — башня тяжело едет
    r: momEats((c, s) => anim(c.atk, [{ transform: T(0, 0) }, { transform: T(s.x, s.y, 'scale(1.04,0.97)'), offset: 0.85 }, { transform: T(s.x, s.y) }], 380)),
    // на коне — прыжок дугой
    n: momEats((c, s) => anim(c.atk, [
      { transform: T(0, 0) },
      { transform: T(s.x * 0.5, Math.min(0, s.y * 0.5) - c.cell * 0.9, 'rotate(-10deg)'), offset: 0.5 },
      { transform: T(s.x, s.y) }
    ], 400, { easing: 'ease-out' })),
    // с венчиком — плывёт, слегка приподнявшись
    b: momEats((c, s) => anim(c.atk, [{ transform: T(0, 0) }, { transform: T(s.x * 0.5, s.y * 0.5 - c.cell * 0.2), offset: 0.5 }, { transform: T(s.x, s.y) }], 380)),
    // королева — подходит, кружась
    q: momEats((c, s) => anim(c.atk, [{ transform: T(0, 0, 'rotate(0deg)') }, { transform: T(s.x, s.y, 'rotate(360deg)') }], 420)),
    // король — важно, медленными шагами
    k: momEats((c, s) => stepsTo(c, s, 2, 0.05, 480))
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
    },
    dmc: {
      attacks: { w: DMC_HEROES, b: DMC_DEMONS },
      words: { w: ['БАХ!', 'ВЖУХ!', 'ДЖЕКПОТ!', 'СТИЛЬНО!'], b: ['ГРРР!', 'ХА-ХА!', 'БУМ!', 'ТЬМА!'] },
      dust: { w: ['#c62828', '#90caf9', '#eeeeee'], b: ['#b71c1c', '#212121', '#ff5252'] },
      eyes: {
        wK: [60, 17, 5], wQ: [60, 29, 5], wR: [53, 30, 5], wB: [52, 28, 6], wN: [61, 27, 5], wP: [56, 32, 5],
        bK: [57, 23, 6], bQ: [54, 23, 5], bR: [57, 30, 6], bB: [52, 35, 6], bN: [55, 37, 5], bP: [51, 47, 6]
      }
    },
    sonic: {
      attacks: { w: SONIC_HEROES, b: SONIC_VILLAINS },
      words: { w: ['ВЖУХ!', 'ХОП!', 'КЛАСС!', 'БАМ!'], b: ['ХА-ХА-ХА!', 'БУМ!', 'ТРАХ!', 'ПОПАЛСЯ!'] },
      dust: { w: ['#1e63e9', '#ffd54a', '#e53935'], b: ['#212121', '#e53935', '#9e9e9e'] },
      eyes: {
        wK: [61, 26, 5], wQ: [50, 31, 7], wR: [57, 35, 6], wB: [58, 33, 6], wN: [50, 32, 5], wP: [55, 26, 6],
        bK: [60, 18, 7], bQ: [56, 26, 0], bR: [49, 11, 6], bB: [57, 33, 7], bN: [58, 29, 5], bP: [45, 43, 8]
      }
    },
    // мама съедает хлеб; хлеб бьёт обычными атаками и рассыпается крошками
    bread: {
      attacks: { w: MOM, b: ATTACKS },
      words: { w: ['ХРУМ!', 'НЯМ-НЯМ!', 'ВКУСНО!', 'ХРУМ-ХРУМ!'], b: ['ХРУСТЬ!', 'БУЛК!', 'КРОШКИ!', 'ПЛЮХ!'] },
      dust: { w: ['#c62828', '#f5f0e6', '#5d4037'], b: ['#d7a35c', '#8d5524', '#f3e0b5'] },
      eyes: {
        wK: [44, 25, 8], wQ: [50, 30, 7], wR: [50, 23, 7], wB: [55, 26, 7], wN: [48, 22, 7], wP: [51, 31, 7],
        bK: [51, 33, 9], bQ: [50, 37, 8], bR: [49, 38, 9], bB: [48, 40, 7], bN: [57, 31, 6], bP: [54, 43, 8]
      }
    }
  };

  // Проглатывание (кусачка): жертва уменьшается и улетает в рот, атакующий жуёт.
  // Звук и начальный размер жертвы может задать атака (c.gulpSound, c.vicScale — если её уже надкусили).
  async function gulp(c, vic, end) {
    Sound.play(c.gulpSound || 'pvzChomp');
    anim(vic, [
      { transform: 'translate(0,0) scale(' + (c.vicScale || 1) + ')', opacity: 1 },
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
    const attacks = set && set.attacks ? set.attacks[atkColor] : ATTACKS;
    const words = set ? set.words[atkColor] : WORDS;
    const c = {
      atk, vic, dx, dy, dist, cell, aRect, vRect, boardEl: o.boardEl,
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

      // жертва: крестики в глазах, шатается… (кроме съеденной — её сразу доедают)
      if (!c.eaten) {
        addCrosses(vic, o.victimCode, set ? set.eyes : EYES);
        Sound.play('dizzy');
        await anim(vic, [
          { transform: 'rotate(0)' }, { transform: 'rotate(-9deg)' }, { transform: 'rotate(8deg)' },
          { transform: 'rotate(-6deg)' }, { transform: 'rotate(0)' }
        ], 420);
      }

      // …и рассыпается на кубики (или её проглатывают), а атакующий занимает клетку
      if (c.gulp || c.eaten) await gulp(c, vic, end);
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
