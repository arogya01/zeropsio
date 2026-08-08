/**
 * app.js
 * ZeroOps Web Studio SPA Client Application.
 * Connects to WebSocket /ws/logs, renders xterm.js terminal, handles synthesis & deployment workflows.
 */

document.addEventListener('DOMContentLoaded', () => {
  let ws = null;
  let term = null;
  let topologyCanvas = null;
  let synthesizedFiles = {};

  // Initialize Topology Canvas
  if (window.TopologyCanvas) {
    topologyCanvas = new window.TopologyCanvas('topology-canvas');
  }

  // Initialize xterm.js terminal
  initTerminal();

  // Connect WebSocket Log Streamer
  connectWebSocket();

  // Wire UI Controls
  setupTabSwitching();
  setupPresetButtons();
  setupFormHandlers();
  setupCopyButton();

  /**
   * Initialize xterm.js Terminal with fallback pre container
   */
  function initTerminal() {
    const container = document.getElementById('terminal-container');
    if (!container) return;

    if (window.Terminal) {
      term = new window.Terminal({
        cursorBlink: true,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 13,
        theme: {
          background: '#050508',
          foreground: '#f8fafc',
          cursor: '#06b6d4',
          selectionBackground: 'rgba(6, 182, 212, 0.3)',
          black: '#09090b',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#f8fafc'
        }
      });
      term.open(container);
      term.writeln('\x1b[36m⚡ ZeroOps Log Streamer Gateway initialized.\x1b[0m');
      term.writeln('\x1b[90mWaiting for deployment commands...\x1b[0m\n');
    } else {
      // Fallback pre element if CDN xterm is offline
      container.innerHTML = '<pre id="terminal-fallback" class="code-block" style="height: 100%; overflow-y: auto; color: #f8fafc; font-family: monospace; font-size: 13px;"></pre>';
    }
  }

  function writeToTerminal(text) {
    if (term) {
      term.writeln(text);
    } else {
      const fallback = document.getElementById('terminal-fallback');
      if (fallback) {
        fallback.textContent += text + '\n';
        fallback.scrollTop = fallback.scrollHeight;
      }
    }
  }

  /**
   * Establish WebSocket connection to /ws/logs
   */
  function connectWebSocket() {
    const statusDot = document.getElementById('ws-status-dot');
    const statusText = document.getElementById('ws-status-text');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/logs`;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (statusDot) statusDot.className = 'status-dot connected';
        if (statusText) statusText.textContent = 'WS Connected';
        writeToTerminal('\x1b[32m✔ Connected to WebSocket /ws/logs\x1b[0m');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleWebSocketMessage(msg);
        } catch {
          writeToTerminal(event.data);
        }
      };

      ws.onclose = () => {
        if (statusDot) statusDot.className = 'status-dot error';
        if (statusText) statusText.textContent = 'Disconnected';
        // Auto reconnect after 3s
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = () => {
        if (statusDot) statusDot.className = 'status-dot error';
        if (statusText) statusText.textContent = 'Connection Error';
      };
    } catch (err) {
      if (statusText) statusText.textContent = 'WS Unavailable';
    }
  }

  /**
   * Dispatch WebSocket Message Events
   */
  function handleWebSocketMessage(msg) {
    if (msg.type === 'log') {
      const lineText = msg.text || `[${msg.service}] ${msg.message}`;
      writeToTerminal(lineText);
    } else if (msg.type === 'topology-update') {
      if (topologyCanvas) {
        topologyCanvas.updateNodeStatus(msg.serviceId, msg.status, msg.privateIp);
      }
    } else if (msg.type === 'complete') {
      showSuccessBanner(msg.liveUrl, msg.projectName);
      writeToTerminal(`\n\x1b[32m🎉 DEPLOYMENT COMPLETE! Live URL: ${msg.liveUrl}\x1b[0m\n`);
    } else if (msg.type === 'history' && Array.isArray(msg.logs)) {
      for (const logMsg of msg.logs) {
        const text = logMsg.text || `[${logMsg.service}] ${logMsg.message}`;
        writeToTerminal(text);
      }
    }
  }

  /**
   * Setup UI Tab Switching
   */
  function setupTabSwitching() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');

        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));

        btn.classList.add('active');
        const pane = document.getElementById(targetTab);
        if (pane) pane.classList.add('active');
      });
    });
  }

  /**
   * Preset Prompt Pills Click Handler
   */
  function setupPresetButtons() {
    const presetBtns = document.querySelectorAll('.preset-btn');
    const promptInput = document.getElementById('prompt-input');

    presetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const promptText = btn.getAttribute('data-prompt');
        if (promptInput && promptText) {
          promptInput.value = promptText;
        }
      });
    });
  }

  /**
   * Form Submit & Action Buttons Handlers
   */
  function setupFormHandlers() {
    const form = document.getElementById('synthesis-form');
    const btnSynthesize = document.getElementById('btn-synthesize');
    const btnDeploy = document.getElementById('btn-deploy');
    const promptInput = document.getElementById('prompt-input');
    const nameInput = document.getElementById('project-name-input');

    if (btnSynthesize) {
      btnSynthesize.addEventListener('click', async () => {
        const prompt = promptInput ? promptInput.value.trim() : '';
        const projectName = nameInput ? nameInput.value.trim() : 'zeroops-cloud-stack';
        if (!prompt) {
          alert('Please enter a prompt description for your stack.');
          return;
        }
        await triggerSynthesis(prompt, projectName);
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const prompt = promptInput ? promptInput.value.trim() : '';
        const projectName = nameInput ? nameInput.value.trim() : 'zeroops-cloud-stack';
        if (!prompt) {
          alert('Please enter a prompt description for your stack.');
          return;
        }
        await triggerDeployment(prompt, projectName);
      });
    }
  }

  /**
   * Call /api/synthesize endpoint
   */
  function triggerSynthesis(prompt, projectName) {
    writeToTerminal(`\n\x1b[36m🔍 Synthesizing stack architecture for: "${prompt}"...\x1b[0m`);

    return fetch('/api/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, projectName })
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          writeToTerminal(`\x1b[31m❌ Synthesis failed: ${data.error}\x1b[0m`);
          return;
        }

        writeToTerminal(`\x1b[32m✔ Stack topology & code synthesized successfully!\x1b[0m`);

        // Render YAMLs in Blueprint Tab
        const yamlViewer = document.getElementById('yaml-viewer');
        if (yamlViewer) {
          yamlViewer.textContent = `# --- zerops-project-import.yml ---\n${data.zeropsProjectImportYaml}\n\n# --- zerops.yml ---\n${data.zeropsYaml}`;
        }

        // Render Code Artifacts in Inspector Tab
        if (data.codeFiles) {
          synthesizedFiles = data.codeFiles;
          renderFileTree(data.codeFiles);
        }

        // Switch to zerops.yml tab
        const yamlTabBtn = document.querySelector('[data-tab="tab-yaml"]');
        if (yamlTabBtn) yamlTabBtn.click();
      })
      .catch((err) => {
        writeToTerminal(`\x1b[31m❌ Network error during synthesis: ${err.message}\x1b[0m`);
      });
  }

  /**
   * Trigger full deployment pipeline via WebSocket / REST
   */
  function triggerDeployment(prompt, projectName) {
    // Hide success banner
    const banner = document.getElementById('success-banner');
    if (banner) banner.classList.add('hidden');

    // Switch to Terminal log tab
    const termTabBtn = document.querySelector('[data-tab="tab-terminal"]');
    if (termTabBtn) termTabBtn.click();

    // First trigger synthesis to load tabs
    triggerSynthesis(prompt, projectName);

    // Send WebSocket deployment command
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          action: 'deploy',
          prompt,
          projectName
        })
      );
    } else {
      // REST fallback
      fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, projectName })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.liveUrl) {
            showSuccessBanner(data.liveUrl, data.projectName);
          }
        });
    }
  }

  /**
   * Render file tree list for synthesized code inspector
   */
  function renderFileTree(files) {
    const list = document.getElementById('file-tree-list');
    if (!list) return;

    list.innerHTML = '';
    const filePaths = Object.keys(files);

    if (filePaths.length === 0) {
      list.innerHTML = '<li class="empty-state">No files synthesized</li>';
      return;
    }

    filePaths.forEach((filePath, idx) => {
      const li = document.createElement('li');
      li.textContent = filePath;
      li.title = filePath;
      if (idx === 0) {
        li.classList.add('active');
        showCodeFile(filePath, files[filePath]);
      }

      li.addEventListener('click', () => {
        document.querySelectorAll('#file-tree-list li').forEach((el) => el.classList.remove('active'));
        li.classList.add('active');
        showCodeFile(filePath, files[filePath]);
      });

      list.appendChild(li);
    });
  }

  function showCodeFile(filePath, content) {
    const pathHeader = document.getElementById('selected-file-path');
    const codeViewer = document.getElementById('code-viewer');

    if (pathHeader) pathHeader.textContent = filePath;
    if (codeViewer) codeViewer.textContent = content || '// Empty file';
  }

  /**
   * Display Verified Live Deployment Banner
   */
  function showSuccessBanner(liveUrl, projectName) {
    const banner = document.getElementById('success-banner');
    const link = document.getElementById('live-url-link');
    if (banner && link) {
      link.href = liveUrl;
      link.textContent = liveUrl;
      banner.classList.remove('hidden');
    }
  }

  /**
   * Copy Live URL button handler
   */
  function setupCopyButton() {
    const copyBtn = document.getElementById('copy-url-btn');
    const link = document.getElementById('live-url-link');

    if (copyBtn && link) {
      copyBtn.addEventListener('click', () => {
        const url = link.href;
        navigator.clipboard.writeText(url).then(() => {
          const originalText = copyBtn.textContent;
          copyBtn.textContent = 'Copied!';
          setTimeout(() => {
            copyBtn.textContent = originalText;
          }, 2000);
        });
      });
    }
  }
});
