const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(ids.length, new Set(ids).size, 'HTML IDs must be unique');

class Element {
  constructor() {
    this.hidden = false;
    this.handlers = {};
    this.children = [];
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  set innerHTML(value) { this.html = value; this.children = []; }
  get innerHTML() { return this.html || ''; }
  appendChild(child) { this.children.push(child); }
  addEventListener(type, handler) { this.handlers[type] = handler; }
  click() { this.handlers.click?.({}); }
}

const elements = new Map(ids.map((id) => [id, new Element()]));
for (const selector of ['.wallet', '.menu', '#rank-up', '#rank-up-badge', '#rank-up-name']) {
  elements.set(selector, new Element());
}
const get = (selector) => elements.get(selector.startsWith('#') ? selector.slice(1) : selector) || null;
const screenEls = [...ids.filter((id) => id.startsWith('screen-'))].map((id) => {
  const element = elements.get(id);
  element.id = id;
  return element;
});
const listeners = {};
const location = { pathname: '/', search: '', hash: '#train' };
const context = vm.createContext({
  console,
  document: {
    querySelector: get,
    querySelectorAll(selector) {
      if (selector === '.screen') return screenEls;
      return [];
    },
    createElement: () => new Element(),
    addEventListener() {}
  },
  window: null,
  location,
  history: { replaceState(_state, _title, url) { location.hash = url.slice(url.indexOf('#')); } },
  addEventListener(type, handler) { listeners[type] = handler; },
  setTimeout() { return 1; },
  clearTimeout() {},
  CONFIG: { voices: {}, pieces: { path: 'pieces/', ext: 'png' }, musicEnabled: false },
  Sound: { musicOn: false, sfxOn: true, play() {}, voice() {}, stopVoice() {}, unlock() {}, toggleMusic() {}, toggleSfx() {} },
  Progress: {
    stars: 0, xp: 0, rank: { name: 'Новичок', piece: 'wP' }, nextRank: null,
    onChange() {}, onRankUp() {}, solvedIn() { return 0; }, addSolved() {}, addXP() {},
    get chest() { return 0; }, set chest(_value) {}, addStars() {}
  },
  Store: { get(_key, fallback) { return fallback; }, set() {} },
  FX: { confetti() {} },
  ParentsScreen: { enter() {}, offerRestore() {} },
  GiftsScreen: { enter() {} },
  PlayScreen: { enter() {}, leave() {} },
  PracticeScreen: { enter() {}, leave() {} },
  TRAIN: { modules: [] },
  PUZZLE_SETS: { eat: [] },
  PuzzleGen: {
    capture() { return { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', goal: 'capture', target: 'e7' }; },
    isSolved() { return false; }
  },
  ChessBoard: {
    create(_el, options) {
      return {
        setPlayerColor() {}, setOrientation() {}, setGame(game) { this.game = game; },
        setInteractive() {}, setMarks() {}, setArrows() {}, setLastMove() {}, select() {},
        squareEl() { return { classList: { add() {}, remove() {} } }; }
      };
    }
  }
});
context.window = context;
vm.runInContext(fs.readFileSync(path.join(root, 'vendor/chess.min.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'js/puzzles.js'), 'utf8'), context, { filename: 'js/puzzles.js' });
let trainEnterCalls = 0;
context.TrainScreen = {
  enter(param) {
    trainEnterCalls++;
    if (!param) context.PuzzlesScreen.renderList();
  },
  leave() {}
};
vm.runInContext(fs.readFileSync(path.join(root, 'js/app.js'), 'utf8'), context, { filename: 'js/app.js' });

const navigate = (hash) => {
  location.hash = '#' + hash;
  listeners.hashchange();
};
const list = get('#puzzle-list');
assert.equal(trainEnterCalls, 1);
assert.equal(list.hidden, false);
assert.equal(list.children.length, 7, 'training map starts with all seven puzzle worlds');

navigate('puzzles/eat');
assert.equal(get('#screen-puzzles').hidden, false);
assert.equal(list.hidden, true, 'world list hides while an exercise is open');
assert.ok(context.PuzzlesScreen.current().puzzle, 'the selected world starts a real exercise');

get('#btn-back').click();
assert.equal(location.hash, 'train');
navigate('train');
assert.equal(get('#screen-train').hidden, false);
assert.equal(get('#screen-puzzles').hidden, true);
assert.equal(list.hidden, false, 'returning from an exercise restores the world list');
assert.equal(list.children.length, 7);
assert.equal(context.PuzzlesScreen.current().puzzle, null, 'leaving discards the old exercise');
console.log('PASS #train → #puzzles/eat → #train restores the seven visible puzzle worlds');

for (const oldLink of ['puzzles', 'learn', 'learn/r']) {
  navigate(oldLink);
  assert.equal(location.hash, '#train');
  assert.equal(get('#screen-train').hidden, false);
  assert.equal(list.hidden, false);
}
console.log('PASS legacy puzzle and piece lesson links lead to the combined training map');

context.TRAIN.modules = [{ id: 'm1', levels: [{ id: '1_1' }] }];
navigate('train/1_1');
get('#btn-back').click();
assert.equal(location.hash, 'train/m1');
navigate('train/m1');
get('#btn-back').click();
assert.equal(location.hash, 'train');
navigate('train');
get('#btn-back').click();
assert.equal(location.hash, 'menu');
console.log('PASS Back returns from a lesson to its island, then map, then menu');
