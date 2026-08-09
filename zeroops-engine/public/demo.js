/**
 * ZeroOps public /demo client — hybrid vibe Build + Ship
 *
 * Build  → POST /api/vibe/build  (generate → install → local preview)
 * Ship   → POST /api/vibe/ship   (explicit deploy; never auto on Build)
 *
 * Polls job endpoints; never invents live URLs.
 */
(function () {
  const promptEl = document.getElementById('demo-prompt');
  const planBox = document.getElementById('plan-box');
  const planCard = document.getElementById('plan-card');
  const errorBox = document.getElementById('error-box');
  const logBox = document.getElementById('log-box');
  const quotaLine = document.getElementById('quota-line');
  const canvasMode = document.getElementById('canvas-mode');
  const successBox = document.getElementById('success-box');
  const successTitle = document.getElementById('success-title');
  const successSub = document.getElementById('success-sub');
  const liveLink = document.getElementById('live-link');
  const liveOpen = document.getElementById('live-open');
  const liveHosts = document.getElementById('live-hosts');
  const copyLiveBtn = document.getElementById('btn-copy-live');
  const deployBox = document.getElementById('deploy-box');
  const deployTitle = document.getElementById('deploy-title');
  const deployHint = document.getElementById('deploy-hint');
  const deployStatus = document.getElementById('deploy-status');
  const workbench = document.getElementById('workbench');
  const templatePill = document.getElementById('template-pill');
  const understoodPill = document.getElementById('understood-pill');
  const llmPill = document.getElementById('llm-pill');
  const filesBox = document.getElementById('files-box');
  const filesList = document.getElementById('files-list');
  const filesCount = document.getElementById('files-count');
  const yamlBox = document.getElementById('yaml-box');
  const yamlCode = document.getElementById('yaml-code');
  const copyBtn = document.getElementById('btn-copy-yaml');

  const buildBtn = document.getElementById('btn-build');
  const shipBtn = document.getElementById('btn-ship');
  const previewCard = document.getElementById('preview-card');
  const previewFrame = document.getElementById('preview-frame');
  const previewPlaceholder = document.getElementById('preview-placeholder');
  const previewPlaceholderTitle = document.getElementById('preview-placeholder-title');
  const previewPlaceholderHint = document.getElementById('preview-placeholder-hint');
  const newBtn = document.getElementById('btn-new');
  const shellEl = document.getElementById('demo-shell');
  const previewStatus = document.getElementById('preview-status');
  const previewLoading = document.getElementById('preview-loading');
  const previewOpen = document.getElementById('preview-open');
  const previewWrap = document.querySelector('.preview-frame-wrap');
  const previewChromeUrl = document.getElementById('preview-chrome-url');

  let lastWorkspaceId = null;
  let lastBuildJobId = null;
  let lastLiveUrl = null;
  let previewReady = false;
  let revealed = false;
  let busy = false;
  let shipStartedAt = 0;

  const CHIP_STATES = ['idle', 'building', 'deploying', 'healthy', 'failed'];
  const STAGE_KEYS = ['generate', 'install', 'preview'];
  const SHIP_STAGE_ORDER = ['package', 'import', 'push', 'url', 'verify'];
  const SHIP_STATUS_LABELS = {
    queued: 'Queued — preparing deploy…',
    packaging: 'Packaging static SPA…',
    package: 'Packaging static SPA…',
    import: 'Creating Zerops project (can take ~30–60s)…',
    resolve: 'Resolving project & waiting for services…',
    activate: 'Waiting for services to activate…',
    push: 'Building & pushing to Zerops — slow part, often 1–2 min…',
    materialize: 'Preparing deploy package…',
    url: 'Fetching public URL from Zerops…',
    subdomain: 'Fetching public URL from Zerops…',
    verify: 'Verifying live HTTP response…',
    shipping: 'Deploying to Zerops…',
  };

  const POLL_INTERVAL_MS = 1500;
  const POLL_MAX_MISSES = 8;

  /* ── stage ──────────────────────────────────────────────────────────────── */

  /** Opens the right panel: the composer collapses into the left rail. */
  function revealWorkbench() {
    if (workbench) workbench.hidden = false;
    if (previewCard) previewCard.hidden = false;
    document.body.dataset.stage = 'working';
    if (shellEl) {
      shellEl.classList.add('is-split');
      shellEl.classList.add('is-working');
    }
    if (newBtn) newBtn.hidden = false;
    autoGrowPrompt(); // the rail's prompt has a different min-height
    revealed = true;
    // Panel is already on-screen in the split layout — do not scrollIntoView.
  }

  /** Collapses back to the centered composer — a fresh prompt, nothing running. */
  function resetToCompose() {
    if (busy) return;
    if (workbench) workbench.hidden = true;
    if (shellEl) shellEl.classList.remove('is-split', 'is-working');
    if (newBtn) newBtn.hidden = true;
    document.body.dataset.stage = 'idle';
    revealed = false;
    lastBuildJobId = null;
    resetCanvas();
    clearPreview();
    setPlaceholder('Preview will appear here', 'Describe an app and hit Build');
    showPlan('');
    renderCodeFiles({});
    setPill(templatePill, '');
    setPill(understoodPill, '');
    setPill(llmPill, '');
    if (yamlBox) yamlBox.hidden = true;
    if (filesBox) filesBox.hidden = true;
    setError('');
    if (promptEl) {
      promptEl.value = '';
      promptEl.focus();
      autoGrowPrompt();
    }
    document.querySelectorAll('.template-card').forEach((b) => b.classList.remove('is-selected'));
  }

  /** Grow the prompt with its content, between the CSS min/max for the current layout. */
  function autoGrowPrompt() {
    if (!promptEl) return;
    promptEl.style.height = '';
    const min = parseFloat(getComputedStyle(promptEl).minHeight) || 0;
    promptEl.style.height = Math.max(min, promptEl.scrollHeight) + 'px';
  }

  function setPlaceholder(title, hint) {
    if (previewPlaceholderTitle) previewPlaceholderTitle.textContent = title;
    if (previewPlaceholderHint) previewPlaceholderHint.textContent = hint;
  }

  function setMode(text, variant) {
    if (!canvasMode) return;
    canvasMode.textContent = text;
    canvasMode.className = 'v-pill v-pill--mono' + (variant ? ' v-pill--' + variant : '');
  }

  function setBusy(state) {
    busy = state;
    if (buildBtn) buildBtn.disabled = state;
    updateShipEnabled();
  }

  function updateShipEnabled() {
    if (!shipBtn) return;
    shipBtn.disabled = busy || !previewReady || !lastWorkspaceId;
  }

  function setShipButtonLabel(label) {
    if (!shipBtn) return;
    const base = shipBtn.dataset.label || 'Ship';
    shipBtn.textContent = label || base;
  }

  function mapShipStage(statusOrStage) {
    const s = String(statusOrStage || '').toLowerCase();
    if (s === 'queued' || s === 'packaging' || s === 'package') return 'package';
    if (s === 'import' || s === 'resolve' || s === 'activate' || s === 'auth') return 'import';
    if (s === 'materialize' || s === 'push') return 'push';
    if (s === 'url' || s === 'subdomain') return 'url';
    if (s === 'verify') return 'verify';
    if (s === 'ready' || s === 'done') return 'verify';
    return null;
  }

  function setShipStageState(activeKey, mode) {
    const stages = document.querySelectorAll('[data-ship-stage]');
    if (!stages.length) return;
    const aidx = activeKey ? SHIP_STAGE_ORDER.indexOf(activeKey) : -1;
    stages.forEach((el) => {
      const key = el.getAttribute('data-ship-stage');
      const idx = SHIP_STAGE_ORDER.indexOf(key);
      if (mode === 'fail') {
        if (activeKey && key === activeKey) el.dataset.state = 'fail';
        else if (aidx >= 0 && idx < aidx) el.dataset.state = 'done';
        else el.dataset.state = 'wait';
        return;
      }
      if (mode === 'done' || mode === 'all-done') {
        el.dataset.state = 'done';
        return;
      }
      if (aidx < 0) {
        el.dataset.state = 'wait';
      } else if (idx < aidx) {
        el.dataset.state = 'done';
      } else if (idx === aidx) {
        el.dataset.state = 'run';
      } else {
        el.dataset.state = 'wait';
      }
    });
  }

  function elapsedLabel() {
    if (!shipStartedAt) return '';
    const sec = Math.max(0, Math.round((Date.now() - shipStartedAt) / 1000));
    if (sec < 60) return sec + 's';
    return Math.floor(sec / 60) + 'm ' + (sec % 60) + 's';
  }

  function showDeployProgress(status, detail) {
    if (deployBox) deployBox.hidden = false;
    if (successBox) successBox.hidden = true;
    const stageKey = mapShipStage(status);
    if (stageKey) setShipStageState(stageKey, 'run');
    if (deployTitle) {
      deployTitle.textContent =
        stageKey === 'push'
          ? 'Building on Zerops…'
          : stageKey === 'import'
            ? 'Creating project on Zerops…'
            : stageKey === 'verify'
              ? 'Almost done — verifying…'
              : stageKey === 'url'
                ? 'Getting your live URL…'
                : 'Deploying to Zerops…';
    }
    if (deployHint) {
      deployHint.innerHTML =
        'Real cloud deploy — usually <strong>1–3 minutes</strong>. Keep this tab open.';
    }
    if (deployStatus) {
      const label = SHIP_STATUS_LABELS[status] || detail || SHIP_STATUS_LABELS.shipping;
      const elapsed = elapsedLabel();
      deployStatus.textContent = elapsed ? label + ' · ' + elapsed : label;
    }
    if (previewStatus) previewStatus.textContent = 'deploying…';
    setMode(status || 'shipping', 'run');
  }

  function hideDeployProgress() {
    if (deployBox) deployBox.hidden = true;
    if (deployStatus) deployStatus.textContent = '';
    setShipStageState(null, 'wait');
  }

  function failDeployProgress(message) {
    const active = document.querySelector('[data-ship-stage][data-state="run"]');
    const key = active ? active.getAttribute('data-ship-stage') : 'push';
    setShipStageState(key, 'fail');
    if (deployTitle) deployTitle.textContent = 'Deploy failed';
    if (deployHint) {
      deployHint.textContent = message || 'Something went wrong during Ship. Check the log and try again.';
    }
    if (deployStatus) deployStatus.textContent = message || 'failed';
  }

  /* ── log ────────────────────────────────────────────────────────────────── */

  function log(line) {
    if (!logBox) return;
    const row = document.createElement('div');
    row.className = 'log-line';
    const match = /^(\[[a-z]+\])\s?/.exec(line);
    if (match) {
      const tag = document.createElement('span');
      tag.className = 'log-tag' + tagVariant(match[1]);
      tag.textContent = match[1];
      row.appendChild(tag);
      row.appendChild(document.createTextNode(' ' + line.slice(match[0].length)));
    } else {
      row.textContent = line;
    }
    logBox.appendChild(row);
    logBox.scrollTop = logBox.scrollHeight;
  }

  function tagVariant(tag) {
    if (tag === '[deploy]' || tag === '[live]' || tag === '[ship]') return ' log-tag--ok';
    if (tag === '[llm]' || tag === '[build]' || tag === '[zcli]') return ' log-tag--run';
    if (tag === '[error]') return ' log-tag--fail';
    return '';
  }

  function clearLog() {
    if (logBox) logBox.textContent = '';
  }

  function setError(msg) {
    if (!errorBox) return;
    if (!msg) {
      errorBox.hidden = true;
      errorBox.textContent = '';
      return;
    }
    errorBox.hidden = false;
    errorBox.textContent = msg;
  }

  /* ── topology + stages ──────────────────────────────────────────────────── */

  function setChip(serviceId, status, host) {
    const el = document.getElementById('node-' + serviceId);
    if (!el) return;
    el.classList.remove(...CHIP_STATES);
    el.classList.add(status || 'idle');
    if (host) {
      const ip = el.querySelector('.topo-chip__ip');
      if (ip) ip.textContent = host;
    }
  }

  function resetStages() {
    STAGE_KEYS.forEach((key) => setStageState(key, 'wait'));
  }

  function setStageState(key, state) {
    const el = document.getElementById('stage-' + key);
    if (!el) return;
    const s = el.querySelector('.build-stage__s');
    el.dataset.state = state;
    if (s) {
      s.dataset.state = state;
      s.textContent =
        state === 'run' ? 'running' : state === 'done' ? 'done' : state === 'fail' ? 'failed' : 'wait';
    }
  }

  function applyBuildStatus(status) {
    const map = {
      queued: 'generate',
      generating: 'generate',
      installing: 'install',
      preview: 'preview',
      ready: 'preview',
      failed: null,
    };
    const active = map[status];
    const placeholderHints = {
      queued: 'Queued — picking up your prompt…',
      generating: 'Writing components, routes, and styles…',
      installing: 'Installing packages for the scaffold…',
      preview: 'Starting the Vite dev server…',
    };
    if (placeholderHints[status] && !previewReady) {
      setPlaceholder('Warming up your preview', placeholderHints[status]);
    }
    if (status === 'ready') {
      STAGE_KEYS.forEach((k) => setStageState(k, 'done'));
      setChip('webapp', 'healthy', 'preview ready');
      setMode('ready', 'ok');
      return;
    }
    if (status === 'failed') {
      const running = STAGE_KEYS.find((k) => {
        const el = document.getElementById('stage-' + k);
        return el && el.dataset.state === 'run';
      });
      setStageState(running || 'generate', 'fail');
      setChip('webapp', 'failed');
      setMode('failed', 'fail');
      setPlaceholder('Build failed', 'Check the log on the left, then try again.');
      return;
    }
    STAGE_KEYS.forEach((k) => {
      const idx = STAGE_KEYS.indexOf(k);
      const aidx = active ? STAGE_KEYS.indexOf(active) : -1;
      if (aidx < 0) setStageState(k, 'wait');
      else if (idx < aidx) setStageState(k, 'done');
      else if (idx === aidx) setStageState(k, 'run');
      else setStageState(k, 'wait');
    });
    setChip('webapp', 'building');
    setMode(status || 'building', 'run');
  }

  function clearPreview() {
    previewReady = false;
    lastWorkspaceId = null;
    if (previewFrame) {
      previewFrame.onload = null;
      previewFrame.onerror = null;
      previewFrame.removeAttribute('src');
      previewFrame.hidden = true;
    }
    if (previewPlaceholder) previewPlaceholder.hidden = false;
    if (previewLoading) previewLoading.hidden = true;
    if (previewOpen) {
      previewOpen.hidden = true;
      previewOpen.removeAttribute('href');
    }
    if (previewWrap) previewWrap.dataset.state = 'idle';
    // Preview card stays visible in the right panel (empty state when idle).
    if (previewCard) previewCard.hidden = false;
    if (previewStatus) previewStatus.textContent = '—';
    updateShipEnabled();
  }

  function setPreviewBuilding() {
    if (previewCard) previewCard.hidden = false;
    if (previewFrame) {
      previewFrame.onload = null;
      previewFrame.onerror = null;
      previewFrame.removeAttribute('src');
      previewFrame.hidden = true;
    }
    setPlaceholder('Warming up your preview', 'Generating files, then installing packages…');
    if (previewPlaceholder) previewPlaceholder.hidden = false;
    if (previewLoading) previewLoading.hidden = true;
    if (previewWrap) previewWrap.dataset.state = 'loading';
    if (previewStatus) previewStatus.textContent = 'building…';
    if (previewOpen) {
      previewOpen.hidden = true;
      previewOpen.removeAttribute('href');
    }
  }

  /** Strip ?query/#hash and ensure trailing slash — query breaks Vite --base assets. */
  function cleanPreviewPath(path) {
    let p = String(path || '').trim().split(/[?#]/)[0];
    if (!p) return p;
    if (!p.endsWith('/')) p += '/';
    return p;
  }

  function showPreview(path) {
    if (!path) return;
    const clean = cleanPreviewPath(path);
    if (previewCard) previewCard.hidden = false;
    if (previewPlaceholder) previewPlaceholder.hidden = true;
    if (previewLoading) previewLoading.hidden = false;
    if (previewWrap) previewWrap.dataset.state = 'loading';
    if (previewStatus) previewStatus.textContent = 'loading';
    if (previewOpen) {
      previewOpen.hidden = false;
      previewOpen.href = clean;
    }
    if (previewChromeUrl) {
      previewChromeUrl.textContent = clean;
      previewChromeUrl.title = clean;
    }
    if (previewFrame) {
      previewFrame.hidden = false;
      previewFrame.onload = () => {
        if (previewLoading) previewLoading.hidden = true;
        if (previewWrap) previewWrap.dataset.state = 'ready';
        if (previewStatus) previewStatus.textContent = 'ready';
      };
      previewFrame.onerror = () => {
        if (previewLoading) previewLoading.hidden = true;
        if (previewWrap) previewWrap.dataset.state = 'error';
        if (previewStatus) previewStatus.textContent = 'error';
        setError(
          'Preview frame failed to load. Try Open preview, or Build again. If blank, hard-refresh the page.',
        );
      };
      // Clean path only — query strings break Vite asset resolution under --base.
      previewFrame.src = clean;
    }
    previewReady = true;
    updateShipEnabled();
    // Ship is available once workspace is ready even if iframe still paints.
    if (shipBtn) {
      shipBtn.title = 'Deploy static SPA to Zerops';
    }
  }

  function resetCanvas(keepLog) {
    setChip('webapp', 'idle', 'preview');
    resetStages();
    if (!keepLog) clearLog();
    if (successBox) successBox.hidden = true;
    hideDeployProgress();
    lastLiveUrl = null;
    setShipButtonLabel(null);
    if (previewOpen) previewOpen.textContent = 'Open ↗';
    setMode('idle');
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /* ── artifacts ──────────────────────────────────────────────────────────── */

  function setPill(el, text, variant) {
    if (!el) return;
    if (!text) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.className = 'v-pill v-pill--mono' + (variant ? ' v-pill--' + variant : '');
  }

  function showPlan(plan) {
    if (!planBox || !planCard) return;
    const text = (plan || '').trim();
    planCard.hidden = !text;
    planBox.textContent = text;
  }

  function renderCodeFiles(codeFiles) {
    const files = Object.entries(codeFiles || {});
    if (filesBox && filesList) {
      filesBox.hidden = files.length === 0;
      filesList.textContent = '';
      files.forEach(([filePath, content]) => {
        const li = document.createElement('li');
        const p = document.createElement('span');
        p.className = 'files-list__path';
        p.textContent = filePath;
        const s = document.createElement('span');
        s.className = 'files-list__size';
        s.textContent = formatBytes(String(content || '').length);
        li.appendChild(p);
        li.appendChild(s);
        filesList.appendChild(li);
      });
      if (filesCount) {
        filesCount.textContent = files.length + (files.length === 1 ? ' file' : ' files');
      }
    }
  }

  function formatBytes(n) {
    return n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB';
  }

  function showLive(url, opts) {
    if (!url || !successBox || !liveLink) return;
    const o = opts || {};
    lastLiveUrl = url;
    hideDeployProgress();
    setShipStageState('verify', 'all-done');
    successBox.hidden = false;
    liveLink.href = url;
    liveLink.textContent = url;
    if (liveOpen) {
      liveOpen.href = url;
      liveOpen.hidden = false;
    }
    document.body.dataset.stage = 'done';
    const shellDone = document.getElementById('demo-shell');
    if (shellDone) shellDone.classList.remove('is-working');
    if (successTitle) {
      successTitle.textContent = o.title || (o.verified === false ? 'Deployed' : 'Live on Zerops');
    }
    if (successSub) {
      const http =
        o.httpStatus != null ? ' HTTP ' + o.httpStatus + '.' : '';
      successSub.textContent =
        (o.verified === false
          ? 'Deploy finished — open and share the URL.'
          : 'Your app is public — open it or copy the URL to share.') + http;
    }
    if (previewChromeUrl) {
      previewChromeUrl.textContent = url;
      previewChromeUrl.title = url;
    }
    if (previewOpen) {
      previewOpen.hidden = false;
      previewOpen.href = url;
      previewOpen.textContent = 'Open live ↗';
    }
    if (previewStatus) previewStatus.textContent = 'live';
    if (copyLiveBtn) {
      copyLiveBtn.textContent = 'Copy URL';
      copyLiveBtn.disabled = false;
    }
    if (liveHosts) {
      liveHosts.textContent = '';
      (o.hosts || ['webapp']).forEach((h) => {
        const li = document.createElement('li');
        li.textContent = h + ' · ' + url.replace(/^https?:\/\//, '');
        liveHosts.appendChild(li);
      });
    }
    // Scroll success into view so judges never miss the URL.
    try {
      successBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch {
      /* ignore */
    }
  }

  /* ── example prompts ────────────────────────────────────────────────────── */

  document.querySelectorAll('.template-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.template-card').forEach((b) => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      if (promptEl) {
        promptEl.value = btn.dataset.prompt || '';
        promptEl.focus();
        autoGrowPrompt();
      }
    });
  });

  /* ── api ────────────────────────────────────────────────────────────────── */

  async function refreshQuota() {
    try {
      const res = await fetch('/api/demo/status');
      const data = await res.json();
      if (quotaLine) {
        // Header line stays terse — full remedies go to the error box below the prompt.
        const parts = [
          `slots ${data.activeCount}/${data.maxProjects}`,
          data.realDeployEnabled ? 'real-deploy on' : 'real-deploy off',
          data.hasDemoOpenAI ? 'openai ready' : 'openai missing',
          data.hasDemoPat ? 'zerops pat ready' : 'pat missing',
        ];
        if (data.zcli && !data.zcli.present) parts.push('zcli missing');
        quotaLine.textContent = parts.join(' · ');
        if (!data.hasDemoOpenAI) {
          setError(
            'OpenAI quota: no API key on the server. Add OPENAI_API_KEY to zeroops-engine/.env and restart, or log in with a BYOK key — then Build again.',
          );
        } else if (!data.hasDemoPat) {
          // Soft note only in quota line; do not block Build with a red error.
        }
      }
      return data;
    } catch {
      if (quotaLine) quotaLine.textContent = 'quota unavailable';
      return null;
    }
  }

  function payload() {
    return { prompt: (promptEl && promptEl.value.trim()) || '' };
  }

  function requirePrompt() {
    const p = payload().prompt;
    if (!p) {
      setError('Describe an app first — or pick one of the examples.');
      promptEl?.focus();
      return null;
    }
    return p;
  }

  /**
   * Poll any vibe job (build or ship) until done.
   * @param {string} url base without ?from=
   * @param {(ev: object) => void} onEvent
   * @param {(snap: object) => void} [onSnap]
   */
  async function pollJob(url, onEvent, onSnap) {
    let from = 0;
    let misses = 0;
    let last = null;

    for (;;) {
      let snapshot;
      try {
        const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'from=' + from, {
          headers: { Accept: 'application/json' },
        });
        if (res.status === 404) {
          throw Object.assign(new Error('the job expired on the server'), { fatal: true });
        }
        if (!res.ok) throw new Error('poll failed — HTTP ' + res.status);
        snapshot = await res.json();
        misses = 0;
      } catch (err) {
        if (err.fatal) throw err;
        misses += 1;
        if (misses >= POLL_MAX_MISSES) throw err;
        log('[build] lost contact with the server, retrying (' + misses + ')');
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      last = snapshot;
      if (onSnap) onSnap(snapshot);
      (snapshot.events || []).forEach(onEvent);
      from = typeof snapshot.next === 'number' ? snapshot.next : from;
      if (snapshot.done || snapshot.status === 'ready' || snapshot.status === 'failed') {
        return snapshot;
      }
      await sleep(POLL_INTERVAL_MS);
    }
  }

  /* ── Build (vibe) ───────────────────────────────────────────────────────── */

  async function runBuild() {
    if (busy || !requirePrompt()) return;
    setBusy(true);
    setError('');
    revealWorkbench();
    resetCanvas();
    clearPreview();
    setPreviewBuilding();
    lastBuildJobId = null;
    lastLiveUrl = null;
    if (successBox) successBox.hidden = true;
    hideDeployProgress();
    setShipButtonLabel(null);
    if (previewOpen) previewOpen.textContent = 'Open ↗';
    setMode('generating', 'run');
    setStageState('generate', 'run');
    setChip('webapp', 'building');
    log('[build] starting vibe generate → install → preview (no deploy)');

    try {
      const res = await fetch('/api/vibe/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload()),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.jobId) {
        const msg =
          data.message ||
          data.error ||
          (res.status === 503
            ? 'Add OpenAI API key (or set server OPENAI_API_KEY) to Build.'
            : 'Build failed to start');
        log('[error] ' + msg);
        if (data.code === 'OPENAI_API_KEY_REQUIRED' || res.status === 503) {
          setError(
            'OpenAI quota / key required for Build. Set OPENAI_API_KEY in zeroops-engine/.env and restart the server, or log in and save a BYOK key.',
          );
        } else {
          setError(msg);
        }
        applyBuildStatus('failed');
        setBusy(false);
        refreshQuota();
        return;
      }

      lastBuildJobId = data.jobId;
      log('[build] job ' + data.jobId + ' — polling status…');

      const finalSnap = await pollJob(
        '/api/vibe/build/' + encodeURIComponent(data.jobId),
        (msg) => {
          switch (msg.type) {
            case 'log':
              log(msg.text || msg.message || '');
              break;
            case 'stage':
              log('[build] ' + (msg.stage || 'stage') + ': ' + (msg.message || ''));
              break;
            case 'plan':
              if (msg.plan) showPlan(msg.plan);
              break;
            case 'files':
              break;
            case 'error':
              log('[error] ' + (msg.error || 'build failed'));
              break;
            default:
              break;
          }
        },
        (snap) => {
          applyBuildStatus(snap.status);
          if (snap.plan) showPlan(snap.plan);
          if (snap.codeFiles) renderCodeFiles(snap.codeFiles);
          if (snap.workspaceId) lastWorkspaceId = snap.workspaceId;
          setPill(templatePill, 'react+vite spa', 'ok');
          setPill(llmPill, 'llm openai', 'ok');
          if (snap.workspaceId) {
            setPill(understoodPill, 'workspace ' + String(snap.workspaceId).slice(0, 10) + '…');
          }
          if (yamlBox && yamlCode && snap.plan) {
            yamlBox.hidden = false;
            yamlCode.textContent = snap.plan;
          }
        },
      );

      if (finalSnap.status === 'ready') {
        lastWorkspaceId = finalSnap.workspaceId || lastWorkspaceId;
        const path =
          finalSnap.previewPath ||
          finalSnap.previewUrl ||
          (lastWorkspaceId ? '/api/vibe/preview/' + lastWorkspaceId + '/' : null);
        if (finalSnap.plan) showPlan(finalSnap.plan);
        if (finalSnap.codeFiles) renderCodeFiles(finalSnap.codeFiles);
        applyBuildStatus('ready');
        if (path) showPreview(path);
        log('[build] preview ready at ' + path);
        log('[build] click Ship to deploy the static SPA to Zerops');
        document.body.dataset.stage = 'preview';
        const shellReady = document.getElementById('demo-shell');
        if (shellReady) shellReady.classList.remove('is-working');
      } else {
        applyBuildStatus('failed');
        const msg = finalSnap.error || 'Build failed';
        setError(msg);
        log('[error] ' + msg);
        clearPreview();
      }
    } catch (err) {
      setError(err.message || String(err));
      applyBuildStatus('failed');
      clearPreview();
    }
    setBusy(false);
    refreshQuota();
  }

  /* ── Ship (vibe) ────────────────────────────────────────────────────────── */

  async function runShip() {
    if (busy || !previewReady || !lastWorkspaceId) return;
    setBusy(true);
    setError('');
    lastLiveUrl = null;
    if (successBox) successBox.hidden = true;
    shipStartedAt = Date.now();
    setShipButtonLabel('Deploying…');
    setChip('webapp', 'deploying', 'deploying…');
    showDeployProgress('packaging', 'Packaging static SPA…');
    log('[ship] packaging static SPA and deploying to Zerops…');
    log('[ship] this is a real deploy — usually 1–3 minutes. URL appears here when ready.');

    try {
      const body = {
        workspaceId: lastWorkspaceId,
      };
      if (lastBuildJobId) body.buildJobId = lastBuildJobId;

      const res = await fetch('/api/vibe/ship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.jobId) {
        const msg =
          data.message ||
          data.error ||
          (res.status === 503
            ? 'Zerops PAT quota: add DEMO_PAT to zeroops-engine/.env (or log in with a PAT) to Ship.'
            : 'Ship failed to start');
        log('[error] ' + msg);
        setError(msg);
        failDeployProgress(msg);
        setChip('webapp', 'healthy', 'preview ready');
        setMode('ready', 'ok');
        setShipButtonLabel(null);
        setBusy(false);
        refreshQuota();
        return;
      }

      log('[ship] job ' + data.jobId + ' — polling until live URL…');
      showDeployProgress('import', 'Job started — creating project…');

      const finalSnap = await pollJob(
        '/api/vibe/ship/' + encodeURIComponent(data.jobId),
        (msg) => {
          switch (msg.type) {
            case 'log':
              log(msg.text || msg.message || '');
              break;
            case 'stage': {
              const stage = msg.stage || 'stage';
              const message = msg.message || msg.text || '';
              log('[ship] ' + stage + ': ' + message);
              // Surface human stage + keep right-panel banner in sync.
              if (stage !== 'log') {
                showDeployProgress(stage, message);
              }
              break;
            }
            case 'error':
              log('[error] ' + (msg.error || 'ship failed'));
              break;
            case 'done':
              if (msg.liveUrl) {
                log('[live] ' + msg.liveUrl);
              }
              break;
            default:
              break;
          }
        },
        (snap) => {
          if (snap.status && snap.status !== 'ready' && snap.status !== 'failed') {
            showDeployProgress(snap.status);
          }
          // Show URL as soon as the poller has it (before verify finishes).
          if (snap.liveUrl && !lastLiveUrl) {
            lastLiveUrl = snap.liveUrl;
            if (deployTitle) deployTitle.textContent = 'URL ready — verifying…';
            if (deployStatus) {
              deployStatus.textContent =
                'Live URL: ' + snap.liveUrl + (elapsedLabel() ? ' · ' + elapsedLabel() : '');
            }
            log('[live] URL from Zerops: ' + snap.liveUrl);
          }
        },
      );

      if (finalSnap.liveUrl) {
        setChip('webapp', 'healthy', 'live');
        setMode(finalSnap.verified ? 'healthy' : 'deployed', 'ok');
        showLive(finalSnap.liveUrl, {
          title: finalSnap.verified ? 'Verified live on Zerops' : 'Deployed on Zerops',
          verified: !!finalSnap.verified,
          httpStatus: finalSnap.httpStatus,
          hosts: ['webapp'],
        });
        log(
          '[live] ' +
            finalSnap.liveUrl +
            (finalSnap.httpStatus != null ? ' → HTTP ' + finalSnap.httpStatus : ''),
        );
        log('[live] share this URL — deploy took ' + (elapsedLabel() || 'a bit'));
      } else {
        const msg = finalSnap.error || 'Ship finished without a live URL';
        setError(msg);
        log('[error] ' + msg);
        failDeployProgress(msg);
        setChip('webapp', previewReady ? 'healthy' : 'failed');
        setMode(previewReady ? 'ready' : 'failed', previewReady ? 'ok' : 'fail');
      }
    } catch (err) {
      const msg = err.message || String(err);
      setError(msg);
      failDeployProgress(msg);
      setChip('webapp', previewReady ? 'healthy' : 'failed');
      setMode(previewReady ? 'ready' : 'failed', previewReady ? 'ok' : 'fail');
    }
    setShipButtonLabel(null);
    setBusy(false);
    refreshQuota();
  }

  /* ── wiring ─────────────────────────────────────────────────────────────── */

  buildBtn?.addEventListener('click', () => runBuild());
  shipBtn?.addEventListener('click', () => runShip());
  newBtn?.addEventListener('click', () => resetToCompose());

  promptEl?.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      runBuild();
    }
  });

  promptEl?.addEventListener('input', autoGrowPrompt);

  copyBtn?.addEventListener('click', async () => {
    if (!yamlCode) return;
    try {
      await navigator.clipboard.writeText(yamlCode.textContent || '');
      copyBtn.textContent = 'copied';
      copyBtn.classList.add('is-copied');
      setTimeout(() => {
        copyBtn.textContent = 'copy';
        copyBtn.classList.remove('is-copied');
      }, 1400);
    } catch {
      copyBtn.textContent = 'copy failed';
      setTimeout(() => {
        copyBtn.textContent = 'copy';
      }, 1400);
    }
  });

  copyLiveBtn?.addEventListener('click', async () => {
    const url = lastLiveUrl || (liveLink && liveLink.href) || '';
    if (!url || url === '#' || url.endsWith('/#')) return;
    try {
      await navigator.clipboard.writeText(url);
      copyLiveBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyLiveBtn.textContent = 'Copy URL';
      }, 1600);
    } catch {
      copyLiveBtn.textContent = 'Copy failed';
      setTimeout(() => {
        copyLiveBtn.textContent = 'Copy URL';
      }, 1600);
    }
  });

  updateShipEnabled();
  refreshQuota();
})();
