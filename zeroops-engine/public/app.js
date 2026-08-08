document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const form = document.getElementById('prompt-form');
  const promptInput = document.getElementById('prompt-input');
  const deployBtn = document.getElementById('deploy-btn');
  const terminalBody = document.getElementById('terminal-body');
  const yamlContent = document.getElementById('yaml-content');
  const codeInspector = document.getElementById('code-inspector');
  const successCard = document.getElementById('success-card');
  const liveUrlLink = document.getElementById('live-url-link');
  const openLiveBtn = document.getElementById('open-live-btn');
  const clearTermBtn = document.getElementById('clear-term-btn');
  const copyYamlBtn = document.getElementById('copy-yaml-btn');
  const presetBtns = document.querySelectorAll('.chip-btn');
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');

  let socket = null;

  // Initialize Canvas Particle Background
  initCanvasBackground();

  // Preset Prompts Click Handler
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      promptInput.value = btn.getAttribute('data-prompt');
      promptInput.focus();
    });
  });

  // Tab Navigation
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      navTabs.forEach(t => t.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.getAttribute('data-tab')).classList.add('active');
    });
  });

  // Clear Terminal Button
  if (clearTermBtn) {
    clearTermBtn.addEventListener('click', () => {
      terminalBody.textContent = 'zcp-control-plane://log-stream.stdout (cleared)\n';
    });
  }

  // Copy zerops.yml Button
  if (copyYamlBtn) {
    copyYamlBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(yamlContent.textContent);
      copyYamlBtn.textContent = 'COPIED!';
      setTimeout(() => { copyYamlBtn.textContent = 'COPY SPEC'; }, 2000);
    });
  }

  // WebSocket Setup
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('[WS] Cybernetic Studio connected to ZCP server');
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'log') {
        appendLog(data.text);
      } else if (data.type === 'topology-update') {
        updateNodeStatus(data.serviceId, data.status);
      } else if (data.type === 'complete') {
        deployBtn.disabled = false;
        deployBtn.querySelector('.btn-content span:last-child').textContent = 'SYNTHESIZE & PROVISION ON ZEROPS VIA ZCP';
        
        successCard.classList.remove('hidden');
        liveUrlLink.href = data.liveUrl;
        liveUrlLink.textContent = data.liveUrl;
        openLiveBtn.href = data.liveUrl;
      }
    };

    socket.onclose = () => {
      setTimeout(connectWebSocket, 2000);
    };
  }

  connectWebSocket();

  // Form Submit Handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const promptText = promptInput.value.trim();
    if (!promptText) return;

    deployBtn.disabled = true;
    deployBtn.querySelector('.btn-content span:last-child').textContent = 'ZCP PROVISIONING IN PROGRESS...';
    terminalBody.textContent = '';
    successCard.classList.add('hidden');

    // Reset topology statuses
    document.querySelectorAll('.node-status').forEach(el => {
      el.className = 'node-status status-building';
      el.textContent = 'BUILDING';
    });

    // Fetch Synthesized Code & Spec
    try {
      const res = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText })
      });
      const synthData = await res.json();
      if (synthData.success) {
        yamlContent.textContent = synthData.zeropsYml;
        renderCodeInspector(synthData.codeFiles);
      }
    } catch (err) {
      console.error('Synthesis error:', err);
    }

    // Dispatch WebSocket Deployment
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        action: 'deploy',
        prompt: promptText
      }));
    }
  });

  function appendLog(text) {
    terminalBody.textContent += text + '\n';
    terminalBody.scrollTop = terminalBody.scrollHeight;
  }

  function updateNodeStatus(serviceId, status) {
    const statusEl = document.querySelector(`#node-${serviceId} .node-status`);
    if (statusEl) {
      statusEl.className = `node-status status-${status}`;
      statusEl.textContent = status.toUpperCase();
    }
  }

  function renderCodeInspector(files) {
    codeInspector.innerHTML = '';
    for (const [filename, content] of Object.entries(files)) {
      const card = document.createElement('div');
      card.style.marginBottom = '1.25rem';
      card.innerHTML = `
        <div style="font-family:var(--font-mono); font-size:0.8rem; font-weight:700; color:var(--neon-cyan); margin-bottom:0.35rem;">📄 ${filename}</div>
        <pre class="code-editor" style="height:auto; max-height:180px;">${content}</pre>
      `;
      codeInspector.appendChild(card);
    }
  }

  // Particle Mesh Background Canvas Function
  function initCanvasBackground() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const particles = Array.from({ length: 45 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 1.5 + 1
    }));

    function draw() {
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = 'rgba(0, 243, 255, 0.25)';
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.04)';

      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      });

      requestAnimationFrame(draw);
    }

    draw();
  }
});
