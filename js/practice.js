// Короткие тренировочные партии: экран использует чистую логику PracticeLogic.
window.PracticeScreen = (function () {
  const $ = (id) => document.getElementById(id);
  const logic = window.PracticeLogic;
  const list = $('practice-list'), view = $('practice-view'), boardEl = $('practice-board');
  const result = $('practice-result'), intro = $('practice-intro');
  let board = null, game = null, task = null, mode = null, phase = 'list';
  let round = 0, taskKey = 0, token = 0, moveCount = 0, hintLevel = 0;
  let variantOffset = 0, quizWrongTaps = 0, openingThreatsBefore = new Set();
  let assisted = false, consequence = null, lastText = '', lastNarration = '', sessionIndependent = 0, sessionAssisted = 0;
  let completed = false, completedTasks = new Set(), speechToken = 0;

  function say(text, face, narration) {
    lastText = text || '';
    lastNarration = narration || lastText;
    const textEl = $('practice-coach-text');
    textEl.textContent = lastText;
    const faceEl = $('practice-coach').querySelector('.coach-face');
    const faces = { normal: 'normal', talk: 'talk', happy: 'happy', think: 'think', oops: 'surprised', surprised: 'surprised' };
    faceEl.innerHTML = '<img src="assets/coach/' + (faces[face] || 'talk') + '.png" alt="Тренер">';
    faceEl.classList.remove('react'); void faceEl.offsetWidth; faceEl.classList.add('react');
    if (window.Sound) Sound.stopVoice();
    const voicePaths = window.PracticeVoice ? PracticeVoice.resolve(lastNarration) : null;
    if (voicePaths && voicePaths.length && window.Sound && Sound.sfxOn) {
      if (window.speechSynthesis) speechSynthesis.cancel();
      Sound.voice(voicePaths.map((path) => [path]));
      return;
    }
    const currentSpeech = ++speechToken;
    if (window.speechSynthesis) {
      speechSynthesis.cancel();
      if (lastNarration && window.Sound && Sound.sfxOn && window.SpeechSynthesisUtterance) {
        const utterance = new SpeechSynthesisUtterance(lastNarration);
        utterance.lang = 'ru-RU';
        utterance.rate = 0.9;
        utterance.onend = () => { if (speechToken !== currentSpeech) return; };
        speechSynthesis.speak(utterance);
      }
    }
  }

  function stopSpeech() {
    speechToken++;
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (window.Sound) Sound.stopVoice();
  }

  function setButtons({ hint = false, retry = false, next = false } = {}) {
    $('practice-hint').hidden = !hint;
    $('practice-retry').hidden = !retry;
    $('practice-next').hidden = !next;
  }

  function renderModes() {
    phase = 'list';
    intro.hidden = true; view.inert = false;
    if (board) { board.setInteractive(false); board.setGame(new Chess()); }
    list.innerHTML = '';
    logic.MODES.forEach((item) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'practice-card block-btn stone';
      const image = document.createElement('img');
      image.src = item.image || 'assets/coach/normal.png';
      image.alt = '';
      const copy = document.createElement('span'); copy.className = 'practice-card-copy';
      const title = document.createElement('b'); title.textContent = item.title;
      const goal = document.createElement('span'); goal.textContent = item.goal;
      const rule = document.createElement('small'); rule.textContent = item.why;
      copy.append(title, goal, rule);
      card.append(image, copy);
      card.addEventListener('click', () => { location.hash = 'practice/' + item.id; });
      list.appendChild(card);
    });
    list.hidden = false; view.hidden = true; result.hidden = true;
  }

  function createBoard() {
    if (!board) {
      board = ChessBoard.create(boardEl, {
        game, playerColor: 'w', orientation: 'w', showTargets: false, checkSound: false,
        isOver: (g) => phase !== 'ready' || g.game_over(),
        onIllegal: illegalMove,
        onMove: onMove
      });
      boardEl.addEventListener('pointerdown', captureSquare, true);
      boardEl.addEventListener('keydown', captureKey, true);
    }
    board.setPlayerColor('w'); board.setOrientation('w'); board.setShowTargets(false);
    board.setGame(game); board.setMarks({}); board.setArrows([]); board.setInteractive(phase === 'ready');
    boardEl.querySelectorAll('.sq').forEach((sq) => {
      sq.tabIndex = 0; sq.setAttribute('role', 'button');
      sq.setAttribute('aria-label', 'Клетка ' + sq.dataset.square);
    });
  }

  function showGoals(status) {
    const goals = $('practice-goals');
    goals.innerHTML = '';
    if (!status || !status.goals) { goals.hidden = true; return; }
    goals.hidden = false;
    status.goals.forEach((item) => {
      const tag = document.createElement('span');
      tag.className = 'practice-goal' + (item.done ? ' done' : '');
      tag.textContent = (item.done ? '✓ ' : '○ ') + item.label;
      goals.appendChild(tag);
    });
    boardEl.querySelectorAll('.sq').forEach((cell) => {
      const central = task && task.id === 'center' && ['d4', 'e4', 'd5', 'e5'].includes(cell.dataset.square);
      cell.classList.toggle('practice-central', central);
      cell.classList.toggle('practice-controlled', central && status.controlled && status.controlled.includes(cell.dataset.square));
    });
  }

  function taskLabel() {
    $('practice-title').textContent = mode.title;
    $('practice-count').textContent = task.kind === 'opening' ? 'До ' + (task.maxMoves || 8) + ' ходов' : 'Задание ' + (round + 1) + ' из ' + (task.total || 3);
  }

  function start(id, repeat) {
    token++;
    stopSpeech();
    mode = logic.MODES.find((m) => m.id === id);
    if (!mode) { renderModes(); return; }
    list.hidden = true; view.hidden = false; result.hidden = true;
    round = 0; moveCount = 0; sessionIndependent = 0; sessionAssisted = 0;
    if (!repeat) {
      variantOffset = Number(Store.get('practice:' + id + ':sessions', 0)) || 0;
      Store.set('practice:' + id + ':sessions', variantOffset + 1);
    }
    completed = false; completedTasks = new Set();
    loadTask(false);
    phase = 'intro'; board.setInteractive(false); view.inert = true;
    $('practice-intro-title').textContent = task.lessonTitle || task.title;
    $('practice-intro-why').textContent = task.why;
    $('practice-intro-goal').textContent = task.goal;
    $('practice-intro-question').textContent = task.question;
    intro.hidden = false;
    $('practice-begin').focus?.();
  }

  function begin() {
    if (phase !== 'intro') return;
    intro.hidden = true; view.inert = false; stopSpeech();
    prepareTurn();
    $('practice-listen').focus?.();
  }

  function prepareTurn() {
    if (task.id === 'watch' && !task.focus) {
      phase = 'observe'; board.setInteractive(false); setButtons();
      game = new Chess(task.beforeFen); board.setGame(game);
      say('Смотри, какой ход сделают чёрные. Потом найди свою фигуру под ударом.', 'think');
      const currentToken = token;
      setTimeout(() => {
        if (currentToken !== token || phase !== 'observe') return;
        board.makeMove(task.lastMove.from, task.lastMove.to, task.lastMove.promotion);
      }, 650);
      return;
    }
    phase = 'ready'; board.setInteractive(true); setButtons({ hint: true });
    say(task.kind === 'opening' ? logic.openingStatus(game, task).text
      : (task.focus ? 'Спаси фигуру на ' + task.focus + '. ' : '') + task.rule, 'normal');
  }

  function loadTask(retainHelp) {
    taskKey++;
    const oldAssisted = retainHelp && assisted;
    task = logic.createTask(mode.id, round + variantOffset);
    game = new Chess(task.fen);
    phase = 'ready'; consequence = null; moveCount = task.kind === 'opening' ? moveCount : 0;
    if (!retainHelp) { assisted = false; hintLevel = 0; }
    else assisted = oldAssisted;
    setButtons({ hint: true });
    createBoard();
    // Clear highlights left by the previous mission, including center squares.
    boardEl.querySelectorAll('.sq').forEach((cell) => cell.classList.remove('practice-central', 'practice-controlled'));
    taskLabel(); showGoals(task.kind === 'opening' ? logic.openingStatus(game, task) : null);
    if (task.focus) board.setMarks({ [task.focus]: 'focus' });
    $('practice-purpose').open = false;
    $('practice-why-text').textContent = task.why;
    $('practice-question').textContent = task.question;
    $('practice-feedback').hidden = true;
    if (round || retainHelp) prepareTurn();
  }

  function illegalMove() {
    if (phase !== 'ready') return;
    assisted = true;
    say('Так не ходят. Попробуй другой ход.', 'think');
  }

  function markTaskDone() {
    if (completedTasks.has(taskKey)) return;
    completedTasks.add(taskKey);
    if (assisted) sessionAssisted++; else sessionIndependent++;
    const prefix = 'practice:' + mode.id + ':';
    const key = prefix + (assisted ? 'assisted' : 'independent');
    Store.set(key, (Number(Store.get(key, 0)) || 0) + 1);
  }

  function beforeFenForLastMove() {
    const history = game.history({ verbose: true }).slice(0, -1);
    const before = new Chess(task.beforeFen || task.fen);
    history.forEach((m) => before.move({ from: m.from, to: m.to, promotion: m.promotion }));
    return before.fen();
  }

  function getThreats(position) {
    const threats = new Set();
    position.SQUARES.forEach((square) => {
      const piece = position.get(square);
      if (piece && piece.color === 'w' && piece.type !== 'k' && logic.threat(position, square)) threats.add(square);
    });
    return threats;
  }

  function onMove(move) {
    if (phase === 'observe' && move.color === 'b') {
      phase = 'find'; board.setInteractive(false); setButtons({ hint: true });
      say('Чёрные сходили с ' + move.from + ' на ' + move.to + '. Какая твоя фигура теперь в опасности? Нажми на неё.', 'think');
      return;
    }
    if (phase === 'bot' && move.color === 'b') { afterOpeningReply(token, move); return; }
    if (phase === 'demo') {
      phase = 'retry'; board.setInteractive(false);
      board.setArrows([]); setButtons({ retry: true });
      say('Вот кто мог забрать! Теперь попробуй ещё раз.', 'think');
      return;
    }
    if (phase !== 'ready' || move.color !== 'w') return;
    board.setInteractive(false);
    // Подсказочная стрелка относится только к предыдущему выбору.
    board.setArrows([]);
    board.setMarks({});
    hintLevel = 0;
    const beforeFen = beforeFenForLastMove();
    if (task.kind === 'opening') {
      moveCount++;
      openingThreatsBefore = getThreats(new Chess(beforeFen));
      const status = logic.openingStatus(game, task);
      if (status.failed) { assisted = true; finishOpening(false, status.text); return; }
      if (task.id === 'traps' && status.done) { finishOpening(true, status.text); return; }
      openingReply(); return;
    }
    const judged = logic.judge(task, beforeFen, game, move);
    if (judged.ok) {
      phase = 'solved'; markTaskDone(); board.setInteractive(false); board.setArrows([]);
      setButtons({ next: true }); say(judged.text, 'happy', judged.text + ' ' + (judged.explanation || task.takeaway));
      $('practice-feedback').textContent = judged.explanation || task.takeaway;
      $('practice-feedback').hidden = false;
      return;
    }
    assisted = true; consequence = judged.consequence || null;
    if (consequence) {
      quizWrongTaps = 0;
      phase = 'quiz'; board.setInteractive(false);
      say(judged.text + ' Кто может забрать фигуру? Найди соперника.', 'oops');
    } else {
      phase = 'retry'; board.setInteractive(false); setButtons({ retry: true });
      say(judged.text, 'think');
    }
  }

  function openingReply() {
    const myToken = token, chosen = logic.reply(game, task);
    if (!chosen) { afterOpeningReply(myToken); return; }
    phase = 'bot';
    setTimeout(() => {
      if (myToken !== token || phase !== 'bot') return;
      if (game.turn() !== 'b' || !game.moves().length) { afterOpeningReply(myToken); return; }
      board.makeMove(chosen.from, chosen.to, chosen.promotion);
    }, 420);
  }

  function afterOpeningReply(myToken, replyMove) {
    if (myToken !== token) return;
    const status = logic.openingStatus(game, task);
    showGoals(status);
    let threatText = '';
    if (replyMove && replyMove.captured) {
      assisted = true;
      threatText = 'Соперник забрал фигуру на ' + replyMove.to + '. Береги остальные!';
    } else {
      const freshThreat = Array.from(getThreats(game)).find((square) => !openingThreatsBefore.has(square));
      if (freshThreat) {
        assisted = true;
        threatText = 'Фигура на ' + freshThreat + ' под ударом. Береги её!';
      }
    }
    if (game.in_check()) {
      assisted = true;
      threatText = 'Твой король под шахом. Его нужно защитить!';
    }
    if (status.failed) { assisted = true; finishOpening(false, status.text); return; }
    if (status.done && !threatText) {
      finishOpening(true, status.text);
      return;
    }
    if (moveCount >= (task.maxMoves || 8) || game.game_over()) { finishOpening(false, 'Хорошая попытка! Попробуем ещё раз и соберём все цели.'); return; }
    phase = 'ready'; board.setInteractive(true); setButtons({ hint: true });
    say(threatText || status.text, threatText ? 'oops' : 'talk');
  }

  function finishOpening(success, text) {
    phase = 'done'; board.setInteractive(false); setButtons();
    if (success) { markTaskDone(); awardSessionXp(); }
    say(text, success ? 'happy' : 'think', text + ' ' + task.takeaway);
    showResult(success ? 'Отлично!' : 'Попробуем ещё?', text + ' ' + task.takeaway, true, success && task.id === 'traps');
  }

  function awardSessionXp() {
    const rewardKey = 'practice:' + mode.id + ':xp-awarded';
    if (!Store.get(rewardKey, false)) { Progress.addXP(3); Store.set(rewardKey, true); }
  }

  function completeSession() {
    if (completed) return;
    completed = true; phase = 'done'; board.setInteractive(false); setButtons();
    // Опыт выдаётся один раз за режим на этом устройстве; звёзд и медалей практика не даёт.
    awardSessionXp();
    say(task.takeaway, 'happy');
    showResult('Все задания пройдены!', task.takeaway, true);
  }

  function scoreText() {
    return 'Сам: ' + sessionIndependent + ' · Вместе: ' + sessionAssisted;
  }

  function showResult(title, text, canRetry, nextExample) {
    $('practice-result-title').textContent = title;
    $('practice-result-text').textContent = text;
    $('practice-result-count').textContent = scoreText();
    $('practice-result-retry').hidden = !canRetry;
    $('practice-result-next').hidden = !nextExample;
    result.hidden = false;
  }

  function captureSquare(e) {
    if (phase === 'find') {
      const cell = e.target.closest('.sq');
      if (!cell) return;
      e.preventDefault(); e.stopPropagation();
      const square = cell.dataset.square;
      if (!logic.threatened(game).includes(square)) {
        assisted = true;
        say('Проверь, какую белую фигуру чёрные могут выгодно забрать. Посмотри, куда смотрит их последняя фигура.', 'think');
        return;
      }
      task.focus = square; phase = 'ready'; hintLevel = 0;
      board.setArrows([]); board.setMarks({ [square]: 'focus' }); board.setInteractive(true);
      say('Верно! Фигура на ' + square + ' под ударом. Теперь спаси её: уйди, защити или убери нападающего.', 'happy');
      return;
    }
    if (phase !== 'quiz') return;
    const sq = e.target.closest('.sq');
    if (!sq) return;
    e.preventDefault(); e.stopPropagation();
    if (sq.dataset.square !== consequence.from) {
      quizWrongTaps++;
      if (quizWrongTaps >= 1) {
        showArrow(consequence, 'red');
        say('Посмотри на красную стрелку. Кто нападает?', 'think');
      } else say('Ищи фигуру соперника, которая нападает.', 'think');
      return;
    }
    phase = 'demo'; board.setArrows([]);
    const legal = game.moves({ square: consequence.from, verbose: true }).find((m) => m.to === consequence.to);
    if (!legal) { phase = 'retry'; setButtons({ retry: true }); say('Позиция уже изменилась. Попробуем снова.', 'think'); return; }
    say('Да! ' + logic.pieceName(legal.piece) + ' забирает нашу фигуру.', 'oops');
    board.makeMove(legal.from, legal.to, legal.promotion);
  }

  function captureKey(e) {
    if (!['quiz', 'find'].includes(phase) || (e.key !== 'Enter' && e.key !== ' ')) return;
    const sq = e.target.closest('.sq'); if (!sq) return;
    e.preventDefault(); e.stopPropagation();
    captureSquare({ target: sq, preventDefault() {}, stopPropagation() {} });
  }

  function showArrow(move, color) {
    if (!move || !board) return;
    board.setArrows([{ from: move.from, to: move.to, color: color || 'red' }]);
  }

  function hint() {
    if (!game || !['ready', 'quiz', 'find'].includes(phase)) return;
    assisted = true;
    if (phase === 'find') {
      hintLevel++;
      const target = logic.threatened(game)[0];
      if (hintLevel === 1) say('Куда теперь смотрит фигура, которой сходили чёрные? Проследи её нападения.', 'think');
      else if (target) { showArrow(logic.threat(game, target)); say('Посмотри по стрелке. Какая белая фигура под ударом?', 'think'); }
      return;
    }
    if (phase === 'quiz') {
      if (hintLevel === 0) { hintLevel = 1; showArrow(consequence, 'red'); say('Вот кто нападает. Посмотри на красную стрелку.', 'think'); return; }
      hintLevel++;
      showArrow(consequence, 'red'); say('Фигура идёт по стрелке и забирает. Попробуем ещё?', 'think'); return;
    }
    hintLevel++;
    if (hintLevel === 1) { say(task.rule || task.goal, 'talk'); return; }
    if (hintLevel === 2) {
      const move = task.kind === 'opening' ? logic.openingHint(game, task) : (logic.solutions(task, game)[0] || null);
      if (move) {
        board.setArrows([]); board.setMarks({ [move.from]: 'safe' });
        say('Посмотри на фигуру на ' + move.from + '.', 'think');
      } else if (task.focus) say('Посмотри на клетку ' + task.focus + '.', 'think');
      else say('Какой ход поможет цели?', 'think');
      return;
    }
    const move = task.kind === 'opening' ? logic.openingHint(game, task) : (logic.solutions(task, game)[0] || null);
    if (move) { board.setMarks({}); showArrow(move, 'red'); say('Попробуй сходить по стрелке.', 'think'); }
    else say('Подумай, какой ход поможет цели.', 'think');
  }

  function retryTask() {
    if (!task) return;
    token++; stopSpeech(); result.hidden = true;
    if (task.kind === 'opening') { moveCount = 0; loadTask(false); if (!round) prepareTurn(); return; }
    loadTask(true);
  }

  function nextTask() {
    if (phase !== 'solved') return;
    token++; stopSpeech(); round++;
    if (round >= (task.total || 3)) { completeSession(); return; }
    loadTask(false);
  }

  function listModes() {
    token++; stopSpeech(); phase = 'list'; result.hidden = true;
    intro.hidden = true; view.inert = false;
    if (location.hash !== '#practice') { location.hash = 'practice'; return; }
    renderModes();
  }

  function restart() {
    if (mode) start(mode.id, true);
  }

  $('practice-hint').addEventListener('click', hint);
  $('practice-begin').addEventListener('click', begin);
  $('practice-intro-list').addEventListener('click', listModes);
  $('practice-intro-listen').addEventListener('click', () => say(task.why + ' ' + task.goal + ' ' + task.question, 'talk'));
  intro.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); begin(); return; }
    if (event.key !== 'Tab') return;
    const buttons = [$('practice-begin'), $('practice-intro-listen'), $('practice-intro-list')];
    const index = buttons.indexOf(document.activeElement);
    event.preventDefault(); buttons[(index + (event.shiftKey ? 2 : 1)) % buttons.length].focus();
  });
  $('practice-listen').addEventListener('click', () => { if (lastText) say(lastText, 'talk', lastNarration); });
  $('practice-retry').addEventListener('click', retryTask);
  $('practice-next').addEventListener('click', nextTask);
  $('practice-modes').addEventListener('click', listModes);
  $('practice-restart').addEventListener('click', restart);
  $('practice-result-retry').addEventListener('click', restart);
  $('practice-result-next').addEventListener('click', () => { if (mode) start(mode.id); });
  $('practice-result-list').addEventListener('click', listModes);

  function enter(id) {
    token++; stopSpeech();
    if (id) start(id); else renderModes();
  }

  function leave() {
    token++; stopSpeech(); phase = 'left';
    if (board) { board.setInteractive(false); board.setGame(new Chess()); }
    result.hidden = true; intro.hidden = true; view.inert = false; setButtons();
  }

  function current() {
    return { game, task, phase, round, mode: mode && mode.id, assisted };
  }

  renderModes();
  return { enter, leave, current };
})();
