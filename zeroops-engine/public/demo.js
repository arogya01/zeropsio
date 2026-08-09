/**
 * ZeroOps public /demo client
 *
 * Two-stage page: the hero holds the prompt, and the workbench below it is
 * revealed on the first run. Everything the scaffold API returns —
 * zerops-import.yml, the generated code files, what the prompt was understood
 * to mean — gets rendered, because the artifacts are the proof.
 *
 * `Build` runs the whole thing — scaffold, import, push, health-check. That takes
 * minutes, so it starts a server-side job and polls it, reporting each stage as
 * it happens rather than sitting on a spinner.
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
  const liveLink = document.getElementById('live-link');
  const liveHosts = document.getElementById('live-hosts');
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

  let lastScaffold = null;
  let revealed = false;
  let busy = false;

  // Must match the topology ids from scaffold.js — chips are `node-<id>`.
  const nodeIds = ['webapp', 'db'];
  const CHIP_STATES = ['idle', 'building', 'deploying', 'healthy', 'failed'];

  /* ── stage ──────────────────────────────────────────────────────────────── */

  function revealWorkbench() {
    if (!workbench) return;
    workbench.hidden = false;
    document.body.dataset.stage = 'working';
    if (!revealed) {
      revealed = true;
      workbench.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function setMode(text, variant) {
    if (!canvasMode) return;
    canvasMode.textContent = text;
    canvasMode.className = 'v-pill v-pill--mono' + (variant ? ' v-pill--' + variant : '');
  }

  /** A real deploy holds a Zerops slot; don't let it be started twice. */
  function setBusy(state) {
    busy = state;
    if (buildBtn) buildBtn.disabled = state;
  }

  /* ── log ────────────────────────────────────────────────────────────────── */

  function log(line) {
    if (!logBox) return;
    const row = document.createElement('div');
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
    if (tag === '[deploy]' || tag === '[live]') return ' log-tag--ok';
    if (tag === '[llm]' || tag === '[zcli]' || tag === '[simulate]') return ' log-tag--run';
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

  /* ── topology ───────────────────────────────────────────────────────────── */

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

  function allChips(status) {
    nodeIds.forEach((id) => setChip(id, status));
  }

  function resetCanvas(keepLog) {
    allChips('idle');
    if (!keepLog) clearLog();
    if (successBox) successBox.hidden = true;
    setMode('idle');
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function animateSteps(steps) {
    setMode('building', 'run');
    allChips('building');
    for (const step of steps || []) {
      await sleep(step.delayMs || 400);
      setChip(step.serviceId, step.status || 'healthy', step.privateHost);
      log('[simulate] ' + step.serviceId + ' → ' + (step.status || 'healthy'));
    }
    setMode('healthy', 'ok');
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

  /** Render everything the API returns that the page used to throw away. */
  function renderArtifacts(data) {
    if (!data) return;

    setPill(templatePill, data.templateName || data.templateId);

    const words = (data.matchedKeywords || []).filter(Boolean);
    setPill(understoodPill, words.length ? 'understood: ' + words.join(', ') : '');

    setPill(
      llmPill,
      data.llmUsed ? 'llm openai' : 'llm fallback',
      data.llmUsed ? 'ok' : 'run'
    );
    if (llmPill) llmPill.title = data.llmError || '';

    const yaml = data.importYaml || '';
    if (yamlBox && yamlCode) {
      yamlBox.hidden = !yaml;
      yamlCode.textContent = yaml;
    }

    const files = Object.entries(data.codeFiles || {});
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

  /**
   * @param {string} url
   * @param {object} [opts] {title, hosts, emphasis}
   */
  function showLive(url, opts) {
    if (!url || !successBox || !liveLink) return;
    const o = opts || {};

    successBox.hidden = false;
    liveLink.href = url;
    liveLink.textContent = url;
    document.body.dataset.stage = 'done';

    if (successTitle) successTitle.textContent = o.title || 'Verified live';

    if (liveHosts) {
      liveHosts.textContent = '';
      const hosts =
        o.hosts ||
        ((lastScaffold && lastScaffold.topology) || []).map((s) => s.privateHost || s.id);
      hosts.forEach((h) => {
        const li = document.createElement('li');
        li.textContent = h;
        liveHosts.appendChild(li);
      });
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
      }
    });
  });

  /* ── api ────────────────────────────────────────────────────────────────── */

  async function refreshQuota() {
    try {
      const res = await fetch('/api/demo/status');
      const data = await res.json();
      if (quotaLine) {
        const parts = [
          `slots ${data.activeCount}/${data.maxProjects}`,
          data.realDeployEnabled ? 'real-deploy on' : 'real-deploy off',
          data.hasDemoOpenAI ? 'openai ready' : 'openai fallback',
          data.hasDemoPat ? 'pat set' : 'no pat',
        ];
        // Without zcli the deploy path cannot run at all — say so up front
        // rather than letting it fail mid-demo.
        if (data.zcli && !data.zcli.present) parts.push('zcli MISSING');
        quotaLine.textContent = parts.join(' · ');
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

  /** keepLog is set when this runs as the build fallback, so the judge can
   *  still read why the real deploy was refused. */
  async function runSimulate(keepLog) {
    if (busy) return;
    setBusy(true);
    setError('');
    revealWorkbench();
    resetCanvas(keepLog);
    log('[simulate] previewing the sequence — nothing is provisioned');
    try {
      const res = await fetch('/api/demo/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Simulate failed');
      lastScaffold = data;
      showPlan(data.plan);
      renderArtifacts(data);
      log('[simulate] project=' + data.projectName);
      await animateSteps(data.steps);

      if (data.liveUrl) {
        showLive(data.liveUrl, { title: 'Shared example stack' });
        log('[simulate] shared stack: ' + data.liveUrl);
      } else {
        // No invented URL. A preview run has nothing real to link to.
        setMode('preview complete', 'run');
        log('[simulate] preview only — no real project was provisioned');
      }
    } catch (err) {
      setError(err.message || String(err));
    }
    setBusy(false);
    refreshQuota();
  }

  /* ── real deploy (NDJSON stream) ────────────────────────────────────────── */

  /** Move the canvas in step with the server's reported stage. */
  function applyStage(stage, level) {
    if (level === 'fail') {
      allChips('failed');
      setMode('failed', 'fail');
      return;
    }
    switch (stage) {
      case 'scaffold':
        setMode('scaffolding', 'run');
        break;
      case 'auth':
        setMode('authenticating', 'run');
        break;
      case 'import':
        setMode('importing', 'run');
        allChips('building');
        if (level === 'ok') setChip('db', 'healthy');
        break;
      case 'activate':
        setMode('activating services', 'run');
        if (level === 'ok') setChip('db', 'healthy');
        break;
      case 'materialize':
        setMode('staging files', 'run');
        break;
      case 'push':
        setMode(level === 'ok' ? 'deployed' : 'building', 'run');
        setChip('webapp', 'deploying');
        break;
      case 'verify':
        if (level === 'ok') {
          allChips('healthy');
          setMode('healthy', 'ok');
        } else {
          setMode('verifying', 'run');
        }
        break;
      default:
        break;
    }
  }

  const POLL_INTERVAL_MS = 1500;
  /** A build survives this many consecutive failed polls before we give up. */
  const POLL_MAX_MISSES = 8;

  /**
   * Collect a deploy job's events until it finishes.
   *
   * The server used to stream these down the POST response, but the platform
   * proxy closes a response that goes ~60s without a byte and the build has
   * silent stretches far longer than that — so the browser saw a network error
   * mid-deploy. Short polls cannot idle out, and a blip just retries.
   */
  async function pollJob(jobId, onEvent) {
    let from = 0;
    let misses = 0;

    for (;;) {
      let snapshot;
      try {
        const res = await fetch(
          '/api/demo/deploy/' + encodeURIComponent(jobId) + '?from=' + from,
          { headers: { Accept: 'application/json' } }
        );
        if (res.status === 404) {
          throw Object.assign(new Error('the deploy job expired on the server'), {
            fatal: true,
          });
        }
        if (!res.ok) throw new Error('poll failed — HTTP ' + res.status);
        snapshot = await res.json();
        misses = 0;
      } catch (err) {
        if (err.fatal) throw err;
        misses += 1;
        if (misses >= POLL_MAX_MISSES) throw err;
        log('[deploy] lost contact with the server, retrying (' + misses + ')');
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      (snapshot.events || []).forEach(onEvent);
      from = snapshot.next;
      if (snapshot.done) return;
      await sleep(POLL_INTERVAL_MS);
    }
  }

  async function runBuild() {
    if (busy || !requirePrompt()) return;
    setBusy(true);
    setError('');
    revealWorkbench();
    resetCanvas();
    setMode('deploying', 'run');
    log('[deploy] provisioning a real Zerops project under the operator PAT…');

    try {
      const res = await fetch('/api/demo/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      });

      const data = await res.json().catch(() => ({}));

      // Guard failures (no PAT, quota full, kill-switch) answer with an error
      // instead of a job id.
      if (!res.ok || !data.jobId) {
        log('[deploy] blocked: ' + (data.error || 'HTTP ' + res.status));
        if (data.fallback === 'simulate') {
          log('[deploy] falling back to the preview');
          setBusy(false);
          await runSimulate(true);
          return;
        }
        throw new Error(data.error || 'Deploy failed');
      }

      log('[deploy] build started — this takes a few minutes');

      let done = null;
      let failure = null;

      await pollJob(data.jobId, (msg) => {
        switch (msg.type) {
          case 'log':
            log(msg.text);
            break;
          case 'stage':
            log('[deploy] ' + msg.stage + ': ' + msg.text);
            applyStage(msg.stage, msg.level);
            break;
          case 'scaffold':
            lastScaffold = msg;
            showPlan(msg.plan);
            renderArtifacts(msg);
            (msg.topology || []).forEach((s) => setChip(s.id, 'building', s.privateHost));
            break;
          case 'done':
            done = msg;
            break;
          case 'error':
            failure = msg;
            break;
          default:
            break;
        }
      });

      if (failure) {
        log('[error] ' + failure.error);
        if (failure.fallback === 'simulate') {
          log('[deploy] falling back to the preview');
          setBusy(false);
          await runSimulate(true);
          return;
        }
        throw new Error(failure.error);
      }

      if (!done) throw new Error('the deploy finished without reporting a result');

      const hosts = (done.services || []).map((s) => s.privateHost || s.id);
      if (done.verified) {
        allChips('healthy');
        setMode('healthy', 'ok');
        showLive(done.liveUrl, { title: 'Verified live', hosts });
        log('[live] ' + done.liveUrl + ' → HTTP ' + done.httpStatus);
      } else {
        setChip('db', 'healthy');
        setChip('webapp', 'building');
        setMode('starting', 'run');
        showLive(done.liveUrl, { title: 'Deployed — still starting', hosts });
        log('[deploy] deployed, but the URL has not answered yet — it may need another minute');
      }
    } catch (err) {
      setError(err.message || String(err));
      allChips('failed');
      setMode('failed', 'fail');
    }
    setBusy(false);
    refreshQuota();
  }

  /* ── wiring ─────────────────────────────────────────────────────────────── */

  buildBtn?.addEventListener('click', () => runBuild());

  promptEl?.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      runBuild();
    }
  });

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

  refreshQuota();
})();
