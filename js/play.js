// «Игра с роботом»: выбор соперника → партия. Ребёнок всегда играет белыми.
// Соперник сидит со своей стороны доски, меняет лицо и говорит фразы:
// в начале, когда забирает/теряет фигуру, ставит шах, выигрывает и проигрывает.
// За победы — медали (бронза → серебро → золото) у каждого соперника.
window.PlayScreen = (function () {
  const $ = (sel) => document.querySelector(sel);
  const V = CONFIG.voices;
  const DUO = { id: 'duo', name: 'Вдвоём', emoji: '👫', color: '#8f8f8f' };
  const REACT_MS = 2600;      // сколько держится лицо-реакция
  const THINK_MS = [700, 1300];

  const listView = $('#opp-list');
  const gameView = $('#play-view');
  const overlay = $('#game-over');
  let board = null;
  let game = null;
  let opp = null;
  let token = 0;               // меняется при новой партии/отмене — старые таймеры молча выходят
  let thinking = false;
  let faceTimer = null;
  const faceCache = {};        // 'lenya/happy' → true/false (есть ли картинка)
  let coachEnabled = Store.get('playCoach', true);
  let coachCount = 0;
  let review = null;
  const coach = document.createElement('div');
  coach.className = 'play-coach';
  coach.hidden = true;
  coach.innerHTML = '<div class="play-coach-text" role="status" aria-live="polite"></div>' +
    '<div class="play-coach-actions"><button type="button" class="block-btn ctrl-btn gold" id="play-coach-show">Покажи</button>' +
    '<button type="button" class="block-btn ctrl-btn grass" id="play-coach-retry" hidden>Переиграть</button>' +
    '<button type="button" class="block-btn ctrl-btn stone" id="play-coach-continue">Играю дальше</button></div>';
  $('#opp-panel').appendChild(coach);
  const coachToggle = document.createElement('label');
  coachToggle.className = 'play-coach-toggle';
  coachToggle.innerHTML = '<input type="checkbox"> Тренер';
  $('#opp-panel .opp-info').appendChild(coachToggle);
  const coachInput = coachToggle.querySelector('input');
  coachInput.checked = coachEnabled;

  function coachSay(text) {
    coach.querySelector('.play-coach-text').textContent = text;
    Sound.stopVoice();
    if (window.speechSynthesis) speechSynthesis.cancel();
    const voiceKey = {
      'Смотрим ответ соперника.': 'reply_watch',
      'Вот ответ! Теперь попробуй ход, после которого фигуру не отдадим.': 'safe_move'
    }[text];
    const dynamicKey = text.startsWith('Фигура на ') ? 'danger_find'
      : text.startsWith('Посмотри, откуда чёрная фигура') ? 'find_attacker' : voiceKey;
    if (dynamicKey && Sound.sfxOn) {
      Sound.voice([['assets/voice/coach/play/' + dynamicKey]]);
      return;
    }
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    if (!Sound.sfxOn || !window.SpeechSynthesisUtterance) return;
    const line = new SpeechSynthesisUtterance(text);
    line.lang = 'ru-RU';
    line.rate = 0.9;
    window.speechSynthesis.speak(line);
  }

  function closeCoach() {
    review = null;
    coach.hidden = true;
    coachInput.disabled = false;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  function offerCoach(move) {
    // В партиях против персонажей ребёнок играет сам. Тренер остаётся только
    // в коде для совместимости со старыми сохранениями и не перехватывает ход.
    if (opp.id !== 'duo' || !coachEnabled || coachCount >= 2 || !window.PracticeLogic) return false;
    const reply = PracticeLogic.threat(game, move.to);
    if (!reply) return false;
    coachCount++;
    review = { source: game, move, reply, phase: 'question' };
    board.setInteractive(false);
    coach.hidden = false;
    $('#play-coach-show').hidden = false;
    $('#play-coach-retry').hidden = true;
    $('#play-coach-continue').disabled = false;
    coachSay('Фигура на ' + move.to + ' под ударом. Найди чёрную фигуру, которая может её забрать.');
    board.setMarks({ [move.to]: 'danger' });
    return true;
  }

  function showConsequence() {
    if (!review || review.phase !== 'question' || board.isBusy()) return;
    const r = review;
    r.phase = 'demo';
    game = new Chess(r.source.fen());
    board.setGame(game);
    board.setInteractive(false);
    board.setArrows([{ from: r.reply.from, to: r.reply.to, color: 'red' }]);
    $('#play-coach-show').hidden = true;
    $('#play-coach-continue').disabled = true;
    coachInput.disabled = true;
    coachSay('Смотрим ответ соперника.');
    board.makeMove(r.reply.from, r.reply.to, r.reply.promotion);
  }

  function restoreCoach(retry) {
    if (!review || board.isBusy() || review.phase === 'demo') return;
    const r = review;
    game = r.source;
    if (retry) game.undo();
    closeCoach();
    board.setGame(game);
    board.setMarks({});
    board.setArrows([]);
    const h = game.history({ verbose: true });
    board.setLastMove(h[h.length - 1] || null);
    updateStatus();
    if (retry) {
      board.setInteractive(true);
      Sound.voice(V.tryAgain);
    } else robotTurn();
  }

  $('#play-coach-show').addEventListener('click', showConsequence);
  $('#play-coach-retry').addEventListener('click', () => restoreCoach(true));
  $('#play-coach-continue').addEventListener('click', () => restoreCoach(false));
  coachInput.addEventListener('change', () => {
    coachEnabled = coachInput.checked;
    Store.set('playCoach', coachEnabled);
    if (!coachEnabled && review) restoreCoach(false);
  });
  $('#board').addEventListener('pointerdown', (e) => {
    if (!review || review.phase !== 'question') return;
    e.preventDefault();
    e.stopPropagation();
    const cell = e.target.closest('[data-square]');
    if (!cell) return;
    if (cell.dataset.square === review.reply.from) showConsequence();
    else {
      coachSay('Посмотри, откуда чёрная фигура может прийти на ' + review.move.to + '.');
      board.setArrows([{ from: review.reply.from, to: review.reply.to, color: 'red' }]);
    }
  }, true);

  const folder = (o) => 'assets/opponents/' + o.id + '/';
  const levelHtml = (level) => {
    const max = 10;
    return '<i class="on"></i>'.repeat(Math.min(level, max)) +
      '<i></i>'.repeat(Math.max(0, max - level));
  };

  // ---------- Картинки соперников ----------
  // Проверяем, какие лица нарисованы, и запоминаем.
  function preloadFaces(o, states) {
    const all = new Set();
    (states || Object.keys(OPPONENT_FACES)).forEach((state) => {
      (OPPONENT_FACES[state] || []).forEach((f) => all.add(f));
    });
    return Promise.all(Array.from(all).map((f) => new Promise((res) => {
      const key = o.id + '/' + f;
      if (key in faceCache) return res();
      const img = new Image();
      img.onload = () => { faceCache[key] = true; res(); };
      img.onerror = () => { faceCache[key] = false; res(); };
      img.src = folder(o) + f + '.png';
    })));
  }

  function faceSrc(o, state) {
    for (const f of OPPONENT_FACES[state] || ['normal']) {
      if (faceCache[o.id + '/' + f]) return folder(o) + f + '.png';
    }
    return null;
  }

  // Портрет: картинка, а пока её нет — цветной блок с эмодзи.
  function avatarHtml(o, state) {
    const src = o.id !== 'duo' && faceSrc(o, state || 'normal');
    return src
      ? '<img src="' + src + '" alt="">'
      : '<span class="avatar-stub" style="background:' + o.color + '">' + o.emoji + '</span>';
  }

  // ---------- Список соперников ----------
  function renderList() {
    listView.innerHTML = '';
    for (const o of OPPONENTS.concat([DUO])) {
      const card = document.createElement('button');
      card.className = 'block-btn opp-card stone' + (o.id === 'duo' ? ' duo' : '');
      const medal = o.id === 'duo' ? null : medalFor(Progress.winsOver(o.id));
      card.innerHTML =
        '<span class="opp-avatar">' + avatarHtml(o) + '</span>' +
        '<span class="opp-name">' + o.name + '</span>' +
        (o.level ? '<span class="opp-level" aria-label="Сложность ' + o.level + ' из 10">' + levelHtml(o.level) + '</span>' : '') +
        (medal ? '<span class="medal small ' + medal.tier + '"><b>' + Progress.winsOver(o.id) + '</b></span>' : '');
      card.addEventListener('click', () => {
        Sound.play('click');
        location.hash = 'play/' + o.id;
      });
      listView.appendChild(card);
    }
    // картинки могли догрузиться — перерисуем один раз
    // В списке нужен только обычный портрет. Все реакции подгружаем после выбора.
    Promise.all(OPPONENTS.map((o) => preloadFaces(o, ['normal']))).then(() => {
      if (!listView.hidden) listView.querySelectorAll('.opp-card').forEach((card, i) => {
        const o = OPPONENTS[i];
        if (o) card.querySelector('.opp-avatar').innerHTML = avatarHtml(o);
      });
    });
  }

  function medalFor(wins) {
    return MEDALS.find((m) => wins >= m.wins) || null;
  }

  // ---------- Лицо и фразы ----------
  function setFace(state, temporary) {
    clearTimeout(faceTimer);
    const box = $('#opp-face');
    box.innerHTML = avatarHtml(opp, state);
    box.classList.remove('react');
    void box.offsetWidth;
    if (state !== 'normal' && state !== 'think') box.classList.add('react');
    box.classList.toggle('thinking', state === 'think');
    if (temporary) faceTimer = setTimeout(() => setFace('normal'), REACT_MS);
  }

  // Случайный вариант фразы; если такого файла нет — пробуем остальные.
  function say(kind) {
    if (opp.id === 'duo') return;
    const variants = OPPONENT_LINES[kind].slice().sort(() => Math.random() - 0.5)
      .map((n) => folder(opp) + n);
    Sound.voice([variants]);
  }

  function bubble(emoji) {
    const b = $('#opp-bubble');
    b.textContent = emoji;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  // ---------- Партия ----------
  function startGame(id) {
    opp = id === 'duo' ? DUO : OPPONENTS.find((o) => o.id === id);
    if (!opp) { location.hash = 'play'; return; }
    token++;
    closeCoach();
    coachCount = 0;
    coachToggle.hidden = true;
    thinking = false;
    game = new Chess();
    overlay.hidden = true;

    if (!board) {
      // общий звук «Шах» выключен: против соперника шах объявляет он сам, вдвоём — только подсветка короля
      board = ChessBoard.create($('#board'), { game, onMove, checkSound: false });
    }
    board.setPlayerColor(opp.id === 'duo' ? 'both' : 'w');
    board.setOrientation('w');
    board.setGame(game);
    board.setMarks({});
    board.setArrows([]);
    board.setInteractive(true);

    gameView.classList.toggle('duo', opp.id === 'duo');
    $('#opp-name').textContent = opp.name;
    $('#opp-level').innerHTML = opp.level ? levelHtml(opp.level) : '';
    const my = token;
    if (opp.id !== 'duo' && Sound.preloadVoice) {
      Sound.preloadVoice(OPPONENT_LINES.hello.map((n) => folder(opp) + n));
    }
    preloadFaces(opp).then(() => { if (my === token) setFace('normal'); });
    setFace('normal');
    updateStatus();
    say('hello');
  }

  function updateStatus() {
    const turn = $('#turn');
    turn.className = 'turn ' + game.turn();
    turn.querySelector('.turn-text').textContent = opp.id === 'duo'
      ? (game.turn() === 'w' ? 'Ходят белые' : 'Ходят чёрные')
      : (game.turn() === 'w' ? 'Твой ход' : 'Думает…');
    $('#btn-undo').disabled = game.history().length === 0;
  }

  function onMove(move) {
    if (review && review.phase === 'demo') {
      review.phase = 'replay';
      $('#play-coach-retry').hidden = false;
      $('#play-coach-continue').disabled = false;
      coachInput.disabled = false;
      coachSay('Вот ответ! Теперь попробуй ход, после которого фигуру не отдадим.');
      return;
    }
    board.setMarks({});
    updateStatus();
    if (game.game_over()) return finish();
    if (opp.id === 'duo') return;

    if (move.color === 'w') {
      // ребёнок сходил
      if (offerCoach(move)) return;
      if (move.captured) { setFace('sad', true); bubble('😢'); say('lost'); }
      robotTurn();
    } else {
      // соперник сходил
      if (game.in_check()) { setFace('check', true); bubble('⚔️'); say('check'); }
      else if (move.captured) { setFace('happy', true); bubble('😄'); say('take'); }
      else setFace('normal');
      board.setInteractive(true);
    }
  }

  function robotTurn() {
    const my = token;
    thinking = true;
    board.setInteractive(false);
    // если только что была реакция на потерю — дадим ей показаться, потом «думает»
    setTimeout(() => { if (my === token && thinking) setFace('think'); }, 900);
    const delay = THINK_MS[0] + Math.random() * (THINK_MS[1] - THINK_MS[0]);
    setTimeout(() => {
      if (my !== token) return;
      const m = ChessAI.choose(game, opp.level);
      thinking = false;
      if (!m || my !== token) return;
      board.makeMove(m.from, m.to, m.promotion);
    }, delay);
  }

  function finish() {
    board.setInteractive(false);
    thinking = false;
    let icon = '🤝', title = 'Ничья!', medalHtml = '';
    const kidWon = game.in_checkmate() && game.turn() === 'b';

    if (opp.id === 'duo') {
      if (game.in_checkmate()) { icon = '🏆'; title = (game.turn() === 'w' ? 'Чёрные' : 'Белые') + ' победили!'; }
    } else if (kidWon) {
      setFace('lose');
      bubble('😭');
      const winsBefore = Progress.winsOver(opp.id);
      const before = medalFor(winsBefore);
      Progress.addWin(opp.id);
      Progress.addXP(20 * opp.level); // Лёня — 20, Человек-паук — 100
      Progress.addStars(opp.level);
      const wins = Progress.winsOver(opp.id);
      const now = medalFor(wins);
      const isNew = now && (!before || before.tier !== now.tier);
      icon = '';
      title = isNew ? now.name + ' медаль!' : 'Победа!';
      const starNote = ' · +' + opp.level + ' звёзд';
      medalHtml = '<div class="medal big ' + now.tier + (isNew ? ' new' : '') + '">' +
        '<span class="medal-face">' + avatarHtml(opp, 'lose') + '</span></div>' +
        '<div class="medal-note">Побед над соперником: ' + wins + nextMedalNote(wins) + starNote + '</div>';
      // первая победа над соперником открывает его секретную наклейку
      const secret = Stickers.unlockSecretFor(opp.id);
      if (secret) {
        medalHtml += '<div class="secret-won"><img src="' + Stickers.src(secret) + '" alt="">' +
          '<span>Секретная наклейка!<br><b>' + secret.name + '</b></span></div>';
      }
      Sound.play('win');
      FX.confetti(isNew ? 160 : 80);
      say('lose');
    } else if (game.in_checkmate()) {
      setFace('win');
      bubble('😎');
      icon = '💪';
      title = 'В этот раз ' + opp.name + ' победил. Ещё раз?';
      say('win');
    } else {
      setFace('normal');
    }

    overlay.querySelector('.go-icon').textContent = icon;
    overlay.querySelector('.go-icon').hidden = !icon;
    overlay.querySelector('.go-title').textContent = title;
    $('#go-medal').innerHTML = medalHtml;
    const my = token;
    setTimeout(() => { if (my === token) overlay.hidden = false; }, 1200);
  }

  function nextMedalNote(wins) {
    const next = MEDALS.slice().reverse().find((m) => m.wins > wins);
    return next ? ' · до следующей медали: ' + (next.wins - wins) : '';
  }

  // ---------- Кнопки ----------
  function undo() {
    if (review) { restoreCoach(true); return; }
    if (thinking || board.isBusy() || !game.history().length) return;
    token++;
    Sound.play('click');
    game.undo();
    // против соперника откатываем и его ответ, чтобы снова был ход ребёнка
    if (opp.id !== 'duo' && game.turn() === 'b') game.undo();
    const h = game.history({ verbose: true });
    board.setGame(game);
    board.setLastMove(h[h.length - 1] || null);
    board.setInteractive(true);
    overlay.hidden = true;
    setFace('normal');
    updateStatus();
  }

  function hint() {
    if (review) { showConsequence(); return; }
    if (thinking || board.isBusy() || game.game_over() || (opp.id !== 'duo' && game.turn() !== 'w')) return;
    Sound.play('click');
    Sound.voice(V.hint);
    const m = ChessAI.hint(game);
    if (!m) return;
    board.setMarks({ [m.from]: 'hint', [m.to]: 'hint-to' });
    board.select(m.from);
  }

  $('#btn-undo').addEventListener('click', undo);
  $('#btn-hint').addEventListener('click', hint);
  $('#btn-new').addEventListener('click', () => { Sound.play('click'); startGame(opp.id); });
  $('#btn-again').addEventListener('click', () => { Sound.play('click'); startGame(opp.id); });
  $('#btn-opponents').addEventListener('click', () => { Sound.play('click'); location.hash = 'play'; });

  function enter(param) {
    listView.hidden = !!param;
    gameView.hidden = !param;
    if (param) startGame(param);
    else {
      leave();
      renderList();
    }
  }

  function leave() {
    token++;
    thinking = false;
    clearTimeout(faceTimer);
    closeCoach();
    overlay.hidden = true;
    Sound.stopVoice();
    if (board) {
      // Replacing the game also invalidates a pending capture animation callback.
      board.setGame(new Chess());
      board.setInteractive(false);
    }
  }

  return { enter, leave, current: () => ({ game, board, opp, review, coachCount, thinking }) };
})();
