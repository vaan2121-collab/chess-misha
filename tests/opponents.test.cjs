const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, console });
for (const file of ['vendor/chess.min.js', 'js/ai.js', 'js/opponents.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

const opponents = context.window.OPPONENTS;
const ai = context.window.ChessAI;
assert.equal(opponents.length, 10);
assert.equal(JSON.stringify(opponents.slice(-5).map((o) => o.level)), JSON.stringify([6, 7, 8, 9, 10]));
assert.equal(opponents.at(-1).id, 'mundus');
assert.equal(new Set(opponents.map((o) => o.id)).size, opponents.length);
for (const opponent of opponents.slice(-5)) {
  const folder = path.join(root, 'assets', 'opponents', opponent.id);
  assert.ok(fs.existsSync(path.join(folder, 'hello1.mp3')));
  assert.ok(fs.existsSync(path.join(folder, 'check1.mp3')));
  assert.ok(fs.existsSync(path.join(folder, 'lost1.mp3')));
  assert.ok(fs.existsSync(path.join(folder, 'lose1.mp3')));
  for (const face of ['normal.png', 'think.png', 'check.png', 'happy.png', 'sad.png', 'win.png', 'lose.png']) {
    assert.ok(fs.existsSync(path.join(folder, face)), `${opponent.id}/${face} exists`);
  }
}
const game = new context.Chess();
for (const level of [6, 7, 8, 9, 10]) assert.ok(ai.choose(game, level));
console.log('PASS five stronger opponents, audio folders, and AI levels 6–10');
