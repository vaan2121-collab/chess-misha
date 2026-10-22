// Все пути к ассетам в одном месте. Чтобы подключить новые файлы —
// положите их в assets/ с такими же именами (или поправьте пути здесь).
window.CONFIG = {
  // Фигуры: assets/pieces/wK.png ... bP.png (w/b = белые/чёрные, K Q R B N P).
  // Пока картинки нет — рисуется запасной символ ♔♕♖...
  pieces: {
    path: 'assets/pieces/',
    ext: 'png'
  },

  // Фоновые мелодии (Этап 1.4). Отсутствующие файлы просто пропускаются.
  // Сейчас выключена: с озвучкой она мешает. Вернуть — поставить musicEnabled: true.
  musicEnabled: false,
  music: [
    'assets/music/track1.mp3',
    'assets/music/track2.mp3',
    'assets/music/track3.mp3',
    'assets/music/track4.mp3',
    'assets/music/track5.mp3'
  ],
  musicVolume: 0.12, // тихий фон, чтобы не заглушать голос и эффекты

  // Звуковые эффекты. Если файла нет — играет простой синтезированный «бип».
  sfx: {
    click:   'assets/sfx/click.mp3',
    select:  'assets/sfx/select.mp3',
    move:    'assets/sfx/move.mp3',
    capture: 'assets/sfx/capture.mp3',
    check:   'assets/sfx/check.mp3',
    win:     'assets/sfx/win.mp3',
    error:   'assets/sfx/error.mp3',
    star:    'assets/sfx/star.mp3',
    // анимация взятия
    whoosh:  'assets/sfx/whoosh.mp3',      // замах / полёт к цели
    hitR:    'assets/sfx/hit-rook.mp3',    // ладья: таран
    hitB:    'assets/sfx/hit-bishop.mp3',  // слон: удар посохом с искрами
    hitN:    'assets/sfx/hit-knight.mp3',  // конь: прыжок и удар копытами
    hitQ:    'assets/sfx/hit-queen.mp3',   // ферзь: волшебный шар
    hitP:    'assets/sfx/hit-pawn.mp3',    // пешка: удар щитом
    hitK:    'assets/sfx/hit-king.mp3',    // король: взмах мечом
    dizzy:   'assets/sfx/dizzy.mp3',       // крестики в глазах
    crumble: 'assets/sfx/crumble.mp3',     // рассыпается на кубики
    // набор «Растения и зомби»
    pvzSun:    'assets/sfx/pvz/sun.mp3',     // подсолнух: солнышко
    pvzPea:    'assets/sfx/pvz/pea.mp3',     // горохострел: «пиу» горошиной
    pvzChomp:  'assets/sfx/pvz/chomp.mp3',   // кусачка: «хрум» и глоток
    pvzRoll:   'assets/sfx/pvz/roll.mp3',    // стенорех: катится и бьёт
    pvzSpike:  'assets/sfx/pvz/spike.mp3',   // кактус: иголки
    pvzSplat:  'assets/sfx/pvz/splat.mp3',   // арбуз: шмяк
    pvzBite:   'assets/sfx/pvz/bite.mp3',    // зомби: кусь
    pvzCone:   'assets/sfx/pvz/cone.mp3',    // зомби с конусом: бодается
    pvzVault:  'assets/sfx/pvz/vault.mp3',   // зомби с шестом: прыжок
    pvzTackle: 'assets/sfx/pvz/tackle.mp3',  // регбист: подкат
    pvzGoo:    'assets/sfx/pvz/goo.mp3',     // зомби-королева: слизь
    pvzStomp:  'assets/sfx/pvz/stomp.mp3'    // зомби-король: топот
  },
  // Пока своих файлов нет — играет похожий звук обычных фигур.
  sfxAlt: {
    pvzSun: 'hitQ', pvzPea: 'hitP', pvzChomp: 'hitN', pvzRoll: 'hitR', pvzSpike: 'hitB', pvzSplat: 'hitQ',
    pvzBite: 'hitP', pvzCone: 'hitR', pvzVault: 'hitN', pvzTackle: 'hitR', pvzGoo: 'hitQ', pvzStomp: 'hitK'
  },
  sfxVolume: 0.8,

  // Анимация взятия: enabled — включена, speed — 1 обычная, 1.5 быстрее, 0.7 медленнее.
  captureFx: { enabled: true, speed: 1 },

  // Голосовые подсказки: assets/voice/<имя>.mp3
  voicePath: 'assets/voice/',
  voiceVolume: 1.0,
  musicDuckVolume: 0.03, // громкость музыки, пока говорит голос

  // Фразы задачек (имена файлов в assets/voice без .mp3).
  // Пока файла нет — фраза просто пропускается (у похвалы — играет «Победа»).
  voices: {
    eat: 'Съешь фигуру',
    who: 'Кто съест',
    check: 'Шах этой фигурой',
    check2: 'Шах за два хода',
    fork: 'Вилка',
    mate: 'Поставь мат',
    helpBlack: 'Помоги чёрным',
    nowCheck: 'Теперь шах',
    tryAgain: 'Попробуй ещё',
    hint: 'Подсказка',
    chest: 'Сундучок',
    mateDone: 'Мат',
    praise: ['Молодец', 'Отлично', 'Супер', 'Ура'],
    praiseFallback: 'Победа',
    // особая похвала: каждую 4-ю победу и при полном сундучке
    praiseBig: 'Ты настоящий шахматист!',
    praiseBigEvery: 4
  }
};
