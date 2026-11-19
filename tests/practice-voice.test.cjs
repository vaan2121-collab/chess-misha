'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/voice/coach/practice/v2/manifest.json'), 'utf8'));
const resolverSource = fs.readFileSync(path.join(root, 'js/practice-voice.js'), 'utf8');
const speechState = { voiceCalls: 0, synthesisCalls: 0 };
const window = { Sound: { voice() { speechState.voiceCalls++; } }, speechSynthesis: { speak() { speechState.synthesisCalls++; } } };
vm.runInNewContext(resolverSource, { window });
const resolve = window.PracticeVoice.resolve;
const v2 = (file) => 'assets/voice/coach/practice/v2/' + file.replace(/\.mp3$/i, '');
const legacy = [["Найди, кто нападает. Уйди, закройся или забери обидчика.","threat_rule"],["В этой игре ищем взятие, после которого нашу фигуру не заберут.","trade_rule"],["Так не ходят. Попробуй другой ход.","illegal_move"],["Вот кто мог забрать! Теперь попробуй ещё раз.","threat_shown"],["Спасли! Теперь эту фигуру не забрать без потерь.","saved_ok"],["Фигура ещё в опасности. Найди, кто может её забрать.","still_danger"],["Попробуем спасти фигуру и продолжить игру.","try_save"],["Забрали! А нашу фигуру в ответ не съесть.","capture_ok"],["Забрали фигуру, но нашу тоже могут съесть. Найди обидчика.","capture_risky"],["Поищи взятие. Кого можно забрать без ответного взятия?","find_capture"],["Посмотри на красную стрелку. Кто нападает?","quiz_arrow"],["Ищи фигуру соперника, которая нападает.","quiz_find"],["Фигура идёт по стрелке и забирает. Попробуем ещё?","quiz_demo"],["Какой ход поможет цели?","hint_goal"],["Попробуй сходить по стрелке.","hint_arrow"],["Подумай, какой ход поможет цели.","hint_think"],["Позиция уже изменилась. Попробуем снова.","position_changed"],["Сначала твой ход.","your_move"]];
const legacyPath = (key) => 'assets/voice/coach/practice/' + key;
const byFile = (file) => {
  const item = manifest.items.find((entry) => entry.file === file);
  assert.ok(item, 'manifest has ' + file);
  return v2(item.file);
};
const expectClips = (text, clips) => assert.equal(JSON.stringify(resolve(text)), JSON.stringify(clips), text);

// Every recorded v2 phrase and coordinate resolves to its exact clip.
for (const item of manifest.items) {
  expectClips(item.text, [v2(item.file)]);
  assert.ok(fs.existsSync(path.join(root, 'assets/voice/coach/practice/v2', item.file)), item.file + ' exists');
}
assert.equal(manifest.mainCount, 88);
assert.equal(manifest.coordinateCount, 64);

// Keep the live legacy sentences that still have no v2 recording, including the five piece responses.
for (const [text, key] of legacy) {
  expectClips(text, [legacyPath(key)]);
  assert.ok(fs.existsSync(path.join(root, legacyPath(key) + '.mp3')), key + ' legacy audio exists');
}
for (const [piece, key] of Object.entries({ pawn: 'taken_by_pawn', knight: 'taken_by_knight', bishop: 'taken_by_bishop', rook: 'taken_by_rook', queen: 'taken_by_queen' })) {
  const russian = { pawn: 'пешка', knight: 'конь', bishop: 'слон', rook: 'ладья', queen: 'ферзь' }[piece];
  const text = 'Да! ' + russian + ' забирает нашу фигуру.';
  expectClips(text, [legacyPath(key)]);
  assert.ok(fs.existsSync(path.join(root, legacyPath(key) + '.mp3')), key + ' legacy audio exists');
}

// Intro and result compositions for each regular mode and both trap lessons.
const groups = new Map();
for (const item of manifest.items) {
  const match = item.source.match(/MODES\.([a-z_]+)\.(why|goal|question|takeaway)$/);
  if (match) {
    const group = groups.get(match[1]) || {};
    group[match[2]] = item;
    groups.set(match[1], group);
  }
}
for (const [mode, group] of groups) {
  if (group.why && group.goal && group.question) {
    expectClips(group.why.text + ' ' + group.goal.text + ' ' + group.question.text,
      [v2(group.why.file), v2(group.goal.file), v2(group.question.file)]);
  }
  if (group.takeaway) expectClips(group.takeaway.text, [v2(group.takeaway.file)]);
}
for (const prefix of ['legals-mate', 'legals-defense']) {
  const group = {};
  for (const item of manifest.items) {
    if (item.source.startsWith('js/practice-traps.js: ' + prefix + '.')) {
      const key = item.source.slice(item.source.lastIndexOf('.') + 1);
      if (['why', 'goal', 'question', 'takeaway', 'success'].includes(key)) group[key] = item;
    }
  }
  const goal = manifest.items.find((item) => item.file === 'traps_goal.mp3');
  expectClips(group.why.text + ' ' + goal.text + ' ' + group.question.text,
    [v2(group.why.file), v2(goal.file), v2(group.question.file)]);
  expectClips(group.success.text + ' ' + group.takeaway.text, [v2(group.success.file), v2(group.takeaway.file)]);
}

// Every board square is resolvable in each of the screen's square-based speech formats.
const squares = manifest.items.filter((item) => item.file.startsWith('squares/'));
const part = (name) => byFile(name + '.mp3');
for (const square of squares) {
  const sq = square.text;
  const sqPath = v2(square.file);
  expectClips('Спаси фигуру на ' + sq + '. Найди, кто нападает. Уйди, закройся или забери обидчика.',
    [part('part_rescue_on'), sqPath, legacyPath('threat_rule')]);
  expectClips('Чёрные сходили с ' + sq + ' на ' + sq + '. Какая твоя фигура теперь в опасности? Нажми на неё.',
    [part('part_black_from'), sqPath, part('part_to'), sqPath, part('part_watch_find')]);
  expectClips('Соперник забрал фигуру на ' + sq + '. Береги остальные!',
    [part('part_enemy_took_on'), sqPath, part('part_keep_others')]);
  expectClips('Фигура на ' + sq + ' под ударом. Береги её!',
    [part('part_piece_on'), sqPath, part('part_under_attack')]);
  expectClips('Верно! Фигура на ' + sq + ' под ударом. Теперь спаси её: уйди, защити или убери нападающего.',
    [part('part_watch_correct_on'), sqPath, part('part_watch_rescue')]);
  expectClips('Посмотри на фигуру на ' + sq + '.', [part('part_look_piece_on'), sqPath]);
  expectClips('Посмотри на клетку ' + sq + '.', [part('part_look_square'), sqPath]);
}
expectClips('На фигуру нападают несколько чёрных фигур. Проверь все нападения: можно уйти, защититься или взять нападающего. Кто может забрать фигуру? Найди соперника.',
  [byFile('rescue_multiple_attackers.mp3'), byFile('quiz_who_can_take.mp3')]);

// Word boundaries prevent the short clip "на" from consuming the start of "нападает".
expectClips('на', [byFile('part_to.mp3')]);
assert.equal(resolve('нападает'), null, 'the short clip на cannot match inside нападает');
assert.equal(resolve('на фигуру нападает'), null);
assert.equal(resolve('Совсем неизвестная фраза.'), null);
assert.equal(resolve('Спаси фигуру на b1. Неизвестное продолжение.'), null);
assert.equal(resolve('напа'), null);
assert.equal(resolve('на/нападает'), null, 'punctuation cannot create an accidental partial-word match');
expectClips('  ФИГУРА НА B1,  ', [byFile('part_piece_on.mp3'), v2('squares/b1.mp3')]);
assert.deepEqual(speechState, { voiceCalls: 0, synthesisCalls: 0 }, 'the resolver does not initiate playback');
