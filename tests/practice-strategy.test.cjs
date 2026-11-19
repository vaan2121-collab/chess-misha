const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, console });
for (const file of ['vendor/chess.min.js', 'js/practice-traps.js', 'js/practice-logic.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

const Chess = context.Chess;
const logic = context.window.PracticeLogic;
for (let round = 0; round < 5; round++) {
  const task = logic.createTask('strategy', round);
  const game = new Chess(task.fen);
  assert.equal(game.validate_fen(task.fen).valid, true);
  assert.ok(game.board().flat().filter(Boolean).length >= 20);
  const solutions = logic.solutions(task, game);
  assert.equal(solutions.length, 1);
  const move = game.move(solutions[0]);
  assert.equal(logic.judge(task, task.fen, game, move).ok, true);
}
console.log('PASS strategic missions: five full-board goals are valid and solvable');
