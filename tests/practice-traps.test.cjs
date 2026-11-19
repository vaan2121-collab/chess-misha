const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {} });
for (const file of ['vendor/chess.min.js', 'js/practice-traps.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const Chess = context.Chess;
const traps = context.window.PracticeTraps;
assert.ok(traps, 'PracticeTraps API is exported');

function play(game, move, color) {
  assert.ok(move, 'suggestion exists');
  assert.equal(move.color, color);
  const legal = game.moves({ verbose: true });
  assert.ok(legal.some((candidate) => candidate.from === move.from && candidate.to === move.to &&
    candidate.promotion === move.promotion), `${move.san} is legal`);
  return game.move(move);
}

for (const [round, expectedDone, expectedBlackMoves] of [[0, 'mate', 6], [1, 'castle', 7]]) {
  const task = traps.createTask(round);
  assert.equal(task.id, 'traps', 'parent integration mode ID is stable');
  assert.ok(task.lessonId, 'the lesson variant has its own ID');
  const game = new Chess(task.fen);
  assert.equal(game.turn(), 'w', 'task starts with White to move');
  assert.equal(game.validate_fen(task.fen).valid, true);
  assert.ok(task.lessonTitle && task.rule && task.why && task.question && task.takeaway);
  assert.ok(task.maxMoves >= 2);
  const expectedLength = task.maxMoves + expectedBlackMoves;

  for (let ply = 0; ply < expectedLength; ply++) {
    const before = game.fen();
    const move = game.turn() === 'w' ? traps.hint(game, task) : traps.reply(game, task);
    assert.equal(game.fen(), before, 'suggestion does not mutate the game');
    play(game, move, ply % 2 === 0 ? 'w' : 'b');
    const state = traps.status(game, task);
    if (ply + 1 < expectedLength) {
      assert.equal(game.game_over(), false, `position after ply ${ply + 1} is not terminal before the goal`);
      assert.equal(state.done, false);
    } else {
      assert.equal(state.done, true);
      assert.equal(state.failed, false);
      assert.equal(state.goals.length, 1);
      assert.equal(state.goals[0].id, expectedDone);
      assert.equal(state.goals[0].done, true);
    }
  }

  assert.equal(traps.hint(game, task), null);
  assert.equal(traps.reply(game, task), null);
}

assert.equal(traps.createTask(0).lessonId, 'legals-mate');
assert.equal(traps.createTask(1).lessonId, 'legals-defense');
assert.equal(traps.createTask(2).lessonId, 'legals-mate');
const mateCopy = traps.createTask(0);
assert.match(mateCopy.why, /ферз/i);
assert.match(mateCopy.why, /конь с f3 на e5/i);
assert.match(mateCopy._reasons[4], /возьмут ферзя/i, 'the trap offers the queen, not the knight');
assert.match(mateCopy._reasons[4], /слоном с g4 на d1/i);
const defenseCopy = traps.createTask(1);
assert.match(defenseCopy.lessonTitle, /разгадал план/i);
assert.doesNotMatch(defenseCopy.rule, /Nc6|e5/i, 'the opening rule does not reveal the later defense');

for (const round of [0, 1]) {
  const task = traps.createTask(round);
  const game = new Chess(task.fen);
  const wrong = game.moves({ verbose: true }).find((candidate) => {
    const san = game.moves({ verbose: true }).find((move) => move.from === candidate.from && move.to === candidate.to)?.san;
    return san !== 'e4';
  });
  assert.ok(wrong);
  assert.ok(game.move(wrong));
  const result = traps.status(game, task);
  assert.equal(result.failed, true);
  assert.equal(result.done, false);
  assert.match(result.text, /хорошим/i, 'a different legal move is not called objectively bad');
  assert.equal(traps.hint(game, task), null);
}

{
  const task = traps.createTask(0);
  const game = new Chess(task.fen);
  for (let ply = 0; ply < 8; ply++) play(game, ply % 2 === 0 ? traps.hint(game, task) : traps.reply(game, task), ply % 2 === 0 ? 'w' : 'b');
  assert.equal(game.turn(), 'w');
  assert.ok(game.moves().includes('Nxe5'));
  assert.equal(traps.hint(game, task).san, 'Nxe5');
  assert.ok(game.move('Nxe5'));
  const defended = traps.reply(game, task);
  assert.equal(defended.san, 'Bxd1', 'the trap branch uses the queen-taking blunder');
  assert.ok(game.move(defended));
  assert.equal(game.in_checkmate(), false);
}

{
  const trap = traps.createTask(0);
  const defense = traps.createTask(1);
  trap.id = 'traps';
  defense.id = 'traps';
  const trapGame = new Chess(trap.fen);
  const defenseGame = new Chess(defense.fen);
  for (let ply = 0; ply < 7; ply++) {
    play(trapGame, ply % 2 === 0 ? traps.hint(trapGame, trap) : traps.reply(trapGame, trap), ply % 2 === 0 ? 'w' : 'b');
    play(defenseGame, ply % 2 === 0 ? traps.hint(defenseGame, defense) : traps.reply(defenseGame, defense), ply % 2 === 0 ? 'w' : 'b');
  }
  assert.deepEqual(trapGame.history(), defenseGame.history(), 'both branches share the same early buildup');
  assert.equal(traps.reply(trapGame, trap).san, 'g6');
  assert.equal(traps.reply(defenseGame, defense).san, 'Nc6');
  play(trapGame, traps.reply(trapGame, trap), 'b');
  play(defenseGame, traps.reply(defenseGame, defense), 'b');
  assert.ok(traps.status(trapGame, trap).text.includes('ферзя'), 'trap line explains the queen sacrifice');
  const defenseStep = traps.status(defenseGame, defense).text;
  assert.ok(defenseStep.includes('b8 на c6') && defenseStep.includes('конём с f3') && defenseStep.includes('d2 на d3'),
    'the defense and danger are explained when White reaches that decision');
  assert.ok(traps.hint(trapGame, trap));
  assert.ok(traps.hint(defenseGame, defense));
}

console.log('PASS practice traps: legal suggestions, complete outcomes, defense branch, and deviations');
