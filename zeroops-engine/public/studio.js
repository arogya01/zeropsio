/**
 * ZeroOps Studio — Client Logic (Multi-tenant with auth + templates)
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('prompt-form');
  const promptInput = document.getElementById('prompt-input');
  const deployBtn = document.getElementById('deploy-btn');
  const terminal = document.getElementById('terminal');
  const yamlView = document.getElementById('yaml-view');
  const codeTree = document.getElementById('code-tree');

  const chatWelcome = document.getElementById('chat-welcome');
  const pipelineFeed = document.getElementById('chat-feed') || document.getElementById('pipeline-feed');
  const feedUserMsg = document.getElementById('feed-user-msg');
  const feedSuccess = document.getElementById('feed-success');
  const successLink = document.getElementById('success-link');
  const templateGrid = document.querySelector('.template-grid');

  const wbTabs = document.querySelectorAll('.wb-tab');
  const wbPanes = document.querySelectorAll('.wb-pane');

  const onboarding = document.getElementById('onboarding');
  const userNameEl = document.getElementById('user-name');

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

  // ─── Auth Check ───
  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.user) {
        currentUser = data.user;
        if (userNameEl) userNameEl.textContent = currentUser.name;
        if (!data.hasToken && !zeropsToken && onboarding) {
          onboarding.classList.remove('hidden');
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

  // ─── Form Submit ───
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const prompt = promptInput ? promptInput.value.trim() : '';
      if (!prompt) return;

      const activeToken = zeropsToken || sessionStorage.getItem('zerops_pat');
      if (!activeToken && currentUser && !currentUser.hasToken) {
        if (onboarding) onboarding.classList.remove('hidden');
        const errEl = document.getElementById('token-error');
        if (errEl) {
          errEl.textContent = 'Please connect your Zerops PAT token before deploying';
          errEl.style.display = 'block';
        }
        return;
      }

      // Transition to pipeline view
      if (chatWelcome) chatWelcome.classList.add('hidden');
      if (pipelineFeed) pipelineFeed.classList.remove('hidden');
      if (feedUserMsg) feedUserMsg.textContent = prompt;
      if (feedSuccess) feedSuccess.classList.add('hidden');

      if (deployBtn) {
        deployBtn.disabled = true;
        deployBtn.textContent = 'Deploying…';
      }
      if (preTerminal) preTerminal.textContent = '';
      if (term) term.clear();

      // Reset pipeline steps
      Object.values(steps).forEach(s => {
        if (!s) return;
        s.className = 'feed-msg feed-msg--system';
        const st = s.querySelector('.feed-step-status');
        if (st) { st.textContent = 'waiting'; st.dataset.status = 'waiting'; }
      });

      // Set all nodes to building
      Object.values(nodes).forEach(n => {
        if (!n) return;
        const isDb = n.classList.contains('topo-chip--db');
        n.className = 'topo-chip building';
        if (isDb) n.classList.add('topo-chip--db');
      });

      try {
        const res = await fetch('/api/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
        });
        const result = await res.json();
        if (result.success) {
          if (yamlView) yamlView.textContent = result.zeropsYml;
          renderCodeFiles(result.codeFiles);
        }
      } catch (err) {
        console.error('Synthesis error:', err);
      }

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          action: 'deploy',
          prompt,
          templateId: selectedTemplateId,
          zeropsToken: activeToken
        }));
      }

      if (promptInput) promptInput.value = '';
      selectedTemplateId = null;
    });
  }

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
        if (currentUser) currentUser.hasToken = true;

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
