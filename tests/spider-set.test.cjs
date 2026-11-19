const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const themesSource = fs.readFileSync(path.join(root, 'js/themes.js'), 'utf8');
const expectedFiles = ['wK', 'wQ', 'wB', 'wN', 'wR', 'wP', 'bK', 'bQ', 'bB', 'bN', 'bR', 'bP'];

function loadThemes(saved = {}) {
  const values = new Map(Object.entries(saved));
  const styles = new Map();
  let stars = 17;
  let reloads = 0;
  const config = { pieces: { path: 'assets/pieces/', ext: 'png' } };
  const context = vm.createContext({
    CONFIG: config,
    Store: {
      get(key, fallback) { return values.has(key) ? values.get(key) : fallback; },
      set(key, value) { values.set(key, value); }
    },
    Progress: {
      get stars() { return stars; },
      addStars(amount) { stars += amount; }
    },
    document: {
      documentElement: {
        style: { setProperty(name, value) { styles.set(name, value); } }
      }
    },
    ChessBoard: { reloadPieces() { reloads++; } },
    window: null
  });
  context.window = context;
  vm.runInContext(themesSource, context, { filename: 'js/themes.js' });
  return { context, config, styles, values, stars: () => stars, reloads: () => reloads };
}

const app = loadThemes();
const set = app.context.PIECE_SETS.find((item) => item.id === 'spider');
assert.ok(set, 'the spider set is registered');
assert.equal(set.name, 'Паутина');
assert.equal(set.icon, '🕸️');
assert.equal(set.price, 0);

const spiderPath = 'assets/pieces/spider/';
for (const file of expectedFiles) {
  assert.equal(app.context.PieceSets.pathOf('spider') + file + '.png', spiderPath + file + '.png');
  assert.ok(fs.existsSync(path.join(root, spiderPath, file + '.png')), file + '.png exists');
}

const startingStars = app.stars();
const initialReloads = app.reloads();
assert.equal(app.context.PieceSets.buy('spider'), true, 'an unowned free set can be bought');
assert.equal(app.stars(), startingStars, 'buying the free set does not spend stars');
assert.equal(app.context.PieceSets.current(), 'spider');
assert.equal(app.config.pieces.path, spiderPath);
assert.equal(app.values.get('pieceSet'), 'spider', 'the selected set is saved');
assert.equal(app.styles.get('--enemy-bP'), 'url("assets/pieces/spider/bP.png")');
assert.equal(app.reloads(), initialReloads + 1, 'choosing reloads the board pieces once');

const refreshed = loadThemes(Object.fromEntries(app.values));
assert.equal(refreshed.context.PieceSets.current(), 'spider', 'refresh restores the saved set');
assert.equal(refreshed.config.pieces.path, spiderPath, 'refresh applies the saved set path');

const fallback = loadThemes({ pieceSet: 'missing-set' });
assert.equal(fallback.context.PieceSets.current(), 'classic', 'unknown saved sets fall back to classic');
assert.equal(fallback.config.pieces.path, 'assets/pieces/', 'fallback restores the base image path');

console.log('PASS spider registry, twelve image paths, free purchase, persistence, and fallback');
