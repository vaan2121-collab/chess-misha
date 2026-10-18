// Модуль «Задачки»: разделы → бесконечная череда задачек.
// В каждом разделе сначала идут готовые задачки (PUZZLE_SETS), потом — из генератора,
// и с каждой решённой задачкой генератор делает их немного сложнее.
window.PuzzlesScreen = (function () {
  const $ = (sel) => document.querySelector(sel);
  const V = CONFIG.voices;
  const pieceSrc = (code) => CONFIG.pieces.path + code + '.' + CONFIG.pieces.ext;

  const WORLDS = [
    { id: 'eat',    name: 'Съешь!',        color: 'redstone', icon: 'bN', goal: 'capture', gen: (l) => PuzzleGen.capture(l) },
    { id: 'who',    name: 'Кто съест?',    color: 'grass',    icon: 'wQ', goal: 'capture', gen: (l) => PuzzleGen.whoCaptures(l) },
    { id: 'check',  name: 'Шах!',          color: 'lapis',    icon: 'bK', goal: 'check',   gen: (l) => PuzzleGen.check(l) },
    { id: 'check2', name: 'Шах за 2 хода', color: 'lapis',    icon: 'bK', goal: 'check2',  gen: (l) => PuzzleGen.check2(l), badge: '2' },
    { id: 'fork',   name: 'Вилка!',        color: 'gold',     icon: 'wN', goal: 'fork',    gen: (l) => PuzzleGen.fork(l) },
    { id: 'mate',   name: 'Мат!',          color: 'gold',     icon: 'wK', goal: 'mate',    gen: (l) => PuzzleGen.mate(l) },
    { id: 'mix',    name: 'Микс',          color: 'stone',    icon: null, emoji: '🎲' }
  ];
  const VOICE_OF = { capture: null, check: V.check, check2: V.check2, fork: V.fork, mate: V.mate };
  const PRAISE_TITLES = ['Молодец!', 'Супер!', 'Отлично!', 'Ура!', 'Здорово!'];
  const CHEST_SIZE = 5;
  const HINT_AFTER = 2;

  const listView = $('#puzzle-list');
  const puzzleView = $('#puzzle-view');
  const overlay = $('#puzzle-win');
  let board = null;
  let world = null;      // раздел, откуда задачка (для «Микса» — настоящий раздел)
  let fromMix = false;
  let puzzle = null;
  let game = null;
  let step = 0;          // для «Шах за 2 хода»: 0 — первый ход, 1 — второй
  let mistakes = 0;
  let hintLevel = 0;
  let busy = false;
  let winsInRow = 0;     // победы за этот заход — для особой похвалы

  // ---------- Разделы ----------
  function renderList() {
    listView.innerHTML = '';
    for (const w of WORLDS) {
      const tile = document.createElement('button');
      tile.className = 'block-btn world-tile ' + w.color;
      const count = w.id === 'mix' ? '' : Progress.solvedIn(w.id);
      tile.innerHTML =
        '<span class="world-icon">' +
          (w.icon ? '<img src="' + pieceSrc(w.icon) + '" alt="">' : w.emoji) +
          (w.badge ? '<span class="world-badge">' + w.badge + '</span>' : '') +
        '</span>' +
        '<span class="world-name">' + w.name + '</span>' +
        (count ? '<span class="world-count">' + count + '</span>' : '');
      tile.addEventListener('click', () => {
        Sound.play('click');
        location.hash = 'puzzles/' + w.id;
      });
      listView.appendChild(tile);
    }
  }

  // ---------- Выбор следующей задачки ----------
  function nextPuzzle(w) {
    const solved = Progress.solvedIn(w.id);
    const set = PUZZLE_SETS[w.id] || [];
    let p = null;
    if (solved < set.length) {
      p = PuzzleGen.fromCurated(set[solved]);
      p.goal = w.goal;
    } else {
      // иногда возвращаемся к готовым — среди них есть красивые классические
      if (set.length && Math.random() < 0.2) {
        p = PuzzleGen.fromCurated(set[Math.floor(Math.random() * set.length)]);
        p.goal = w.goal;
      } else {
        p = w.gen(solved - set.length);
      }
    }
    // генератор не справился (почти не бывает) — берём готовую
    if (!p && set.length) p = Object.assign(PuzzleGen.fromCurated(set[0]), { goal: w.goal });
    return p;
  }

  function startWorld(id) {
    fromMix = id === 'mix';
    const playable = WORLDS.filter((w) => w.gen);
    world = fromMix ? playable[Math.floor(Math.random() * playable.length)] : WORLDS.find((w) => w.id === id);
    if (!world) { location.hash = 'puzzles'; return; }
    startPuzzle(nextPuzzle(world));
  }

  // ---------- Задачка ----------
  function startPuzzle(p) {
    puzzle = p;
    game = new Chess(puzzle.fen);
    step = 0;
    mistakes = 0;
    hintLevel = 0;
    busy = false;
    overlay.hidden = true;

    if (!board) {
      board = ChessBoard.create($('#puzzle-board'), {
        game,
        onMove,
        // в задачках ничья «из-за недостатка материала» не мешает
        isOver: (g) => g.in_checkmate() || g.in_stalemate()
      });
    }
    const side = game.turn();
    board.setPlayerColor(side);
    board.setOrientation(side);
    board.setGame(game);
    board.setInteractive(true);
    showHeader();
    paintMarks();
    paintChest($('#puzzle-chest'));
    sayTask();
  }

  function sayTask() {
    const task = puzzle.goal === 'capture' ? (world.id === 'who' ? V.who : V.eat) : VOICE_OF[puzzle.goal];
    Sound.voice(game.turn() === 'b' ? [V.helpBlack, task] : [task]);
  }

  function showHeader() {
    $('#puzzle-goal').textContent = world.name;
    $('#puzzle-head').className = 'lesson-head goal-' + puzzle.goal;
    const icons = $('#puzzle-icons');
    icons.innerHTML = '';
    const addIcon = (code) => {
      const img = document.createElement('img');
      img.src = pieceSrc(code);
      img.alt = '';
      icons.appendChild(img);
    };
    const codeAt = (s) => { const p = game.get(s); return p.color + p.type.toUpperCase(); };
    if (puzzle.goal === 'capture') addIcon(codeAt(puzzle.target));
    if (puzzle.goal === 'check' || puzzle.goal === 'check2') {
      if (puzzle.piece) addIcon(game.turn() + puzzle.piece.toUpperCase());
    }
    if (puzzle.goal === 'fork') puzzle.targets.forEach((t) => addIcon(codeAt(t)));
  }

  // Рамки целей, подсветка фигуры для шаха, подсказки.
  function paintMarks(hint) {
    const marks = {};
    if (puzzle.goal === 'capture') marks[puzzle.target] = 'target';
    if (puzzle.goal === 'fork') puzzle.targets.forEach((t) => { marks[t] = 'target'; });
    if (puzzle.piece && (puzzle.goal === 'check' || puzzle.goal === 'check2')) {
      // подсвечиваем фигуру, которой надо ставить шах
      for (const f of 'abcdefgh') for (let r = 1; r <= 8; r++) {
        const p = game.get(f + r);
        if (p && p.type === puzzle.piece && p.color === game.turn()) marks[f + r] = 'focus';
      }
    }
    if (hint) {
      marks[hint.from] = 'hint';
      if (hint.to) marks[hint.to] = 'hint-to';
    }
    board.setMarks(marks);
  }

  function onMove(move) {
    if (PuzzleGen.isSolved(puzzle, game, move)) return win();

    // «Шах за 2 хода»: первый ход — подготовка, затем отвечают чёрные.
    if (puzzle.goal === 'check2' && step === 0) {
      step = 1;
      busy = true;
      board.setInteractive(false);
      setTimeout(() => {
        const reply = PuzzleGen.blackReply(game);
        if (!reply) return fail(move);
        game.move(reply);
        board.setLastMove(reply);
        paintMarks();
        board.setInteractive(true);
        busy = false;
        Sound.voice(V.nowCheck);
      }, 600);
      return;
    }
    fail(move);
  }

  // Неверно: показываем, что не так, и возвращаем позицию к началу задачки.
  function fail(move) {
    mistakes++;
    busy = true;
    board.setInteractive(false);
    Sound.play('error');
    Sound.voice(V.tryAgain);
    const el = board.squareEl(move.to);
    el.classList.add('wrong');
    setTimeout(() => {
      el.classList.remove('wrong');
      game.load(puzzle.fen);
      step = 0;
      board.setGame(game);
      board.setInteractive(true);
      busy = false;
      if (mistakes >= HINT_AFTER) showHint();
      else paintMarks();
    }, 900);
  }

  // Подсказка: сначала — какой фигурой ходить, со второго раза — ещё и куда.
  function showHint() {
    hintLevel++;
    let m = null;
    if (puzzle.goal === 'check2' && step === 0) m = PuzzleGen.check2Plans(puzzle, game)[0];
    else m = PuzzleGen.solutions(puzzle, game)[0];
    if (!m) return;
    const showTo = hintLevel >= 2 || mistakes > HINT_AFTER;
    paintMarks({ from: m.from, to: showTo ? m.to : null });
    board.select(m.from);
  }

  function win() {
    busy = true;
    board.setInteractive(false);
    Progress.addSolved(world.id);

    let chest = Progress.chest + 1;
    const chestFull = chest >= CHEST_SIZE;
    Progress.chest = chestFull ? 0 : chest;
    if (chestFull) Progress.addStars(1);

    paintMarks();
    if (puzzle.goal !== 'mate') Sound.play('win'); // при мате звук уже сыграла доска
    FX.confetti(chestFull ? 140 : 60);

    winsInRow++;
    const big = chestFull || winsInRow % V.praiseBigEvery === 0;
    const praise = big
      ? [[V.praiseBig, V.praiseFallback]]
      : [[V.praise[Math.floor(Math.random() * V.praise.length)], V.praiseFallback]];
    const lines = [];
    if (puzzle.goal === 'mate') lines.push(V.mateDone);
    lines.push(...praise);
    if (chestFull) lines.push(V.chest);
    setTimeout(() => Sound.voice(lines), 300);

    $('#puzzle-win-title').textContent = PRAISE_TITLES[Math.floor(Math.random() * PRAISE_TITLES.length)];
    $('#puzzle-win-reward').hidden = !chestFull;
    paintChest($('#win-chest'), chestFull ? CHEST_SIZE : chest);
    paintChest($('#puzzle-chest'));
    setTimeout(() => { overlay.hidden = false; }, 900);
  }

  function paintChest(el, filled) {
    const n = filled === undefined ? Progress.chest : filled;
    el.innerHTML = '';
    for (let i = 0; i < CHEST_SIZE; i++) {
      const s = document.createElement('span');
      s.className = 'chest-slot' + (i < n ? ' got' : '');
      el.appendChild(s);
    }
  }

  $('#btn-puzzle-listen').addEventListener('click', () => { if (puzzle) sayTask(); });
  $('#btn-puzzle-hint').addEventListener('click', () => {
    if (busy || !overlay.hidden) return;
    Sound.play('click');
    Sound.voice(V.hint);
    showHint();
  });
  $('#btn-puzzle-next').addEventListener('click', () => {
    Sound.play('click');
    startWorld(fromMix ? 'mix' : world.id);
  });
  $('#btn-puzzle-list').addEventListener('click', () => {
    Sound.play('click');
    location.hash = 'puzzles';
  });

  function enter(param) {
    listView.hidden = !!param;
    puzzleView.hidden = !param;
    if (param) startWorld(param);
    else {
      overlay.hidden = true;
      winsInRow = 0;
      Sound.stopVoice();
      renderList();
    }
  }

  // current() — для отладки и автотестов: текущая задачка и позиция.
  return { enter, current: () => ({ puzzle, game, step }) };
})();
