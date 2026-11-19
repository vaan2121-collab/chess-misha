const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
assert.equal(ids.length, new Set(ids).size, 'HTML IDs must be unique');

class Element {
  constructor() {
    this.handlers = {};
    this.children = [];
    this.dataset = {};
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  set innerHTML(value) { this.html = value; this.children = []; }
  get innerHTML() { return this.html || ''; }
  append(...items) { this.children.push(...items); }
  appendChild(item) { this.children.push(item); }
  setAttribute() {}
  querySelector() { return new Element(); }
  querySelectorAll() { return []; }
  addEventListener(type, handler) { this.handlers[type] = handler; }
  click() { this.handlers.click && this.handlers.click({}); }
}
const elements = new Map(ids.map((id) => [id, new Element()]));
const get = (id) => elements.get(id) || null;
const timers = [];
const memory = new Map();
const voiceCalls = [], syntheticCalls = [];
let board;
let boardOptions;
const context = vm.createContext({
  document: { getElementById: get, createElement: () => new Element() },
  location: { hash: '' },
  localStorage: {
    getItem: (key) => memory.has(key) ? memory.get(key) : null,
    setItem: (key, value) => memory.set(key, value),
    get length() { return memory.size; },
    key: (index) => [...memory.keys()][index]
  },
  Sound: { sfxOn: true, stopVoice() {}, play() {}, voice(queue) { voiceCalls.push(queue); } },
  speechSynthesis: { cancel() {}, speak(utterance) { syntheticCalls.push(utterance.text); } },
  SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
  setTimeout: (fn) => { timers.push(fn); return timers.length; },
  clearTimeout() {},
  ChessBoard: {
    create(el, opts) {
      boardOptions = opts;
      board = {
        game: opts.game, arrows: [], interactive: true,
        setGame(game) { this.game = game; },
        setInteractive(on) { this.interactive = on; },
        setPlayerColor() {}, setOrientation() {}, setShowTargets() {}, setMarks() {},
        setArrows(arrows) { this.arrows = arrows; },
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
for (const file of ['vendor/chess.min.js', 'js/storage.js', 'js/practice-traps.js', 'js/practice-logic.js', 'js/practice-voice.js', 'js/practice.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const screen = context.PracticeScreen;
const logic = context.PracticeLogic;
const flush = () => { while (timers.length) timers.shift()(); };
function enter(id) {
  screen.enter(id);
  assert.equal(screen.current().phase, 'intro');
  assert.equal(board.interactive, false);
  assert.ok(get('practice-intro-why').textContent);
  get('practice-intro-listen').click();
  get('practice-begin').click();
}
function solve() {
  const state = screen.current();
  const move = logic.solutions(state.task, state.game)[0];
  assert.ok(move);
  assert.ok(board.makeMove(move.from, move.to, move.promotion));
}

enter('capture');
get('practice-hint').click();
assert.equal(screen.current().assisted, true);
solve();
assert.equal(screen.current().phase, 'solved');
assert.equal(context.Store.get('practice:capture:assisted'), 1);
assert.equal(context.Store.get('practice:capture:independent', 0), 0);
const firstFen = screen.current().task.fen;
get('practice-next').click();
assert.notEqual(screen.current().task.fen, firstFen);
assert.equal(screen.current().assisted, false);
solve(); get('practice-next').click(); solve(); get('practice-next').click();
assert.equal(screen.current().phase, 'done');
assert.equal(get('practice-result-count').textContent, 'Сам: 2 · Вместе: 1');
const xp = context.Progress.xp;
get('practice-next').click();
assert.equal(context.Progress.xp, xp);
console.log('PASS assisted solutions differ from independent ones; session rewards cannot repeat');

enter('capture');
let state = screen.current();
const originalFen = state.task.fen;
const wrong = state.game.moves({ verbose: true }).find((move) => {
  const after = new context.Chess(state.game.fen());
  after.move(move);
  const result = logic.judge(state.task, state.game.fen(), after, move);
  return !result.ok && result.consequence;
});
assert.ok(wrong);
const after = new context.Chess(state.game.fen()); after.move(wrong);
const consequence = logic.judge(state.task, state.game.fen(), after, wrong).consequence;
board.makeMove(wrong.from, wrong.to, wrong.promotion);
assert.equal(screen.current().phase, 'quiz');
function quizTap(square) {
  const cell = { dataset: { square }, closest() { return this; } };
  get('practice-board').handlers.pointerdown({ target: cell, preventDefault() {}, stopPropagation() {} });
}
quizTap('a1' === consequence.from ? 'h1' : 'a1');
assert.equal(screen.current().phase, 'quiz');
assert.ok(board.arrows.length > 0);
quizTap(consequence.from);
assert.equal(screen.current().phase, 'retry');
get('practice-retry').click();
assert.equal(screen.current().game.fen(), originalFen);
assert.equal(screen.current().assisted, true);
solve();
assert.equal(screen.current().phase, 'solved');
console.log('PASS mistakes show a real reply and retry preserves assisted status');

enter('rescue');
boardOptions.onIllegal('a1', 'a8');
assert.equal(screen.current().assisted, true);
console.log('PASS illegal attempts cannot count as independent solutions');

enter('center');
const openingXp = context.Progress.xp;
for (let n = 0; n < 8 && screen.current().phase !== 'done'; n++) {
  const move = logic.openingHint(screen.current().game);
  board.makeMove(move.from, move.to, move.promotion);
  assert.equal(screen.current().phase, 'bot');
  flush();
}
assert.equal(screen.current().phase, 'done');
assert.equal(logic.openingStatus(screen.current().game).done, true);
assert.ok(context.Progress.xp > openingXp);
console.log('PASS the opening checks its goal after an actual opponent reply');

enter('center');
const move = logic.openingHint(screen.current().game);
board.makeMove(move.from, move.to, move.promotion);
screen.leave();
const leftFen = screen.current().game.fen();
flush();
assert.equal(screen.current().phase, 'left');
assert.equal(screen.current().game.fen(), leftFen);
assert.equal(board.interactive, false);
console.log('PASS leaving cancels pending practice robot moves');
for (const id of ['center', 'development', 'traps']) {
  for (let variant = 0; variant < 2; variant++) {
    enter(id);
    for (let n = 0; n < (screen.current().task.maxMoves || 8) && screen.current().phase !== 'done'; n++) {
      const state = screen.current();
      const move = logic.openingHint(state.game, state.task);
      assert.ok(move, id + ' offers a legal plan');
      board.makeMove(move.from, move.to, move.promotion);
      flush();
    }
    const state = screen.current();
    assert.equal(state.phase, 'done');
    assert.equal(logic.openingStatus(state.game, state.task).done, true, id + ' completes its actual objective');
  }
}
console.log('PASS center, development and trap variants complete through the real screen lifecycle');

enter('traps');
const replayLesson = screen.current().task.lessonId;
get('practice-restart').click();
assert.equal(screen.current().phase, 'intro');
assert.equal(screen.current().task.lessonId, replayLesson);
get('practice-begin').click();
for (let n = 0; n < 10 && screen.current().phase !== 'done'; n++) {
  const state = screen.current(), move = logic.openingHint(state.game, state.task);
  board.makeMove(move.from, move.to, move.promotion); flush();
}
assert.equal(get('practice-result-next').hidden, false);
get('practice-result-next').click();
assert.notEqual(screen.current().task.lessonId, replayLesson);
get('practice-begin').click();
const trapState = screen.current();
const expected = logic.openingHint(trapState.game, trapState.task);
const offPlan = trapState.game.moves({ verbose: true }).find((move) => move.san !== expected.san);
board.makeMove(offPlan.from, offPlan.to, offPlan.promotion);
assert.equal(screen.current().phase, 'done');
assert.match(get('practice-result-text').textContent, /другой законный ход может быть хорошим/);
console.log('PASS replay preserves the lesson, another answer changes it, and off-plan play is explained');

for (let variant = 0; variant < 3; variant++) {
  enter('watch');
  assert.equal(screen.current().phase, 'observe');
  flush();
  assert.equal(screen.current().phase, 'find');
  const targets = logic.threatened(screen.current().game);
  assert.ok(targets.length);
  get('practice-hint').click(); get('practice-hint').click();
  assert.ok(board.arrows.length);
  quizTap(targets[0]);
  assert.equal(screen.current().phase, 'ready');
  assert.equal(board.arrows.length, 0);
  solve();
  assert.equal(screen.current().phase, 'solved');
  assert.equal(get('practice-feedback').hidden, false);
}
enter('watch'); screen.leave(); flush();
assert.equal(screen.current().phase, 'left');
assert.equal(get('practice-intro').hidden, true);
console.log('PASS observation requires identifying the threatened piece and allows a legal rescue');
assert.deepEqual(syntheticCalls, [], 'all exercised lessons must use the recorded voice');
assert.ok(voiceCalls.some((queue) => queue.some(([clip]) => clip.includes('/v2/'))));
assert.ok(voiceCalls.some((queue) => queue.some(([clip]) => clip.includes('/squares/'))));
for (const queue of voiceCalls) for (const [clip] of queue) assert.ok(fs.existsSync(path.join(root, clip + '.mp3')), clip + ' must exist');
const mutedCalls = voiceCalls.length;
context.Sound.sfxOn = false;
enter('capture'); get('practice-listen').click();
assert.equal(voiceCalls.length, mutedCalls, 'muting suppresses all recorded clips');
console.log('PASS intros, lessons, coordinate prompts and feedback use recordings; mute is respected');
console.log('9 practice screen checks passed.');
