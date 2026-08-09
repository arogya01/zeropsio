/**
 * ZeroOps Studio — Client Logic (Multi-tenant with auth + templates)
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('prompt-form');
  const promptInput = document.getElementById('prompt-input');
  const deployBtn = document.getElementById('deploy-btn');
  const shipBtn = document.getElementById('ship-btn');
  const terminal = document.getElementById('terminal');
  const yamlView = document.getElementById('yaml-view');
  const codeTree = document.getElementById('code-tree');
  const previewFrame = document.getElementById('preview-frame');
  const previewPlaceholder = document.getElementById('preview-placeholder');

  let lastWorkspaceId = null;
  let lastBuildJobId = null;
  let previewReady = false;
  let busy = false;

  const chatWelcome = document.getElementById('chat-welcome');
  const pipelineFeed = document.getElementById('chat-feed') || document.getElementById('pipeline-feed');
  const feedUserMsg = document.getElementById('feed-user-msg');
  const feedSuccess = document.getElementById('feed-success');
  const successLink = document.getElementById('success-link');
  const templateGrid = document.querySelector('.template-grid');

  const wbTabs = document.querySelectorAll('.wb-tab');
  const wbPanes = document.querySelectorAll('.wb-pane');

  const onboarding = document.getElementById('onboarding');
  const openaiOnboarding = document.getElementById('openai-onboarding');
  const userNameEl = document.getElementById('user-name');
  const topbarKeys = document.getElementById('topbar-keys');

  let hasOpenAIKey = false;
  let hasZeropsToken = false;

  const steps = {
    synth: document.getElementById('feed-step-synth'),
    net: document.getElementById('feed-step-net'),
    lxd: document.getElementById('feed-step-lxd'),
    health: document.getElementById('feed-step-health'),
  };

  const aliasMap = {
    'webapp': 'web-frontend',
    'web-frontend': 'web-frontend',
    'apigateway': 'api-gateway',
    'api-gateway': 'api-gateway',
    'aiworker': 'ai-worker',
    'ai-worker': 'ai-worker',
    'postgres': 'db-postgres',
    'db-postgres': 'db-postgres',
    'valkey': 'cache-valkey',
    'cache-valkey': 'cache-valkey'
  };

  const nodes = {
    'web-frontend': document.getElementById('node-web-frontend'),
    'api-gateway': document.getElementById('node-api-gateway'),
    'ai-worker': document.getElementById('node-ai-worker'),
    'db-postgres': document.getElementById('node-db-postgres'),
    'cache-valkey': document.getElementById('node-cache-valkey'),
  };

  function getNode(serviceId) {
    if (!serviceId) return null;
    const canonical = aliasMap[serviceId] || aliasMap[serviceId.toLowerCase()] || serviceId;
    return nodes[canonical] || document.getElementById(`node-${canonical}`) || document.getElementById(serviceId);
  }

  let socket = null;
  let currentUser = null;
  let zeropsToken = sessionStorage.getItem('zerops_pat') || null;
  let selectedTemplateId = null;

  const tokenInput = document.getElementById('zerops-token-input');
  if (tokenInput) {
    tokenInput.addEventListener('input', () => {
      const errEl = document.getElementById('token-error');
      if (errEl) errEl.style.display = 'none';
    });
  }

  function refreshKeyChrome() {
    if (topbarKeys) {
      const o = hasOpenAIKey ? 'openai✓' : 'openai·';
      const z = hasZeropsToken || zeropsToken ? 'pat✓' : 'pat·';
      topbarKeys.textContent = o + ' · ' + z + ' · zcli';
    }
  }

  function openOpenAIModal() {
    if (openaiOnboarding) openaiOnboarding.classList.remove('hidden');
  }
  window.openOpenAIModal = openOpenAIModal;

  async function saveOpenAIKey() {
    const input = document.getElementById('openai-key-input');
    const errEl = document.getElementById('openai-error');
    const key = input ? input.value.trim() : '';
    if (errEl) errEl.style.display = 'none';
    try {
      const res = await fetch('/api/auth/openai-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (errEl) {
          errEl.textContent = data.error || 'Invalid key';
          errEl.style.display = 'block';
        }
        return;
      }
      hasOpenAIKey = true;
      sessionStorage.setItem('has_openai', '1');
      if (openaiOnboarding) openaiOnboarding.classList.add('hidden');
      refreshKeyChrome();
      // PAT only required for Ship — do not block Build
    } catch (e) {
      if (errEl) {
        errEl.textContent = e.message || 'Failed to save key';
        errEl.style.display = 'block';
      }
    }
  }
  window.saveOpenAIKey = saveOpenAIKey;

  function skipPatForNow() {
    if (onboarding) onboarding.classList.add('hidden');
  }
  window.skipPatForNow = skipPatForNow;

  // ─── Auth Check ───
  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        // Unauthenticated: still allow studio for local demo; no force login
        return;
      }
      const data = await res.json();
      if (data && data.user) {
        currentUser = data.user;
        currentUser.hasToken = !!data.hasToken;
        if (userNameEl) userNameEl.textContent = currentUser.name;
        hasOpenAIKey = !!data.hasOpenAIKey || sessionStorage.getItem('has_openai') === '1';
        hasZeropsToken = !!data.hasToken;
        if (data.hasToken) zeropsToken = zeropsToken || sessionStorage.getItem('zerops_pat');
        refreshKeyChrome();

        // OpenAI helps Build; PAT is only for Ship (prompted when shipping)
        if (!hasOpenAIKey && openaiOnboarding) {
          openaiOnboarding.classList.remove('hidden');
        }
      }
    } catch (e) {
      console.log('Auth check bypass:', e);
    }
  }
  checkAuth();

  // ─── Load Templates ───
  async function loadTemplates() {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();

      if (data.templates && data.templates.length > 0 && templateGrid) {
        templateGrid.innerHTML = '';
        data.templates.forEach(t => {
          const btn = document.createElement('button');
          btn.className = 'template-card';
          btn.dataset.templateId = t.id;
          btn.dataset.prompt = t.description || t.name;
          btn.innerHTML = `
            <span class="template-card__icon">${t.icon || '📦'}</span>
            <span class="template-card__label">${t.name}</span>
          `;
          btn.addEventListener('click', () => {
            selectedTemplateId = t.id;
            if (promptInput) {
              promptInput.value = t.description || t.name;
              promptInput.focus();
            }
          });
          templateGrid.appendChild(btn);
        });
      }
    } catch (e) {
      console.log('No templates found:', e);
    }
  }
  loadTemplates();

  // ─── Ctrl/Cmd + Enter ───
  if (promptInput) {
    promptInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (form) form.requestSubmit();
      }
    });
  }

  // ─── Workbench Tab Switching ───
  wbTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      wbTabs.forEach(t => t.classList.remove('active'));
      wbPanes.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const targetPane = document.getElementById(tab.dataset.tab);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // ─── Terminal / xterm.js Integration ───
  let term = null;
  const terminalContainer = document.getElementById('wb-terminal');
  const preTerminal = document.getElementById('terminal');

  function initTerminal() {
    if (typeof window.Terminal === 'function') {
      try {
        term = new window.Terminal({
          cursorBlink: true,
          fontSize: 12,
          fontFamily: "'DM Mono', monospace",
          theme: {
            background: '#0c0c0f',
            foreground: '#7dd3fc',
            cursor: '#e8a427'
          },
          convertEol: true
        });
        if (preTerminal) preTerminal.style.display = 'none';
        term.open(terminalContainer);
        if (window.FitAddon && window.FitAddon.FitAddon) {
          const fitAddon = new window.FitAddon.FitAddon();
          term.loadAddon(fitAddon);
          fitAddon.fit();
        }
        term.writeln('\x1b[33mZeroOps Studio Terminal initialized.\x1b[0m');
        term.writeln('Waiting for deployment logs...\n');
      } catch (e) {
        console.warn('xterm.js fallback to pre tag:', e);
        term = null;
        if (preTerminal) preTerminal.style.display = 'block';
      }
    }
  }
  initTerminal();

  function appendLogMessage(data) {
    const ansiText = data.text || data.message || '';
    if (term) {
      term.writeln(ansiText);
    } else if (preTerminal) {
      const plainText = ansiText.replace(/\x1b\[[0-9;]*m/g, '');
      preTerminal.textContent += plainText + '\n';
      preTerminal.scrollTop = preTerminal.scrollHeight;
    }

    const t = (data.text || data.message || '').toLowerCase();
    if (t.includes('synthesiz') || t.includes('spec')) setStep('synth', 'active');
    if (t.includes('subnet') || t.includes('network') || t.includes('10.160') || t.includes('yaml file was checked')) {
      setStep('synth', 'done');
      setStep('net', 'active');
    }
    if (t.includes('lxd') || t.includes('container') || t.includes('provision') || t.includes('services to be added') || t.includes('stack.create')) {
      setStep('net', 'done');
      setStep('lxd', 'active');
    }
    if (t.includes('health') || t.includes('audit') || t.includes('verif') || t.includes('project imported')) {
      setStep('lxd', 'done');
      setStep('health', 'active');
    }
  }

  // ─── WebSocket Streamer (/ws/logs) ───
  function connectWS() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${proto}//${location.host}/ws/logs`);

    socket.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }

      if (data.type === 'history') {
        if (Array.isArray(data.logs)) {
          data.logs.forEach(log => appendLogMessage(log));
        }
      } else if (data.type === 'log') {
        appendLogMessage(data);
      } else if (data.type === 'topology-update') {
        const node = getNode(data.serviceId);
        if (node) {
          const rawStatus = (data.status || '').toLowerCase();
          const isDb = node.classList.contains('topo-chip--db');
          node.className = `topo-chip ${rawStatus}`;
          if (isDb) node.classList.add('topo-chip--db');

          const hostLabel = data.privateHost || data.privateIp;
          if (hostLabel) {
            const ipEl = node.querySelector('.topo-chip__ip');
            if (ipEl) ipEl.textContent = hostLabel;
          }
        }
      } else if (data.type === 'complete') {
        if (deployBtn) {
          deployBtn.disabled = false;
          deployBtn.innerHTML = 'Deploy <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        }
        setStep('health', 'done');
        if (successLink && data.liveUrl) successLink.href = data.liveUrl;
        if (feedSuccess) feedSuccess.classList.remove('hidden');
        const scroll = document.querySelector('.panel-left__scroll');
        if (scroll) scroll.scrollTop = scroll.scrollHeight;
      }
    };

    socket.onclose = () => setTimeout(connectWS, 3000);
  }
  connectWS();

  // ─── Vibe Build + Ship ───
  const POLL_INTERVAL_MS = 1500;
  const POLL_MAX_MISSES = 8;

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function updateShipEnabled() {
    if (!shipBtn) return;
    shipBtn.disabled = busy || !previewReady || !lastWorkspaceId;
  }

  function clearPreview() {
    previewReady = false;
    lastWorkspaceId = null;
    if (previewFrame) {
      previewFrame.removeAttribute('src');
      previewFrame.style.display = 'none';
    }
    if (previewPlaceholder) previewPlaceholder.style.display = 'flex';
    updateShipEnabled();
  }

  function showPreview(path) {
    if (!path) return;
    if (previewPlaceholder) previewPlaceholder.style.display = 'none';
    if (previewFrame) {
      previewFrame.style.display = 'block';
      previewFrame.src = path;
    }
    previewReady = true;
    updateShipEnabled();
    // Switch to preview tab
    const previewTab = document.querySelector('.wb-tab[data-tab="wb-preview"]');
    if (previewTab) previewTab.click();
  }

  function setBusy(state) {
    busy = state;
    if (deployBtn) deployBtn.disabled = state;
    updateShipEnabled();
  }

  function applyBuildStatus(status) {
    // Map vibe statuses onto feed steps: synth=generate, net=install, lxd=preview, health=ship
    const order = ['synth', 'net', 'lxd'];
    const map = {
      queued: 'synth',
      generating: 'synth',
      installing: 'net',
      preview: 'lxd',
      ready: 'lxd',
      failed: null,
    };
    if (status === 'ready') {
      order.forEach((k) => setStep(k, 'done'));
      const node = getNode('web-frontend');
      if (node) {
        node.className = 'topo-chip healthy';
        const ip = node.querySelector('.topo-chip__ip');
        if (ip) ip.textContent = 'preview ready';
      }
      return;
    }
    if (status === 'failed') {
      const running = order.find((k) => {
        const el = steps[k];
        const st = el && el.querySelector('.feed-step-status');
        return st && st.dataset.status === 'running';
      });
      if (running) setStep(running, 'active');
      const node = getNode('web-frontend');
      if (node) node.className = 'topo-chip failed';
      return;
    }
    const active = map[status];
    const aidx = active ? order.indexOf(active) : -1;
    order.forEach((k, i) => {
      if (aidx < 0) {
        /* leave */
      } else if (i < aidx) setStep(k, 'done');
      else if (i === aidx) setStep(k, 'active');
    });
    const node = getNode('web-frontend');
    if (node) node.className = 'topo-chip building';
  }

  async function pollVibeJob(url, onEvent, onSnap) {
    let from = 0;
    let misses = 0;
    for (;;) {
      let snapshot;
      try {
        const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'from=' + from, {
          headers: { Accept: 'application/json' },
          credentials: 'include',
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
        appendLogMessage({ text: '[build] lost contact, retrying (' + misses + ')' });
        await sleep(POLL_INTERVAL_MS);
        continue;
      }
      if (onSnap) onSnap(snapshot);
      (snapshot.events || []).forEach(onEvent);
      from = typeof snapshot.next === 'number' ? snapshot.next : from;
      if (snapshot.done || snapshot.status === 'ready' || snapshot.status === 'failed') {
        return snapshot;
      }
      await sleep(POLL_INTERVAL_MS);
    }
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const prompt = promptInput ? promptInput.value.trim() : '';
      if (!prompt || busy) return;

      // OpenAI required for Build when logged in; server may still have DEMO key
      if (currentUser && !hasOpenAIKey && openaiOnboarding) {
        openaiOnboarding.classList.remove('hidden');
        // still attempt — server may use OPENAI_API_KEY / demo key
      }

      if (chatWelcome) chatWelcome.classList.add('hidden');
      if (pipelineFeed) pipelineFeed.classList.remove('hidden');
      if (feedUserMsg) feedUserMsg.textContent = prompt;
      if (feedSuccess) feedSuccess.classList.add('hidden');

      setBusy(true);
      clearPreview();
      lastBuildJobId = null;
      if (deployBtn) deployBtn.textContent = 'Building…';
      if (preTerminal) preTerminal.textContent = '';
      if (term) term.clear();

      Object.values(steps).forEach(s => {
        if (!s) return;
        s.className = 'feed-msg feed-msg--system';
        const st = s.querySelector('.feed-step-status');
        if (st) { st.textContent = 'waiting'; st.dataset.status = 'waiting'; }
      });

      const node = getNode('web-frontend');
      if (node) node.className = 'topo-chip building';

      appendLogMessage({ text: '[build] starting vibe generate → install → preview (no deploy)' });

      try {
        const res = await fetch('/api/vibe/build', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ prompt }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.jobId) {
          const msg =
            data.message ||
            data.error ||
            (res.status === 503
              ? 'Add OpenAI API key (or set server OPENAI_API_KEY) to Build.'
              : 'Build failed to start');
          appendLogMessage({ text: '[error] ' + msg });
          if (data.code === 'OPENAI_API_KEY_REQUIRED' || res.status === 503) {
            if (openaiOnboarding) openaiOnboarding.classList.remove('hidden');
          }
          applyBuildStatus('failed');
          setBusy(false);
          if (deployBtn) deployBtn.textContent = 'Build';
          return;
        }

        lastBuildJobId = data.jobId;
        appendLogMessage({ text: '[build] job ' + data.jobId });

        const finalSnap = await pollVibeJob(
          '/api/vibe/build/' + encodeURIComponent(data.jobId),
          (msg) => {
            if (msg.type === 'log') appendLogMessage({ text: msg.text || msg.message || '' });
            else if (msg.type === 'stage') {
              appendLogMessage({ text: '[build] ' + (msg.stage || '') + ': ' + (msg.message || '') });
            } else if (msg.type === 'error') {
              appendLogMessage({ text: '[error] ' + (msg.error || 'build failed') });
            } else if (msg.type === 'plan' && msg.plan && yamlView) {
              yamlView.textContent = msg.plan;
            }
          },
          (snap) => {
            applyBuildStatus(snap.status);
            if (snap.plan && yamlView) yamlView.textContent = snap.plan;
            if (snap.codeFiles) renderCodeFiles(snap.codeFiles);
            if (snap.workspaceId) lastWorkspaceId = snap.workspaceId;
          },
        );

        if (finalSnap.status === 'ready') {
          lastWorkspaceId = finalSnap.workspaceId || lastWorkspaceId;
          const path =
            finalSnap.previewPath ||
            finalSnap.previewUrl ||
            (lastWorkspaceId ? '/api/vibe/preview/' + lastWorkspaceId + '/' : null);
          if (finalSnap.plan && yamlView) yamlView.textContent = finalSnap.plan;
          if (finalSnap.codeFiles) renderCodeFiles(finalSnap.codeFiles);
          applyBuildStatus('ready');
          if (path) showPreview(path);
          appendLogMessage({ text: '[build] preview ready — click Ship to deploy' });
        } else {
          applyBuildStatus('failed');
          appendLogMessage({ text: '[error] ' + (finalSnap.error || 'Build failed') });
          clearPreview();
        }
      } catch (err) {
        appendLogMessage({ text: '[error] ' + (err.message || String(err)) });
        applyBuildStatus('failed');
        clearPreview();
      }

      setBusy(false);
      if (deployBtn) deployBtn.textContent = 'Build';
      if (promptInput) promptInput.value = '';
      selectedTemplateId = null;
    });
  }

  if (shipBtn) {
    shipBtn.addEventListener('click', async () => {
      if (busy || !previewReady || !lastWorkspaceId) return;

      const activeToken = zeropsToken || sessionStorage.getItem('zerops_pat');
      hasZeropsToken = !!(activeToken || hasZeropsToken || (currentUser && currentUser.hasToken));
      if (!hasZeropsToken && onboarding) {
        // Server may have DEMO_PAT — still try; show modal on 503
      }

      setBusy(true);
      if (feedSuccess) feedSuccess.classList.add('hidden');
      setStep('health', 'active');
      appendLogMessage({ text: '[ship] packaging static SPA and deploying to Zerops…' });

      try {
        const body = { workspaceId: lastWorkspaceId };
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
              ? 'Add a Zerops PAT (or set DEMO_PAT on the server) to Ship.'
              : 'Ship failed to start');
          appendLogMessage({ text: '[error] ' + msg });
          if (data.code === 'ZEROPS_TOKEN_REQUIRED' || res.status === 503) {
            if (onboarding) onboarding.classList.remove('hidden');
          }
          setBusy(false);
          return;
        }

        appendLogMessage({ text: '[ship] job ' + data.jobId });
        const finalSnap = await pollVibeJob(
          '/api/vibe/ship/' + encodeURIComponent(data.jobId),
          (msg) => {
            if (msg.type === 'log') appendLogMessage({ text: msg.text || msg.message || '' });
            else if (msg.type === 'stage') {
              appendLogMessage({ text: '[ship] ' + (msg.stage || '') + ': ' + (msg.message || '') });
            } else if (msg.type === 'error') {
              appendLogMessage({ text: '[error] ' + (msg.error || 'ship failed') });
            }
          },
        );

        if (finalSnap.liveUrl) {
          setStep('health', 'done');
          if (successLink) {
            successLink.href = finalSnap.liveUrl;
            successLink.textContent = finalSnap.liveUrl;
          }
          if (feedSuccess) feedSuccess.classList.remove('hidden');
          appendLogMessage({
            text:
              '[live] ' +
              finalSnap.liveUrl +
              (finalSnap.httpStatus != null ? ' → HTTP ' + finalSnap.httpStatus : ''),
          });
          const node = getNode('web-frontend');
          if (node) {
            node.className = 'topo-chip healthy';
            const ip = node.querySelector('.topo-chip__ip');
            if (ip) ip.textContent = 'live';
          }
        } else {
          appendLogMessage({ text: '[error] ' + (finalSnap.error || 'Ship finished without a live URL') });
        }
      } catch (err) {
        appendLogMessage({ text: '[error] ' + (err.message || String(err)) });
      }
      setBusy(false);
    });
  }

  updateShipEnabled();

  function setStep(key, state) {

    const el = steps[key];
    if (!el) return;
    el.className = `feed-msg feed-msg--system ${state}`;
    const statusEl = el.querySelector('.feed-step-status');
    if (statusEl) {
      if (state === 'active') { statusEl.textContent = 'running'; statusEl.dataset.status = 'running'; }
      if (state === 'done') { statusEl.textContent = 'done'; statusEl.dataset.status = 'done'; }
    }
  }

  function renderCodeFiles(files) {
    const fileList = document.getElementById('code-file-list');
    const activeFilename = document.getElementById('code-active-filename');
    const activeContent = document.getElementById('code-active-content');
    if (codeTree) codeTree.innerHTML = '';

    if (!files || Object.keys(files).length === 0) return;

    if (fileList) fileList.innerHTML = '';
    const entries = Object.entries(files);

    entries.forEach(([filename, content], index) => {
      if (fileList) {
        const li = document.createElement('li');
        li.className = 'code-inspector__file-item' + (index === 0 ? ' active' : '');
        li.dataset.filename = filename;
        li.innerHTML = `<span class="file-icon">📄</span> ${filename}`;

        li.addEventListener('click', () => {
          document.querySelectorAll('.code-inspector__file-item').forEach(el => el.classList.remove('active'));
          li.classList.add('active');
          if (activeFilename) activeFilename.textContent = filename;
          if (activeContent) activeContent.textContent = content;
        });

        fileList.appendChild(li);
      }

      if (codeTree) {
        const block = document.createElement('div');
        block.className = 'code-tree__file';
        const header = document.createElement('div');
        header.className = 'code-tree__filename';
        header.textContent = filename;
        const pre = document.createElement('pre');
        pre.className = 'code-tree__content';
        pre.textContent = content;
        block.appendChild(header);
        block.appendChild(pre);
        codeTree.appendChild(block);
      }
    });

    if (entries.length > 0) {
      const [firstFile, firstContent] = entries[0];
      if (activeFilename) activeFilename.textContent = firstFile;
      if (activeContent) activeContent.textContent = firstContent;
    }
  }

  // ─── Global functions for onboarding + logout ───
  window.saveToken = async function() {
    const tokenInput = document.getElementById('zerops-token-input');
    const token = tokenInput ? tokenInput.value.trim() : '';
    const errEl = document.getElementById('token-error');

    if (!token) {
      if (errEl) {
        errEl.textContent = 'Token cannot be empty';
        errEl.style.display = 'block';
      }
      return;
    }

    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data.success) {
        zeropsToken = token;
        sessionStorage.setItem('zerops_pat', token);
        hasZeropsToken = true;
        if (currentUser) currentUser.hasToken = true;
        refreshKeyChrome();

        // Register token with server for WebSockets
        await fetch('/api/ws-token', { method: 'POST' }).catch(() => {});

        onboarding.classList.add('hidden');
        if (errEl) errEl.style.display = 'none';
        if (tokenInput) tokenInput.value = '';
      } else {
        if (errEl) {
          errEl.textContent = data.error || 'Failed to save token';
          errEl.style.display = 'block';
        }
      }
    } catch {
      if (errEl) {
        errEl.textContent = 'Connection error';
        errEl.style.display = 'block';
      }
    }
  };

  window.openTokenModal = function() {
    const errEl = document.getElementById('token-error');
    if (errEl) errEl.style.display = 'none';
    onboarding.classList.remove('hidden');
  };

  window.logout = async function() {
    sessionStorage.removeItem('zerops_pat');
    zeropsToken = null;
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };
});
