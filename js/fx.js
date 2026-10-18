// Праздничные эффекты: кубическое конфетти и «искорки» на клетке.
window.FX = (function () {
  const COLORS = ['#f2c230', '#5fa83a', '#2f5bd3', '#d43a2f', '#ffffff', '#ff8fd0', '#58e0e0'];

  function confetti(count) {
    const layer = document.createElement('div');
    layer.className = 'confetti';
    for (let i = 0; i < (count || 70); i++) {
      const c = document.createElement('i');
      const size = 8 + Math.random() * 10;
      c.style.left = Math.random() * 100 + 'vw';
      c.style.width = c.style.height = size + 'px';
      c.style.background = COLORS[i % COLORS.length];
      c.style.animationDuration = 1.8 + Math.random() * 1.6 + 's';
      c.style.animationDelay = Math.random() * 0.5 + 's';
      c.style.setProperty('--drift', (Math.random() * 30 - 15) + 'vw');
      c.style.setProperty('--spin', (Math.random() * 720 - 360) + 'deg');
      layer.appendChild(c);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 4200);
  }

  function sparkle(el) {
    if (!el) return;
    el.classList.remove('sparkle');
    void el.offsetWidth; // перезапуск анимации
    el.classList.add('sparkle');
    setTimeout(() => el.classList.remove('sparkle'), 600);
  }

  return { confetti, sparkle };
})();
