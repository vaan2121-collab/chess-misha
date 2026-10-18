// Одна белая фигура на пустой доске + звёздочки — для уроков «Учим фигуры».
// chess.js не умеет позиции без королей, поэтому ходы считаем сами.
// Объект повторяет нужную часть интерфейса chess.js, и ChessBoard работает с ним как с обычной игрой.
//
// Звезда ведёт себя как чужая фигура: сквозь неё ходить нельзя, встать на неё — можно (это «съесть»).
// Пешка поэтому берёт звёзды только по диагонали, а звезда прямо перед ней загораживает путь.
window.SoloGame = (function () {
  const FILES = 'abcdefgh';
  const RAYS = {
    r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
    q: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
  };
  const STEPS = {
    k: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
    n: [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
  };

  const toXY = (sq) => [FILES.indexOf(sq[0]), +sq[1] - 1];
  const toSq = (x, y) => FILES[x] + (y + 1);
  const onBoard = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;

  // Куда фигура type может пойти с клетки from, если на доске стоят звёзды stars (Set).
  function targets(type, from, stars) {
    const [x, y] = toXY(from);
    const out = [];

    if (RAYS[type]) {
      for (const [dx, dy] of RAYS[type]) {
        let nx = x + dx, ny = y + dy;
        while (onBoard(nx, ny)) {
          const sq = toSq(nx, ny);
          out.push(sq);
          if (stars.has(sq)) break;
          nx += dx; ny += dy;
        }
      }
    } else if (STEPS[type]) {
      for (const [dx, dy] of STEPS[type]) {
        if (onBoard(x + dx, y + dy)) out.push(toSq(x + dx, y + dy));
      }
    } else if (type === 'p') {
      const one = toSq(x, y + 1);
      if (y < 7 && !stars.has(one)) {
        out.push(one);
        const two = toSq(x, y + 2);
        if (y === 1 && !stars.has(two)) out.push(two);
      }
      for (const dx of [-1, 1]) {
        if (onBoard(x + dx, y + 1) && stars.has(toSq(x + dx, y + 1))) out.push(toSq(x + dx, y + 1));
      }
    }
    return out;
  }

  // Цепочка из count звёзд: каждую можно взять одним ходом с предыдущей.
  // Проверяем, что путь проходим и когда на доске стоят все звёзды сразу.
  function makeStars(type, start, count) {
    const distance = (a, b) => {
      const [ax, ay] = toXY(a), [bx, by] = toXY(b);
      return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
    };
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    for (let attempt = 0; attempt < 300; attempt++) {
      const chain = [];
      let pos = start;
      for (let k = 0; k < count; k++) {
        let cands;
        if (type === 'p') {
          // для пешки звёзды только по диагонали вперёд
          const [x, y] = toXY(pos);
          cands = [-1, 1].filter((dx) => onBoard(x + dx, y + 1)).map((dx) => toSq(x + dx, y + 1));
        } else {
          cands = targets(type, pos, new Set());
        }
        cands = cands.filter((sq) => sq !== start && !chain.includes(sq));
        // дальнобойным фигурам не ставим звезду вплотную — пусть «прокатятся»
        const far = cands.filter((sq) => distance(sq, pos) >= 2);
        if (RAYS[type] && far.length) cands = far;
        if (!cands.length) break;
        pos = pick(cands);
        chain.push(pos);
      }
      if (chain.length === count && solvable(type, start, chain)) return chain;
    }
    return [];
  }

  function solvable(type, start, chain) {
    const left = new Set(chain);
    let pos = start;
    for (const sq of chain) {
      if (!targets(type, pos, left).includes(sq)) return false;
      left.delete(sq);
      pos = sq;
    }
    return true;
  }

  // opts.sound — звук взятия: 'star' для звёздочек, 'capture' для врагов
  function create(type, start, stars, opts) {
    const takeSound = (opts && opts.sound) || 'star';
    let pos = start;
    const starSet = new Set(stars || []);
    const history = [];

    return {
      get stars() { return Array.from(starSet); },
      get position() { return pos; },
      get(square) { return square === pos ? { type, color: 'w' } : null; },
      moves(opts) {
        if (!opts || opts.square !== pos) return [];
        return targets(type, pos, starSet).map((to) => ({
          from: pos, to, color: 'w', piece: type,
          captured: starSet.has(to) ? 'star' : undefined
        }));
      },
      move({ from, to }) {
        if (from !== pos || !targets(type, pos, starSet).includes(to)) return null;
        const took = starSet.delete(to);
        pos = to;
        const move = { from, to, color: 'w', piece: type, captured: took ? 'star' : undefined, sound: took ? takeSound : undefined };
        history.push(move);
        return move;
      },
      turn: () => 'w',
      in_check: () => false,
      in_checkmate: () => false,
      in_stalemate: () => false,
      game_over: () => false,
      history: () => history.slice()
    };
  }

  return { create, makeStars };
})();
