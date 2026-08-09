/**
 * Hero pipeline story: prompt → synthesize nodes → zcli logs → healthy → live URL.
 * Pauses when offscreen. Respects prefers-reduced-motion (static end state).
 */
(function () {
  const LOGS = [
    { t: '[zcli] project project-import…', c: '' },
    { t: '[zcli] studio: stack.create', c: '' },
    { t: '[zcli] build: npm ci — ok', c: 'is-ok' },
    { t: '[audit] HTTP probe — 200', c: 'is-ok' },
    { t: '[audit] services healthy', c: 'is-ok' }
  ];

  const PROMPT =
    'AI Video Clipper — Next.js + Go API + Python worker + Postgres + Valkey';

  function qs(root, sel) {
    return root.querySelector(sel);
  }

  function setNodes(root, mode) {
    const nodes = root.querySelectorAll('.pipeline__node');
    const edges = root.querySelectorAll('.pipeline__edge');
    nodes.forEach((n, i) => {
      n.classList.remove('is-building', 'is-healthy');
      if (mode === 'idle') return;
      if (mode === 'building') {
        if (i <= root._buildIdx) n.classList.add('is-building');
      }
      if (mode === 'healthy') n.classList.add('is-healthy');
    });
    edges.forEach((e, i) => {
      e.classList.toggle('is-hot', mode === 'building' && i <= root._buildIdx);
      if (mode === 'healthy') e.classList.remove('is-hot');
    });
  }

  function clearLogs(logEl) {
    logEl.innerHTML = '';
  }

  function addLog(logEl, item) {
    const line = document.createElement('div');
    line.className = 'pipeline__log-line ' + (item.c || '');
    line.textContent = item.t;
    logEl.appendChild(line);
    requestAnimationFrame(() => line.classList.add('is-in'));
  }

  function typePrompt(el, text, reduced) {
    return new Promise((resolve) => {
      if (reduced) {
        el.textContent = text;
        resolve();
        return;
      }
      el.textContent = '';
      let i = 0;
      const tick = () => {
        i += 1;
        el.textContent = text.slice(0, i);
        if (i < text.length) setTimeout(tick, 18);
        else resolve();
      };
      tick();
    });
  }

  function wait(ms, reduced) {
    return new Promise((r) => setTimeout(r, reduced ? 0 : ms));
  }

  async function runOnce(root, reduced) {
    const promptEl = qs(root, '.pipeline__prompt-text');
    const logEl = qs(root, '.pipeline__log');
    const urlEl = qs(root, '.pipeline__url');
    const bar = qs(root, '.pipeline__progress > i');
    const stage = qs(root, '[data-stage]');

    root._buildIdx = -1;
    urlEl && urlEl.classList.remove('is-live');
    clearLogs(logEl);
    setNodes(root, 'idle');
    if (bar) bar.style.width = '4%';
    if (stage) stage.textContent = '01 · Describe';

    await typePrompt(promptEl, PROMPT, reduced);
    if (bar) bar.style.width = '18%';
    await wait(400, reduced);

    if (stage) stage.textContent = '02 · Synthesize stack';
    const nodes = root.querySelectorAll('.pipeline__node');
    for (let i = 0; i < nodes.length; i++) {
      root._buildIdx = i;
      setNodes(root, 'building');
      if (bar) bar.style.width = 18 + ((i + 1) / nodes.length) * 35 + '%';
      await wait(320, reduced);
    }

    if (stage) stage.textContent = '03 · Provision via zcli';
    for (let i = 0; i < LOGS.length; i++) {
      addLog(logEl, LOGS[i]);
      if (bar) bar.style.width = 53 + ((i + 1) / LOGS.length) * 30 + '%';
      await wait(380, reduced);
    }

    if (stage) stage.textContent = '04 · Health audit';
    setNodes(root, 'healthy');
    await wait(350, reduced);

    if (stage) stage.textContent = '05 · Live URL';
    if (bar) bar.style.width = '100%';
    urlEl && urlEl.classList.add('is-live');
    await wait(2200, reduced);
  }

  function boot(root) {
    const reduced =
      (window.ZeroOpsMotion && window.ZeroOpsMotion.reduced) ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    let running = false;
    let cancelled = false;
    let visible = true;

    async function loop() {
      if (running) return;
      running = true;
      while (!cancelled) {
        if (!visible && !reduced) {
          await wait(400, false);
          continue;
        }
        await runOnce(root, reduced);
        if (reduced) break; // static end state
        await wait(900, false);
      }
      running = false;
    }

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          visible = entries.some((e) => e.isIntersecting);
        },
        { threshold: 0.2 }
      );
      io.observe(root);
    }

    loop();
    return () => {
      cancelled = true;
    };
  }

  function initAll() {
    document.querySelectorAll('[data-pipeline]').forEach((root) => boot(root));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
