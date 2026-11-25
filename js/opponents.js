// Соперники в «Игре с роботом». Картинки и фразы — в assets/opponents/<id>/.
// Уровни 6–10 сильнее Человека-паука, но остаются локальными ботами,
// чтобы ребёнок мог победить их тренировкой и подсказками.
window.OPPONENTS = [
  { id: 'lenya',     name: 'Лёня Макароня', level: 1, color: '#5fa83a', emoji: '🧒' },
  { id: 'vladus',    name: 'Владус',       level: 2, color: '#2f5bd3', emoji: '🎮' },
  { id: 'nero',      name: 'Неро',         level: 3, color: '#3d7fc9', emoji: '⚔️' },
  { id: 'dante',     name: 'Данте',        level: 4, color: '#c62828', emoji: '🗡️' },
  { id: 'spiderman', name: 'Человек-паук', level: 5, color: '#b71c1c', emoji: '🕷️' },
  { id: 'baldi',     name: 'Балди',         level: 6, color: '#d18b22', emoji: '📏' },
  { id: 'sonic',     name: 'Соник',         level: 7, color: '#1769c2', emoji: '💨' },
  { id: 'creeper',   name: 'Крипер',        level: 8, color: '#3a9b45', emoji: '💥' },
  { id: 'mario',     name: 'Марио',         level: 9, color: '#e53935', emoji: '🍄' },
  { id: 'mundus',    name: 'Мундус',        level: 10, color: '#344c80', emoji: '⚡' }
];

// Лица: если картинки нет — берём следующую в цепочке.
window.OPPONENT_FACES = {
  normal: ['normal'],
  think:  ['think', 'normal'],
  happy:  ['happy', 'normal'],
  sad:    ['sad', 'normal'],
  check:  ['check', 'happy', 'normal'],
  win:    ['win', 'happy', 'normal'],
  lose:   ['lose', 'sad', 'normal']
};

// Фразы: несколько вариантов (take1, take2, take3) — играет случайный из тех, что есть.
window.OPPONENT_LINES = {
  hello: ['hello1', 'hello2'],
  take:  ['take1', 'take2', 'take3'],
  lost:  ['lost1', 'lost2', 'lost3'],
  check: ['check1', 'check2'],
  win:   ['win1', 'win2'],
  lose:  ['lose1', 'lose2']
};

// Медали за победы над каждым соперником.
window.MEDALS = [
  { wins: 5, tier: 'gold',   name: 'Золотая' },
  { wins: 3, tier: 'silver', name: 'Серебряная' },
  { wins: 1, tier: 'bronze', name: 'Бронзовая' }
];
