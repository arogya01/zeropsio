document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('prompt-form-v3');
  const promptInput = document.getElementById('prompt-input-v3');
  const deployBtn = document.getElementById('deploy-btn-v3');
  const termBody = document.getElementById('term-body-v3');
  const yamlBody = document.getElementById('yaml-body-v3');
  const successBanner = document.getElementById('success-banner-v3');
  const liveLink = document.getElementById('live-link-v3');
  const liveBtn = document.getElementById('live-btn-v3');
  const sChips = document.querySelectorAll('.s-chip');
  const sTabs = document.querySelectorAll('.s-tab-btn');
  const sPanes = document.querySelectorAll('.s-pane');

  let socket = null;

  sChips.forEach(chip => {
    chip.addEventListener('click', () => {
      promptInput.value = chip.getAttribute('data-prompt');
    });
  });

  sTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      sTabs.forEach(t => t.classList.remove('active'));
      sPanes.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.getAttribute('data-tab')).classList.add('active');
    });
  });

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
        const nodeBadge = document.querySelector(`#v3-node-${data.serviceId} .s-n-badge`);
        if (nodeBadge) {
          nodeBadge.className = `s-n-badge status-${data.status}`;
          nodeBadge.textContent = data.status.toUpperCase();
        }
      } else if (data.type === 'complete') {
        deployBtn.disabled = false;
        deployBtn.querySelector('span').textContent = '⚡ Synthesize & Provision on Zerops';

        successBanner.classList.remove('hidden');
        liveLink.href = data.liveUrl;
        liveLink.textContent = data.liveUrl;
        liveBtn.href = data.liveUrl;
      }
    };

    socket.onclose = () => setTimeout(connectWebSocket, 2000);
  }

  connectWebSocket();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const promptText = promptInput.value.trim();
    if (!promptText) return;

    deployBtn.disabled = true;
    deployBtn.querySelector('span').textContent = '⚡ Provisioning Stack via ZCP...';
    termBody.textContent = '';
    successBanner.classList.add('hidden');

    document.querySelectorAll('.s-n-badge').forEach(el => {
      el.className = 's-n-badge status-building';
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
      }
    } catch (err) { console.error(err); }

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action: 'deploy', prompt: promptText }));
    }
  });
});
