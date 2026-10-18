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

  function word(rect) {
    const el = document.createElement('div');
    el.className = 'fx-word';
    el.textContent = WORDS[Math.floor(Math.random() * WORDS.length)];
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

  // ---------- Жертва: крестики и кубики ----------
  function addCrosses(vic, code) {
    const [x, y, gap] = EYES[code] || [50, 38, 8];
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

  function shatter(vic, src, rect, color) {
    const dust = DUST[color] || DUST.b;
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
    const c = {
      atk, dx, dy, dist, cell, aRect, vRect,
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
        word(vRect);
        popAt('fx-flash', vRect, cell * 1.1, [{ transform: 'scale(0.2)', opacity: 1 }, { transform: 'scale(1.5)', opacity: 0 }], 300);
        shakeBoard(o.boardEl);
      }
    };

    try {
      Sound.play('whoosh');
      const type = ATTACKS[o.attackerType] ? o.attackerType : 'p';
      const end = await ATTACKS[type](c);

      // жертва: крестики в глазах, шатается…
      addCrosses(vic, o.victimCode);
      Sound.play('dizzy');
      await anim(vic, [
        { transform: 'rotate(0)' }, { transform: 'rotate(-9deg)' }, { transform: 'rotate(8deg)' },
        { transform: 'rotate(-6deg)' }, { transform: 'rotate(0)' }
      ], 420);

      // …и рассыпается на кубики, а атакующий занимает клетку
      Sound.play('crumble');
      shatter(vic, src, vRect, (o.victimCode || 'b')[0]);
      await wait(120);
      await anim(atk, [{ transform: T(end.x, end.y) }, { transform: T(dx, dy) }], 200);
      await anim(atk, [{ transform: T(dx, dy, 'scale(1.1,0.9)') }, { transform: T(dx, dy) }], 110);
    } finally {
      atk.remove();
      if (vic.isConnected) vic.remove();
    }
  }

  return { play, enabled };
})();
