// Навигация между экранами, копилка и кнопки звука.
// Экраны переключаются через адрес (#menu, #play ...), поэтому кнопка
// «Назад» на телефоне/планшете возвращает в меню, а не закрывает приложение.
(function () {
  const SCREENS = ['menu', 'learn', 'puzzles', 'play', 'gifts'];
  const $ = (sel) => document.querySelector(sel);

  // --- Навигация ---
  // Адрес вида #learn/r: экран learn, параметр r (какая фигура).
  let current = { name: 'menu', param: '' };

  function show(hash) {
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
    location.hash = current.param ? current.name : 'menu';
  });

  // --- Копилка звёзд в верхней панели ---
  const walletEl = $('#wallet-count');
  function paintWallet() { walletEl.textContent = Progress.stars; }
  Progress.onChange(paintWallet);
  paintWallet();

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
