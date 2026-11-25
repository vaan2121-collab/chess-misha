// Темы доски в стиле Minecraft. Покупаются за ⭐ в «Моих подарках», вкладка «Доски».
window.THEMES = [
  { id: 'grass',  name: 'Травяная', icon: '🌿', price: 0,  light: '#ead9a4', dark: '#74a944', frame: '#8b5a2b' },
  { id: 'snow',   name: 'Снежная',  icon: '❄️', price: 10, light: '#f4f8fb', dark: '#8fbfe0', frame: '#5d7f9c' },
  { id: 'desert', name: 'Пустыня',  icon: '🏜️', price: 15, light: '#f3dfa7', dark: '#d39b4a', frame: '#a8642a' },
  { id: 'ocean',  name: 'Океан',    icon: '🐠', price: 20, light: '#a8e0d4', dark: '#3f8f86', frame: '#2d5f6e' },
  { id: 'nether', name: 'Незер',    icon: '🔥', price: 30, light: '#c46a5c', dark: '#4a2a2e', frame: '#2c1418' },
  { id: 'end',    name: 'Энд',      icon: '🐉', price: 40, light: '#f1efc0', dark: '#a77ab8', frame: '#3d2a4a' }
];

THEMES.push(
  { id: 'green-hill', name: 'Зелёные холмы', icon: 'GH', price: 30, light: '#77d52c', dark: '#8a431d', frame: '#8b572f', image: 'assets/boards/reference/green-hill.png', skinPad: '22% 15% 14%' },
  { id: 'block-world', name: 'Блочный мир', icon: 'BW', price: 30, light: '#a7e84a', dark: '#62666d', frame: '#4b2d1c', image: 'assets/boards/reference/block-world.png', skinPad: '21%' },
  { id: 'pixel-castle', name: 'Кирпичный замок', icon: 'PC', price: 30, light: '#ffe0a8', dark: '#63bd3f', frame: '#9b4a17', image: 'assets/boards/reference/pixel-castle.png', skinPad: '22% 15% 14%' },
  { id: 'ice-castle', name: 'Ледяной замок', icon: 'ICE', price: 30, light: '#f4fbff', dark: '#8bd0f0', frame: '#6f9fc8', image: 'assets/boards/original/ice-castle.png', skinPad: '12%' },
  { id: 'volcanic-fortress', name: 'Огненная крепость', icon: 'VF', price: 30, light: '#ffd27a', dark: '#8d2c26', frame: '#4a1d1a', image: 'assets/boards/original/volcanic-fortress.png', skinPad: '15% 10% 10%' },
  { id: 'cosmic-station', name: 'Космическая станция', icon: 'CS', price: 30, light: '#22e8f4', dark: '#101b72', frame: '#7549b8', image: 'assets/boards/original/cosmic-station.png', skinPad: '13% 10% 10%' }
);

window.Themes = (function () {
  const owned = () => Object.assign({ grass: true }, Store.get('themes', {}));
  const previewMode = () => new URLSearchParams(location.search).get('boards') === 'test';
  const available = (id) => !!owned()[id] || previewMode();
  const current = () => {
    const id = Store.get('theme', 'grass');
    return THEMES.some((x) => x.id === id) && available(id) ? id : 'grass';
  };

  function apply(id) {
    const t = THEMES.find((x) => x.id === id) || THEMES[0];
    const root = document.documentElement.style;
    root.setProperty('--sq-light', t.light);
    root.setProperty('--sq-dark', t.dark);
    root.setProperty('--board-frame', t.frame);
    // Темы используют только поле 8×8: большие фоновые картинки намеренно
    // не показываем, чтобы доска оставалась крупной на телефоне.
    root.setProperty('--board-skin-image', 'none');
    root.setProperty('--board-skin-padding', '0');
    if (document.documentElement.dataset) document.documentElement.dataset.boardSkin = 'classic';
    if (!document.querySelectorAll) return;
    document.querySelectorAll('.board').forEach((board) => {
      board.style.backgroundImage = '';
      board.style.backgroundPosition = '';
      board.style.backgroundSize = '';
      board.style.padding = '';
      board.querySelectorAll('.sq').forEach((sq) => {
        sq.style.backgroundColor = '';
      });
    });
  }

  function choose(id) {
    if (!THEMES.some((x) => x.id === id) || !available(id)) return false;
    Store.set('theme', id);
    apply(id);
    return true;
  }

  // Купить за звёзды. Возвращает true, если получилось.
  function buy(id) {
    const t = THEMES.find((x) => x.id === id);
    if (!t || available(id) || Progress.stars < t.price) return false;
    Progress.addStars(-t.price);
    Store.set('themes', Object.assign(Store.get('themes', {}), { [id]: true }));
    choose(id);
    return true;
  }

  apply(current());
  return { owned, current, choose, buy, apply, previewMode, available };
})();

// Наборы фигур. Покупаются за ⭐ в «Моих подарках», вкладка «Фигуры».
// Картинки набора: assets/pieces/<id>/wK.png ... bP.png (нарезка — tools/cut-pieces.ps1 -Set <id>).
// Обычные фигуры лежат прямо в assets/pieces/. Если в наборе нет какой-то картинки — берётся обычная.
window.PIECE_SETS = [
  { id: 'classic', name: 'Обычные', icon: '♟️', price: 0 },
  // белые — растения, чёрные — зомби (лист: assets/pieces/source/pvz.png, нарезка tools/cut-piece-sheet.ps1)
  { id: 'pvz', name: 'Растения и зомби', icon: '🌻', price: 50 },
  // белые — герои, чёрные — демоны (лист: assets/pieces/source/dmc.png,
  // нарезка: tools/cut-piece-sheet.ps1 -Set dmc -DarkMax 34 -SatMax 30 -Close 7)
  { id: 'dmc', name: 'Devil May Cry', icon: '😈', price: 50 },
  // белые — герои, чёрные — злодеи (лист: assets/pieces/source/sonic.png,
  // нарезка: tools/cut-piece-sheet.ps1 -Set sonic -SatMax 12 -Light)
  { id: 'sonic', name: 'Соник', icon: '🦔', price: 50 },
  // белые — мама, чёрные — хлеб (лист: assets/pieces/source/bread.png,
  // нарезка: tools/cut-piece-sheet.ps1 -Set bread -SatMax 12 -Light)
  { id: 'bread', name: 'Мама против Хлеба', icon: '🥖', price: 25 },
  { id: 'spider', name: 'Паутина', icon: '🕸️', price: 0 }
];

window.PieceSets = (function () {
  const base = CONFIG.pieces.path;
  const owned = () => Object.assign({ classic: true }, Store.get('pieceSets', {}));
  const current = () => {
    const id = Store.get('pieceSet', 'classic');
    return PIECE_SETS.some((s) => s.id === id) ? id : 'classic';
  };
  const pathOf = (id) => (id === 'classic' ? base : base + id + '/');

  function apply(id) {
    const path = pathOf(id);
    CONFIG.pieces.path = path;
    // чёрные фигуры-«враги» в уроках рисуются через CSS
    const root = document.documentElement.style;
    ['bP', 'bN', 'bB', 'bR'].forEach((p) =>
      root.setProperty('--enemy-' + p, 'url("' + path + p + '.' + CONFIG.pieces.ext + '")'));
    if (window.ChessBoard) ChessBoard.reloadPieces();
  }

  function choose(id) {
    Store.set('pieceSet', id);
    apply(id);
  }

  // Купить за звёзды. Возвращает true, если получилось.
  function buy(id) {
    const s = PIECE_SETS.find((x) => x.id === id);
    if (!s || owned()[id] || Progress.stars < s.price) return false;
    Progress.addStars(-s.price);
    Store.set('pieceSets', Object.assign(Store.get('pieceSets', {}), { [id]: true }));
    choose(id);
    return true;
  }

  apply(current());
  return { base, owned, current, choose, buy, pathOf };
})();
