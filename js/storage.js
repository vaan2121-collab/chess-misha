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

  // Все сохранённые значения игры: { 'stars:earned': 73, 'wins:lenya': 3, ... } — для кода сохранения.
  function all() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) out[k.slice(PREFIX.length)] = get(k.slice(PREFIX.length));
      }
    } catch (e) { /* хранилище недоступно */ }
    return out;
  }

  return { get, set, all };
})();

// Прогресс ребёнка: копилка звёзд и пройденные уроки.
window.Progress = (function () {
  const listeners = [];
  // Звёзды храним как «заработано» и «потрачено» (баланс = разница): так прогресс
  // с двух устройств можно объединить, не теряя трат и не удваивая звёзды.
  if (Store.get('stars:earned') === undefined) {
    Store.set('stars:earned', Store.get('stars', 0)); // переносим старый баланс
    Store.set('stars:spent', 0);
  }
  let earned = Store.get('stars:earned', 0);
  let spent = Store.get('stars:spent', 0);
  let learned = Store.get('learned', {}); // { r: true, b: true, ... }

  function notify() { listeners.forEach((fn) => fn()); }

  return {
    get stars() { return earned - spent; },
    // n > 0 — заработал, n < 0 — потратил (покупка наклейки)
    addStars(n) {
      if (n >= 0) { earned += n; Store.set('stars:earned', earned); }
      else { spent += -n; Store.set('stars:spent', spent); }
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
