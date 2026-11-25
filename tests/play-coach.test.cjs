const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

// Minimal UI adapter: exercise the real controller with chess.js and controlled timers.
const elements = new Map();
class Element {
  constructor() {
    this.hidden = false;
    this.disabled = false;
    this.handlers = {};
    this.children = new Map();
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  set innerHTML(html) {
    this.html = html;
    for (const match of html.matchAll(/id="([^"]+)"/g)) elements.set(match[1], new Element());
  }
  get innerHTML() { return this.html || ''; }
  querySelector(selector) {
    if (selector.startsWith('#')) return get(selector.slice(1));
    if (!this.children.has(selector)) this.children.set(selector, new Element());
    return this.children.get(selector);
  }
  querySelectorAll() { return []; }
  appendChild() {}
  addEventListener(type, handler) { this.handlers[type] = handler; }
  click() { if (!this.disabled && this.handlers.click) this.handlers.click({}); }
}
function get(id) {
  if (!elements.has(id)) elements.set(id, new Element());
  return elements.get(id);
}
const timers = [];
const memory = new Map();
let board;
const context = vm.createContext({
  console,
  document: {
    querySelector: (selector) => get(selector.slice(1)),
    createElement: () => new Element()
  },
  localStorage: {
    getItem: (key) => memory.has(key) ? memory.get(key) : null,
    setItem: (key, value) => memory.set(key, value),
    get length() { return memory.size; },
    key: (index) => [...memory.keys()][index]
  },
  location: { hash: '' },
  Image: class {},
  Sound: { sfxOn: false, play() {}, voice() {}, stopVoice() {} },
  FX: { confetti() {} },
  CONFIG: { voices: {} },
  Stickers: { unlockSecretFor() { return null; } },
  setTimeout: (fn) => { timers.push(fn); return timers.length; },
  clearTimeout() {},
  ChessBoard: {
    create(el, opts) {
      board = {
        game: opts.game, interactive: true,
        setGame(game) { this.game = game; },
        setInteractive(on) { this.interactive = on; },
        setPlayerColor() {}, setOrientation() {}, setMarks() {}, setArrows() {}, setLastMove() {}, select() {},
        isBusy() { return false; },
        makeMove(from, to, promotion) {
          const move = this.game.move({ from, to, promotion: promotion || 'q' });
          if (move) opts.onMove(move);
          return move;
        }
      };
      return board;
    }
  }
});
context.window = context;
for (const file of ['vendor/chess.min.js', 'js/storage.js', 'js/opponents.js', 'js/practice-logic.js', 'js/play.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const play = context.PlayScreen;
const fen = '7k/8/8/8/8/8/6r1/4Q2K w - - 0 1';
function mistake() {
  play.enter('lenya');
  play.current().game.load(fen);
  assert.ok(board.makeMove('e1', 'e2'));
  assert.equal(play.current().review, null);
  assert.equal(board.interactive, false);
  assert.equal(play.current().thinking, true);
}

assert.equal(context.Progress.winsOver('lenya'), 0);
console.log('PASS games against characters are not intercepted by the coach');

mistake();
assert.equal(play.current().game.turn(), 'b');
assert.equal(play.current().review, null);
assert.equal(play.current().thinking, true);
play.leave();
const savedFen = play.current().game.fen();
while (timers.length) timers.shift()();
assert.equal(play.current().game.fen(), savedFen);
assert.equal(play.current().thinking, false);
assert.equal(get('game-over').hidden, true);
console.log('PASS leaving during a pending robot turn cancels stale callbacks');

play.enter('duo');
play.current().game.load(fen);
board.makeMove('e1', 'e2');
assert.equal(play.current().review, null);
assert.equal(play.current().thinking, false);
console.log('PASS two-player games are not intercepted by the robot coach');
console.log('3 play coach checks passed.');
