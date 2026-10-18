// Обёртка над localStorage: не падает в приватном режиме и при пустом хранилище.
window.Store = (function () {
  const PREFIX = 'misha-chess:';

  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) { /* хранилище недоступно — работаем без сохранения */ }
  }

  return { get, set };
})();

// Прогресс ребёнка: копилка звёзд и пройденные уроки.
window.Progress = (function () {
  const listeners = [];
  let stars = Store.get('stars', 0);
  let learned = Store.get('learned', {}); // { r: true, b: true, ... }

  function notify() { listeners.forEach((fn) => fn()); }

  return {
    get stars() { return stars; },
    addStars(n) {
      stars += n;
      Store.set('stars', stars);
      notify();
    },
    // Шаги урока по фигуре: { r: { info: true, stars: true, eat: true, check: true } }
    lessonSteps(piece) {
      const v = learned[piece];
      if (v === true) return { stars: true }; // старый формат: были только звёздочки
      return v || {};
    },
    markStep(piece, step) {
      const steps = Object.assign({}, this.lessonSteps(piece));
      const first = !steps[step];
      steps[step] = true;
      learned[piece] = steps;
      Store.set('learned', learned);
      return first;
    },
    // Сколько задачек решено в разделе — от этого растёт сложность.
    solvedIn(world) { return Store.get('pw:' + world, 0); },
    addSolved(world) { Store.set('pw:' + world, this.solvedIn(world) + 1); },
    // «Сундучок»: каждые 5 решённых задачек — звезда в копилку.
    get chest() { return Store.get('chest', 0); },
    set chest(n) { Store.set('chest', n); },
    // Победы над соперниками в «Игре с роботом» — за них медали.
    winsOver(id) { return Store.get('wins:' + id, 0); },
    addWin(id) { Store.set('wins:' + id, this.winsOver(id) + 1); },
    onChange(fn) { listeners.push(fn); }
  };
})();
