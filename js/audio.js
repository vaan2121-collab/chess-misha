// Фоновая музыка (плейлист по кругу) и звуковые эффекты.
// Браузеры запрещают звук до первого касания экрана, поэтому музыка
// стартует по первому тапу (Sound.unlock()).
window.Sound = (function () {
  let musicOn = Store.get('musicOn', true);
  let sfxOn = Store.get('sfxOn', true);

  const music = new Audio();
  music.volume = CONFIG.musicVolume;
  let tracks = CONFIG.musicEnabled === false ? [] : CONFIG.music.slice();
  let trackIndex = Store.get('trackIndex', 0) % Math.max(tracks.length, 1);
  let failedInRow = 0;
  let unlocked = false;

  music.addEventListener('ended', nextTrack);
  music.addEventListener('error', () => {
    // Файла нет или он битый — пробуем следующий, но не крутимся бесконечно.
    failedInRow++;
    if (failedInRow < tracks.length) nextTrack();
  });
  music.addEventListener('playing', () => { failedInRow = 0; });

  function loadTrack() {
    if (!tracks.length) return;
    music.src = tracks[trackIndex];
    Store.set('trackIndex', trackIndex);
  }

  function nextTrack() {
    if (!tracks.length) return;
    trackIndex = (trackIndex + 1) % tracks.length;
    loadTrack();
    if (musicOn && unlocked) music.play().catch(() => {});
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    loadTrack();
    if (musicOn) music.play().catch(() => {});
  }

  function toggleMusic() {
    musicOn = !musicOn;
    Store.set('musicOn', musicOn);
    if (musicOn) {
      if (!music.src) loadTrack();
      music.play().catch(() => {});
    } else {
      music.pause();
    }
    return musicOn;
  }

  function toggleSfx() {
    sfxOn = !sfxOn;
    Store.set('sfxOn', sfxOn);
    return sfxOn;
  }

  // --- Эффекты ---
  const sfxCache = {};
  const sfxMissing = {};

  for (const name in CONFIG.sfx) {
    const a = new Audio();
    a.preload = 'auto';
    a.addEventListener('error', () => { sfxMissing[name] = true; });
    a.src = CONFIG.sfx[name];
    sfxCache[name] = a;
  }

  // Запасные звуки, пока нет настоящих файлов: частоты и длительности нот.
  const BEEPS = {
    click:   [[660, 0.05]],
    select:  [[520, 0.06]],
    move:    [[330, 0.08]],
    capture: [[440, 0.07], [220, 0.12]],
    check:   [[880, 0.1], [660, 0.1]],
    win:     [[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.25]],
    error:   [[180, 0.15]],
    star:    [[988, 0.06], [1319, 0.12]],
    // 0 — шум (удары, хруст)
    whoosh:  [[0, 0.12]],
    hitR:    [[0, 0.06], [90, 0.14]],
    hitB:    [[1400, 0.04], [1900, 0.05], [2400, 0.06]],
    hitN:    [[220, 0.05], [0, 0.05], [110, 0.1]],
    hitQ:    [[880, 0.04], [1320, 0.04], [1760, 0.04], [2350, 0.08]],
    hitP:    [[330, 0.05], [0, 0.04], [160, 0.08]],
    hitK:    [[0, 0.05], [700, 0.04], [350, 0.1]],
    dizzy:   [[600, 0.06], [900, 0.06], [600, 0.06], [900, 0.06]],
    crumble: [[0, 0.08], [0, 0.08], [0, 0.14]]
  };
  let noiseBuffer = null;
  let ctx = null;

  function beep(name) {
    const notes = BEEPS[name];
    if (!notes) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      let t = ctx.currentTime;
      for (const [freq, dur] of notes) {
        let osc;
        if (freq === 0) {
          // шум: глухие удары и хруст кубиков
          if (!noiseBuffer) {
            noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
          }
          osc = ctx.createBufferSource();
          osc.buffer = noiseBuffer;
        } else {
          osc = ctx.createOscillator();
          osc.type = 'square'; // «пиксельный» 8-битный тембр
          osc.frequency.value = freq;
        }
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.08 * CONFIG.sfxVolume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur);
        t += dur;
      }
    } catch (e) { /* Web Audio недоступен */ }
  }

  function play(name) {
    if (!sfxOn) return;
    const a = sfxCache[name];
    // нет файла — играем замену из CONFIG.sfxAlt, а если и её нет — «бип»
    const alt = () => (CONFIG.sfxAlt && CONFIG.sfxAlt[name] ? play(CONFIG.sfxAlt[name]) : beep(name));
    if (!a || sfxMissing[name]) return alt();
    const clone = a.cloneNode(); // чтобы быстрые повторы не обрывали друг друга
    clone.volume = CONFIG.sfxVolume;
    clone.play().catch(alt);
  }

  // --- Голос ---
  // Одновременно звучит только одна фраза; музыка на это время приглушается.
  // Голос подчиняется кнопке звуков (🔊).
  // voice('Шах') — одна фраза; voice(['Помоги чёрным', 'Поставь мат']) — фразы подряд.
  // Элемент очереди может быть списком вариантов: [['Нет файла', 'Победа']] —
  // если первого файла нет (ещё не записан), играет следующий.
  const voiceEl = new Audio();
  voiceEl.volume = CONFIG.voiceVolume;
  let queue = [];

  function restoreMusic() { music.volume = CONFIG.musicVolume; }

  function playNext() {
    if (!queue.length) return restoreMusic();
    const item = queue.shift();
    const options = Array.isArray(item) ? item : [item];
    // имя с «/» — это путь (фразы соперников), иначе — файл из assets/voice
    const path = options[0].includes('/') ? options[0] : CONFIG.voicePath + options[0];
    voiceEl.src = encodeURI(path + '.mp3');
    voiceEl.dataset.fallback = JSON.stringify(options.slice(1));
    music.volume = CONFIG.musicDuckVolume;
    voiceEl.play().catch(() => {});
  }

  voiceEl.addEventListener('ended', playNext);
  voiceEl.addEventListener('error', () => {
    const rest = JSON.parse(voiceEl.dataset.fallback || '[]');
    if (rest.length) queue.unshift(rest);
    playNext();
  });

  function voice(names) {
    if (!sfxOn) return;
    voiceEl.pause();
    queue = Array.isArray(names) ? names.slice() : [names];
    playNext();
  }

  function stopVoice() {
    queue = [];
    voiceEl.pause();
    restoreMusic();
  }

  return {
    unlock,
    toggleMusic,
    toggleSfx,
    nextTrack,
    play,
    voice,
    stopVoice,
    get musicOn() { return musicOn; },
    get sfxOn() { return sfxOn; }
  };
})();
