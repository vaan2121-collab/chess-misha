// Генераторы и «судья» для «Тренировки». Каждая позиция строится под идею уровня
// и проверяется по правилам. Ход ребёнка оценивается ПО СМЫСЛУ: засчитывается любой ход,
// который решает задачу, а ошибка распознаётся по типу — для объясняющей фразы Тренера.
//
// Задача: { kind, fen, ... }
//   free        1.1 съешь фигуру, которую никто не охраняет
//   save        1.2 спаси свою фигуру из-под удара (victim — где она стоит)
//   trade       1.3 выгодный обмен: отдай маленькую фигуру за большую
//   eatChecker  5.1 шах — съешь обидчика (checker — где он стоит)
//   block       5.2 шах — закройся фигурой-щитом
//   escape      5.3 шах — уведи короля
//   szu         испытание острова 5 — спасись от шаха любым способом
window.TrainGen = (function () {
  const U = PuzzleGen.util;
  const attacks = PuzzleGen.attacks;
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  const TRIES = 500;
  const other = (c) => (c === 'w' ? 'b' : 'w');

  // ---------- Кто кого бьёт ----------
  function piecesOf(g, color) {
    const out = [];
    for (const s of U.ALL) { const p = g.get(s); if (p && p.color === color) out.push(s); }
    return out;
  }

  // Клетки фигур цвета color, которые бьют клетку square.
  function attackersOf(g, square, color) {
    return piecesOf(g, color).filter((s) => s !== square && attacks(g, s, square));
  }

  // Фигуру на клетке можно съесть с выгодой: она без защиты или её бьёт фигура дешевле.
  function hanging(g, square) {
    const p = g.get(square);
    if (!p || p.type === 'k') return false;
    const att = attackersOf(g, square, other(p.color));
    if (!att.length) return false;
    const def = attackersOf(g, square, p.color);
    if (!def.length) return true;
    return Math.min(...att.map((s) => VAL[g.get(s).type])) < VAL[p.type];
  }

  const whiteHanging = (g) => piecesOf(g, 'w').some((s) => hanging(g, s));
  const isDefended = (g, square) => {
    const p = g.get(square);
    return !!p && attackersOf(g, square, p.color).length > 0;
  };

  // ---------- Судья ----------
  // before — позиция до хода (chess.js), after — после. Возвращает { ok, oops, method }.
  function judge(task, before, after, move) {
    switch (task.kind) {
      case 'free': {
        if (!move.captured) return { ok: false, oops: 'oops_nothing' };
        if (isDefended(before, move.to)) return { ok: false, oops: 'oops_defended' };
        return { ok: true };
      }
      case 'save': {
        if (!whiteHanging(after)) return { ok: true };
        if (move.from !== task.victim && hanging(after, task.victim)) return { ok: false, oops: 'oops_other' };
        return { ok: false, oops: 'oops_still' };
      }
      case 'trade': {
        if (move.captured && VAL[move.captured] >= VAL[move.piece] + 2) return { ok: true };
        if (move.captured && VAL[move.captured] < VAL[move.piece] && isDefended(before, move.to)) return { ok: false, oops: 'oops_bad_trade' };
        return { ok: false, oops: null };
      }
      case 'eatChecker': {
        if (move.to === task.checker && move.captured) return { ok: true, method: 'ate' };
        return { ok: false, oops: move.piece === 'k' ? 'oops_ran' : 'oops_blocked' };
      }
      case 'block': {
        if (move.piece === 'k') return { ok: false, oops: 'oops_ran' };
        if (hanging(after, move.to)) return { ok: false, oops: 'oops_unsafe_shield' };
        return { ok: true, method: 'blocked' };
      }
      case 'escape':
        return { ok: true, method: 'ran' }; // при таком шахе ходить может только король
      case 'szu':
        return { ok: true, method: move.captured ? 'ate' : move.piece === 'k' ? 'ran' : 'blocked' };
    }
    return { ok: false, oops: null };
  }

  // Все ходы, которые решают задачу (для подсказок и проверки генерации).
  function solutions(task, game) {
    const out = [];
    for (const m of game.moves({ verbose: true })) {
      game.move(m);
      const after = new Chess(game.fen());
      game.undo();
      if (judge(task, game, after, m).ok) out.push(m);
    }
    return out;
  }

  // Есть ли среди ходов «ловушка» — ход, который выглядит похоже, но ошибочен.
  function hasTrap(task, game) {
    for (const m of game.moves({ verbose: true })) {
      game.move(m);
      const after = new Chess(game.fen());
      game.undo();
      const r = judge(task, game, after, m);
      if (!r.ok && r.oops) return true;
    }
    return false;
  }

  // ---------- Помощники для расстановки ----------
  // Клетки, с которых фигура code (например 'bR') била бы клетку target при текущей расстановке.
  function squaresAttacking(pl, code, target) {
    const out = [];
    for (const s of U.freeSquares(pl, code[1] === 'P' ? U.notEdgeRanks : null)) {
      const test = Object.assign({}, pl, { [s]: code });
      const g = new Chess();
      if (!g.load(U.toFen(test, 'w'))) continue;
      if (attacks(g, s, target)) out.push(s);
    }
    return out;
  }

  function tryMake(build) {
    for (let i = 0; i < TRIES; i++) {
      const t = build();
      if (t) return t;
    }
    return null;
  }

  function finish(task, pl, allowCheck) {
    const g = U.makeGame(pl, 'w', allowCheck);
    if (!g) return null;
    task.fen = g.fen();
    return { task, game: g };
  }

  const decoys = (pl, n, codes) => { for (let i = 0; i < n; i++) U.place(pl, U.pick(codes), U.notEdgeRanks); };

  // ---------- 1.1 Бесплатный обед ----------
  function free(level) {
    return tryMake(() => {
      const pl = {};
      const hunter = U.place(pl, 'w' + U.pick(level < 2 ? ['R', 'B', 'N'] : ['R', 'B', 'N', 'Q']));
      // жертвы — на клетках, которые бьёт охотник
      const g0 = new Chess(); g0.load(U.toFen(pl, 'w'));
      const reach = U.ALL.filter((s) => !pl[s] && attacks(g0, hunter, s) && U.notEdgeRanks(s));
      if (reach.length < 2) return null;
      const [freeSq, trapSq] = reach.sort(() => Math.random() - 0.5);
      pl[freeSq] = 'b' + U.pick(['N', 'B', 'R']);
      pl[trapSq] = 'b' + U.pick(['N', 'B', 'R', 'Q']);
      // защитник ловушки — чёрная пешка по диагонали «сверху»
      const [tx, ty] = U.xy(trapSq);
      const guards = [-1, 1].map((dx) => [tx + dx, ty + 1]).filter(([x, y]) => U.onBoard(x, y) && y < 7 && !pl[U.sq(x, y)]);
      if (!guards.length) return null;
      pl[U.sq(...U.pick(guards))] = 'bP';
      U.place(pl, 'wK');
      U.place(pl, 'bK');
      if (level >= 3) decoys(pl, 1, ['bP']);
      if (level >= 5) U.place(pl, 'w' + U.pick(['N', 'B']));

      const r = finish({ kind: 'free' }, pl);
      if (!r || whiteHanging(r.game)) return null;
      if (!solutions(r.task, r.game).length || !hasTrap(r.task, r.game)) return null;
      return r.task;
    });
  }

  // ---------- 1.2 Спаси рядового ----------
  function save(level) {
    return tryMake(() => {
      const pl = {};
      const victim = U.place(pl, 'w' + U.pick(['N', 'B', 'R', 'Q']));
      const vType = pl[victim][1].toLowerCase();
      const cheaper = ['P', 'N', 'B', 'R'].filter((t) => VAL[t.toLowerCase()] < VAL[vType]);
      const aCode = 'b' + U.pick(cheaper.length ? cheaper : ['N', 'B']);
      const from = squaresAttacking(pl, aCode, victim);
      if (!from.length) return null;
      pl[U.pick(from)] = aCode;
      U.place(pl, 'wK');
      U.place(pl, 'bK');
      decoys(pl, level < 3 ? 1 : 2, ['bN', 'bB', 'bP', 'bR']); // перекрывают клетки — побег не везде безопасен

      const r = finish({ kind: 'save', victim }, pl);
      if (!r || !hanging(r.game, victim)) return null;
      // кроме жертвы, никто не висит
      if (piecesOf(r.game, 'w').some((s) => s !== victim && hanging(r.game, s))) return null;
      if (!solutions(r.task, r.game).length || !hasTrap(r.task, r.game)) return null;
      return r.task;
    });
  }

  // ---------- 1.3 Выгодный обмен ----------
  function trade(level) {
    return tryMake(() => {
      const pl = {};
      const big = U.place(pl, 'b' + U.pick(['Q', 'R', 'Q']), U.notEdgeRanks);
      const [bx, by] = U.xy(big);
      // защитник большой фигуры — пешка
      const guards = [-1, 1].map((dx) => [bx + dx, by + 1]).filter(([x, y]) => U.onBoard(x, y) && y < 7 && !pl[U.sq(x, y)]);
      if (!guards.length) return null;
      pl[U.sq(...U.pick(guards))] = 'bP';
      // маленькая белая фигура, которая бьёт большую
      const cCode = 'w' + U.pick(['P', 'N', 'N', 'B']);
      const from = squaresAttacking(pl, cCode, big).filter((s) => cCode !== 'wP' || +s[1] >= 2);
      if (!from.length) return null;
      pl[U.pick(from)] = cCode;
      U.place(pl, 'wK');
      U.place(pl, 'bK');
      // приманка: можно съесть что-то дешёвое, но это невыгодно
      if (level >= 2) decoys(pl, 1, ['bP', 'bN']);
      if (level >= 4) U.place(pl, 'w' + U.pick(['R', 'Q']));

      const r = finish({ kind: 'trade' }, pl);
      if (!r) return null;
      if (!solutions(r.task, r.game).length) return null;
      return r.task;
    });
  }

  // ---------- Модуль 5: королю шах ----------
  // Ставим белого короля и чёрную фигуру, которая объявляет шах.
  function checkSetup(checkerTypes) {
    const pl = {};
    const wk = U.place(pl, 'wK');
    const code = 'b' + U.pick(checkerTypes);
    const from = squaresAttacking(pl, code, wk).filter((s) => U.dist(s, wk) >= (code === 'bN' ? 1 : 2));
    if (!from.length) return null;
    const checker = U.pick(from);
    pl[checker] = code;
    return { pl, wk, checker };
  }

  function legalSplit(game) {
    const moves = game.moves({ verbose: true });
    return {
      moves,
      kingMoves: moves.filter((m) => m.piece === 'k'),
      captures: moves.filter((m) => m.piece !== 'k' && m.captured),
      blocks: moves.filter((m) => m.piece !== 'k' && !m.captured)
    };
  }

  // 5.1 — обидчика может съесть белая фигура (не король)
  function eatChecker(level) {
    return tryMake(() => {
      const s = checkSetup(['R', 'B', 'Q', 'N']);
      if (!s) return null;
      const { pl, checker } = s;
      const hCode = 'w' + U.pick(['R', 'B', 'N', 'Q']);
      const hFrom = squaresAttacking(pl, hCode, checker);
      if (!hFrom.length) return null;
      pl[U.pick(hFrom)] = hCode;
      U.place(pl, 'bK');
      if (level >= 2) decoys(pl, 1, ['bP', 'bN']);
      const r = finish({ kind: 'eatChecker', checker }, pl, true);
      if (!r || !r.game.in_check()) return null;
      const L = legalSplit(r.game);
      if (!L.captures.some((m) => m.to === checker)) return null;
      if (!L.kingMoves.length && !L.blocks.length) return null; // нужна возможность ошибиться
      return r.task;
    });
  }

  // 5.2 — съесть нельзя, но можно закрыться фигурой, которую не съедят бесплатно
  function block(level) {
    return tryMake(() => {
      const s = checkSetup(['R', 'B', 'Q']);
      if (!s) return null;
      const { pl } = s;
      U.place(pl, 'w' + U.pick(['R', 'B', 'N']));
      if (level >= 2) U.place(pl, 'w' + U.pick(['N', 'B']));
      U.place(pl, 'bK');
      if (level >= 3) decoys(pl, 1, ['bP', 'bN']);
      const r = finish({ kind: 'block', checker: s.checker }, pl, true);
      if (!r || !r.game.in_check()) return null;
      const L = legalSplit(r.game);
      if (L.captures.length) return null; // съесть обидчика нельзя
      if (!solutions(r.task, r.game).length) return null;
      return r.task;
    });
  }

  // 5.3 — ни съесть, ни закрыться: только уйти, причём часть клеток вокруг короля под боем
  function escape(level) {
    return tryMake(() => {
      const s = checkSetup(['R', 'Q', 'B', 'N', 'R']);
      if (!s) return null;
      const { pl } = s;
      decoys(pl, level < 2 ? 1 : 2, ['bR', 'bB', 'bN']); // перекрывают клетки побега
      U.place(pl, 'bK');
      const r = finish({ kind: 'escape', checker: s.checker }, pl, true);
      if (!r || !r.game.in_check()) return null;
      const L = legalSplit(r.game);
      if (L.captures.length || L.blocks.length || !L.kingMoves.length) return null;
      // хотя бы одна соседняя клетка закрыта — есть над чем подумать
      const [kx, ky] = U.xy(s.wk);
      let around = 0;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && U.onBoard(kx + dx, ky + dy)) around++;
      if (L.kingMoves.length >= around || L.kingMoves.length > 4) return null;
      return r.task;
    });
  }

  // Испытание 5: любой из трёх видов
  function szu(level) {
    const t = U.pick([eatChecker, block, escape])(level);
    if (t) t.kind = 'szu';
    return t;
  }

  // Испытание 1: любой из трёх видов
  function hunt(level) {
    return U.pick([free, save, trade])(level);
  }

  const GEN = { free, save, trade, eatChecker, block, escape, szu, hunt };

  return { GEN, judge, solutions, hanging, attackersOf, VAL };
})();
