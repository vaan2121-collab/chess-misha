// Навигация между экранами, копилка и кнопки звука.
// Экраны переключаются через адрес (#menu, #play ...), поэтому кнопка
// «Назад» на телефоне/планшете возвращает в меню, а не закрывает приложение.
(function () {
  const SCREENS = ['menu', 'learn', 'puzzles', 'play', 'gifts', 'parents', 'train'];
  const $ = (sel) => document.querySelector(sel);

  // --- Навигация ---
  // Адрес вида #learn/r: экран learn, параметр r (какая фигура).
  let current = { name: 'menu', param: '' };

  function show(hash) {
    // ссылка из QR-кода «перенести прогресс»: #restore=<код>
    if (hash && hash.startsWith('restore=')) {
      const code = hash.slice('restore='.length);
      history.replaceState(null, '', location.pathname + '#menu');
      show('menu');
      ParentsScreen.offerRestore(code);
      return;
    }
    let [name, param] = (hash || '').split('/');
    if (!SCREENS.includes(name)) { name = 'menu'; param = ''; }
    current = { name, param: param || '' };
    document.querySelectorAll('.screen').forEach((s) => {
      s.hidden = s.id !== 'screen-' + name;
    });
    $('#btn-back').hidden = name === 'menu';
    if (name === 'menu' || name === 'gifts') Sound.stopVoice();
    if (name === 'play') PlayScreen.enter(current.param);
    if (name === 'learn') LearnScreen.enter(current.param);
    if (name === 'puzzles') PuzzlesScreen.enter(current.param);
    if (name === 'gifts') GiftsScreen.enter();
    if (name === 'parents') ParentsScreen.enter();
    if (name === 'train') TrainScreen.enter(current.param);
    if (name === 'menu') paintMenuBars();
  }

  window.addEventListener('hashchange', () => show(location.hash.slice(1)));

  document.querySelectorAll('[data-go]').forEach((btn) => {
    btn.addEventListener('click', () => {
      Sound.play('click');
      location.hash = btn.dataset.go;
    });
  });

  // «Назад» поднимается на уровень выше: из урока — к списку фигур, оттуда — в меню.
  $('#btn-back').addEventListener('click', () => {
    Sound.play('click');
    // из уровня тренировки — на его остров
    if (current.name === 'train' && current.param) {
      const m = TRAIN.modules.find((x) => (x.levels || []).some((l) => l.id === current.param));
      location.hash = m ? 'train/' + m.id : 'train';
      return;
    }
    location.hash = current.param ? current.name : 'menu';
  });

  // --- Звание и цель от родителей в меню ---
  function rankBadge(r) {
    return '<img src="' + CONFIG.pieces.path + r.piece + '.' + CONFIG.pieces.ext + '" alt="">' + (r.crown ? '<span class="rank-crown">👑</span>' : '');
  }

  function paintMenuBars() {
    const r = Progress.rank, next = Progress.nextRank;
    const pct = next ? Math.round((Progress.xp - r.xp) / (next.xp - r.xp) * 100) : 100;
    $('#rank-bar').innerHTML =
      '<span class="rank-badge">' + rankBadge(r) + '</span>' +
      '<span class="rank-info"><b>' + r.name + '</b>' +
      '<span class="xp-bar"><i style="width:' + pct + '%"></i></span>' +
      '<small>' + (next ? 'до звания «' + next.name + '»: ' + (next.xp - Progress.xp) : 'высшее звание!') + '</small></span>';
    const g = Progress.goal;
    const gb = $('#goal-bar');
    gb.hidden = !g;
    if (g) {
      const p = Progress.goalProgress();
      gb.classList.toggle('reached', p >= g.target);
      gb.innerHTML = '<span class="goal-icon">🎁</span><span class="rank-info"><b>' + g.text + '</b>' +
        '<span class="xp-bar gold"><i style="width:' + Math.round(p / g.target * 100) + '%"></i></span>' +
        '<small>' + (p >= g.target ? 'Готово! Покажи родителям!' : p + ' / ' + g.target + ' ⭐') + '</small></span>';
      // цель достигнута — празднуем один раз
      if (p >= g.target && !g.reached) {
        Store.set('goal', Object.assign({}, g, { reached: true }));
        FX.confetti(160);
        Sound.play('win');
        Sound.voice([['assets/voice/train/system/goal_done']]);
      }
    }
  }
  Progress.onChange(() => { if (current.name === 'menu') paintMenuBars(); });

  // --- Новое звание: торжественное окно поверх любого экрана ---
  Progress.onRankUp((r) => {
    $('#rank-up-badge').innerHTML = rankBadge(r);
    $('#rank-up-name').textContent = r.name;
    setTimeout(() => {
      $('#rank-up').hidden = false;
      FX.confetti(160);
      Sound.play('win');
      Sound.voice([['assets/voice/train/system/rank_up']]);
    }, 1600); // после празднования победы, которое принесло опыт
  });
  $('#btn-rank-ok').addEventListener('click', () => { Sound.play('click'); $('#rank-up').hidden = true; });

  // --- Копилка звёзд в верхней панели ---
  const walletEl = $('#wallet-count');
  function paintWallet() { walletEl.textContent = Progress.stars; }
  Progress.onChange(paintWallet);
  paintWallet();

  // Вход для родителей — долгое нажатие на копилку (ребёнок случайно не попадёт).
  const wallet = $('.wallet');
  let pressTimer = null;
  wallet.addEventListener('pointerdown', () => {
    pressTimer = setTimeout(() => { Sound.play('click'); location.hash = 'parents'; }, 1200);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) =>
    wallet.addEventListener(ev, () => clearTimeout(pressTimer)));
  wallet.addEventListener('contextmenu', (e) => e.preventDefault());

  // --- Звук ---
  // Первое касание где угодно «разблокирует» звук в браузере.
  document.addEventListener('pointerdown', Sound.unlock, { once: true });

  const musicBtn = $('#btn-music');
  musicBtn.hidden = CONFIG.musicEnabled === false;
  const sfxBtn = $('#btn-sfx');
  function paintSoundButtons() {
    musicBtn.classList.toggle('off', !Sound.musicOn);
    sfxBtn.classList.toggle('off', !Sound.sfxOn);
  }
  musicBtn.addEventListener('click', () => { Sound.toggleMusic(); paintSoundButtons(); });
  sfxBtn.addEventListener('click', () => { Sound.toggleSfx(); Sound.play('click'); paintSoundButtons(); });
  paintSoundButtons();

  show(location.hash.slice(1) || 'menu');
})();
