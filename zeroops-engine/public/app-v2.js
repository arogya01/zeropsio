document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('prompt-form-v2');
  const promptInput = document.getElementById('prompt-input-v2');
  const deployBtn = document.getElementById('deploy-btn-v2');
  const termBody = document.getElementById('term-body-v2');
  const yamlBody = document.getElementById('yaml-body-v2');
  const successBanner = document.getElementById('success-banner-v2');
  const liveLink = document.getElementById('live-link-v2');
  const liveBtn = document.getElementById('live-btn-v2');
  const vChips = document.querySelectorAll('.v-chip');
  const vTabs = document.querySelectorAll('.v-tab-btn');
  const vPanes = document.querySelectorAll('.v-pane');

  let socket = null;

  vChips.forEach(chip => {
    chip.addEventListener('click', () => {
      promptInput.value = chip.getAttribute('data-prompt');
    });
  });

  vTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      vTabs.forEach(t => t.classList.remove('active'));
      vPanes.forEach(p => p.classList.remove('active'));
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
        const nodeStatus = document.querySelector(`#v2-node-${data.serviceId} .v-s-status`);
        if (nodeStatus) {
          nodeStatus.className = `v-s-status status-${data.status}`;
          nodeStatus.textContent = data.status.toUpperCase();
        }
      } else if (data.type === 'complete') {
        deployBtn.disabled = false;
        deployBtn.querySelector('span').textContent = 'Deploy to Zerops ▲';

        document.querySelectorAll('.v-step').forEach(s => s.classList.add('active'));
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
    deployBtn.querySelector('span').textContent = 'Building Stack ▲...';
    termBody.textContent = '';
    successBanner.classList.add('hidden');

    document.querySelectorAll('.v-s-status').forEach(el => {
      el.className = 'v-s-status status-building';
      el.textContent = 'BUILDING';
    });

    document.querySelectorAll('.v-step').forEach((s, idx) => {
      if (idx === 0) s.classList.add('active');
      else s.classList.remove('active');
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
