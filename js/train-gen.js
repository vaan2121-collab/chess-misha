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
  // step — какой это ход ребёнка в задаче (0 — первый, 1 — второй, для задач в 2 хода)
  function judge(task, before, after, move, step) {
    step = step || 0;
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
      case 'win2': {
        const id = move.from + move.to + (move.promotion || '');
        if (step === 0) {
          if (task.first.includes(id)) return { ok: false, cont: true };
          if (task.theme === 'fork' && move.piece === 'n') return { ok: false, oops: 'oops_nofork' };
          return { ok: false, oops: 'oops_first' };
        }
        if (move.captured && VAL[move.captured] >= task.minGain) return { ok: true };
        return { ok: false, oops: 'oops_missed' };
      }
      case 'pin': {
        if (!pinnedBy(after, move.to)) return { ok: false, oops: 'oops_nopin' };
        if (hanging(after, move.to)) return { ok: false, oops: 'oops_unsafe' };
        return { ok: true };
      }
      case 'promote': {
        if (!move.promotion) return { ok: false, oops: 'oops_nopromo' };
        if (after.in_stalemate()) return { ok: false, oops: 'oops_stalemate' };
        if (hanging(after, move.to)) return { ok: false, oops: 'oops_unsafe' };
        return { ok: true, method: move.promotion };
      }
      case 'castle': {
        if (/[kq]/.test(move.flags)) return { ok: true };
        return { ok: false, oops: move.piece === 'k' ? 'oops_kingwalk' : 'oops_nocastle' };
      }
      case 'center': {
        if (move.piece === 'q') return { ok: false, oops: 'oops_queen' };
        if (move.piece === 'k') return { ok: false, oops: 'oops_king' };
        if (move.piece === 'p' && 'abgh'.includes(move.to[0])) return { ok: false, oops: 'oops_edge' };
        if (hanging(after, move.to)) return { ok: false, oops: 'oops_unsafe' };
        if (centerScore(after) > centerScore(before)) return { ok: true };
        return { ok: false, oops: 'oops_nocenter' };
      }
      case 'defend': {
        // ребёнок за чёрных: после хода у белых не должно быть мата в 1 и ферзь не должен висеть
        if (after.moves().some((s) => s.endsWith('#'))) return { ok: false, oops: 'oops_mate' };
        const q = piecesOf(after, 'b').find((s) => after.get(s).type === 'q');
        if (q && attackersOf(after, q, 'w').length && !attackersOf(after, q, 'b').length) return { ok: false, oops: 'oops_queen' };
        return { ok: true };
      }
      case 'mate': {
        if (after.in_checkmate()) return { ok: true };
        if (after.in_stalemate()) return { ok: false, oops: 'oops_stalemate' };
        if (task.theme === 'kiss' && move.piece === 'q' && hanging(after, move.to)) return { ok: false, oops: 'oops_unprotected' };
        if (after.in_check()) return { ok: false, oops: 'oops_check' };
        return { ok: false, oops: null };
      }
    }
    return { ok: false, oops: null };
  }

  // Все ходы, которые решают задачу (для подсказок и проверки генерации).
  function solutions(task, game, step) {
    if (task.kind === 'win2') {
      const ms = game.moves({ verbose: true });
      return step ? ms.filter((m) => m.captured && VAL[m.captured] >= task.minGain)
        : ms.filter((m) => task.first.includes(m.from + m.to + (m.promotion || '')));
    }
    // мат: chess.js сам помечает такие ходы знаком # — это быстро
    if (task.kind === 'mate') return game.moves({ verbose: true }).filter((m) => m.san.endsWith('#'));
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

  // ---------- Остров «Мат в 1 ход» ----------
  const onEdge = (s) => s[0] === 'a' || s[0] === 'h' || s[1] === '1' || s[1] === '8';

  // 2.1 Поцелуй смерти: мат ферзём вплотную к королю, ферзя охраняет помощник
  function kiss(level) {
    return tryMake(() => {
      const pl = {};
      const bk = U.place(pl, 'bK', (s) => onEdge(s) && s[1] !== '1');
      if (level < 3) {
        U.place(pl, 'wK', (s) => U.dist(s, bk) === 2); // помощник — свой король
      } else {
        U.place(pl, 'wK', (s) => U.dist(s, bk) >= 3);
        U.place(pl, 'w' + U.pick(['R', 'B', 'N']), (s) => U.dist(s, bk) >= 2);
      }
      U.place(pl, 'wQ', (s) => U.dist(s, bk) >= 2);
      if (level >= 2) decoys(pl, 1, ['bP']);
      const r = finish({ kind: 'mate', theme: 'kiss' }, pl);
      if (!r) return null;
      const sols = solutions(r.task, r.game);
      if (!sols.length || sols.length > 3) return null;
      if (!sols.every((m) => m.piece === 'q' && U.dist(m.to, bk) === 1)) return null;
      return r.task;
    });
  }

  // 2.2 Коридорный мат: король за своими пешками, мат по 8-му ряду
  function corridor(level) {
    return tryMake(() => {
      const pl = {};
      const x = U.rnd(8);
      pl[U.sq(x, 7)] = 'bK';
      for (const dx of [-1, 0, 1]) if (U.onBoard(x + dx, 6)) pl[U.sq(x + dx, 6)] = 'bP';
      U.place(pl, 'w' + U.pick(level < 2 ? ['R'] : ['R', 'Q', 'R']), (s) => +s[1] <= 5);
      U.place(pl, 'wK', (s) => +s[1] <= 2);
      if (level >= 3) decoys(pl, 1, ['bN', 'bB']);  // может прикрывать часть ряда
      if (level >= 5) U.place(pl, 'wR', (s) => +s[1] <= 5);
      const r = finish({ kind: 'mate', theme: 'corridor' }, pl);
      if (!r) return null;
      const sols = solutions(r.task, r.game);
      if (!sols.length || !sols.every((m) => m.to[1] === '8')) return null;
      return r.task;
    });
  }

  // 2.3 Лесенка: одна ладья отрезает 7-й ряд, вторая ставит мат по 8-му
  function ladder(level) {
    return tryMake(() => {
      const pl = {};
      const x = U.rnd(8);
      const bk = U.sq(x, 7);
      pl[bk] = 'bK';
      const cutX = U.pick([0, 1, 2, 3, 4, 5, 6, 7].filter((cx) => Math.abs(cx - x) >= 2));
      pl[U.sq(cutX, 6)] = 'wR';
      U.place(pl, 'w' + (level < 3 ? 'R' : U.pick(['R', 'Q'])), (s) => +s[1] <= 5 && U.dist(s, bk) >= 2);
      U.place(pl, 'wK', (s) => +s[1] <= 2);
      if (level >= 4) decoys(pl, 1, ['bP']);
      const r = finish({ kind: 'mate', theme: 'ladder' }, pl);
      if (!r) return null;
      const sols = solutions(r.task, r.game);
      if (!sols.length || !sols.every((m) => m.to[1] === '8')) return null;
      return r.task;
    });
  }

  // Испытание: маты всех видов
  function mateMix(level) {
    return U.pick([kiss, corridor, ladder])(level);
  }

  // ---------- Задачи в 2 хода: выиграть фигуру ----------
  const uci = (m) => m.from + m.to + (m.promotion || '');

  // Лучшее, что белые могут съесть следующим ходом (цена фигуры), не отдав больше, чем взяли.
  function bestGain(g) {
    let best = 0;
    for (const m of g.moves({ verbose: true })) {
      if (!m.captured) continue;
      const v = VAL[m.captured];
      if (v <= best) continue;
      g.move(m);
      const safe = !attackersOf(g, m.to, 'b').length || VAL[m.piece] <= v;
      g.undo();
      if (safe) best = v;
    }
    return best;
  }

  // Ответ соперника: ход, после которого белые выигрывают меньше всего.
  function reply(g) {
    let best = null, bestScore = Infinity;
    for (const m of g.moves({ verbose: true })) {
      g.move(m);
      const score = g.in_checkmate() ? -1 : bestGain(g) - (m.captured ? VAL[m.captured] : 0) * 0.5;
      g.undo();
      if (score < bestScore || (score === bestScore && Math.random() < 0.5)) { best = m; bestScore = score; }
    }
    return best;
  }

  // Первые ходы, после которых белые ВЫНУЖДЕННО забирают фигуру ценой >= minGain.
  function forcedFirsts(g, minGain, filter) {
    const out = [];
    for (const m of g.moves({ verbose: true })) {
      if (filter && !filter(m)) continue;
      g.move(m);
      let ok = !g.game_over() || g.in_checkmate();
      if (ok && !g.in_checkmate()) {
        for (const r of g.moves({ verbose: true })) {
          g.move(r);
          const gain = bestGain(g);
          g.undo();
          if (gain < minGain) { ok = false; break; }
        }
      }
      g.undo();
      if (ok) out.push(uci(m));
    }
    return out;
  }

  // Общая проверка задачи «в 2 хода»: решение есть, оно одно-два, и сразу съесть нечего.
  function finishWin2(task, pl, minGain, themeFilter) {
    const r = finish(task, pl);
    if (!r || bestGain(r.game) >= minGain) return null; // нельзя просто взять фигуру сразу
    const first = forcedFirsts(r.game, minGain);
    if (!first.length || first.length > 2) return null;
    if (themeFilter && !r.game.moves({ verbose: true }).some((m) => first.includes(uci(m)) && themeFilter(m))) return null;
    task.first = first;
    task.minGain = minGain;
    return task;
  }

  const KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const around = (s, offs) => {
    const [x, y] = U.xy(s);
    return offs.map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => U.onBoard(a, b)).map(([a, b]) => U.sq(a, b));
  };

  // 3.1 Вилка конём: шах королю + нападение на ладью/ферзя, потом забрать
  function fork2(level) {
    return tryMake(() => {
      const pl = {};
      const s = U.pick(U.ALL);
      const spots = around(s, KN).sort(() => Math.random() - 0.5);
      if (spots.length < 3) return null;
      pl[spots[0]] = 'bK';
      pl[spots[1]] = 'b' + U.pick(['Q', 'R', 'R']);
      pl[spots[2]] = 'wN';
      U.place(pl, 'wK', (q) => U.dist(q, spots[0]) >= 2);
      if (level >= 2) decoys(pl, 1, ['bP']);
      if (level >= 4) U.place(pl, 'w' + U.pick(['B', 'P']), U.notEdgeRanks);
      return finishWin2({ kind: 'win2', theme: 'fork' }, pl, 5, (m) => m.piece === 'n');
    });
  }

  // 3.2 Вилка пешкой: пешка шагает и бьёт две фигуры сразу
  function pawnFork2(level) {
    return tryMake(() => {
      const pl = {};
      const x = 1 + U.rnd(6), y = 2 + U.rnd(4);
      pl[U.sq(x - 1, y + 1)] = 'b' + U.pick(['N', 'R', 'Q', 'N']);
      pl[U.sq(x + 1, y + 1)] = 'b' + U.pick(['N', 'R', 'Q', 'N']);
      pl[y === 3 && Math.random() < 0.5 ? U.sq(x, 1) : U.sq(x, y - 1)] = 'wP';
      U.place(pl, 'wK', (q) => +q[1] <= 3);
      U.place(pl, 'bK', (q) => +q[1] >= 7);
      if (level >= 3) U.place(pl, 'w' + U.pick(['N', 'B']), U.notEdgeRanks);
      return finishWin2({ kind: 'win2', theme: 'pawnfork' }, pl, 3, (m) => m.piece === 'p');
    });
  }

  // 3.3 Связка: поставь слона/ладью/ферзя так, чтобы фигура не могла уйти — за ней король
  function pin(level) {
    return tryMake(() => {
      const pl = {};
      const bk = U.place(pl, 'bK');
      const diag = Math.random() < 0.5;
      const dirs = diag ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const [dx, dy] = U.pick(dirs);
      const [kx, ky] = U.xy(bk);
      const k = 1 + U.rnd(2);
      if (!U.onBoard(kx + dx * k, ky + dy * k)) return null;
      const xSq = U.sq(kx + dx * k, ky + dy * k);
      if (pl[xSq]) return null;
      pl[xSq] = 'b' + U.pick(['N', 'N', 'B', 'R']);
      const sType = level >= 3 && Math.random() < 0.4 ? 'Q' : diag ? 'B' : 'R';
      U.place(pl, 'w' + sType, (q) => {
        const [qx, qy] = U.xy(q);
        // не на той же линии — иначе связка уже есть
        const along = (qx - kx) * dy === (qy - ky) * dx && Math.sign(qx - kx) === Math.sign(dx) && Math.sign(qy - ky) === Math.sign(dy);
        return !along && U.dist(q, bk) >= 2;
      });
      U.place(pl, 'wK', (q) => U.dist(q, bk) >= 2);
      if (level >= 2) decoys(pl, 1, ['bP']);
      const r = finish({ kind: 'pin' }, pl);
      if (!r) return null;
      const sols = solutions(r.task, r.game);
      if (!sols.length || sols.length > 3) return null;
      return r.task;
    });
  }

  // Какая чёрная фигура связана ходом move (между ним и чёрным королём одна чёрная фигура).
  function pinnedBy(g, from) {
    const p = g.get(from);
    if (!p || !['b', 'r', 'q'].includes(p.type)) return null;
    const dirs = [];
    if (p.type !== 'b') dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);
    if (p.type !== 'r') dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
    const [x0, y0] = U.xy(from);
    for (const [dx, dy] of dirs) {
      let first = null;
      for (let x = x0 + dx, y = y0 + dy; U.onBoard(x, y); x += dx, y += dy) {
        const q = g.get(U.sq(x, y));
        if (!q) continue;
        if (!first) { if (q.color !== 'b' || q.type === 'k') break; first = U.sq(x, y); continue; }
        if (q.color === 'b' && q.type === 'k') return first;
        break;
      }
    }
    return null;
  }

  function superMix(level) { return U.pick([fork2, pawnFork2, pin])(level); }

  // ---------- Остров «Секретное оружие» ----------
  // 6.1 Превращение пешки: пешка у последней линии — превратись и не попадись
  function promote(level) {
    return tryMake(() => {
      const pl = {};
      const x = U.rnd(8);
      pl[U.sq(x, 6)] = 'wP';
      U.place(pl, 'bK', (q) => U.dist(q, U.sq(x, 7)) >= (level < 2 ? 3 : 2) && q[1] !== '1');
      U.place(pl, 'wK', (q) => +q[1] <= 4);
      if (level >= 2) decoys(pl, 1, ['bN', 'bB', 'bR']); // может бить клетку превращения
      if (level >= 4 && U.onBoard(x + 1, 7)) pl[U.sq(x + 1, 7)] = pl[U.sq(x + 1, 7)] || 'b' + U.pick(['N', 'B']); // можно превратиться, съев
      const r = finish({ kind: 'promote' }, pl);
      if (!r) return null;
      const sols = solutions(r.task, r.game);
      if (!sols.length) return null;
      return r.task;
    });
  }

  // 6.2 Рокировка: король в центре, путь свободен — спрячь короля
  function castle(level) {
    return tryMake(() => {
      const pl = { e1: 'wK' };
      const short = Math.random() < 0.6 || level < 2;
      const long = !short || (level >= 3 && Math.random() < 0.5);
      if (short) pl.h1 = 'wR';
      if (long) pl.a1 = 'wR';
      // пешки прикрывают короля
      ['f2', 'g2', 'h2', 'a2', 'b2', 'c2'].forEach((s) => { if (Math.random() < 0.7) pl[s] = 'wP'; });
      U.place(pl, 'bK', (q) => +q[1] >= 6);
      decoys(pl, level < 2 ? 1 : 2, ['bN', 'bB', 'bP']);
      if (level >= 2) U.place(pl, 'w' + U.pick(['N', 'B']), (q) => +q[1] >= 3);
      const g0 = U.makeGame(pl, 'w');
      if (!g0) return null;
      const rights = (short ? 'K' : '') + (long ? 'Q' : '');
      const fen = g0.fen().replace(' w - - ', ' w ' + rights + ' - ');
      const g = new Chess();
      if (!g.load(fen)) return null;
      const task = { kind: 'castle', fen: g.fen() };
      if (!g.moves({ verbose: true }).some((m) => /[kq]/.test(m.flags))) return null;
      return task;
    });
  }

  // 6.3 Лазер (сквозной удар): шах по линии, за королём — ферзь или ладья
  function skewer2(level) {
    return tryMake(() => {
      const pl = {};
      const diag = Math.random() < 0.5;
      const dirs = diag ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const [dx, dy] = U.pick(dirs);
      const bk = U.pick(U.ALL);
      const [kx, ky] = U.xy(bk);
      if (!U.onBoard(kx + dx, ky + dy)) return null;
      pl[bk] = 'bK';
      pl[U.sq(kx + dx, ky + dy)] = 'b' + U.pick(['Q', 'R']);
      U.place(pl, 'w' + (diag ? U.pick(['B', 'Q']) : U.pick(['R', 'Q'])), (q) => U.dist(q, bk) >= 3);
      U.place(pl, 'wK', (q) => U.dist(q, bk) >= 3);
      if (level >= 3) decoys(pl, 1, ['bP']);
      const t = finishWin2({ kind: 'win2', theme: 'skewer' }, pl, 5, (m) => ['b', 'r', 'q'].includes(m.piece));
      if (!t) return null;
      // первый ход — именно шах по линии
      const g = new Chess(t.fen);
      if (!g.moves({ verbose: true }).some((m) => t.first.includes(uci(m)) && /\+/.test(m.san))) return null;
      return t;
    });
  }

  // 6.4 Вскрытый шах: отпрыгни фигурой — откроется шах, а сама она нападёт на ферзя
  function discover2(level) {
    return tryMake(() => {
      const pl = {};
      const diag = Math.random() < 0.5;
      const dirs = diag ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const [dx, dy] = U.pick(dirs);
      const bk = U.place(pl, 'bK');
      const [kx, ky] = U.xy(bk);
      const j = 3 + U.rnd(3), i = 1 + U.rnd(j - 2);
      if (!U.onBoard(kx + dx * j, ky + dy * j)) return null;
      pl[U.sq(kx + dx * j, ky + dy * j)] = 'w' + (diag ? 'B' : 'R');
      const blocker = U.sq(kx + dx * i, ky + dy * i);
      if (pl[blocker]) return null;
      pl[blocker] = 'w' + U.pick(['N', 'N', diag ? 'N' : 'B']);
      U.place(pl, 'bQ', (q) => U.dist(q, bk) >= 2);
      U.place(pl, 'wK', (q) => U.dist(q, bk) >= 3);
      if (level >= 3) decoys(pl, 1, ['bP']);
      const t = finishWin2({ kind: 'win2', theme: 'discover' }, pl, 9, (m) => m.from === blocker);
      return t;
    });
  }

  function secretMix(level) { return U.pick([promote, castle, skewer2, discover2])(level); }

  // ---------- Остров «Царь горы» ----------
  const CENTER = ['d4', 'e4', 'd5', 'e5'];
  function centerScore(g) {
    let s = 0;
    for (const c of CENTER) {
      const p = g.get(c);
      if (p && p.color === 'w') s += 2;
      s += attackersOf(g, c, 'w').length;
    }
    return s;
  }

  // 7.1 Битва за центр — позиции первых ходов партии
  const OPENINGS = ['', 'e5', 'd5', 'c5', 'e4 e5 Nf3 Nc6', 'd4 d5', 'e4 c5', 'Nf3 d5', 'e4 e5', 'e4 d6', 'c4 e5', 'e4 Nf6', 'd4 Nf6'];
  function center() {
    const seq = U.pick(OPENINGS);
    const moves = seq ? seq.split(' ') : [];
    const g = new Chess();
    if (moves.length % 2 === 1) g.move('e4'); // строка начинается с ответа чёрных — белые сначала e4
    for (const m of moves) if (!g.move(m)) return null;
    return g.turn() === 'w' ? { kind: 'center', fen: g.fen() } : null;
  }

  // 7.2 Защита от детского мата — ребёнок играет чёрными
  const SCHOLAR = ['e4 e5 Bc4 Nc6 Qh5', 'e4 e5 Qh5 Nc6 Bc4', 'e4 e5 Bc4 Bc5 Qf3', 'e4 e5 Qf3 Nc6 Bc4', 'e4 Nc6 Bc4 e5 Qh5', 'e4 e5 Bc4 Nf6 Qf3', 'e4 e5 Nc3 Nc6 Bc4 Bc5 Qh5'];
  function scholar() {
    const g = new Chess();
    U.pick(SCHOLAR).split(' ').forEach((m) => g.move(m));
    return { kind: 'defend', fen: g.fen() };
  }

  // 7.3 Капкан: жадная фигура соперника залезла в угол — отрежь ей пути и забери
  function trap2(level) {
    return tryMake(() => {
      const pl = {};
      const corners = ['a1', 'h1', 'a2', 'h2', 'b1', 'g1', 'a3', 'h3'];
      const victim = U.pick(corners);
      pl[victim] = 'b' + U.pick(['B', 'N']);
      for (let i = 0; i < 3; i++) U.place(pl, 'wP', (q) => +q[1] >= 2 && +q[1] <= 4);
      U.place(pl, 'w' + U.pick(['R', 'N', 'B']));
      U.place(pl, 'wK', (q) => +q[1] <= 3);
      U.place(pl, 'bK', (q) => +q[1] >= 7);
      return finishWin2({ kind: 'win2', theme: 'trap' }, pl, 3, (m) => !m.captured);
    });
  }

  // ---------- Остров «Спасательная операция» ----------
  // 8.1 Не поставь пат: мат есть, но рядом с ним ловушки-паты
  function noStalemate(level) {
    return tryMake(() => {
      const pl = {};
      const bk = U.place(pl, 'bK', (s) => ['a8', 'h8', 'a1', 'h1', 'b8', 'g8', 'a7', 'h7'].includes(s));
      U.place(pl, 'wK', (s) => U.dist(s, bk) === 2);
      U.place(pl, 'w' + (level < 3 ? 'Q' : U.pick(['Q', 'R'])), (s) => U.dist(s, bk) >= 2);
      const r = finish({ kind: 'mate', theme: 'stalemate' }, pl);
      if (!r) return null;
      const g = r.game;
      const mates = solutions(r.task, g);
      if (!mates.length) return null;
      const stalemates = g.moves({ verbose: true }).filter((m) => { g.move(m); const s = g.in_stalemate(); g.undo(); return s; });
      if (!stalemates.length) return null;
      return r.task;
    });
  }

  // 8.2 Не зевни: у тебя несколько фигур, одна в опасности — найди её и спаси
  function guard(level) {
    return tryMake(() => {
      const t = save(level + 3);
      if (!t) return null;
      // добавляем ещё одну спокойную белую фигуру, чтобы было из чего выбирать
      const g = new Chess(t.fen);
      const pl = {};
      for (const s of U.ALL) { const p = g.get(s); if (p) pl[s] = p.color + p.type.toUpperCase(); }
      U.place(pl, 'w' + U.pick(['N', 'B', 'R']));
      const r = finish({ kind: 'save', victim: t.victim }, pl);
      if (!r || !hanging(r.game, t.victim)) return null;
      if (piecesOf(r.game, 'w').some((s) => s !== t.victim && hanging(r.game, s))) return null;
      if (!solutions(r.task, r.game).length) return null;
      return r.task;
    });
  }

  function rescueMix(level) { return U.pick([noStalemate, guard])(level); }

  // Одинокий король-босс убегает: держится подальше от края и от белого короля,
  // забирает фигуру, если её оставили без защиты.
  function bossKing(g) {
    let best = null, bestScore = -Infinity;
    const wk = piecesOf(g, 'w').find((s) => g.get(s).type === 'k');
    for (const m of g.moves({ verbose: true })) {
      const [x, y] = U.xy(m.to);
      let score = Math.min(x, 7 - x, y, 7 - y) * 10 + U.dist(m.to, wk) + Math.random();
      if (m.captured) score += 100;
      g.move(m);
      if (g.moves().some((s) => s.endsWith('#'))) score -= 15; // не подставляться под мат в 1
      g.undo();
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
  }

  // Подсказка для мат-боссов — техника «сжимай короля»: оставь ему как можно меньше ходов,
  // гони к краю, подводи своего короля; никогда не ставь пат и не подставляй фигуры.
  // seen — позиции, которые уже были в этой партии (чтобы подсказка не ходила по кругу)
  function bossHint(g, seen) {
    const kingOf = (c) => piecesOf(g, c).find((s) => g.get(s).type === 'k');
    let best = null, bestScore = -Infinity;
    for (const m of g.moves({ verbose: true })) {
      g.move(m);
      let score;
      if (g.in_checkmate()) score = 1e6;
      else if (g.in_stalemate()) score = -1e6;
      else {
        const bk = kingOf('b'), wk = kingOf('w');
        const unsafe = piecesOf(g, 'w').some((s) => g.get(s).type !== 'k' && U.dist(s, bk) === 1 && !attackersOf(g, s, 'w').length);
        if (unsafe) score = -1e5;
        else {
          const [x, y] = U.xy(bk);
          score = -g.moves().length * 10 - Math.min(x, 7 - x, y, 7 - y) * 6 - U.dist(wk, bk) * 3;
          if (seen && seen.has(g.fen().split(" ")[0])) score -= 60; // уже было — не повторяемся
          // заглянем на ход вперёд: если на любой ответ есть мат — отличный ход
          const replies = g.moves({ verbose: true });
          let mateAll = replies.length > 0;
          for (const r of replies) {
            g.move(r);
            const mate = g.moves().some((s) => s.endsWith('#'));
            g.undo();
            if (!mate) { mateAll = false; break; }
          }
          if (mateAll) score += 5e5;
        }
      }
      g.undo();
      if (score > bestScore || (score === bestScore && Math.random() < 0.3)) { bestScore = score; best = m; }
    }
    return best;
  }

  // ---------- Боссы: мини-партии против робота ----------
  function pawnRace() {
    return tryMake(() => {
      const pl = { e1: 'wK', e8: 'bK' };
      const files = [0, 1, 2, 3, 4, 5, 6, 7].sort(() => Math.random() - 0.5).slice(0, 3);
      files.forEach((x) => { pl[U.sq(x, 1)] = 'wP'; pl[U.sq(x, 6)] = 'bP'; });
      const g = U.makeGame(pl, 'w');
      return g ? { kind: 'boss', boss: 'race', fen: g.fen() } : null;
    });
  }

  function mateBoss(pieces, limit) {
    return () => tryMake(() => {
      const pl = {};
      const bk = U.place(pl, 'bK', (s) => { const [x, y] = U.xy(s); return x >= 2 && x <= 5 && y >= 2 && y <= 5; });
      U.place(pl, 'wK', (s) => U.dist(s, bk) >= 3);
      pieces.forEach((p) => U.place(pl, 'w' + p, (s) => U.dist(s, bk) >= 2));
      const g = U.makeGame(pl, 'w');
      return g ? { kind: 'boss', boss: 'mate', limit, fen: g.fen() } : null;
    });
  }

  const GEN = {
    free, save, trade, eatChecker, block, escape, szu, hunt, kiss, corridor, ladder, mateMix,
    fork2, pawnFork2, pin, superMix, promote, castle, skewer2, discover2, secretMix,
    center, scholar, trap2, noStalemate, guard, rescueMix,
    pawnRace, rooksBoss: mateBoss(['R', 'R'], 30), queenBoss: mateBoss(['Q'], 40)
  };

  return { GEN, judge, solutions, reply, bossKing, bossHint, hanging, attackersOf, VAL };
})();
