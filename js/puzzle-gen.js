// Генератор задачек: каждый раз новая случайная позиция, поэтому их нельзя запомнить.
// Каждая позиция проверяется chess.js: она легальна и у неё есть решение.
//
// Задачка — объект:
//   { goal, fen, target?, targets?, piece?, moves? }
//   goal: 'capture' — съесть фигуру на target
//         'check'   — шах фигурой piece (или любой, если piece не задан)
//         'check2'  — шах фигурой piece за 2 своих хода (чёрные отвечают)
//         'fork'    — одним ходом напасть сразу на все targets
//         'mate'    — мат в 1 ход
//   moves — вместо fen: ходы от начальной позиции (для дебютных ловушек)
window.PuzzleGen = (function () {
  const FILES = 'abcdefgh';
  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rnd(arr.length)];
  const sq = (x, y) => FILES[x] + (y + 1);
  const xy = (s) => [FILES.indexOf(s[0]), +s[1] - 1];
  const onBoard = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;
  const dist = (a, b) => {
    const [ax, ay] = xy(a), [bx, by] = xy(b);
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
  };
  const ALL = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) ALL.push(sq(x, y));

  const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

  // ---------- Позиция ----------

  // placement: { e1: 'wK', e8: 'bK', a1: 'wR' } → FEN
  function toFen(pl, turn) {
    const rows = [];
    for (let y = 7; y >= 0; y--) {
      let row = '', empty = 0;
      for (let x = 0; x < 8; x++) {
        const p = pl[sq(x, y)];
        if (!p) { empty++; continue; }
        if (empty) { row += empty; empty = 0; }
        row += p[0] === 'w' ? p[1].toUpperCase() : p[1].toLowerCase();
      }
      if (empty) row += empty;
      rows.push(row);
    }
    return rows.join('/') + ' ' + turn + ' - - 0 1';
  }

  function freeSquares(pl, filter) {
    return ALL.filter((s) => !pl[s] && (!filter || filter(s)));
  }

  function place(pl, code, filter) {
    const options = freeSquares(pl, filter);
    if (!options.length) return null;
    const s = pick(options);
    pl[s] = code;
    return s;
  }

  const notEdgeRanks = (s) => s[1] !== '1' && s[1] !== '8';

  // Проверка правил: короли не рядом, пешки не на крайних линиях,
  // тот, кто не ходит, не под шахом; ходящий тоже не под шахом (так проще детям).
  // allowCheck — ходящему можно стоять под шахом (задания «спаси короля»).
  function makeGame(pl, turn, allowCheck) {
    let wk, bk;
    for (const s in pl) {
      if (pl[s] === 'wK') wk = s;
      if (pl[s] === 'bK') bk = s;
      if (pl[s][1] === 'P' && !notEdgeRanks(s)) return null;
    }
    if (!wk || !bk || dist(wk, bk) < 2) return null;
    const other = new Chess();
    if (!other.load(toFen(pl, turn === 'w' ? 'b' : 'w')) || other.in_check()) return null;
    const g = new Chess();
    if (!g.load(toFen(pl, turn)) || (g.in_check() && !allowCheck)) return null;
    if (g.in_checkmate() || g.in_stalemate()) return null;
    return g;
  }

  // ---------- Цели ----------

  // Бьёт ли фигура с клетки from клетку to (с учётом загораживающих фигур).
  function attacks(g, from, to) {
    const p = g.get(from);
    if (!p || from === to) return false;
    const [fx, fy] = xy(from), [tx, ty] = xy(to);
    const dx = tx - fx, dy = ty - fy;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (p.type === 'n') return ax * ay === 2;
    if (p.type === 'k') return Math.max(ax, ay) === 1;
    if (p.type === 'p') return ax === 1 && dy === (p.color === 'w' ? 1 : -1);
    const straight = dx === 0 || dy === 0;
    const diagonal = ax === ay;
    if (p.type === 'r' && !straight) return false;
    if (p.type === 'b' && !diagonal) return false;
    if (p.type === 'q' && !straight && !diagonal) return false;
    const sx = Math.sign(dx), sy = Math.sign(dy);
    for (let x = fx + sx, y = fy + sy; x !== tx || y !== ty; x += sx, y += sy) {
      if (g.get(sq(x, y))) return false;
    }
    return true;
  }

  // Достигнута ли цель ходом move (ход уже сделан в game).
  function isSolved(puzzle, game, move) {
    switch (puzzle.goal) {
      case 'capture': return move.to === puzzle.target && !!move.captured;
      case 'check':
      case 'check2': return game.in_check() && (!puzzle.piece || move.piece === puzzle.piece);
      case 'fork': return puzzle.targets.every((t) => attacks(game, move.to, t));
      case 'mate': return game.in_checkmate();
    }
    return false;
  }

  // Все ходы, решающие задачку в 1 ход.
  function solutions(puzzle, game) {
    const out = [];
    for (const m of game.moves({ verbose: true })) {
      // быстрый отсев: для шаха и мата chess.js уже пометил ход знаком + или #
      if ((puzzle.goal === 'mate') && !m.san.endsWith('#')) continue;
      if ((puzzle.goal === 'check' || puzzle.goal === 'check2') && !/[+#]$/.test(m.san)) continue;
      game.move(m);
      if (isSolved(puzzle, game, m)) out.push(m);
      game.undo();
    }
    return out;
  }

  // Ответ чёрных в «шах за 2 хода»: спокойный ход пешкой, иначе любой ход не королём, иначе королём.
  function blackReply(game) {
    const moves = game.moves({ verbose: true }).filter((m) => !/[+#]$/.test(m.san));
    return moves.find((m) => m.piece === 'p' && !m.captured) ||
      moves.find((m) => m.piece !== 'k' && !m.captured) ||
      moves.find((m) => !m.captured) || moves[0] || null;
  }

  // Первые ходы, после которых (и ответа чёрных) можно поставить шах фигурой piece.
  function check2Plans(puzzle, game) {
    const plans = [];
    for (const m of game.moves({ verbose: true })) {
      if (m.piece !== puzzle.piece || /[+#]$/.test(m.san)) continue;
      game.move(m);
      const reply = blackReply(game);
      if (reply) {
        game.move(reply);
        if (solutions(puzzle, game).length) plans.push(m);
        game.undo();
      }
      game.undo();
    }
    return plans;
  }

  // ---------- Генераторы ----------

  const TRIES = 400;

  function tryMake(build) {
    for (let i = 0; i < TRIES; i++) {
      const p = build();
      if (p) return p;
    }
    return null;
  }

  function finish(puzzle, pl, turn) {
    const g = makeGame(pl, turn);
    if (!g) return null;
    puzzle.fen = g.fen();
    return { puzzle, game: g };
  }

  // «Съешь!»: одна белая фигура, цель в рамке. С уровнем — больше типов фигур и лишние чёрные фигуры.
  function capture(level) {
    return tryMake(() => {
      const pl = {};
      const types = level < 4 ? ['r', 'b', 'q', 'n'] : ['r', 'b', 'q', 'n', 'p', 'p', 'k'];
      const T = pick(types);
      const target = place(pl, 'b' + pick(['P', 'N', 'B', 'R', 'Q']), notEdgeRanks);
      if (T === 'k') {
        place(pl, 'wK', (s) => dist(s, target) === 1);
      } else {
        place(pl, 'w' + T.toUpperCase(), T === 'p' ? notEdgeRanks : null);
        place(pl, 'wK');
      }
      place(pl, 'bK');
      const decoys = level < 6 ? 0 : level < 12 ? 1 : 2;
      for (let i = 0; i < decoys; i++) place(pl, 'b' + pick(['P', 'N', 'B']), notEdgeRanks);

      const puzzle = { goal: 'capture', target };
      const r = finish(puzzle, pl, 'w');
      if (!r) return null;
      const sols = solutions(puzzle, r.game);
      if (!sols.length || sols.some((m) => m.piece !== T)) return null;
      return puzzle;
    });
  }

  // «Кто съест?»: 2–3 белые фигуры, съесть цель может только одна.
  function whoCaptures(level) {
    return tryMake(() => {
      const pl = {};
      const count = level < 6 ? 2 : 3;
      const types = ['R', 'B', 'Q', 'N', 'P'].sort(() => Math.random() - 0.5).slice(0, count);
      const target = place(pl, 'b' + pick(['P', 'N', 'B', 'R', 'Q']), notEdgeRanks);
      types.forEach((t) => place(pl, 'w' + t, t === 'P' ? notEdgeRanks : null));
      place(pl, 'wK', (s) => dist(s, target) > 1);
      place(pl, 'bK');
      if (level >= 8) place(pl, 'bP', notEdgeRanks);

      const puzzle = { goal: 'capture', target };
      const r = finish(puzzle, pl, 'w');
      if (!r) return null;
      const sols = solutions(puzzle, r.game);
      if (!sols.length || new Set(sols.map((m) => m.from)).size !== 1) return null;
      return puzzle;
    });
  }

  // «Шах!»: шах указанной фигурой в 1 ход.
  function check(level, piece) {
    return tryMake(() => {
      const pl = {};
      const T = piece || pick(['r', 'b', 'q', 'n', 'p']);
      const bk = place(pl, 'bK', T === 'p' ? (s) => +s[1] >= 3 : null);
      if (T === 'p') {
        // пешке нужна клетка по диагонали перед королём
        const [kx, ky] = xy(bk);
        const dx = pick([-1, 1]);
        const s = [kx + dx, ky - 1];
        const steps = pick([1, 2]);
        const from = [s[0], s[1] - steps];
        if (!onBoard(...from) || from[1] < 1 || (steps === 2 && from[1] !== 1)) return null;
        pl[sq(...from)] = 'wP';
      } else {
        place(pl, 'w' + T.toUpperCase());
      }
      place(pl, 'wK');
      const pawns = 1 + (level >= 6 ? 2 : 0);
      for (let i = 0; i < pawns; i++) place(pl, 'bP', notEdgeRanks);

      const puzzle = { goal: 'check', piece: T };
      const r = finish(puzzle, pl, 'w');
      if (!r) return null;
      const sols = solutions(puzzle, r.game);
      if (!sols.length) return null;
      return puzzle;
    });
  }

  // «Шах за 2 хода»: фигура не может дать шах сразу, но может за 2 хода.
  function check2(level, piece) {
    return tryMake(() => {
      const pl = {};
      const T = piece || pick(['r', 'b', 'q', 'n', 'n']);
      place(pl, 'bK');
      place(pl, 'w' + T.toUpperCase(), T === 'p' ? notEdgeRanks : null);
      place(pl, 'wK');
      // пешка чёрных «в стороне» — ей чёрные делают спокойный ответный ход
      place(pl, 'bP', (s) => s[1] === '7' && !pl[s[0] + '6'] && !pl[s[0] + '5']);
      if (level >= 6) place(pl, 'bP', notEdgeRanks);

      const puzzle = { goal: 'check2', piece: T };
      const r = finish(puzzle, pl, 'w');
      if (!r) return null;
      if (solutions(puzzle, r.game).length) return null; // шах в 1 ход — слишком просто
      if (!check2Plans(puzzle, r.game).length) return null;
      return puzzle;
    });
  }

  // «Вилка»: конь (а с уровнем и пешка) одним ходом нападает на две фигуры.
  function fork(level) {
    const usePawn = level >= 5 && Math.random() < 0.35;
    return tryMake(() => usePawn ? pawnFork() : knightFork(level));
  }

  function knightFork(level) {
    const pl = {};
    const s = pick(ALL);
    const [x, y] = xy(s);
    const around = KNIGHT.map(([dx, dy]) => [x + dx, y + dy]).filter((p) => onBoard(...p)).map((p) => sq(...p));
    if (around.length < 3) return null;
    const shuffled = around.sort(() => Math.random() - 0.5);
    const [kSq, tSq, nSq] = shuffled;
    // с королём (шах + нападение) или две ценные фигуры
    const withKing = level < 3 || Math.random() < 0.7;
    pl[kSq] = withKing ? 'bK' : 'b' + pick(['R', 'Q']);
    pl[tSq] = 'b' + pick(level < 3 ? ['Q', 'R'] : ['Q', 'R', 'R', 'B']);
    pl[nSq] = 'wN';
    if (!withKing) place(pl, 'bK');
    place(pl, 'wK');
    if (level >= 4) place(pl, 'bP', notEdgeRanks);

    const puzzle = { goal: 'fork', targets: [kSq, tSq] };
    const r = finish(puzzle, pl, 'w');
    if (!r) return null;
    const g = r.game;
    // конь не должен уже бить цели, иначе можно просто съесть
    if (attacks(g, nSq, tSq) || attacks(g, nSq, kSq)) return null;
    const sols = solutions(puzzle, g);
    if (!sols.length || sols.some((m) => m.piece !== 'n')) return null;
    return puzzle;
  }

  function pawnFork() {
    const pl = {};
    const x = 1 + rnd(6), y = 2 + rnd(4); // клетка вилки: не у края
    const s = sq(x, y);
    const t1 = sq(x - 1, y + 1), t2 = sq(x + 1, y + 1);
    pl[t1] = 'b' + pick(['N', 'B', 'R', 'Q']);
    pl[t2] = 'b' + pick(['N', 'B', 'R', 'Q']);
    const from = y === 3 && Math.random() < 0.5 ? sq(x, 1) : sq(x, y - 1);
    pl[from] = 'wP';
    place(pl, 'wK');
    place(pl, 'bK');

    const puzzle = { goal: 'fork', targets: [t1, t2] };
    const r = finish(puzzle, pl, 'w');
    if (!r || !solutions(puzzle, r.game).length) return null;
    return puzzle;
  }

  // «Мат в 1 ход»: шаблоны по уровню — ферзь, ладья, две ладьи, мат по последней линии.
  function mate(level) {
    const patterns = level < 3 ? ['Q'] : level < 6 ? ['Q', 'R'] : level < 10 ? ['Q', 'R', 'RR', 'back'] : ['Q', 'R', 'RR', 'back', 'QB', 'QN'];
    const pattern = pick(patterns);
    return tryMake(() => {
      const pl = {};
      const edge = (s) => s[0] === 'a' || s[0] === 'h' || s[1] === '1' || s[1] === '8';
      let bk;
      if (pattern === 'back') {
        const x = 1 + rnd(6);
        bk = sq(x, 7);
        pl[bk] = 'bK';
        // пешки перед королём, иногда одна сдвинута
        for (const dx of [-1, 0, 1]) {
          if (onBoard(x + dx, 6)) pl[sq(x + dx, Math.random() < 0.2 ? 5 : 6)] = 'bP';
        }
        place(pl, 'w' + pick(['R', 'Q', 'R']), (s) => +s[1] <= 4);
        place(pl, 'wK', (s) => +s[1] <= 2);
      } else {
        bk = place(pl, 'bK', (s) => edge(s) && s[1] !== '1');
        place(pl, 'wK', (s) => dist(s, bk) === 2);
        const pieces = { Q: ['Q'], R: ['R'], RR: ['R', 'R'], QB: ['Q', 'B'], QN: ['Q', 'N'] }[pattern];
        pieces.forEach((p) => place(pl, 'w' + p, (s) => dist(s, bk) >= 2));
      }

      const puzzle = { goal: 'mate' };
      const r = finish(puzzle, pl, 'w');
      if (!r) return null;
      const sols = solutions(puzzle, r.game);
      if (!sols.length || sols.length > 3) return null; // не слишком много решений — иначе неинтересно
      return puzzle;
    });
  }

  // Зеркальная копия позиции (a↔h) — классические задачки выглядят по-новому.
  function mirror(fen) {
    const parts = fen.split(' ');
    if (parts[2] !== '-') return fen; // с рокировкой не зеркалим
    parts[0] = parts[0].split('/').map((row) => {
      const cells = row.replace(/\d/g, (d) => '.'.repeat(+d)).split('').reverse().join('');
      return cells.replace(/\.+/g, (m) => m.length);
    }).join('/');
    parts[3] = '-';
    return parts.join(' ');
  }

  function mirrorSquare(s) { return FILES[7 - FILES.indexOf(s[0])] + s[1]; }

  // Готовая задачка из списка: позиция из fen или из ходов, иногда зеркально.
  function fromCurated(p) {
    const puzzle = Object.assign({}, p);
    if (p.moves) {
      const g = new Chess();
      p.moves.split(' ').forEach((m) => g.move(m));
      puzzle.fen = g.fen();
    } else if (Math.random() < 0.5 && p.fen.split(' ')[2] === '-') {
      puzzle.fen = mirror(p.fen);
      if (p.target) puzzle.target = mirrorSquare(p.target);
      if (p.targets) puzzle.targets = p.targets.map(mirrorSquare);
    }
    return puzzle;
  }

  return {
    capture, whoCaptures, check, check2, fork, mate,
    fromCurated, isSolved, solutions, check2Plans, blackReply, attacks, mirror,
    // общие помощники для других генераторов (js/train-gen.js)
    util: { toFen, makeGame, place, freeSquares, ALL, dist, xy, sq, onBoard, pick, rnd, notEdgeRanks }
  };
})();
