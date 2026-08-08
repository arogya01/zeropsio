document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('prompt-form-v4');
  const promptInput = document.getElementById('prompt-input-v4');
  const deployBtn = document.getElementById('deploy-btn-v4');
  const termBody = document.getElementById('term-body-v4');
  const yamlBody = document.getElementById('yaml-body-v4');
  const codeTree = document.getElementById('code-tree-v4');
  const successBanner = document.getElementById('success-banner-v4');
  const liveUrlLink = document.getElementById('live-url-v4');
  const liveBtn = document.getElementById('live-btn-v4');
  const clearTermBtn = document.getElementById('clear-term-v4');
  const presetTags = document.querySelectorAll('.preset-tag');
  const cTabs = document.querySelectorAll('.c-tab');
  const cPanes = document.querySelectorAll('.c-pane');

  let socket = null;

  // Preset Prompts
  presetTags.forEach(tag => {
    tag.addEventListener('click', () => {
      promptInput.value = tag.getAttribute('data-prompt');
      promptInput.focus();
    });
  });

  // Ctrl + Enter shortcut
  promptInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  // Tab switching
  cTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      cTabs.forEach(t => t.classList.remove('active'));
      cPanes.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.getAttribute('data-tab')).classList.add('active');
    });
  });

  if (clearTermBtn) {
    clearTermBtn.addEventListener('click', () => {
      termBody.textContent = 'zcp-control-plane://log-stream.stdout (cleared output)\n';
    });
  }

  // WebSocket Connection
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'log') {
        termBody.textContent += data.text + '\n';
        termBody.scrollTop = termBody.scrollHeight;
      } else if (data.type === 'topology-update') {
        const statusBadge = document.querySelector(`#v4-node-${data.serviceId} .h-badge`);
        if (statusBadge) {
          statusBadge.className = `h-badge status-${data.status}`;
          statusBadge.textContent = data.status.toUpperCase();
        }
      } else if (data.type === 'complete') {
        deployBtn.disabled = false;
        deployBtn.querySelector('span:last-child').textContent = 'SYNTHESIZE & PROVISION ON ZEROPS VIA ZCP';

        successBanner.classList.remove('hidden');
        liveUrlLink.href = data.liveUrl;
        liveUrlLink.textContent = data.liveUrl;
        liveBtn.href = data.liveUrl;
      }
    };

    socket.onclose = () => setTimeout(connectWebSocket, 2000);
  }

  connectWebSocket();

  // Form Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const promptText = promptInput.value.trim();
    if (!promptText) return;

    deployBtn.disabled = true;
    deployBtn.querySelector('span:last-child').textContent = 'ZCP PIPELINE PROVISIONING...';
    termBody.textContent = '';
    successBanner.classList.add('hidden');

    document.querySelectorAll('.h-badge').forEach(el => {
      el.className = 'h-badge status-building';
      el.textContent = 'BUILDING';
    });

    try {
      const res = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText })
      });
      const synthData = await res.json();
      if (synthData.success) {
        yamlBody.textContent = synthData.zeropsYml;
        renderCodeTree(synthData.codeFiles);
      }
    } catch (err) { console.error(err); }

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action: 'deploy', prompt: promptText }));
    }
  });

  function renderCodeTree(files) {
    codeTree.innerHTML = '';
    for (const [filename, content] of Object.entries(files)) {
      const item = document.createElement('div');
      item.style.marginBottom = '1.25rem';
      item.innerHTML = `
        <div style="font-family:var(--font-mono); font-size:0.8rem; font-weight:700; color:var(--cyan); margin-bottom:0.35rem;">📄 ${filename}</div>
        <pre class="code-editor" style="height:auto; max-height:160px;">${content}</pre>
      `;
      codeTree.appendChild(item);
    }
  }
});
