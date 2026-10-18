// «Мои подарки»: альбом наклеек и полка медалей.
// Обычные наклейки покупаются за ⭐ (их дают уроки и сундучки задачек).
// Секретные герои открываются только победой над соперником в «Игре с роботом».
window.STICKERS = [
  { id: 'king',     name: 'Я король!',   price: 3 },
  { id: 'victory',  name: 'Победа!',     price: 3 },
  { id: 'magic',    name: 'Магия!',      price: 4 },
  { id: 'castling', name: 'Рокировка!',  price: 4 },
  { id: 'knight',   name: 'Ход конём!',  price: 4 },
  { id: 'hide',     name: 'Прятки!',     price: 5 },
  { id: 'oops',     name: 'Ой-ой!',      price: 5 },
  { id: 'trap',     name: 'В ловушке!',  price: 5 },
  { id: 'deadend',  name: 'Тупик!',      price: 6 },
  { id: 'mate',     name: 'Шах и мат!',  price: 6 },
  // секретные: открываются победой над соперником
  { id: 'secret-sonic',     name: 'Соник',        opponent: 'lenya' },
  { id: 'secret-zombie',    name: 'Зомби',        opponent: 'vladus' },
  { id: 'secret-nero',      name: 'Неро',         opponent: 'nero' },
  { id: 'secret-dante',     name: 'Данте',        opponent: 'dante' },
  { id: 'secret-spiderman', name: 'Человек-паук', opponent: 'spiderman' }
];

window.Stickers = (function () {
  const src = (s) => 'assets/stickers/pack/' + s.id + '.png';
  let owned = Store.get('stickers', {});

  function has(id) { return !!owned[id]; }
  function give(id) { owned[id] = true; Store.set('stickers', owned); }

  // Победа над соперником открывает его секретную наклейку (один раз).
  function unlockSecretFor(opponentId) {
    const s = STICKERS.find((x) => x.opponent === opponentId);
    if (!s || has(s.id)) return null;
    give(s.id);
    return s;
  }

  return { src, has, give, unlockSecretFor };
})();

window.GiftsScreen = (function () {
  const $ = (sel) => document.querySelector(sel);
  const V = CONFIG.voices;
  const grid = $('#sticker-grid');
  const shelf = $('#medal-shelf');
  const modal = $('#sticker-modal');
  let tab = 'stickers';
  let current = null;

  // ---------- Альбом ----------
  function renderStickers() {
    grid.innerHTML = '';
    for (const s of STICKERS) {
      const own = Stickers.has(s.id);
      const cell = document.createElement('button');
      cell.className = 'sticker-cell' + (own ? ' owned' : ' locked') + (s.opponent ? ' secret' : '');
      let badge = '';
      if (!own && s.price) badge = '<span class="price"><span class="star-icon"></span>' + s.price + '</span>';
      if (!own && s.opponent) badge = '<span class="secret-badge">?</span>';
      cell.innerHTML = '<img src="' + Stickers.src(s) + '" alt="">' + badge;
      cell.addEventListener('click', () => { Sound.play('click'); open(s); });
      grid.appendChild(cell);
    }
    const n = STICKERS.filter((s) => Stickers.has(s.id)).length;
    $('#sticker-count').textContent = n + ' / ' + STICKERS.length;
  }

  // ---------- Окно наклейки ----------
  function open(s) {
    current = s;
    const own = Stickers.has(s.id);
    const img = $('#sm-img');
    img.src = Stickers.src(s);
    img.className = own ? '' : 'silhouette';
    $('#sm-name').textContent = own || !s.opponent ? s.name : 'Секретный герой';
    $('#sm-opp').innerHTML = '';
    show('#sm-owned', own);
    show('#sm-buy', !own && !!s.price && Progress.stars >= s.price);
    show('#sm-need', !own && !!s.price && Progress.stars < s.price);
    show('#sm-secret', !own && !!s.opponent);
    if (!own && s.price) {
      $('#sm-price').textContent = s.price;
      $('#sm-need-n').textContent = s.price - Progress.stars;
    }
    if (!own && s.opponent) {
      const o = OPPONENTS.find((x) => x.id === s.opponent);
      $('#sm-opp-name').textContent = o.name;
      $('#sm-opp').innerHTML = '<img src="assets/opponents/' + o.id + '/normal.png" alt="">';
    }
    modal.hidden = false;
  }

  function show(sel, v) { $(sel).hidden = !v; }

  function buy() {
    const s = current;
    if (!s || Stickers.has(s.id) || Progress.stars < s.price) return;
    Progress.addStars(-s.price);
    Stickers.give(s.id);
    reveal(s);
  }

  // Открытие: силуэт трясётся, вспыхивает и превращается в наклейку.
  function reveal(s) {
    const img = $('#sm-img');
    ['#sm-buy', '#sm-need', '#sm-secret'].forEach((x) => show(x, false));
    img.classList.add('shaking');
    Sound.play('select');
    setTimeout(() => {
      img.classList.remove('shaking', 'silhouette');
      img.classList.add('revealed');
      $('#sm-name').textContent = s.name;
      Sound.play('win');
      FX.confetti(120);
      Sound.voice([[V.praise[Math.floor(Math.random() * V.praise.length)], V.praiseFallback]]);
      show('#sm-owned', true);
      renderStickers();
    }, 900);
    setTimeout(() => img.classList.remove('revealed'), 1800);
  }

  // Отправить картинку (в Max, Telegram…) через системное меню «Поделиться»,
  // а если браузер так не умеет — просто сохранить файл.
  async function share() {
    const s = current;
    const url = Stickers.src(s);
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], s.id + '.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: s.name });
        return;
      }
    } catch (e) { /* открыто как файл с диска или отмена — просто сохраняем */ }
    save();
  }

  function save() {
    const a = document.createElement('a');
    a.href = Stickers.src(current);
    a.download = 'Шахматы Миши — ' + current.name + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ---------- Полка медалей ----------
  function renderMedals() {
    shelf.innerHTML = '';
    for (const o of OPPONENTS) {
      const wins = Progress.winsOver(o.id);
      const medal = MEDALS.find((m) => wins >= m.wins);
      const next = MEDALS.slice().reverse().find((m) => m.wins > wins);
      const row = document.createElement('div');
      row.className = 'medal-row';
      row.innerHTML =
        '<span class="opp-avatar"><img src="assets/opponents/' + o.id + '/normal.png" alt=""></span>' +
        '<span class="medal-row-info"><b>' + o.name + '</b>' +
          '<span class="medal-row-wins">Побед: ' + wins + (next ? ' · до медали: ' + (next.wins - wins) : '') + '</span></span>' +
        '<span class="medal-slots">' +
          MEDALS.slice().reverse().map((m) =>
            '<span class="medal small ' + m.tier + (wins >= m.wins ? '' : ' empty') + '"></span>').join('') +
        '</span>';
      shelf.appendChild(row);
    }
    const total = OPPONENTS.reduce((n, o) => n + MEDALS.filter((m) => Progress.winsOver(o.id) >= m.wins).length, 0);
    $('#medal-count').textContent = total + ' / ' + OPPONENTS.length * MEDALS.length;
  }

  function setTab(t) {
    tab = t;
    document.querySelectorAll('.gift-tab').forEach((b) => {
      const on = b.dataset.tab === t;
      b.classList.toggle('active', on);
      b.classList.toggle('gold', on);
      b.classList.toggle('stone', !on);
    });
    grid.hidden = t !== 'stickers';
    shelf.hidden = t !== 'medals';
    if (t === 'stickers') renderStickers(); else renderMedals();
  }

  document.querySelectorAll('.gift-tab').forEach((b) =>
    b.addEventListener('click', () => { Sound.play('click'); setTab(b.dataset.tab); }));
  $('#sm-buy').addEventListener('click', buy);
  $('#sm-share').addEventListener('click', share);
  $('#sm-save').addEventListener('click', save);
  $('#sm-close').addEventListener('click', () => { Sound.play('click'); modal.hidden = true; });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });

  function enter() {
    modal.hidden = true;
    setTab(tab);
  }

  return { enter };
})();
