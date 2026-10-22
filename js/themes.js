// Темы доски в стиле Minecraft. Покупаются за ⭐ в «Моих подарках», вкладка «Доски».
window.THEMES = [
  { id: 'grass',  name: 'Травяная', icon: '🌿', price: 0,  light: '#ead9a4', dark: '#74a944', frame: '#8b5a2b' },
  { id: 'snow',   name: 'Снежная',  icon: '❄️', price: 10, light: '#f4f8fb', dark: '#8fbfe0', frame: '#5d7f9c' },
  { id: 'desert', name: 'Пустыня',  icon: '🏜️', price: 15, light: '#f3dfa7', dark: '#d39b4a', frame: '#a8642a' },
  { id: 'ocean',  name: 'Океан',    icon: '🐠', price: 20, light: '#a8e0d4', dark: '#3f8f86', frame: '#2d5f6e' },
  { id: 'nether', name: 'Незер',    icon: '🔥', price: 30, light: '#c46a5c', dark: '#4a2a2e', frame: '#2c1418' },
  { id: 'end',    name: 'Энд',      icon: '🐉', price: 40, light: '#f1efc0', dark: '#a77ab8', frame: '#3d2a4a' }
];

window.Themes = (function () {
  const owned = () => Object.assign({ grass: true }, Store.get('themes', {}));
  const current = () => Store.get('theme', 'grass');

  function apply(id) {
    const t = THEMES.find((x) => x.id === id) || THEMES[0];
    const root = document.documentElement.style;
    root.setProperty('--sq-light', t.light);
    root.setProperty('--sq-dark', t.dark);
    root.setProperty('--board-frame', t.frame);
  }

  function choose(id) {
    Store.set('theme', id);
    apply(id);
  }

  // Купить за звёзды. Возвращает true, если получилось.
  function buy(id) {
    const t = THEMES.find((x) => x.id === id);
    if (!t || owned()[id] || Progress.stars < t.price) return false;
    Progress.addStars(-t.price);
    Store.set('themes', Object.assign(Store.get('themes', {}), { [id]: true }));
    choose(id);
    return true;
  }

  apply(current());
  return { owned, current, choose, buy, apply };
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
  { id: 'sonic', name: 'Соник', icon: '🦔', price: 50 }
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
