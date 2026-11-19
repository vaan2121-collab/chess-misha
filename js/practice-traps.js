(function (root) {
  'use strict';

  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const LESSONS = [
    {
      lessonId: 'legals-mate',
      lessonTitle: 'Ловушка Легаля: мат в конце',
      rule: 'Развивай фигуры и замечай, когда соперник жадно берёт ферзя.',
      why: 'Конь с f3 на e5 открывает слону чёрных путь к ферзю на d1. Если чёрные жадно заберут ферзя, слон и конь начнут шаховать короля.',
      question: 'Почему после взятия ферзя король всё равно не спасся?',
      takeaway: 'Перед взятием всегда проверь: не будет ли у соперника шаха или мата?',
      white: ['e4', 'Nf3', 'Bc4', 'Nc3', 'Nxe5', 'Bxf7+', 'Nd5#'],
      black: ['e5', 'd6', 'Bg4', 'g6', 'Bxd1', 'Ke7'],
      reasons: [
        'Пешка с e2 на e4 занимает центр и открывает дорогу слону.',
        'Конь с g1 на f3 выходит в игру и нападает на пешку e5.',
        'Слон с f1 на c4 выходит в игру и смотрит на слабое поле f7.',
        'Конь с b1 на c3 выходит в игру и помогает бороться за центр.',
        'Конь с f3 на e5 будто предлагает взять ферзя: он открыл слону чёрных диагональ к ферзю на d1. Если чёрные жадно возьмут ферзя слоном с g4 на d1, белые ответят шахами слона и коня.',
        'Слон с c4 на f7 забирает пешку и шахует. Слону помогает конь, поэтому королю трудно укрыться.',
        'Конь с c3 на d5 ставит мат: королю некуда уйти и нечем закрыться.'
      ],
      goal: { id: 'mate', label: 'Поставить мат королю' },
      success: 'Мат! Чёрные взяли ферзя и пропустили мат.'
    },
    {
      lessonId: 'legals-defense',
      lessonTitle: 'Ловушка Легаля: соперник разгадал план',
      rule: 'Займи центр, развивай фигуры и следи, как отвечает соперник.',
      why: 'Ловушка зависит от ответа соперника. Если она не сработала, продолжай развивать фигуры и береги короля.',
      question: 'Как изменился план соперника, и что теперь важно сделать белым?',
      takeaway: 'Ловушка зависит от ответа соперника. Если он защищается, продолжай развивать фигуры.',
      white: ['e4', 'Nf3', 'Bc4', 'Nc3', 'd3', 'Be3', 'O-O'],
      black: ['e5', 'd6', 'Bg4', 'Nc6', 'Nf6', 'Be7', 'O-O'],
      reasons: [
        'Пешка с e2 на e4 занимает центр и открывает дорогу слону.',
        'Конь с g1 на f3 выходит в игру и нападает на пешку e5.',
        'Слон с f1 на c4 выходит в игру и смотрит на поле f7.',
        'Конь с b1 на c3 выходит в игру. Обе стороны борются за центр.',
        'Чёрные вывели коня с b8 на c6: теперь пешку e5 защищают и этот конь, и пешка d6. Не забирай её конём с f3; продвинь пешку d2 на d3, чтобы поддержать центр и открыть слону дорогу.',
        'Слон с c1 на e3 выходит в игру и помогает закончить развитие.',
        'Король с e1 на g1 и ладья с h1 на f1 рокируются: король прячется в безопасное место.'
      ],
      goal: { id: 'castle', label: 'Развить фигуры и укрыть короля рокировкой' },
      success: 'Хорошо сыграно: фигуры развиты, король укрыт. Чёрные не попались в ловушку.'
    },
    {
      lessonId: 'queen-chase',
      lessonTitle: 'Ферзь вышел слишком рано',
      rule: 'Развивай фигуры и получай темп, нападая на раннего ферзя.',
      why: 'Если ферзь соперника вышел слишком рано, не гоняйся за ним одной фигурой. Развивай команду, прячь короля и заставляй ферзя тратить ходы.',
      question: 'Что важнее: поймать ферзя сразу или спокойно вывести команду?',
      takeaway: 'Ранний ферзь часто сам теряет темпы. Развитие и рокировка помогают использовать это.',
      white: ['e4', 'Nf3', 'Bc4', 'O-O', 'd4'],
      black: ['e5', 'Qh4', 'd6', 'Qf6', 'Qg6'],
      reasons: [
        'Пешка с e2 на e4 занимает центр и открывает дорогу слону.',
        'Конь с g1 на f3 выходит в игру и помогает контролировать центр.',
        'Слон с f1 на c4 смотрит на слабое поле f7.',
        'Король рокируется: команда развивается, а король прячется.',
        'Пешка с d2 на d4 укрепляет центр. Белые развиваются, пока чёрный ферзь тратит ходы.'
      ],
      goal: { id: 'castle', type: 'castle', label: 'Развить команду и сделать рокировку' },
      success: 'Отлично! Пока ферзь гулял, белые развили фигуры и спрятали короля.'
    },
    {
      lessonId: 'calm-development',
      lessonTitle: 'Сначала команда, потом атака',
      rule: 'Займи центр, выведи коней и слонов, затем сделай рокировку.',
      why: 'Красивый ранний выпад не заменяет командную работу. Сначала фигуры помогают друг другу, а король оказывается в безопасности.',
      question: 'Какая фигура ещё сидит дома и кому пора помочь королю?',
      takeaway: 'Хорошее начало — это центр, развитие и безопасный король. Атаковать легче всей командой.',
      white: ['e4', 'Nf3', 'd4', 'Bc4', 'O-O'],
      black: ['e5', 'Nc6', 'd6', 'Bg4', 'Nf6'],
      reasons: [
        'Пешка с e2 на e4 занимает центр и открывает слону дорогу.',
        'Конь с g1 на f3 выходит ближе к центру.',
        'Пешка с d2 на d4 помогает захватить больше места.',
        'Слон с f1 на c4 выходит в игру и смотрит на f7.',
        'Рокировка соединяет ладью с игрой и прячет короля.'
      ],
      goal: { id: 'develop', type: 'develop', label: 'Вывести фигуры и укрыть короля' },
      success: 'Команда собрана: центр занят, фигуры развиты, король в безопасности.'
    }
  ];

  function legalMove(game, san) {
    if (!game || game.game_over()) return null;
    const found = game.moves({ verbose: true }).find((move) => move.san === san);
    return found || null;
  }

  function makeLine(lesson) {
    const game = new Chess(START);
    const history = [];
    for (let i = 0; i < lesson.white.length; i++) {
      const whiteMove = legalMove(game, lesson.white[i]);
      if (!whiteMove) throw new Error('Illegal white move in lesson: ' + lesson.white[i]);
      history.push(whiteMove.from + whiteMove.to + (whiteMove.promotion || ''));
      game.move(whiteMove);
      if (i < lesson.black.length) {
        const blackMove = legalMove(game, lesson.black[i]);
        if (!blackMove) throw new Error('Illegal black move in lesson: ' + lesson.black[i]);
        history.push(blackMove.from + blackMove.to + (blackMove.promotion || ''));
        game.move(blackMove);
      }
    }
    return history;
  }

  function createTask(round) {
    // Первые две линии сохраняем на старых местах: прогресс и тесты не ломаются.
    // Новые схемы появляются после повторного прохождения базовых.
    const order = [0, 1, 0, 1, 2, 3];
    const index = order[Math.abs(Math.floor(Number(round) || 0)) % order.length];
    const lesson = LESSONS[index];
    const line = makeLine(lesson);
    return {
      kind: 'traps', id: 'traps', lessonId: lesson.lessonId, fen: START,
      lessonTitle: lesson.lessonTitle, rule: lesson.rule, why: lesson.why,
      question: lesson.question, takeaway: lesson.takeaway,
      maxMoves: lesson.white.length,
      _line: line.slice(), _white: lesson.white.slice(), _black: lesson.black.slice(),
      _reasons: lesson.reasons.slice(), _goal: Object.assign({}, lesson.goal), _success: lesson.success
    };
  }

  function historyKey(game) {
    return game.history({ verbose: true }).map((move) =>
      move.from + move.to + (move.promotion || '')
    );
  }

  function comparePath(game, task) {
    const actual = historyKey(game);
    const expected = task && Array.isArray(task._line) ? task._line : [];
    let common = 0;
    while (common < actual.length && common < expected.length && actual[common] === expected[common]) common++;
    return { actual, expected, common, failed: common < actual.length || actual.length > expected.length };
  }

  function status(game, task) {
    if (!game || !task || !Array.isArray(task._line)) {
      return { goals: [], done: false, failed: true, text: 'Задание не найдено. Начни его заново.' };
    }
    const path = comparePath(game, task);
    if (path.failed) {
      return {
        goals: [{ id: task._goal.id, label: task._goal.label, done: false }],
        done: false, failed: true,
        text: 'Это учебный пример: другой законный ход может быть хорошим! Чтобы пройти именно эту линию, начни заново и попробуй подсказку.'
      };
    }
    const castled = game.get('g1') && game.get('g1').type === 'k' && game.get('g1').color === 'w' &&
      game.get('f1') && game.get('f1').type === 'r' && game.get('f1').color === 'w';
    const developed = castled && game.get('f3') && game.get('f3').type === 'n' &&
      game.get('c4') && game.get('c4').type === 'b';
    const goalDone = task.lessonId === 'legals-mate' ? game.in_checkmate() :
      task._goal.type === 'castle' ? castled :
      task._goal.type === 'develop' ? developed :
      task.lessonId === 'legals-defense' && castled && game.get('c6') &&
      game.get('c6').type === 'n' && game.get('c6').color === 'b';
    const done = path.actual.length === path.expected.length && goalDone;
    return {
      goals: [{ id: task._goal.id, label: task._goal.label, done: Boolean(done) }],
      done: Boolean(done), failed: false,
      text: done ? task._success : (game.turn() === 'w'
        ? (task._reasons[Math.floor(path.actual.length / 2)] || 'Посмотри на угрозы и выбери ход.')
        : 'Ход сделан. Дождись ответа чёрных и проверь, что изменилось.')
    };
  }

  function suggested(game, task, color) {
    if (!game || !task || game.turn() !== color || game.game_over()) return null;
    const path = comparePath(game, task);
    if (path.failed || path.actual.length >= path.expected.length) return null;
    const moveIndex = path.actual.length;
    if ((color === 'w' && moveIndex % 2 !== 0) || (color === 'b' && moveIndex % 2 !== 1)) return null;
    const san = color === 'w' ? task._white[Math.floor(moveIndex / 2)] : task._black[Math.floor(moveIndex / 2)];
    return san ? legalMove(game, san) : null;
  }

  function hint(game, task) { return suggested(game, task, 'w'); }
  function reply(game, task) { return suggested(game, task, 'b'); }

  root.PracticeTraps = { createTask, status, hint, reply };
})(window);
