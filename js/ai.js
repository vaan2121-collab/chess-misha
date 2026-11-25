// «Мозги» соперников. Уровень 1–10:
//   1 — ходит почти наугад, иногда ест что попало
//   2 — жадный: съедает самую дорогую фигуру, которую видит, не думая о последствиях
//   3 — смотрит на 2 полухода вперёд, но часто ошибается (большой «шум»)
//   4 — смотрит на 2 полухода, ошибается редко
//   5 — думает до 3 полуходов (сколько успеет за отведённое время), почти не ошибается
//   6–10 — усиленные профили: глубже считают, но всё ещё работают локально.
window.ChessAI = (function () {
  const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const CENTER = [0, 1, 2, 3, 3, 2, 1, 0];
  const MATE = 100000;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Оценка позиции с точки зрения белых: материал + немного за центр и продвижение пешек.
  function evaluate(g) {
    let s = 0;
    const board = g.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = board[r][f];
        if (!p) continue;
        let v = VALUE[p.type];
        if (p.type === 'n' || p.type === 'b') v += (CENTER[f] + CENTER[r]) * 5;
        if (p.type === 'q') v += (CENTER[f] + CENTER[r]) * 2;
        if (p.type === 'p') {
          const advance = p.color === 'w' ? 6 - r : r - 1;
          v += advance * 8 + CENTER[f] * 3;
        }
        s += p.color === 'w' ? v : -v;
      }
    }
    return s;
  }

  // Сначала взятия (дорогая жертва дешёвым нападающим), потом остальное — так отсечение работает лучше.
  function ordered(moves) {
    return moves.sort((a, b) => score(b) - score(a));
    function score(m) {
      let s = 0;
      if (m.captured) s += 10 * VALUE[m.captured] - VALUE[m.piece];
      if (m.promotion) s += 800;
      return s;
    }
  }

  // Негамакс с альфа-бета отсечением. Возвращает оценку для стороны, которая ходит.
  function search(g, depth, alpha, beta, deadline) {
    if (deadline && Date.now() > deadline) throw new Error('time');
    const color = g.turn() === 'w' ? 1 : -1;
    if (depth === 0) return color * evaluate(g);
    const moves = g.moves({ verbose: true });
    if (!moves.length) return g.in_check() ? -MATE - depth : 0; // мат (чем раньше, тем хуже) или пат
    let best = -Infinity;
    for (const m of ordered(moves)) {
      g.move(m);
      let v;
      try {
        v = -search(g, depth - 1, -beta, -alpha, deadline);
      } finally {
        g.undo(); // даже если время вышло — позиция должна вернуться как была
      }
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }

  // Оценки всех ходов на глубине depth (с небольшим случайным шумом).
  function rankMoves(g, depth, noise, deadline) {
    const out = [];
    for (const m of ordered(g.moves({ verbose: true }))) {
      g.move(m);
      let v;
      try {
        v = -search(g, depth - 1, -Infinity, Infinity, deadline);
      } finally {
        g.undo();
      }
      out.push({ move: m, score: v + (Math.random() * 2 - 1) * noise });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  function bestAtDepth(g, depth, noise, deadline) {
    const ranked = rankMoves(g, depth, noise, deadline);
    return ranked.length ? ranked[0].move : null;
  }

  function choose(g, level) {
    const moves = g.moves({ verbose: true });
    if (!moves.length) return null;

    if (level <= 1) {
      const captures = moves.filter((m) => m.captured);
      return captures.length && Math.random() < 0.3 ? pick(captures) : pick(moves);
    }

    if (level === 2) {
      const captures = moves.filter((m) => m.captured);
      if (captures.length && Math.random() < 0.85) {
        const top = Math.max(...captures.map((m) => VALUE[m.captured]));
        return pick(captures.filter((m) => VALUE[m.captured] === top));
      }
      return pick(moves);
    }

    if (level === 3) return bestAtDepth(g, 2, 150);
    if (level === 4) return bestAtDepth(g, 2, 40);

    // уровни 5–10: углубляемся, пока хватает времени. Пауза ограничена,
    // чтобы сильный соперник не превращал детскую партию в ожидание.
    const profile = {
      5: { ms: 1500, noise: 15, depth: 3 },
      6: { ms: 1800, noise: 10, depth: 3 },
      7: { ms: 2200, noise: 7, depth: 3 },
      8: { ms: 2600, noise: 4, depth: 4 },
      9: { ms: 3000, noise: 2, depth: 4 },
      10: { ms: 3500, noise: 0, depth: 4 }
    }[level] || { ms: 1500, noise: 15, depth: 3 };
    const deadline = Date.now() + profile.ms;
    let best = bestAtDepth(g, 2, profile.noise);
    try {
      best = bestAtDepth(g, profile.depth, profile.noise, deadline) || best;
    } catch (e) { /* не успели — берём результат глубины 2 */ }
    return best;
  }

  // Хороший ход для подсказки ребёнку.
  function hint(g) {
    return bestAtDepth(g, 2, 0);
  }

  return { choose, hint, evaluate };
})();
