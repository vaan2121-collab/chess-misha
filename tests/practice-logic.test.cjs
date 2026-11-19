const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {} });
for (const name of ['vendor/chess.min.js', 'js/practice-traps.js', 'js/practice-logic.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, { filename: name });
}
const Chess = context.Chess;
const logic = context.window.PracticeLogic;
let checks = 0;
function check(name, run) {
  run();
  checks++;
  console.log('PASS ' + name);
}

for (const id of ['rescue', 'capture']) {
  for (let round = 0; round < (id === 'rescue' ? 8 : 6); round++) {
    check(id + ' example ' + round + ': valid, solvable and immutable', () => {
      const task = logic.createTask(id, round);
      const game = new Chess(task.fen);
      assert.equal(game.validate_fen(task.fen).valid, true);
      assert.equal(game.in_check(), false);
      const kings = game.board().flat().filter((p) => p && p.type === 'k');
      assert.equal(kings.length, 2);
      if (id === 'rescue') {
        const pieces = game.board().flat().filter(Boolean);
        assert.equal(pieces.filter((p) => p.color === 'w').length, 6);
        assert.equal(pieces.filter((p) => p.color === 'b').length, 10);
        const black = new Chess(task.fen.replace(' w ', ' b '));
        const attackers = black.moves({ verbose: true }).filter((m) => m.captured && m.to === task.focus);
        assert.ok(attackers.length >= 2);
        assert.ok(logic.threat(game, task.focus), 'the target must actually face a material loss');
      }
      const solutions = logic.solutions(task, game);
      assert.ok(solutions.length > 0);
      assert.equal(game.fen(), task.fen);
      for (const solution of solutions) {
        const after = new Chess(task.fen);
        const move = after.move(solution);
        assert.ok(move);
        assert.equal(logic.judge(task, task.fen, after, move).ok, true);
      }
    });
  }
}

check('a defended capture demonstrates the actual legal recapture', () => {
  const task = logic.createTask('capture', 0);
  const game = new Chess(task.fen);
  const move = game.move('Rxb5');
  const result = logic.judge(task, task.fen, game, move);
  assert.equal(result.ok, false);
  assert.equal(result.consequence.san, 'cxb5');
  assert.ok(game.move(result.consequence));
  assert.equal(game.get('b5').color, 'b');
});

check('ignoring a threat is not a rescue', () => {
  const task = logic.createTask('rescue', 0);
  const game = new Chess(task.fen);
  const move = game.move('Ra3');
  assert.ok(move);
  const result = logic.judge(task, task.fen, game, move);
  assert.equal(result.ok, false);
  assert.ok(result.consequence);
});

check('rescue examples include multiple attackers on the target', () => {
  const task = logic.createTask('rescue', 1);
  const game = new Chess(task.fen.replace(' w ', ' b '));
  const attackers = game.moves({ verbose: true }).filter((move) => {
    const after = new Chess(task.fen);
    after.move(move);
    return move.captured && move.to === task.focus;
  });
  assert.ok(attackers.length >= 2);
});

check('a fair pawn exchange is not called a material loss', () => {
  const game = new Chess();
  for (const move of ['e4', 'd5', 'Nc3']) assert.ok(game.move(move));
  assert.equal(logic.threat(game, 'e4'), null);
});

check('a pinned attacker cannot be used in a demonstration', () => {
  const game = new Chess('4k3/4b3/8/8/7N/8/8/K3R3 w - - 0 1');
  assert.equal(logic.threat(game, 'h4'), null);
});

check('en passant threats identify the real victim square', () => {
  const game = new Chess('7k/8/8/8/3pP3/8/8/7K b - e3 0 1');
  const reply = logic.threat(game, 'e4');
  assert.equal(reply.from, 'd4');
  assert.equal(reply.to, 'e3');
  assert.equal(game.move(reply).flags.includes('e'), true);
});

check('free material may be taken by any legal saving move', () => {
  const task = logic.createTask('rescue', 1);
  const game = new Chess(task.fen);
  const move = logic.solutions(task, game)[0];
  assert.ok(move);
  game.move(move);
  assert.equal(logic.judge(task, task.fen, game, move).ok, true);
});

check('saving a piece by hanging a safe queen is not rewarded', () => {
  const game = new Chess('4r2k/8/8/8/8/Q7/4N3/7K w - - 0 1');
  const before = game.fen();
  const move = game.move('Qe3');
  assert.ok(move);
  const result = logic.judge({ id: 'rescue', focus: 'e2' }, before, game, move);
  assert.equal(result.ok, false);
  assert.equal(result.consequence.to, 'e3');
});

check('the opening goal starts empty and is achievable against replies', () => {
  const game = new Chess();
  assert.equal(logic.openingStatus(game).goals.some((g) => g.done), false);
  let done = false;
  for (let n = 0; n < 8; n++) {
    const fen = game.fen();
    const move = logic.openingHint(game);
    assert.ok(move);
    assert.equal(game.fen(), fen);
    assert.ok(game.move(move));
    const beforeReply = game.fen();
    const reply = logic.reply(game);
    assert.equal(game.fen(), beforeReply);
    assert.ok(reply);
    assert.ok(game.move(reply));
    done = logic.openingStatus(game).done;
    if (done) break;
  }
  assert.equal(done, true);
});

check('returning a knight home removes its opening goal', () => {
  const game = new Chess();
  for (const move of ['Nc3', 'd5', 'Nb1', 'e5']) assert.ok(game.move(move));
  assert.equal(logic.openingStatus(game).goals.find((g) => g.id === 'knight').done, false);
});

check('an attacked developed piece is not counted as safe development', () => {
  const game = new Chess('r6k/8/8/8/B3P3/5N2/8/7K w - - 0 1');
  assert.equal(logic.openingStatus(game).goals.find((g) => g.id === 'bishop').done, false);
});

check('mate or stalemate is never mistaken for an opening goal', () => {
  const game = new Chess();
  for (const move of ['f3', 'e5', 'g4', 'Qh4#']) assert.ok(game.move(move));
  assert.equal(logic.openingStatus(game).done, false);
  assert.equal(logic.reply(game), null);
});

check('all exposed move suggestions remain legal through a longer game', () => {
  const game = new Chess();
  for (let n = 0; n < 30 && !game.game_over(); n++) {
    const fen = game.fen();
    const move = game.turn() === 'w' ? logic.openingHint(game) : logic.reply(game);
    assert.ok(move);
    assert.equal(game.fen(), fen);
    assert.ok(game.move(move));
  }
});

check('unknown mode IDs are rejected', () => assert.equal(logic.createTask('unknown', 0), null));

check('center can be controlled from a distance without a central pawn', () => {
  const game = new Chess();
  for (const move of ['Nf3', 'g6', 'g3', 'Bg7', 'Bg2', 'd6']) assert.ok(game.move(move));
  const status = logic.openingStatus(game, logic.createTask('center', 0));
  assert.ok(status.controlled.includes('d4') && status.controlled.includes('e5'));
  assert.equal(status.done, true);
  assert.ok(['d4', 'e4', 'd5', 'e5'].every((square) => !game.get(square)));
});

check('attack geometry respects pawn direction, blockers and friendly defense', () => {
  const game = new Chess('7k/8/8/8/3P4/2B5/8/4K3 w - - 0 1');
  assert.equal(logic.attacks(game, 'd4', 'e5'), true);
  assert.equal(logic.attacks(game, 'd4', 'e3'), false);
  assert.equal(logic.attacks(game, 'd4', 'd5'), false);
  assert.equal(logic.attacks(game, 'c3', 'd4'), true);
  assert.equal(logic.attacks(game, 'c3', 'e5'), false);
});

for (const id of ['center', 'development']) {
  for (const round of [0, 1]) check(id + ' is achievable against bot style ' + round, () => {
    const task = logic.createTask(id, round), game = new Chess(task.fen);
    for (let n = 0; n < task.maxMoves && !logic.openingStatus(game, task).done; n++) {
      const fen = game.fen();
      assert.ok(game.move(logic.openingHint(game, task)));
      assert.notEqual(game.fen(), fen);
      assert.ok(game.move(logic.reply(game, task)));
    }
    assert.equal(logic.openingStatus(game, task).done, true);
    if (id === 'development') assert.ok(game.history({ verbose: true }).some((move) => move.color === 'w' && /[kq]/.test(move.flags)));
  });
}

check('merely moving the king near a rook does not count as castling', () => {
  const game = new Chess('7k/8/8/8/8/3B1N2/8/5RK1 w - - 0 1');
  assert.equal(logic.openingStatus(game, logic.createTask('development', 0)).goals.find((goal) => goal.id === 'castle').done, false);
});

for (let round = 0; round < 3; round++) check('watch scenario ' + round + ' shows a real threat and is solvable', () => {
  const task = logic.createTask('watch', round), game = new Chess(task.beforeFen);
  assert.ok(game.move(task.lastMove));
  assert.equal(game.fen(), task.fen);
  const targets = logic.threatened(game);
  assert.ok(targets.length > 0);
  for (const focus of targets) assert.ok(logic.solutions(Object.assign({}, task, { focus }), game).length > 0);
});

for (let round = 0; round < 2; round++) check('trap integration preserves lesson outcome ' + round, () => {
  const task = logic.createTask('traps', round), game = new Chess(task.fen);
  for (let n = 0; n < task.maxMoves && !logic.openingStatus(game, task).done; n++) {
    assert.ok(game.move(logic.openingHint(game, task)));
    if (logic.openingStatus(game, task).done) break;
    assert.ok(game.move(logic.reply(game, task)));
  }
  assert.equal(logic.openingStatus(game, task).done, true);
});
console.log(checks + ' practice checks passed.');
