// Rules and examples for short practice games. All moves come from chess.js.
window.PracticeLogic = (function () {
  const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  const NAMES = { p: 'пешка', n: 'конь', b: 'слон', r: 'ладья', q: 'ферзь', k: 'король' };
  const CENTER = ['d4', 'e4', 'd5', 'e5'];
  const MODES = [
    { id: 'center', title: 'Держи центр', goal: 'Контролируй две клетки в середине. Выведи коня и слона.',
      rule: 'Держи под прицелом две клетки: d4, e4, d5 или e5. Помогут пешки, кони и слоны.',
      why: 'Центр — как перекрёсток. Отсюда фигурам легче помогать друг другу и попадать в разные части доски.',
      question: 'Какие клетки в середине видят твои фигуры?',
      takeaway: 'Центр можно занять пешками или держать под прицелом издалека. Прежде чем идти вперёд, проверь защиту.',
      maxMoves: 8, image: 'assets/pieces/wP.png' },
    { id: 'development', title: 'Собери команду', goal: 'Выведи коня и слона. Сделай рокировку.',
      rule: 'Открой дорогу коню и слону. Потом спрячь короля рокировкой.',
      why: 'Фигуры на первой линии ещё не помогают команде. Выведи помощников, а короля спрячь за пешками.',
      question: 'Кто ещё сидит дома? Что мешает рокировке?',
      takeaway: 'Развивай фигуры и береги короля. Если тебе объявили шах, сначала защити его.',
      maxMoves: 10, image: 'assets/pieces/wK.png' },
    { id: 'watch', title: 'Что задумал соперник?', goal: 'Посмотри ход чёрных. Найди фигуру под ударом и спаси её.',
      rule: 'После хода соперника спроси: на что он напал? Нажми на свою фигуру в опасности.',
      why: 'Соперник тоже строит планы. Замечая его нападения, ты успеешь защитить свою команду.',
      question: 'Что изменилось после последнего хода?',
      takeaway: 'После каждого хода соперника проверь: есть ли шах, взятие или новая угроза?', image: 'assets/pieces/bN.png' },
    { id: 'rescue', title: 'Спаси фигуру', goal: 'Заметь нападение и спаси свою фигуру.',
      rule: 'Найди, кто нападает. Уйди, закройся или забери обидчика.',
      why: 'Каждая фигура — помощник. Сохрани её, чтобы она могла защищать друзей и нападать.',
      question: 'Можно уйти, защитить фигуру или убрать нападающего?',
      takeaway: 'Спасти — не всегда убежать. Иногда помогает защита, перекрытие или взятие нападающего.', image: 'assets/pieces/wN.png' },
    { id: 'capture', title: 'Бери без потерь', goal: 'Забери фигуру без ответного взятия.',
      rule: 'В этой игре ищем взятие, после которого нашу фигуру не заберут.',
      why: 'Не всякий подарок безопасен. Прежде чем взять фигуру, представь ответ соперника.',
      question: 'Кто сможет забрать мою фигуру после взятия?',
      takeaway: 'Проверяй ответ на своё взятие. В обычной партии выгодный размен тоже бывает хорошим ходом.', image: 'assets/pieces/wR.png' },
    { id: 'strategy', title: 'Стратегические миссии', goal: 'На полной доске найди ход с понятной целью.',
      rule: 'Сначала назови цель хода, потом проверь ответ соперника.',
      why: 'В настоящей партии фигур много. Шахматист не ищет красивый ход вслепую — он сначала понимает, чего хочет добиться.',
      question: 'Что изменится после твоего хода?',
      takeaway: 'Хороший ход не случайный: он создаёт угрозу, помогает королю или улучшает работу команды.', image: 'assets/pieces/wQ.png' },
    { id: 'traps', title: 'Лаборатория ловушек', goal: 'Заметь приманку и проверь ответ соперника.',
      rule: 'Ловушка сработает, только если соперник ошибётся. Проверяй его ответ.',
      why: 'Заманчивая фигура может быть приманкой. Научись считать несколько ходов и замечать опасность.',
      question: 'Что будет, если соперник не возьмёт приманку?',
      takeaway: 'Соперник может разгадать ловушку. Тогда продолжай развивать фигуры и защищать короля.', image: 'assets/pieces/wQ.png' }
  ];
  const EXAMPLES = {
    rescue: [
      // 6 белых и 10 чёрных: на каждую цель смотрят сразу несколько фигур.
      ['r1b1r1k1/pp1n1p2/3p1n2/8/4P3/7N/R7/2BQ2K1 w - - 0 1', 'e4'],
      ['k2r1q1r/ppn5/4p1b1/5n2/3N4/3P4/8/R1BQ2K1 w - - 0 1', 'd4'],
      ['r4rk1/pppq4/1n1p4/4n3/2R5/6N1/4P3/2BQ2K1 w - - 0 1', 'c4'],
      ['r2qr1k1/pbn4p/3p1n2/8/4Q3/6N1/R6P/2B2K2 w - - 0 1', 'e4']
    ],
    capture: [
      ['k7/8/2p5/1n6/8/7K/8/1R3n2 w - - 0 1', ''],
      ['rnbqkbnr/pppp1ppp/8/4p3/3P4/2N5/PPP1PPPP/R1BQKBNR w KQkq - 0 1', ''],
      ['7k/8/p7/1p3r2/3N4/8/7P/7K w - - 0 1', ''],
      // Полная доска: безопасное взятие нужно заметить среди обычных фигур.
      ['rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 1', ''],
      ['rnbqkbnr/pppp1ppp/8/4p3/3P4/2N5/PPP1PPPP/R1BQKBNR w KQkq - 0 1', ''],
      ['rnbqkbnr/pppp1ppp/8/4p3/3P4/3N4/PPP1PPPP/R1BQKBNR w KQkq - 0 1', '']
    ],
    strategy: [
      { lessonTitle: 'Две цели одним прыжком', goal: 'Поставь вилку: напади на короля и ладью.',
        rule: 'Найди ход, который создаёт сразу две угрозы.', why: 'Один сильный ход может заставить соперника спасать короля и одновременно оставить фигуру без защиты.',
        question: 'На какие две цели нападёт твой конь?', takeaway: 'Вилка — это две угрозы одним ходом.', fen: 'r1bqkbnr/pppppppp/8/3Nn3/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', solutions: ['Nxc7+'], explanation: 'Конь с d5 на c7 напал на короля e8 и ладью a8.' },
      { lessonTitle: 'Шах с планом', goal: 'Атакуй короля и не потеряй слона.',
        rule: 'Поставь шах ходом, который выводит твою фигуру в атаку.', why: 'Шах полезен, когда он помогает атаке, а не просто заставляет короля сделать один шаг.',
        question: 'Какая фигура может ворваться к королю с шахом?', takeaway: 'Перед шахом проверь, сможет ли твоя фигура остаться в безопасности.', fen: 'rnbqkbnr/pppppppp/8/8/2B5/8/PPPPPPPP/RNBQK1NR w KQkq - 0 1', solutions: ['Bxf7+'], explanation: 'Слон с c4 на f7 даёт шах и начинает атаку на короля.' },
      { lessonTitle: 'Король в крепости', goal: 'Сделай рокировку и спрячь короля.',
        rule: 'Закончи развитие короткой рокировкой.', why: 'Король в центре легко попадает под шахи. Рокировка прячет его и соединяет ладью с игрой.',
        question: 'Все ли клетки между королём и ладьёй свободны?', takeaway: 'Безопасный король помогает думать о плане, а не только спасаться от шахов.', fen: 'rnbqk2r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1', solutions: ['O-O'], explanation: 'Рокировка переводит короля в безопасное место и выводит ладью.' },
      { lessonTitle: 'Открой дорогу слону', goal: 'Займи центр и освободи диагональ для слона.',
        rule: 'Сделай ход пешкой так, чтобы центр помогал всей команде.', why: 'Пешка в центре занимает место и открывает дорогу слонам и ферзю.',
        question: 'Какая центральная пешка может открыть сразу несколько дорог?', takeaway: 'Центральная пешка — не только боец: её ход выпускает фигуры.', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', solutions: ['d4'], explanation: 'Пешка с d2 на d4 занимает центр и открывает слону c1 диагональ.' },
      { lessonTitle: 'Взятие без подарка', goal: 'Забери пешку и проверь, что твою пешку не съедят в ответ.',
        rule: 'Сначала посмотри на ответ соперника, потом бери.', why: 'В настоящей партии фигура может выглядеть подарком, но за ней часто стоит ответное взятие.',
        question: 'Кто сможет забрать твою пешку после взятия?', takeaway: 'Безопасное взятие — это взятие после проверки ответа соперника.', fen: 'rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 1', solutions: ['dxe5'], explanation: 'Пешка с d4 забирает e5, а чёрные не могут сразу забрать её обратно.' }
    ]
  };

  function forTurn(game, color) {
    const fields = game.fen().split(' ');
    if (fields[1] !== color) fields[3] = '-';
    fields[1] = color;
    return new Chess(fields.join(' '));
  }

  function victimSquare(move) {
    return move.flags.includes('e') ? move.to[0] + move.from[1] : move.to;
  }

  function capturesOf(game, square, byColor) {
    const g = forTurn(game, byColor);
    return g.moves({ verbose: true }).filter((m) => m.captured && victimSquare(m) === square);
  }

  function threatText(game, square) {
    const count = capturesOf(game, square, 'b').length;
    return count > 1
      ? 'На фигуру нападают несколько чёрных фигур. Проверь все нападения: можно уйти, защититься или взять нападающего.'
      : 'Фигура ещё в опасности. Найди, кто может её забрать.';
  }

  // A direct material loss, accounting for a legal immediate recapture and pins.
  // This is deliberately not a tactical engine or a judgement of every sacrifice.
  function threat(game, square) {
    const piece = game.get(square);
    if (!piece || piece.type === 'k') return null;
    const enemy = piece.color === 'w' ? 'b' : 'w';
    let best = null;
    let bestGain = 0;
    for (const move of capturesOf(game, square, enemy)) {
      const g = forTurn(game, enemy);
      g.move(move);
      const recapture = g.moves({ verbose: true }).some((m) => m.captured && m.to === move.to);
      const gain = VALUE[piece.type] - (recapture ? VALUE[move.promotion || move.piece] : 0);
      if (gain > bestGain) { best = move; bestGain = gain; }
    }
    return best;
  }

  function createTask(id, round) {
    const mode = MODES.find((m) => m.id === id);
    if (!mode) return null;
    const example = EXAMPLES[id];
    const n = Math.max(0, Math.floor(round || 0));
    if (id === 'traps') return Object.assign({}, mode, window.PracticeTraps.createTask(n), { id, kind: 'opening' });
    if (id === 'strategy') {
      const item = EXAMPLES.strategy[n % EXAMPLES.strategy.length];
      return Object.assign({}, mode, item, { id, kind: 'drill', total: EXAMPLES.strategy.length });
    }
    if (id === 'watch') {
      const scenarios = [
        ['e4', 'e5', 'Bc4', 'b5'],
        ['d4', 'Nf6', 'Bf4', 'd6', 'e3', 'e5'],
        ['d4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'Ne4']
      ];
      const game = new Chess(), moves = scenarios[n % scenarios.length];
      moves.slice(0, -1).forEach((move) => game.move(move));
      const beforeFen = game.fen(), lastMove = game.move(moves[moves.length - 1]);
      return Object.assign({}, mode, { kind: 'drill', beforeFen, lastMove, fen: game.fen(), focus: '' });
    }
    let fen = example ? example[n % example.length][0] : new Chess().fen();
    let focus = example ? example[n % example.length][1] : '';
    if (example && Math.floor(n / example.length) % 2) {
      const original = new Chess(fen);
      const mirrored = new Chess();
      const mirror = (square) => 'hgfedcba'['abcdefgh'.indexOf(square[0])] + square[1];
      mirrored.clear();
      for (const square of original.SQUARES) {
        const piece = original.get(square);
        if (piece) mirrored.put(piece, mirror(square));
      }
      fen = mirrored.fen();
      if (focus) focus = mirror(focus);
    }
    return Object.assign({}, mode, {
      kind: id === 'center' || id === 'development' ? 'opening' : 'drill',
      replyStyle: n % 2 ? 'distance' : 'classical',
      fen, focus
    });
  }

  function judge(task, beforeFen, after, move) {
    if (!move || move.color !== 'w') return { ok: false, text: 'Сначала твой ход.', consequence: null };
    if (task.id === 'strategy') {
      if (task.solutions.includes(move.san)) return { ok: true, text: 'Цель выполнена!', explanation: task.explanation, consequence: null };
      return { ok: false, text: 'Ход законный, но он пока не помогает главной цели.', consequence: null };
    }
    if (task.id === 'rescue' || task.id === 'watch') {
      const focus = move.from === task.focus ? move.to : task.focus;
      const danger = threat(after, focus);
      if (after.get(focus) && !danger && !after.in_stalemate()) {
        const before = new Chess(beforeFen);
        const exposed = after.SQUARES.find((square) => {
          const piece = after.get(square);
          if (square === focus || !piece || piece.color !== 'w' || piece.type === 'k') return false;
          const oldSquare = square === move.to ? move.from : square;
          return threat(after, square) && !threat(before, oldSquare);
        });
        if (exposed) return { ok: false,
          text: 'Эту фигуру спасли, но теперь другой помощник под ударом. Попробуй сохранить обоих.',
          consequence: threat(after, exposed) };
        const action = move.from === task.focus ? 'Ты увёл фигуру из-под удара.'
          : move.captured ? 'Ты убрал нападающего или изменил защиту.' : 'Ты помог фигуре другим ходом: закрыл нападение или добавил защиту.';
        return { ok: true, text: 'Спасли! Теперь эту фигуру не забрать без потерь.', explanation: action + ' На своём следующем ходу снова проверь угрозы.', consequence: null };
      }
      return { ok: false, text: danger
        ? threatText(after, focus)
        : 'Попробуем спасти фигуру и продолжить игру.', consequence: danger };
    }
    if (task.id === 'capture') {
      const replies = capturesOf(after, move.to, 'b');
      if (move.captured && !replies.length && !after.in_stalemate()) {
        return { ok: true, text: 'Забрали! А нашу фигуру в ответ не съесть.', explanation: 'Ты проверил ответ соперника: сразу забрать твою фигуру он не может.', consequence: null };
      }
      return { ok: false, text: move.captured
        ? 'Забрали фигуру, но нашу тоже могут съесть. Найди обидчика.'
        : 'Поищи взятие. Кого можно забрать без ответного взятия?', consequence: replies[0] || null };
    }
    return { ok: false, text: task.rule, consequence: null };
  }

  function solutions(task, game) {
    if (game.turn() !== 'w') return [];
    const fen = game.fen();
    return game.moves({ verbose: true }).filter((m) => {
      const after = new Chess(fen);
      after.move(m);
      return judge(task, fen, after, m).ok;
    });
  }

  // Geometric attacks include friendly occupied squares (they are defended),
  // unlike legal move lists. Sliding pieces must have a clear line of sight.
  function attacks(game, from, to) {
    if (from === to) return false;
    const piece = game.get(from);
    if (!piece) return false;
    const dx = to.charCodeAt(0) - from.charCodeAt(0), dy = +to[1] - +from[1];
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (piece.type === 'p') return ax === 1 && dy === (piece.color === 'w' ? 1 : -1);
    if (piece.type === 'n') return ax * ay === 2;
    if (piece.type === 'k') return Math.max(ax, ay) === 1;
    const diagonal = ax === ay, straight = dx === 0 || dy === 0;
    if (!(piece.type === 'q' && (diagonal || straight)
      || piece.type === 'b' && diagonal || piece.type === 'r' && straight)) return false;
    for (let step = 1; step < Math.max(ax, ay); step++) {
      const square = String.fromCharCode(from.charCodeAt(0) + Math.sign(dx) * step)
        + (+from[1] + Math.sign(dy) * step);
      if (game.get(square)) return false;
    }
    return true;
  }

  function openingStatus(game, task) {
    if (task && task.id === 'traps') return window.PracticeTraps.status(game, task);
    const pieces = { p: [], n: [], b: [] };
    const active = [];
    for (const square of game.SQUARES) {
      const p = game.get(square);
      if (p && p.color === 'w' && p.type !== 'k' && !threat(game, square)) {
        active.push(square);
        if (pieces[p.type]) pieces[p.type].push(square);
      }
    }
    const controlled = CENTER.filter((target) => active.some((from) => attacks(game, from, target)));
    const development = task && task.id === 'development';
    const castled = game.history({ verbose: true }).some((move) => move.color === 'w' && /[kq]/.test(move.flags));
    const goals = [
      ...(development ? [] : [{ id: 'center', label: 'Центр: ' + Math.min(2, controlled.length) + ' из 2 клеток', done: controlled.length >= 2 }]),
      { id: 'knight', label: 'Конь выведен', done: pieces.n.some((s) => +s[1] >= 3 && 'cdef'.includes(s[0])) },
      { id: 'bishop', label: 'Слон выведен', done: pieces.b.some((s) => +s[1] >= 2) },
      ...(development ? [{ id: 'castle', label: 'Рокировка', done: castled }] : [])
    ];
    const missing = goals.find((g) => !g.done);
    const castlingReady = game.turn() === 'w' && game.moves({ verbose: true }).some((move) => /[kq]/.test(move.flags));
    return { goals, controlled, done: !missing && !game.in_check() && !game.game_over(),
      text: missing ? ({
        center: 'Держи две центральные клетки под прицелом. Пешка смотрит по диагонали, а конь может помочь издалека.',
        knight: 'Выведи коня ближе к середине: там у него больше дорог для помощи команде.',
        bishop: 'Освободи диагональ и выведи слона. Из дома он пока мало помогает.',
        castle: castlingReady ? 'Дорога открыта! Сделай рокировку: король идёт на две клетки к ладье.'
          : 'Подготовь рокировку: освободи клетки между королём и ладьёй. Король не должен проходить через шах.'
      })[missing.id] : development
        ? 'Помощники в игре, король за пешками! Теперь легче играть всей командой.'
        : 'Ты контролируешь центр, а конь и слон помогают команде. Центр можно держать и издалека!' };
  }

  function openingHint(game, task) {
    if (task && task.id === 'traps') return window.PracticeTraps.hint(game, task);
    if (game.turn() !== 'w') return null;
    const status = openingStatus(game, task);
    const old = status.goals.filter((g) => g.done).length;
    const moves = game.moves({ verbose: true });
    const ranked = moves.map((move) => {
      const after = new Chess(game.fen());
      after.move(move);
      // Preserve history for the castling objective when evaluating a candidate.
      const next = openingStatus(after, task);
      if (/[kq]/.test(move.flags)) next.goals.filter((goal) => goal.id === 'castle').forEach((goal) => { goal.done = true; });
      if (status.goals.some((goal) => goal.id === 'castle' && goal.done)) next.goals.filter((goal) => goal.id === 'castle').forEach((goal) => { goal.done = true; });
      const score = (next.goals.filter((g) => g.done).length - old) * 50
        + Math.min(2, next.controlled.length) * 3
        + (task && task.id === 'development' ?
          (['f1', 'g1'].filter((square) => !after.get(square)).length
            - ['f1', 'g1'].filter((square) => !game.get(square)).length) * 15
          + (move.from === 'e2' && ['e3', 'e4'].includes(move.to) ? 12 : 0) : 0)
        + (move.piece === 'p' && ['e3', 'e4', 'd3', 'd4', 'g3'].includes(move.to) ? 4 : 0)
        + (move.piece === 'n' && ['b1', 'g1'].includes(move.from) ? 2 : 0)
        - (threat(after, move.to) ? 200 : 0) + (move.captured ? VALUE[move.captured] : 0)
        - (move.piece === 'k' && !/[kq]/.test(move.flags) ? 30 : 0);
      return { move, score };
    }).sort((a, b) => b.score - a.score);
    return ranked.length ? ranked[0].move : null;
  }

  function reply(game, task) {
    if (task && task.id === 'traps') return window.PracticeTraps.reply(game, task);
    if (game.turn() !== 'b' || game.game_over()) return null;
    const preferred = task && task.replyStyle === 'distance'
      ? ['g6', 'Bg7', 'Nf6', 'd6', 'O-O', 'c5', 'Nc6', 'e5', 'd5']
      : ['e5', 'd5', 'Nc6', 'Nf6', 'Bc5', 'Bf5', 'Be7', 'e6', 'd6', 'O-O'];
    const moves = game.moves({ verbose: true });
    const ranked = moves.map((move) => {
      const after = new Chess(game.fen());
      after.move(move);
      const i = preferred.indexOf(move.san.replace(/[+#]/g, ''));
      const score = (i >= 0 ? 30 - i : 0) + (move.captured ? VALUE[move.captured] * 12 : 0)
        - (threat(after, move.to) ? VALUE[move.promotion || move.piece] * 15 : 0);
      return { move, score };
    }).sort((a, b) => b.score - a.score);
    return ranked.length ? ranked[0].move : null;
  }

  function threatened(game) {
    return game.SQUARES.filter((square) => {
      const piece = game.get(square);
      return piece && piece.color === 'w' && piece.type !== 'k' && threat(game, square);
    });
  }

  return { MODES, createTask, judge, solutions, openingStatus, openingHint, reply, threat, attacks, threatened,
    pieceName: (type) => NAMES[type] || 'фигура' };
})();
