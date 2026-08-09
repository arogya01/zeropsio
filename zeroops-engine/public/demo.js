/**
 * ZeroOps public /demo client
 * Canvas theater + optional real deploy (operator PAT, capped).
 *
 * Two-stage page: the hero holds the prompt, and the workbench below it is
 * revealed on the first run. Everything the scaffold API returns —
 * zerops-import.yml, generated code files, template confidence — gets rendered,
 * because the artifacts are the proof that something real was built.
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
  const liveLink = document.getElementById('live-link');
  const liveHosts = document.getElementById('live-hosts');
  const workbench = document.getElementById('workbench');
  const templatePill = document.getElementById('template-pill');
  const confidencePill = document.getElementById('confidence-pill');
  const llmPill = document.getElementById('llm-pill');
  const filesBox = document.getElementById('files-box');
  const filesList = document.getElementById('files-list');
  const filesCount = document.getElementById('files-count');
  const yamlBox = document.getElementById('yaml-box');
  const yamlCode = document.getElementById('yaml-code');
  const copyBtn = document.getElementById('btn-copy-yaml');

  let selectedTemplateId = 'ai-video-clipper';
  let lastScaffold = null;
  let revealed = false;

  const nodeIds = [
    'web-frontend',
    'api-gateway',
    'ai-worker',
    'db-postgres',
    'cache-valkey',
  ];

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
    if (tag === '[deploy]') return ' log-tag--ok';
    if (tag === '[llm]') return ' log-tag--run';
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

  function resetCanvas(keepLog) {
    nodeIds.forEach((id) => setChip(id, 'idle'));
    if (!keepLog) clearLog();
    if (successBox) successBox.hidden = true;
    setMode('idle');
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function animateSteps(steps) {
    setMode('building', 'run');
    for (const id of nodeIds) setChip(id, 'building');
    for (const step of steps || []) {
      await sleep(step.delayMs || 400);
      setChip(step.serviceId, step.status || 'healthy', step.privateHost);
      log('[topology] ' + step.serviceId + ' → ' + (step.status || 'healthy'));
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
    setPill(
      confidencePill,
      data.confidence != null ? 'confidence ' + data.confidence : ''
    );
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

  function showLive(url) {
    if (!url || !successBox || !liveLink) return;
    successBox.hidden = false;
    liveLink.href = url;
    liveLink.textContent = url;
    document.body.dataset.stage = 'done';

    if (liveHosts) {
      liveHosts.textContent = '';
      const topology = (lastScaffold && lastScaffold.topology) || [];
      topology.forEach((s) => {
        const li = document.createElement('li');
        li.textContent = s.privateHost || s.id;
        liveHosts.appendChild(li);
      });
    }
  }

  /* ── template pills ─────────────────────────────────────────────────────── */

  document.querySelectorAll('.template-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.template-card').forEach((b) => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      selectedTemplateId = btn.dataset.id;
      if (promptEl && !promptEl.value.trim()) {
        const labels = {
          'ai-video-clipper': 'AI video clipper with Whisper transcription and a job queue',
          'ecommerce-platform': 'E-commerce store with cart, orders, and product catalog',
          'rag-search-engine': 'RAG search over company docs with embeddings and chat',
        };
        promptEl.value = labels[selectedTemplateId] || '';
      }
    });
  });
  const first = document.querySelector('.template-card[data-id="ai-video-clipper"]');
  if (first) first.classList.add('is-selected');

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
        quotaLine.textContent = parts.join(' · ');
      }
      return data;
    } catch {
      if (quotaLine) quotaLine.textContent = 'quota unavailable';
      return null;
    }
  }

  function payload() {
    return {
      prompt: (promptEl && promptEl.value.trim()) || '',
      templateId: selectedTemplateId,
    };
  }

  async function runScaffold() {
    setError('');
    revealWorkbench();
    resetCanvas();
    setMode('scaffolding', 'run');
    log('[scaffold] mapping prompt → template (open-lovable intent patterns)…');
    try {
      const res = await fetch('/api/demo/scaffold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scaffold failed');
      lastScaffold = data;
      log('[scaffold] template=' + data.templateId + ' project=' + data.projectName);
      if (data.llmUsed) log('[llm] OpenAI flavor applied (Dyad-style <zeroops-write>)');
      else log('[llm] fallback flavor (no key or error)' + (data.llmError ? ': ' + data.llmError : ''));
      showPlan(data.plan);
      renderArtifacts(data);
      (data.topology || []).forEach((s) => {
        setChip(s.id, 'idle', s.privateHost);
      });
      setMode('scaffolded');
    } catch (err) {
      setError(err.message || String(err));
      setMode('error', 'fail');
    }
  }

  /** keepLog is set when this runs as the deploy fallback, so the judge can
   *  still read why the real deploy was refused. */
  async function runSimulate(keepLog) {
    setError('');
    revealWorkbench();
    resetCanvas(keepLog);
    log('[simulate] shared-stack theater…');
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
      showLive(data.liveUrl);
      log('[simulate] live URL (shared / example): ' + data.liveUrl);
    } catch (err) {
      setError(err.message || String(err));
    }
    refreshQuota();
  }

  async function runDeploy() {
    setError('');
    revealWorkbench();
    resetCanvas();
    setMode('deploying', 'run');
    log('[deploy] requesting real provision under operator PAT…');
    nodeIds.forEach((id) => setChip(id, 'building'));
    try {
      const res = await fetch('/api/demo/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      });
      const data = await res.json();
      if (!res.ok) {
        log('[deploy] blocked: ' + (data.error || res.status));
        if (data.fallback === 'simulate') {
          log('[deploy] falling back to canvas theater');
          await runSimulate(true);
          return;
        }
        throw new Error(data.error || 'Deploy failed');
      }
      lastScaffold = data;
      showPlan(data.plan);
      renderArtifacts(data);
      (data.logs || []).forEach((l) => log(l));
      (data.topology || []).forEach((s) => setChip(s.id, s.status || 'healthy', s.privateHost));
      setMode('healthy', 'ok');
      if (data.liveUrl) showLive(data.liveUrl);
      log('[deploy] done · ' + (data.liveUrl || 'no url'));
    } catch (err) {
      setError(err.message || String(err));
      nodeIds.forEach((id) => setChip(id, 'failed'));
      setMode('failed', 'fail');
    }
    refreshQuota();
  }

  /* ── wiring ─────────────────────────────────────────────────────────────── */

  // Wrapped, not passed by reference: the MouseEvent would land in runSimulate's
  // keepLog argument and read as truthy.
  document.getElementById('btn-scaffold')?.addEventListener('click', () => runScaffold());
  document.getElementById('btn-simulate')?.addEventListener('click', () => runSimulate());
  document.getElementById('btn-deploy')?.addEventListener('click', () => runDeploy());

  promptEl?.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      runScaffold();
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
      setTimeout(() => { copyBtn.textContent = 'copy'; }, 1400);
    }
  });

  refreshQuota();
})();
