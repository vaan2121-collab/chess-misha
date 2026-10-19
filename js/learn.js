// Модуль «Учим фигуры»: список фигур → урок из шагов:
//   info  — знакомство: как ходит, сила, цена (голос + свободные ходы по доске)
//   stars — «Собери 3 звёздочки»
//   eat   — «Съешь врагов»: чёрные фигуры, каждую можно съесть одним ходом с прошлой клетки
//   check — «Поставь шах» этой фигурой 3 раза (у короля этого шага нет)
window.LearnScreen = (function () {
  const $ = (sel) => document.querySelector(sel);

  // Порядок — от простой к сложной. value — цена в пешках (у короля — бесценный).
  const PIECES = [
    { type: 'r', name: 'Ладья',  start: 'd4', value: 5 },
    { type: 'b', name: 'Слон',   start: 'd4', value: 3 },
    { type: 'q', name: 'Ферзь',  start: 'd4', value: 9 },
    { type: 'k', name: 'Король', start: 'e4', value: 0 },
    { type: 'n', name: 'Конь',   start: 'd4', value: 3 },
    { type: 'p', name: 'Пешка',  start: 'e2', value: 1 }
  ];
  const STEPS = [
    { id: 'info',  icon: '📖' },
    { id: 'stars', icon: '⭐' },
    { id: 'eat',   icon: '⚔️' },
    { id: 'check', icon: '♚' }
  ];
  const STAR_COUNT = 3;
  const ENEMY_COUNT = 4;
  const CHECK_ROUNDS = 3;
  const ENEMY_TYPES = ['P', 'P', 'N', 'B', 'R'];

  // Голосовые файлы (assets/voice): приветствие — уже записанное «Ладья.mp3» и т.д.
  const voiceOf = (piece, what) => piece.name + ' ' + what; // «Ладья ходит», «Ладья сила», «Ладья цена»

  const listView = $('#learn-list');
  const lessonView = $('#learn-lesson');
  const overlay = $('#learn-win');
  let board = null;
  let piece = null;
  let step = 'info';
  let game = null;
  let layout = [];      // клетки звёзд/врагов текущего раунда — для перезапуска
  let enemies = {};     // { d6: 'bN' }
  let heard = {};       // какие фразы знакомства уже прослушаны
  let checkRound = 0;
  let checkPuzzle = null;
  let mistakes = 0;

  const pieceSrc = (code) => CONFIG.pieces.path + code + '.' + CONFIG.pieces.ext;
  const stepsFor = (p) => STEPS.filter((s) => !(s.id === 'check' && p.type === 'k'));

  // ---------- Список фигур ----------
  function renderList() {
    listView.innerHTML = '';
    for (const p of PIECES) {
      const done = Progress.lessonSteps(p.type);
      const steps = stepsFor(p);
      const card = document.createElement('button');
      card.className = 'block-btn piece-card stone';
      card.innerHTML =
        '<img src="' + pieceSrc('w' + p.type.toUpperCase()) + '" alt="">' +
        '<span class="piece-card-name">' + p.name + '</span>' +
        '<span class="step-dots">' +
          steps.map((s) => '<i class="' + (done[s.id] ? 'got' : '') + '"></i>').join('') +
        '</span>';
      card.addEventListener('click', () => {
        Sound.play('click');
        location.hash = 'learn/' + p.type;
      });
      listView.appendChild(card);
    }
  }

  // ---------- Урок ----------
  function openLesson(type) {
    piece = PIECES.find((p) => p.type === type);
    if (!piece) { location.hash = 'learn'; return; }

    $('#lesson-img').src = pieceSrc('w' + piece.type.toUpperCase());
    $('#lesson-name').textContent = piece.name;
    overlay.hidden = true;
    heard = {};

    if (!board) {
      board = ChessBoard.create($('#learn-board'), {
        game: SoloGame.create(piece.type, piece.start),
        playerColor: 'w',
        onMove,
        isOver: (g) => g.in_checkmate() || g.in_stalemate()
      });
    }
    paintValue();
    setStep('info');
    Sound.voice(piece.name); // приветствие — уже записанный файл
  }

  function setStep(id) {
    step = id;
    mistakes = 0;
    overlay.hidden = true;
    board.setInteractive(true);
    renderTabs();
    document.querySelectorAll('[data-for-step]').forEach((el) => {
      el.hidden = !el.dataset.forStep.split(' ').includes(id);
    });
    $('#lesson-value').hidden = id !== 'info';
    if (id === 'info') startExplore();
    if (id === 'stars') startCollect('stars');
    if (id === 'eat') startCollect('eat');
    if (id === 'check') { checkRound = 0; startCheck(); }
  }

  function renderTabs() {
    const done = Progress.lessonSteps(piece.type);
    const tabs = $('#lesson-steps');
    tabs.innerHTML = '';
    // если текущий шаг пройден — следующий непройденный подпрыгивает, зовёт дальше
    const next = done[step] ? stepsFor(piece).find((s) => !done[s.id]) : null;
    for (const s of stepsFor(piece)) {
      const b = document.createElement('button');
      b.className = 'step-tab' + (s.id === step ? ' active' : '') + (done[s.id] ? ' done' : '') +
        (next && s.id === next.id ? ' next' : '');
      b.textContent = s.icon;
      b.addEventListener('click', () => {
        if (s.id === step) return;
        Sound.play('click');
        setStep(s.id);
        sayTask();
      });
      tabs.appendChild(b);
    }
  }

  // Цена фигуры картинкой: ряд пешек, у короля — корона.
  function paintValue() {
    const strip = $('#lesson-value');
    strip.innerHTML = piece.value
      ? Array(piece.value).fill('<img src="' + pieceSrc('wP') + '" alt="">').join('')
      : '<span class="crown">👑</span>';
  }

  function sayTask() {
    if (step === 'info') Sound.voice(piece.name);
    if (step === 'stars') Sound.voice('Три звёздочки');
    if (step === 'eat') Sound.voice(piece.type === 'p' ? ['Съешь врагов', 'Пешка сила'] : 'Съешь врагов');
    if (step === 'check') Sound.voice(CONFIG.voices.check);
  }

  // --- Знакомство: фигура стоит, её ходы подсвечены, можно свободно ходить ---
  function startExplore() {
    game = SoloGame.create(piece.type, piece.start);
    board.setGame(game);
    board.setMarks({});
    board.select(piece.start);
    paintProgress();
  }

  function listen(what) {
    Sound.voice(voiceOf(piece, what));
    if (what === 'ходит' && step === 'info') board.select(game.position);
    if (what === 'цена') FX.sparkle($('#lesson-value'));
    heard[what] = true;
    paintInfoButtons();
    if (heard['ходит'] && heard['сила'] && heard['цена']) {
      // знакомство пройдено, когда прослушаны все три рассказа
      if (Progress.markStep(piece.type, 'info')) {
        Progress.addStars(1);
        Sound.play('star');
        renderTabs();
      }
    }
  }

  function paintInfoButtons() {
    $('#btn-moves').classList.toggle('heard', !!heard['ходит']);
    $('#btn-power').classList.toggle('heard', !!heard['сила']);
    $('#btn-value').classList.toggle('heard', !!heard['цена']);
  }

  // --- Звёздочки и враги: одна механика, разный вид ---
  function startCollect(kind, sameLayout) {
    const count = kind === 'stars' ? STAR_COUNT : ENEMY_COUNT;
    if (!sameLayout) {
      layout = SoloGame.makeStars(piece.type, piece.start, count);
      enemies = {};
      layout.forEach((s) => { enemies[s] = 'b' + ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)]; });
    }
    game = SoloGame.create(piece.type, piece.start, layout, { sound: kind === 'stars' ? 'star' : 'capture' });
    board.setGame(game);
    showTargets();
    board.select(piece.start);
    paintProgress();
  }

  function showTargets() {
    const marks = {};
    game.stars.forEach((s) => { marks[s] = step === 'stars' ? 'star' : 'enemy e-' + enemies[s]; });
    board.setMarks(marks);
  }

  // --- Шах: настоящая позиция из генератора задачек ---
  function startCheck() {
    checkPuzzle = PuzzleGen.check(checkRound * 3, piece.type);
    game = new Chess(checkPuzzle.fen);
    board.setGame(game);
    paintCheckMarks();
    paintProgress();
  }

  function paintCheckMarks(hintTo) {
    const marks = {};
    for (const f of 'abcdefgh') for (let r = 1; r <= 8; r++) {
      const p = game.get(f + r);
      if (p && p.color === 'w' && p.type === piece.type) marks[f + r] = 'focus';
    }
    if (hintTo) marks[hintTo] = 'hint-to';
    board.setMarks(marks);
  }

  function onMove(move) {
    if (step === 'info') { board.select(game.position); return; }

    if (step === 'stars' || step === 'eat') {
      if (move.captured) {
        showTargets();
        FX.sparkle(board.squareEl(move.to));
      }
      paintProgress();
      if (!game.stars.length) return stepWon();
      if (piece.type === 'p' && pawnStuck()) {
        // пешка назад не ходит — даём попробовать заново с той же расстановкой
        board.setInteractive(false);
        Sound.play('error');
        setTimeout(() => { board.setInteractive(true); startCollect(step, true); }, 900);
        return;
      }
      board.select(game.position);
      return;
    }

    if (step === 'check') {
      if (PuzzleGen.isSolved(checkPuzzle, game, move)) {
        checkRound++;
        paintProgress();
        if (checkRound >= CHECK_ROUNDS) return stepWon();
        board.setInteractive(false);
        Sound.play('star');
        setTimeout(() => { board.setInteractive(true); mistakes = 0; startCheck(); }, 800);
        return;
      }
      // не шах — возвращаем позицию
      mistakes++;
      board.setInteractive(false);
      Sound.play('error');
      Sound.voice(CONFIG.voices.tryAgain);
      setTimeout(() => {
        game.load(checkPuzzle.fen);
        board.setGame(game);
        board.setInteractive(true);
        const hint = mistakes >= 2 ? PuzzleGen.solutions(checkPuzzle, game)[0] : null;
        paintCheckMarks(hint && hint.to);
        if (hint) board.select(hint.from);
      }, 900);
    }
  }

  // Пешка застряла, если ни одна оставшаяся цель ей уже не достижима.
  function pawnStuck() {
    const file = (sq) => sq.charCodeAt(0);
    const rank = (sq) => +sq[1];
    const p = game.position;
    if (!game.moves({ square: p }).length) return true;
    return !game.stars.some((s) =>
      rank(s) > rank(p) && Math.abs(file(s) - file(p)) <= rank(s) - rank(p));
  }

  // Полоска прогресса в заголовке: звёзды / съеденные враги / поставленные шахи.
  function paintProgress() {
    const bar = $('#lesson-stars');
    bar.hidden = step === 'info';
    if (step === 'info') return;
    const total = step === 'stars' ? STAR_COUNT : step === 'eat' ? ENEMY_COUNT : CHECK_ROUNDS;
    const got = step === 'check' ? checkRound : total - game.stars.length;
    bar.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const s = document.createElement('span');
      s.className = 'star-slot' + (i < got ? ' got' : '');
      bar.appendChild(s);
    }
  }

  function stepWon() {
    board.setInteractive(false);
    const first = Progress.markStep(piece.type, step);
    if (first) Progress.addStars(1);
    Progress.addXP(first ? 20 : 5);
    const done = Progress.lessonSteps(piece.type);
    const allDone = stepsFor(piece).every((s) => done[s.id]);

    $('#learn-win-reward').hidden = !first;
    $('#learn-win-title').textContent = allDone && first ? 'Урок пройден!' : 'Молодец!';
    Sound.play('win');
    FX.confetti(allDone && first ? 140 : 70);
    const V = CONFIG.voices;
    const praise = [[V.praise[Math.floor(Math.random() * V.praise.length)], V.praiseFallback]];
    setTimeout(() => Sound.voice(allDone && first ? ['Урок пройден'] : praise), 500);
    renderTabs();
    setTimeout(() => { overlay.hidden = false; }, 900);
  }

  // Следующий шаг урока, а после последнего — следующая фигура.
  function goNext() {
    const steps = stepsFor(piece);
    const i = steps.findIndex((s) => s.id === step);
    if (i < steps.length - 1) {
      setStep(steps[i + 1].id);
      sayTask();
    } else {
      const j = PIECES.indexOf(piece);
      location.hash = j < PIECES.length - 1 ? 'learn/' + PIECES[j + 1].type : 'learn';
    }
  }

  // ---------- Кнопки ----------
  $('#btn-moves').addEventListener('click', () => listen('ходит'));
  $('#btn-power').addEventListener('click', () => listen('сила'));
  $('#btn-value').addEventListener('click', () => listen('цена'));
  $('#btn-listen').addEventListener('click', () => piece && sayTask());
  $('#btn-restart').addEventListener('click', () => {
    Sound.play('click');
    setStep(step);
  });
  $('#btn-learn-again').addEventListener('click', () => {
    Sound.play('click');
    setStep(step);
    sayTask();
  });
  $('#btn-learn-next').addEventListener('click', () => {
    Sound.play('click');
    goNext();
  });

  function enter(param) {
    const inLesson = !!param;
    listView.hidden = inLesson;
    lessonView.hidden = !inLesson;
    if (inLesson) openLesson(param);
    else {
      overlay.hidden = true;
      Sound.stopVoice();
      renderList();
    }
  }

  return { enter };
})();
