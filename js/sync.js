// Код сохранения: перенос прогресса на другое устройство без регистрации.
// Прогресс упаковывается в короткий код (и QR со ссылкой). На другом устройстве код
// ОБЪЕДИНЯЕТСЯ с тем, что уже есть: счётчики — по большему, наклейки и уроки — складываются.
// Поэтому перенос ничего не стирает, даже если сделать его «не в ту сторону».
window.Sync = (function () {
  // Настройки устройства не переносим — только прогресс.
  const SKIP = new Set(['musicOn', 'sfxOn', 'trackIndex', 'stars']);

  function snapshot() {
    const data = Store.all();
    SKIP.forEach((k) => delete data[k]);
    return data;
  }

  function exportCode() {
    return LZString.compressToEncodedURIComponent(JSON.stringify({ v: 1, d: snapshot() }));
  }

  function decode(code) {
    try {
      const raw = LZString.decompressFromEncodedURIComponent(String(code).trim());
      const obj = raw && JSON.parse(raw);
      return obj && obj.v === 1 && obj.d ? obj.d : null;
    } catch (e) {
      return null;
    }
  }

  // Уроки: старый формат «true» = пройдены звёздочки.
  const steps = (v) => (v === true ? { stars: true } : v || {});

  function mergeValue(key, mine, theirs) {
    if (mine === undefined) return theirs;
    if (theirs === undefined) return mine;
    if (key === 'stickers' || key === 'themes' || key === 'pieceSets' || key === 'trainDone') return Object.assign({}, mine, theirs);
    if (key === 'learned') {
      const out = {};
      new Set([...Object.keys(mine), ...Object.keys(theirs)]).forEach((p) => {
        out[p] = Object.assign({}, steps(mine[p]), steps(theirs[p]));
      });
      return out;
    }
    if (typeof mine === 'number' && typeof theirs === 'number') return Math.max(mine, theirs);
    return mine;
  }

  function importData(data) {
    const mine = snapshot();
    Object.keys(data).forEach((k) => {
      if (SKIP.has(k)) return;
      Store.set(k, mergeValue(k, mine[k], data[k]));
    });
  }

  // Короткая сводка для экрана и для вопроса «перенести?».
  function summary(data) {
    const stars = (data['stars:earned'] || 0) - (data['stars:spent'] || 0);
    const stickers = Object.keys(data.stickers || {}).length;
    const wins = Object.keys(data).filter((k) => k.startsWith('wins:')).reduce((n, k) => n + data[k], 0);
    const solved = Object.keys(data).filter((k) => k.startsWith('pw:')).reduce((n, k) => n + data[k], 0);
    return { stars, stickers, wins, solved };
  }

  function summaryHtml(s) {
    return '<span class="star-icon"></span> ' + s.stars + ' · 🎨 ' + s.stickers + ' наклеек · 🏅 ' + s.wins +
      ' побед · 🧩 ' + s.solved + ' задачек';
  }

  return { exportCode, decode, importData, summary, summaryHtml, snapshot };
})();

// Экран «Для родителей»: сохранить код / перенести прогресс.
window.ParentsScreen = (function () {
  const $ = (sel) => document.querySelector(sel);
  const restoreBox = $('#restore-confirm');
  let pending = null;

  function shareUrl(code) {
    return location.origin + location.pathname + '#restore=' + code;
  }

  function showCode() {
    const code = Sync.exportCode();
    const url = shareUrl(code);
    $('#save-code').value = code;
    try {
      const qr = qrcode(0, 'L');
      qr.addData(url);
      qr.make();
      $('#save-qr').innerHTML = '<img alt="QR-код" src="' + qr.createDataURL(4, 8) + '">';
    } catch (e) {
      $('#save-qr').textContent = 'QR не поместился — используйте код ниже.';
    }
    $('#save-result').hidden = false;
  }

  async function copyCode() {
    const field = $('#save-code');
    try {
      await navigator.clipboard.writeText(field.value);
    } catch (e) {
      field.select();
      document.execCommand('copy');
    }
    flash($('#btn-copy-code'));
  }

  async function sendCode() {
    const text = 'Прогресс «Шахматы Миши». Откройте ссылку на новом устройстве:\n' + shareUrl($('#save-code').value);
    try {
      if (navigator.share) { await navigator.share({ title: 'Шахматы Миши — прогресс', text }); return; }
    } catch (e) { /* отменили */ }
    copyCode();
  }

  function flash(btn) {
    btn.classList.add('done');
    setTimeout(() => btn.classList.remove('done'), 1200);
  }

  // Спрашиваем перед объединением и показываем, что придёт.
  function offerRestore(code) {
    const data = Sync.decode(code);
    if (!data) {
      alert('Код не подошёл. Проверьте, что он скопирован целиком.');
      return false;
    }
    pending = data;
    $('#restore-theirs').innerHTML = Sync.summaryHtml(Sync.summary(data));
    $('#restore-mine').innerHTML = Sync.summaryHtml(Sync.summary(Sync.snapshot()));
    restoreBox.hidden = false;
    return true;
  }

  function confirmRestore() {
    if (!pending) return;
    Sync.importData(pending);
    pending = null;
    location.replace(location.pathname + '#menu');
    location.reload(); // перезагружаем, чтобы все экраны взяли новый прогресс
  }

  $('#btn-show-code').addEventListener('click', () => { Sound.play('click'); showCode(); });
  $('#btn-copy-code').addEventListener('click', copyCode);
  $('#btn-send-code').addEventListener('click', sendCode);
  $('#btn-load-code').addEventListener('click', () => {
    const code = $('#load-code').value;
    if (code.trim()) offerRestore(code);
  });
  $('#btn-restore-yes').addEventListener('click', confirmRestore);
  $('#btn-restore-no').addEventListener('click', () => { pending = null; restoreBox.hidden = true; });

  // ---- цель-приз ----
  function paintGoal() {
    const g = Progress.goal;
    $('#goal-now').innerHTML = g
      ? 'Сейчас: «' + g.text + '» — ' + Progress.goalProgress() + ' из ' + g.target + ' <span class="star-icon"></span>'
      : 'Цель пока не задана.';
    $('#btn-goal-clear').hidden = !g;
  }

  $('#btn-goal-set').addEventListener('click', () => {
    const text = $('#goal-text').value.trim();
    const target = Math.max(5, Math.min(1000, parseInt($('#goal-target').value, 10) || 50));
    if (!text) { $('#goal-text').focus(); return; }
    Progress.setGoal(text, target);
    Sound.play('win');
    paintGoal();
  });
  $('#btn-goal-clear').addEventListener('click', () => {
    Progress.clearGoal();
    Sound.play('click');
    paintGoal();
  });

  function enter() {
    $('#save-result').hidden = true;
    $('#load-code').value = '';
    $('#parents-now').innerHTML = Sync.summaryHtml(Sync.summary(Sync.snapshot()));
    paintGoal();
  }

  return { enter, offerRestore };
})();
