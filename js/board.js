// Шахматная доска поверх chess.js.
// Управление касанием: тап по своей фигуре → подсветка ходов → тап по клетке.
// Модуль переиспользуется в следующих этапах (справочник, задачки, игра с ИИ).
//
//   const board = ChessBoard.create(element, {
//     game: new Chess(),          // экземпляр chess.js
//     playerColor: 'both',        // 'w' | 'b' | 'both' — кем можно ходить
//     orientation: 'w',           // снизу белые или чёрные
//     onMove: (move) => {}        // вызывается после каждого хода игрока
//   });
window.ChessBoard = (function () {
  const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  // Сплошные символы для обоих цветов — цвет задаётся в CSS.
  const GLYPHS = {
    wk: '♚', wq: '♛', wr: '♜', wb: '♝', wn: '♞', wp: '♟︎',
    bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟︎'
  };

  // Проверяем один раз, какие картинки фигур есть в assets/pieces.
  const pieceImages = {};
  const imageWaiters = [];
  for (const code in GLYPHS) {
    const file = code[0] + code[1].toUpperCase(); // wk → wK
    const src = CONFIG.pieces.path + file + '.' + CONFIG.pieces.ext;
    const img = new Image();
    img.onload = () => {
      pieceImages[code] = src;
      imageWaiters.forEach((fn) => fn());
    };
    img.src = src;
  }

  function create(el, opts) {
    const state = {
      game: opts.game,
      playerColor: opts.playerColor || 'both',
      orientation: opts.orientation || 'w',
      onMove: opts.onMove || function () {},
      // Когда доска перестаёт принимать ходы. В задачках ничья «из-за недостатка
      // материала» не считается концом — там важна только цель задания.
      isOver: opts.isOver || ((g) => g.game_over()),
      // звук шаха; в «Игре с роботом» его нет — там шах объявляет сам соперник
      checkSound: opts.checkSound !== false,
      interactive: opts.interactive !== false,
      selected: null,
      targets: [],
      lastMove: null,
      marks: {} // { e4: 'star' } — значки поверх клеток
    };

    el.classList.add('board');
    el.innerHTML = '';
    const squares = {};

    for (let i = 0; i < 64; i++) {
      const sq = document.createElement('div');
      sq.className = 'sq';
      sq.addEventListener('pointerdown', onSquareTap);
      el.appendChild(sq);
    }

    // Расставляем имена клеток с учётом ориентации доски.
    function layout() {
      const cells = el.children;
      for (let i = 0; i < 64; i++) {
        const row = Math.floor(i / 8);
        const col = i % 8;
        const file = state.orientation === 'w' ? col : 7 - col;
        const rank = state.orientation === 'w' ? 8 - row : row + 1;
        const name = FILES[file] + rank;
        const cell = cells[i];
        cell.dataset.square = name;
        cell.classList.toggle('light', (file + rank) % 2 === 1);
        cell.classList.toggle('dark', (file + rank) % 2 === 0);
        squares[name] = cell;
        cell.dataset.file = row === 7 ? FILES[file] : '';
        cell.dataset.rank = col === 0 ? rank : '';
      }
    }

    function canControl(color) {
      return state.interactive &&
        (state.playerColor === 'both' || state.playerColor === color);
    }

    function select(square) {
      state.selected = square;
      state.targets = state.game.moves({ square, verbose: true });
      render();
    }

    function clearSelection() {
      state.selected = null;
      state.targets = [];
      render();
    }

    function onSquareTap(e) {
      e.preventDefault();
      const square = e.currentTarget.dataset.square;
      const game = state.game;
      if (state.animating || state.isOver(game)) return;

      const turn = game.turn();
      const piece = game.get(square);

      // Тап по клетке, куда можно сходить.
      const move = state.targets.find((m) => m.to === square);
      if (state.selected && move) {
        makeMove(state.selected, square);
        return;
      }

      // Тап по своей фигуре — выбираем её (или снимаем выбор повторным тапом).
      if (piece && piece.color === turn && canControl(turn)) {
        if (state.selected === square) {
          clearSelection();
        } else {
          Sound.play('select');
          select(square);
        }
        return;
      }

      if (state.selected) {
        Sound.play('error');
        clearSelection();
      }
    }

    function makeMove(from, to) {
      const game = state.game;
      // Кого съедают и где он стоит (при взятии на проходе — не на клетке to).
      const legal = game.moves({ square: from, verbose: true }).find((m) => m.to === to);
      if (!legal) return null;
      const victimSq = legal.flags && legal.flags.includes('e') ? to[0] + from[1] : to;
      const attackerEl = squares[from].querySelector('.piece');
      const victimEl = squares[victimSq].querySelector('.piece, .mark.enemy'); // звёзды не рассыпаем
      const victimPiece = game.get(victimSq);
      const enemyMatch = victimEl && victimEl.className.match(/e-(\w\w)/);
      const victimCode = victimPiece ? victimPiece.color + victimPiece.type.toUpperCase() : enemyMatch && enemyMatch[1];

      // Превращение пешки — всегда в ферзя, чтобы не усложнять детям.
      const move = game.move({ from, to, promotion: 'q' });
      if (!move) return null;
      state.selected = null;
      state.targets = [];
      state.lastMove = move;

      const animate = move.captured && attackerEl && victimEl && window.CaptureFX && CaptureFX.enabled();
      if (!animate) {
        finishMove(move, false);
        return move;
      }
      // Атака и рассыпание на кубики; доску перерисуем после анимации.
      state.animating = true;
      el.querySelectorAll('.selected, .target, .target-capture').forEach((c) =>
        c.classList.remove('selected', 'target', 'target-capture'));
      CaptureFX.play({ attackerEl, victimEl, attackerType: move.piece, victimCode, boardEl: el })
        .catch(() => {})
        .then(() => {
          state.animating = false;
          if (state.game === game) finishMove(move, true);
        });
      return move;
    }

    function finishMove(move, animated) {
      playMoveSound(move, animated);
      render(move.to);
      state.onMove(move);
    }

    function playMoveSound(move, animated) {
      if (animated) {
        // звук удара уже был в анимации — остались только шах и мат
        if (state.game.in_checkmate()) Sound.play('win');
        else if (state.game.in_check() && state.checkSound) Sound.play('check');
      }
      else if (move.sound) Sound.play(move.sound); // особый звук задаёт сама «игра»
      else if (state.game.in_checkmate()) Sound.play('win');
      else if (state.game.in_check()) { if (state.checkSound) Sound.play('check'); else Sound.play('move'); }
      else if (move.captured) Sound.play('capture');
      else Sound.play('move');
    }

    function render(landedSquare) {
      const game = state.game;
      const checkSquare = game.in_check() ? findKing(game.turn()) : null;

      for (const name in squares) {
        const cell = squares[name];
        const piece = game.get(name);
        const target = state.targets.find((m) => m.to === name);

        cell.classList.toggle('selected', state.selected === name);
        cell.classList.toggle('target', !!target && !target.captured);
        cell.classList.toggle('target-capture', !!target && !!target.captured);
        cell.classList.toggle('last', !!state.lastMove &&
          (state.lastMove.from === name || state.lastMove.to === name));
        cell.classList.toggle('in-check', checkSquare === name);

        const key = piece ? piece.color + piece.type : '';
        const mark = state.marks[name] || '';
        const content = key + '|' + mark + '|' + (pieceImages[key] ? 1 : 0);
        if (cell.dataset.content !== content) {
          cell.dataset.content = content;
          cell.innerHTML = (mark ? '<span class="mark ' + mark + '"></span>' : '') +
            (key ? pieceHtml(key) : '');
        }
        const pieceEl = cell.querySelector('.piece');
        if (name === landedSquare && pieceEl) pieceEl.classList.add('landed');
      }
    }

    function pieceHtml(key) {
      if (pieceImages[key]) {
        return '<img class="piece" draggable="false" alt="" src="' + pieceImages[key] + '">';
      }
      return '<span class="piece glyph ' + key[0] + '">' + GLYPHS[key] + '</span>';
    }

    function findKing(color) {
      for (const name in squares) {
        const p = state.game.get(name);
        if (p && p.type === 'k' && p.color === color) return name;
      }
      return null;
    }

    // Доска всегда квадратная и вписана в родителя (с запасом под рамку).
    function fit() {
      const box = el.parentElement.getBoundingClientRect();
      const size = Math.floor(Math.min(box.width, box.height) - 24);
      if (size > 0) {
        el.style.width = size + 'px';
        el.style.height = size + 'px';
      }
    }
    if (window.ResizeObserver) new ResizeObserver(fit).observe(el.parentElement);
    window.addEventListener('resize', fit);
    fit();

    imageWaiters.push(() => render());
    layout();
    render();

    return {
      render: () => render(),
      select,
      clearSelection,
      makeMove,
      setMarks(marks) { state.marks = marks || {}; render(); },
      squareEl(name) { return squares[name]; },
      setGame(game) {
        state.game = game;
        state.lastMove = null;
        clearSelection();
      },
      setOrientation(color) {
        state.orientation = color;
        layout();
        render();
      },
      flip() { this.setOrientation(state.orientation === 'w' ? 'b' : 'w'); },
      setInteractive(v) { state.interactive = v; if (!v) clearSelection(); },
      setPlayerColor(color) { state.playerColor = color; },
      isBusy() { return !!state.animating; }, // идёт анимация взятия
      setLastMove(move) { state.lastMove = move; render(move && move.to); }
    };
  }

  return { create };
})();
