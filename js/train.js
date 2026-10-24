// «Тренировка»: карта островов → уровни острова → уровень.
// Уровень: Тренер объясняет на доске (слайды со стрелками) → 5 задач с подсказками и
// объяснением ошибок → итог с правилом уровня и наградой.
window.TrainScreen = (function () {
  const $ = (sel) => document.querySelector(sel);
  const T = TRAIN;
  const VOICE = 'assets/voice/train/';
  const mapView = $('#train-map');
  const islandView = $('#train-island');
  const levelView = $('#train-view');
  const doneBox = $('#train-done');

  let board = null;
  let module = null;
  let level = null;
  let mode = 'idle';      // explain | task | done
  let slide = 0;
  let task = null;
  let game = null;
  let taskIdx = 0;
  let mistakes = 0;       // за уровень
  let taskMistakes = 0;   // за текущую задачу
  let hints = 0;
  let hintLevel = 0;
  let streak = 0;
  let explainedWhy = false;
  let busy = false;
  let side = 'w';         // за кого играет ребёнок в этой задаче
  let step = 0;           // ход ребёнка в задаче «в 2 хода» (0 или 1)
  let stepFen = '';       // позиция перед текущим ходом ребёнка
  let movesLeft = 0;      // у босса: сколько ходов осталось
  let seen = new Set();   // у мат-босса: позиции после ходов ребёнка (подсказка не ходит по кругу)
  const faceCache = {};

  // ---------- Где лежат голоса ----------
  const sysVoice = (key, i) => VOICE + 'system/' + key + (T.system[key].length > 1 ? i + 1 : '');
  const levelVoice = (key) => VOICE + (level.voiceDir || level.id) + '/' + key;
  const pickIdx = (arr) => Math.floor(Math.random() * arr.length);

  // ---------- Тренер ----------
  // Лица Тренера: assets/coach/<состояние>.png; пока картинок нет — значок.
  const FACES = { normal: ['normal'], talk: ['talk', 'normal'], happy: ['happy', 'normal'], think: ['think', 'normal'], oops: ['surprised', 'think', 'normal'] };
  ['normal', 'talk', 'happy', 'think', 'surprised'].forEach((f) => {
    const img = new Image();
    img.onload = () => { faceCache[f] = true; };
    img.src = T.coach.folder + f + '.png';
  });

  function faceHtml(state) {
    const f = (FACES[state] || ['normal']).find((x) => faceCache[x]);
    return f ? '<img src="' + T.coach.folder + f + '.png" alt="">'
      : '<span class="avatar-stub" style="background:' + T.coach.color + '">' + T.coach.emoji + '</span>';
  }

  // Тренер говорит: субтитр на экране + голос (если файл записан).
  function say(box, text, voicePath, face) {
    const el = box.querySelector('.coach-text');
    el.textContent = text;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    const f = box.querySelector('.coach-face');
    f.innerHTML = faceHtml(face || 'talk');
    f.classList.remove('react');
    void f.offsetWidth;
    f.classList.add('react');
    if (voicePath) Sound.voice([[voicePath]]);
  }

  function saySystem(box, key, face) {
    const i = pickIdx(T.system[key]);
    say(box, T.system[key][i], sysVoice(key, i), face);
  }

  // ---------- Состояние прохождения ----------
  const doneMap = () => Store.get('trainDone', {});
  const isDone = (id) => !!doneMap()[id];
  const isPerfect = (id) => doneMap()[id] === 'perfect';
  const unlocked = (m, i) => i === 0 || isDone(m.levels[i - 1].id);

  function findLevel(id) {
    for (const m of T.modules) for (const l of m.levels || []) if (l.id === id) return { m, l };
    return null;
  }

  // ---------- Карта островов ----------
  function renderMap() {
    mapView.innerHTML = '';
    T.modules.forEach((m, n) => {
      const card = document.createElement('button');
      card.className = 'block-btn island ' + m.color + (m.soon ? ' soon' : '');
      const done = (m.levels || []).filter((l) => isDone(l.id)).length;
      card.innerHTML =
        '<span class="island-num">' + (n + 1) + '</span>' +
        '<span class="island-icon">' + m.icon + '</span>' +
        '<span class="island-name">' + m.name + '</span>' +
        (m.soon ? '<span class="island-soon">🔒 скоро</span>'
          : '<span class="island-prog">' + done + ' / ' + m.levels.length + '</span>');
      card.addEventListener('click', () => {
        if (m.soon) { Sound.play('error'); return; }
        Sound.play('click');
        location.hash = 'train/' + m.id;
      });
      mapView.appendChild(card);
    });
  }

  // ---------- Остров ----------
  function renderIsland(m) {
    module = m;
    const box = $('#island-coach');
    $('#island-title').textContent = m.icon + ' ' + m.name;
    const list = $('#island-levels');
    list.innerHTML = '';
    m.levels.forEach((l, i) => {
      const open = unlocked(m, i);
      const b = document.createElement('button');
      b.className = 'block-btn level-btn ' + (l.exam ? 'gold' : 'stone') + (open ? '' : ' locked');
      const mark = !open ? '🔒' : isPerfect(l.id) ? '🌟' : isDone(l.id) ? '✅' : '▶';
      b.innerHTML = '<span class="level-mark">' + mark + '</span><span class="level-name">' + l.name + '</span>';
      b.addEventListener('click', () => {
        if (!open) { Sound.play('error'); say(box, 'Сначала пройди предыдущий уровень!', null, 'think'); return; }
        Sound.play('click');
        location.hash = 'train/' + l.id;
      });
      list.appendChild(b);
    });
    // вступление острова — при первом визите целиком, потом только первая фраза
    const key = 'trainIntro:' + m.id;
    const first = !Store.get(key, false);
    Store.set(key, true);
    const lines = first ? m.intro : [m.intro[0]];
    say(box, lines.join(' '), null, 'talk');
    Sound.voice(lines.map((_, i) => [VOICE + m.id + '/intro' + (i + 1)]));
  }

  // ---------- Уровень ----------
  function openLevel(id) {
    const found = findLevel(id);
    if (!found) { location.hash = 'train'; return; }
    module = found.m;
    level = found.l;
    if (!board) {
      board = ChessBoard.create($('#train-board'), {
        game: new Chess(),
        onMove,
        onIllegal,
        isOver: (g) => g.in_checkmate() || g.in_stalemate()
      });
    }
    $('#train-level-name').textContent = level.name;
    doneBox.hidden = true;
    mistakes = 0; hints = 0; streak = 0; explainedWhy = false;
    // объяснение — при первом входе; потом сразу к задачам (объяснить можно кнопкой)
    if (level.explain && !isDone(level.id)) startExplain();
    else startTasks();
  }

  // ---- объяснение на доске ----
  function startExplain() {
    mode = 'explain';
    slide = 0;
    board.setInteractive(false);
    setButtons();
    showSlide();
  }

  function showSlide() {
    const s = level.explain[slide];
    // позиция берётся из первого слайда, где она указана, и держится дальше
    const fen = level.explain.slice(0, slide + 1).reverse().find((x) => x.fen).fen;
    if (!game || game.fen() !== fen) { game = new Chess(fen); board.setGame(game); }
    // показываем со стороны того, кто ходит в первом примере (в «Защите от детского мата» — чёрные)
    board.setOrientation(new Chess(level.explain[0].fen).turn());
    let marks = Object.assign({}, s.marks || {});
    if (s.safeFor) marks = safeMarks(s.safeFor);
    if (s.values) marks = valueMarks();
    board.setMarks(marks);
    board.setArrows(s.arrows || []);
    showLetter(s.letter);
    say($('#train-coach'), s.text, levelVoice('explain' + (slide + 1)), 'talk');
    $('#btn-train-ok').innerHTML = slide < level.explain.length - 1
      ? '<span>➜</span>Понятно' : '<span>🚀</span>Начинаем!';
  }

  // клетки, куда может уйти фигура: зелёные — безопасные, красные — под ударом
  function safeMarks(from) {
    const marks = {};
    for (const m of game.moves({ square: from, verbose: true })) {
      game.move(m);
      marks[m.to] = TrainGen.attackersOf(game, m.to, 'b').length ? 'danger' : 'safe';
      game.undo();
    }
    return marks;
  }

  // цена над каждой фигурой
  function valueMarks() {
    const marks = {};
    for (const f of 'abcdefgh') for (let r = 1; r <= 8; r++) {
      const p = game.get(f + r);
      if (p && p.type !== 'k') marks[f + r] = 'value v' + TrainGen.VAL[p.type];
    }
    return marks;
  }

  function showLetter(letter) {
    const el = $('#train-letter');
    el.hidden = !letter;
    if (letter) {
      el.textContent = letter;
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
    }
  }

  function nextSlide() {
    Sound.play('click');
    if (slide < level.explain.length - 1) { slide++; showSlide(); }
    else startTasks();
  }

  // ---- задачи ----
  function startTasks() {
    mode = 'task';
    taskIdx = 0;
    showLetter(null);
    board.setArrows([]);
    setButtons();
    nextTask();
  }

  const tasksOf = () => level.tasks || T.tasksPerLevel;

  function nextTask() {
    const count = Store.get('trainCount:' + level.id, 0); // сложность растёт с опытом
    task = TrainGen.GEN[level.gen](count) || TrainGen.GEN[level.gen](0);
    game = new Chess(task.fen);
    // ребёнок играет той стороной, чей ход (в «Защите от детского мата» — чёрными)
    side = game.turn();
    step = 0;
    stepFen = task.fen;
    movesLeft = task.limit || 0;
    seen = new Set();
    board.setGame(game);
    board.setOrientation(side);
    board.setPlayerColor(side);
    board.setChoosePromotion(!!level.choosePromotion);
    board.setMarks(task.checker ? { [task.checker]: 'focus' } : {});
    board.setArrows([]);
    board.setShowTargets(!level.noTargets);
    board.setInteractive(true);
    taskMistakes = 0;
    hintLevel = 0;
    busy = false;
    paintProgress();
    const box = $('#train-coach');
    if (taskIdx === 0) say(box, level.task[0], level.exam ? levelVoice('exam_task') : levelVoice('task1'), 'talk');
    else if (level.task[1]) say(box, level.task[1], levelVoice('task2'), 'talk');
    else saySystem(box, 'next', 'talk');
  }

  // Начать задачу заново (после ошибки) — та же позиция.
  function resetTask() {
    game.load(task.fen);
    step = 0;
    stepFen = task.fen;
    movesLeft = task.limit || 0;
    board.setGame(game);
    board.setMarks(task.checker ? { [task.checker]: 'focus' } : {});
    board.setInteractive(true);
    busy = false;
    paintProgress();
  }

  function onMove(move) {
    if (mode !== 'task') return;
    // ход соперника (он ходит через ту же доску) — после него снова ход ребёнка
    if (move.color !== side) return afterReply(move);
    if (busy) return;
    if (level.boss) return bossMove(move);
    const before = new Chess(stepFen);
    const r = TrainGen.judge(task, before, game, move, step);
    const box = $('#train-coach');
    board.setMarks({});
    board.setArrows([]);
    busy = true;
    board.setInteractive(false);

    // задача в 2 хода: первый ход верный — соперник отвечает, потом снова ход ребёнка
    if (r.cont) {
      step = 1;
      hintLevel = 0;
      FX.sparkle(board.squareEl(move.to));
      Sound.play('star');
      if (level.cont) say(box, level.cont, levelVoice('cont'), 'happy');
      setTimeout(() => {
        const m = TrainGen.reply(game);
        if (m) board.makeMove(m.from, m.to, m.promotion);
      }, 1300);
      return;
    }

    if (r.ok) {
      streak++;
      Store.set('trainCount:' + level.id, Store.get('trainCount:' + level.id, 0) + 1);
      Progress.addXP(5);
      FX.sparkle(board.squareEl(move.to));
      Sound.play('star');
      if (level.methods && r.method) say(box, level.methods[r.method], levelVoice('exam_' + r.method), 'happy');
      else if (!explainedWhy && level.why) { explainedWhy = true; say(box, level.why, levelVoice('why'), 'happy'); }
      else if (streak === 3) saySystem(box, 'streak3', 'happy');
      else saySystem(box, 'correct', 'happy');
      taskIdx++;
      paintProgress();
      setTimeout(() => {
        if (taskIdx >= tasksOf()) finishLevel();
        else nextTask();
      }, explainedWhy && taskIdx === 1 ? 2600 : 1500);
      return;
    }

    // ошибка: объясняем, что не так, и возвращаем позицию
    mistakes++;
    taskMistakes++;
    streak = 0;
    if (r.oops && level.oops && level.oops[r.oops]) say(box, level.oops[r.oops], levelVoice(r.oops), 'oops');
    else if (TrainGen.hanging(game, move.to)) saySystem(box, 'blunder', 'oops');
    else saySystem(box, 'wrong', 'oops');
    Sound.play('error');
    const el = board.squareEl(move.to);
    el.classList.add('wrong');
    setTimeout(() => {
      el.classList.remove('wrong');
      resetTask();
      if (taskMistakes >= 2 && hintLevel < 2) showHint(true);
    }, 1400);
  }

  // Соперник ответил — запоминаем позицию, ход снова за ребёнком.
  function afterReply(move) {
    stepFen = game.fen();
    if (level.boss) return bossAfterReply(move);
    busy = false;
    board.setInteractive(true);
    if (level.cont2) say($('#train-coach'), level.cont2, levelVoice('cont2'), 'talk');
  }

  // ---- боссы: мини-партия против робота ----
  function bossMove(move) {
    let status = null;
    if (task.boss === 'race') {
      if (move.flags.includes('p')) status = 'win';
      else if (game.game_over()) status = 'lose_draw';
    } else {
      movesLeft--;
      seen.add(game.fen().split(' ')[0]);
      if (game.in_checkmate()) status = 'win';
      else if (game.in_stalemate()) return bossTakeBack('oops_stalemate', 1);
      else if (movesLeft <= 0) status = 'lose_limit';
    }
    paintProgress();
    if (status) return bossEnd(status);
    busy = true;
    board.setInteractive(false);
    setTimeout(() => {
      const m = task.boss === 'race' ? ChessAI.choose(game, level.ai || 2) : TrainGen.bossKing(game);
      if (m) board.makeMove(m.from, m.to, m.promotion);
    }, 700);
  }

  function bossAfterReply(move) {
    if (task.boss === 'race' && move.flags.includes('p')) return bossEnd('lose_race');
    if (task.boss === 'mate' && move.captured) return bossTakeBack('lose_piece', 2);
    if (game.game_over()) return bossEnd('lose_draw');
    busy = false;
    board.setInteractive(true);
  }

  // Мат-босс: пат или потерянная фигура — не начинаем заново, а возвращаем ход и объясняем.
  function bossTakeBack(status, plies) {
    busy = true;
    board.setInteractive(false);
    mistakes++;
    Sound.play('error');
    const box = $('#train-coach');
    if (level.oops && level.oops[status]) say(box, level.oops[status], levelVoice(status), 'oops');
    else saySystem(box, 'wrong', 'oops');
    setTimeout(() => {
      for (let i = 0; i < plies; i++) game.undo();
      movesLeft++;
      board.setGame(game);
      paintProgress();
      busy = false;
      board.setInteractive(true);
    }, 2600);
  }

  function bossEnd(status) {
    busy = true;
    board.setInteractive(false);
    const box = $('#train-coach');
    if (status === 'win') {
      FX.sparkle(board.squareEl(game.history({ verbose: true }).pop().to));
      say(box, level.why, levelVoice('why'), 'happy');
      taskIdx = tasksOf();
      Store.set('trainCount:' + level.id, Store.get('trainCount:' + level.id, 0) + 1);
      setTimeout(finishLevel, 2200);
      return;
    }
    // проиграли боссу — объясняем и начинаем новую партию
    mistakes++;
    Sound.play('error');
    if (level.oops && level.oops[status]) say(box, level.oops[status], levelVoice(status), 'oops');
    else saySystem(box, 'wrong', 'oops');
    setTimeout(nextTask, 3200);
  }

  // Режим «без подсказок ходов»: ребёнок ткнул туда, куда нельзя.
  function onIllegal(from) {
    if (mode !== 'task') return;
    const p = game.get(from);
    if (p && p.type === 'k') saySystem($('#train-coach'), 'illegal_king', 'oops');
    else saySystem($('#train-coach'), 'wrong', 'think');
  }

  // Подсказка по нарастающей: вопрос → фигура → ход.
  function showHint(auto) {
    if (mode !== 'task' || busy) return;
    // у босса подсказывает «мозг» робота, у задач — список решений
    const sols = level.boss
      ? [task.boss === 'mate' ? TrainGen.bossHint(game, seen) : ChessAI.hint(game)].filter(Boolean)
      : TrainGen.solutions(task, game, step);
    if (!sols.length) return;
    const m = sols[0];
    const texts = level.hint || [];
    const maxLevel = Math.max(texts.length, 2);
    hintLevel = Math.min(hintLevel + 1, maxLevel);
    hints++;
    const box = $('#train-coach');
    const showMove = hintLevel >= maxLevel;
    if (texts[hintLevel - 1]) say(box, texts[hintLevel - 1], levelVoice('hint' + hintLevel), 'think');
    else saySystem(box, 'hint_ok', 'think');
    if (hintLevel >= 2 || !texts.length) {
      board.setMarks(Object.assign({ [m.from]: 'hint' }, showMove ? { [m.to]: 'hint-to' } : {}));
      if (showMove) board.setArrows([{ from: m.from, to: m.to, color: 'yellow' }]);
      board.select(m.from);
    }
    if (auto) Sound.play('click');
  }

  function paintProgress() {
    const bar = $('#train-progress');
    bar.innerHTML = '';
    // у босса с ограничением — сколько ходов осталось
    if (level.boss && task && task.limit) {
      bar.innerHTML = '<span class="moves-left' + (movesLeft <= 5 ? ' low' : '') + '">Ходов: ' + movesLeft + '</span>';
      return;
    }
    for (let i = 0; i < tasksOf(); i++) {
      const s = document.createElement('span');
      s.className = 'chest-slot' + (i < taskIdx ? ' got' : '');
      bar.appendChild(s);
    }
  }

  // ---- итог уровня ----
  function finishLevel() {
    mode = 'done';
    const perfect = mistakes === 0 && hints === 0;
    const map = doneMap();
    const first = !map[level.id];
    if (!map[level.id] || perfect) map[level.id] = perfect ? 'perfect' : 'done';
    Store.set('trainDone', map);
    const stars = level.exam ? (first ? 5 : 1) : (first ? 3 : 1);
    Progress.addStars(stars);
    Progress.addXP(first ? (level.exam ? 50 : 20) : 5);

    Sound.play('win');
    FX.confetti(perfect ? 140 : 80);
    const doneVoice = level.exam ? levelVoice('exam_done') : levelVoice('done');
    const resKey = perfect ? 'level_perfect' : 'level_done';
    Sound.voice([[doneVoice], [sysVoice(resKey, 0)]]);

    $('#td-letter').textContent = level.letter || '';
    $('#td-letter').hidden = !level.letter;
    $('#td-rule').textContent = level.done;
    $('#td-result').textContent = perfect ? '🌟 Без единой ошибки!' : 'Ошибок: ' + mistakes + (hints ? ' · подсказок: ' + hints : '');
    $('#td-reward').innerHTML = '+' + stars + ' <span class="star-icon"></span>';
    const idx = module.levels.indexOf(level);
    $('#btn-td-next').hidden = idx >= module.levels.length - 1;
    setTimeout(() => { doneBox.hidden = false; }, 900);
  }

  function setButtons() {
    $('#btn-train-ok').hidden = mode !== 'explain';
    $('#btn-train-hint').hidden = mode !== 'task';
    $('#btn-train-explain').hidden = mode !== 'task' || !level.explain;
  }

  // ---------- Кнопки ----------
  $('#btn-train-ok').addEventListener('click', nextSlide);
  $('#btn-train-hint').addEventListener('click', () => { Sound.play('click'); showHint(false); });
  $('#btn-train-explain').addEventListener('click', () => {
    Sound.play('click');
    mode = 'explain';
    board.setInteractive(false);
    setButtons();
    saySystem($('#train-coach'), 'explain_again', 'talk');
    setTimeout(startExplain, 1800);
  });
  $('#btn-td-again').addEventListener('click', () => { Sound.play('click'); openLevel(level.id); });
  $('#btn-td-island').addEventListener('click', () => { Sound.play('click'); location.hash = 'train/' + module.id; });
  $('#btn-td-next').addEventListener('click', () => {
    Sound.play('click');
    const idx = module.levels.indexOf(level);
    location.hash = 'train/' + module.levels[idx + 1].id;
  });

  function enter(param) {
    $('#train-map-wrap').hidden = !!param;
    const isIsland = param && T.modules.some((m) => m.id === param);
    islandView.hidden = !isIsland;
    levelView.hidden = !param || isIsland;
    doneBox.hidden = true;
    if (!param) {
      renderMap();
      const box = $('#map-coach');
      saySystem(box, 'hello', 'talk');
    } else if (isIsland) {
      renderIsland(T.modules.find((m) => m.id === param));
    } else {
      openLevel(param);
    }
  }

  // current() — для отладки и автотестов
  return { enter, current: () => ({ task, game, mode, step, side, busy, level, movesLeft }) };
})();
