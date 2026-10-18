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

  const folder = (o) => 'assets/opponents/' + o.id + '/';

  // ---------- Картинки соперников ----------
  // Проверяем, какие лица нарисованы, и запоминаем.
  function preloadFaces(o) {
    const all = new Set();
    Object.values(OPPONENT_FACES).forEach((chain) => chain.forEach((f) => all.add(f)));
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
        (o.level ? '<span class="opp-level">' + '<i class="on"></i>'.repeat(o.level) + '<i></i>'.repeat(5 - o.level) + '</span>' : '') +
        (medal ? '<span class="medal small ' + medal.tier + '"><b>' + Progress.winsOver(o.id) + '</b></span>' : '');
      card.addEventListener('click', () => {
        Sound.play('click');
        location.hash = 'play/' + o.id;
      });
      listView.appendChild(card);
    }
    // картинки могли догрузиться — перерисуем один раз
    Promise.all(OPPONENTS.map(preloadFaces)).then(() => {
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
    board.setInteractive(true);

    gameView.classList.toggle('duo', opp.id === 'duo');
    $('#opp-name').textContent = opp.name;
    $('#opp-level').innerHTML = opp.level
      ? '<i class="on"></i>'.repeat(opp.level) + '<i></i>'.repeat(5 - opp.level) : '';
    preloadFaces(opp).then(() => setFace('normal'));
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
    board.setMarks({});
    updateStatus();
    if (game.game_over()) return finish();
    if (opp.id === 'duo') return;

    if (move.color === 'w') {
      // ребёнок сходил
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
      board.makeMove(m.from, m.to);
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
      const before = medalFor(Progress.winsOver(opp.id));
      Progress.addWin(opp.id);
      const wins = Progress.winsOver(opp.id);
      const now = medalFor(wins);
      const isNew = now && (!before || before.tier !== now.tier);
      icon = '';
      title = isNew ? now.name + ' медаль!' : 'Победа!';
      medalHtml = '<div class="medal big ' + now.tier + (isNew ? ' new' : '') + '">' +
        '<span class="medal-face">' + avatarHtml(opp, 'lose') + '</span></div>' +
        '<div class="medal-note">Побед над соперником: ' + wins + nextMedalNote(wins) + '</div>';
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
    setTimeout(() => { overlay.hidden = false; }, 1200);
  }

  function nextMedalNote(wins) {
    const next = MEDALS.slice().reverse().find((m) => m.wins > wins);
    return next ? ' · до следующей медали: ' + (next.wins - wins) : '';
  }

  // ---------- Кнопки ----------
  function undo() {
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
      token++;
      overlay.hidden = true;
      Sound.stopVoice();
      renderList();
    }
  }

  return { enter };
})();
