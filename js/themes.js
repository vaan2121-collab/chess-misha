// Темы доски в стиле Minecraft. Покупаются за ⭐ в «Моих подарках», вкладка «Доски».
window.THEMES = [
  { id: 'grass',  name: 'Травяная', icon: '🌿', price: 0,  light: '#ead9a4', dark: '#74a944', frame: '#8b5a2b' },
  { id: 'snow',   name: 'Снежная',  icon: '❄️', price: 10, light: '#f4f8fb', dark: '#8fbfe0', frame: '#5d7f9c' },
  { id: 'desert', name: 'Пустыня',  icon: '🏜️', price: 15, light: '#f3dfa7', dark: '#d39b4a', frame: '#a8642a' },
  { id: 'ocean',  name: 'Океан',    icon: '🐠', price: 20, light: '#a8e0d4', dark: '#3f8f86', frame: '#2d5f6e' },
  { id: 'nether', name: 'Незер',    icon: '🔥', price: 30, light: '#c46a5c', dark: '#4a2a2e', frame: '#2c1418' },
  { id: 'end',    name: 'Энд',      icon: '🐉', price: 40, light: '#f1efc0', dark: '#a77ab8', frame: '#3d2a4a' }
];

window.Themes = (function () {
  const owned = () => Object.assign({ grass: true }, Store.get('themes', {}));
  const current = () => Store.get('theme', 'grass');

  function apply(id) {
    const t = THEMES.find((x) => x.id === id) || THEMES[0];
    const root = document.documentElement.style;
    root.setProperty('--sq-light', t.light);
    root.setProperty('--sq-dark', t.dark);
    root.setProperty('--board-frame', t.frame);
  }

  function choose(id) {
    Store.set('theme', id);
    apply(id);
  }

  // Купить за звёзды. Возвращает true, если получилось.
  function buy(id) {
    const t = THEMES.find((x) => x.id === id);
    if (!t || owned()[id] || Progress.stars < t.price) return false;
    Progress.addStars(-t.price);
    Store.set('themes', Object.assign(Store.get('themes', {}), { [id]: true }));
    choose(id);
    return true;
  }

  apply(current());
  return { owned, current, choose, buy, apply };
})();
