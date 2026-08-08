document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('prompt-form-v1');
  const promptInput = document.getElementById('prompt-input-v1');
  const deployBtn = document.getElementById('deploy-btn-v1');
  const termBody = document.getElementById('term-body-v1');
  const yamlBody = document.getElementById('yaml-body-v1');
  const codeBody = document.getElementById('code-body-v1');
  const successBanner = document.getElementById('success-banner-v1');
  const liveLink = document.getElementById('live-link-v1');
  const clearTermBtn = document.getElementById('clear-term-v1');
  const rayChips = document.querySelectorAll('.ray-chip');
  const cTabs = document.querySelectorAll('.c-tab');
  const cPanes = document.querySelectorAll('.c-pane');

  let socket = null;

  // Keyboard shortcut listener
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '1') {
      e.preventDefault();
      rayChips[0]?.click();
    } else if ((e.metaKey || e.ctrlKey) && e.key === '2') {
      e.preventDefault();
      rayChips[1]?.click();
    } else if ((e.metaKey || e.ctrlKey) && e.key === '3') {
      e.preventDefault();
      rayChips[2]?.click();
    }
  });

  // Preset Chips
  rayChips.forEach(chip => {
    chip.addEventListener('click', () => {
      promptInput.value = chip.getAttribute('data-prompt');
      promptInput.focus();
    });
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
      termBody.textContent = 'zcp-control-plane://log-stream.stdout (cleared)\n';
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
        const nodeStatus = document.querySelector(`#v1-node-${data.serviceId} .n-status`);
        if (nodeStatus) {
          nodeStatus.className = `n-status status-${data.status}`;
          nodeStatus.textContent = data.status.toUpperCase();
        }
      } else if (data.type === 'complete') {
        deployBtn.disabled = false;
        deployBtn.querySelector('span').textContent = 'Synthesize & Deploy on Zerops via ZCP';

        successBanner.classList.remove('hidden');
        liveLink.href = data.liveUrl;
        liveLink.textContent = `Open App (${data.liveUrl}) ↗`;
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
    deployBtn.querySelector('span').textContent = 'ZCP Pipeline Running...';
    termBody.textContent = '';
    successBanner.classList.add('hidden');

    document.querySelectorAll('.n-status').forEach(el => {
      el.className = 'n-status status-building';
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
        renderCodeInspector(synthData.codeFiles);
      }
    } catch (err) { console.error(err); }

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action: 'deploy', prompt: promptText }));
    }
  });

  function renderCodeInspector(files) {
    codeBody.innerHTML = '';
    for (const [filename, content] of Object.entries(files)) {
      const card = document.createElement('div');
      card.style.marginBottom = '1rem';
      card.innerHTML = `
        <div style="font-family:var(--font-mono); font-size:0.75rem; color:var(--indigo); margin-bottom:0.25rem;">📄 ${filename}</div>
        <pre class="code-body" style="height:auto; max-height:160px; background:#0c0d10; padding:0.6rem; border-radius:6px;">${content}</pre>
      `;
      codeBody.appendChild(card);
    }
  }
});
