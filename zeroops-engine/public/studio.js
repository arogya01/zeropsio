/**
 * ZeroOps Studio — Client Logic (Bolt.new-inspired layout)
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('prompt-form');
  const promptInput = document.getElementById('prompt-input');
  const deployBtn = document.getElementById('deploy-btn');
  const terminal = document.getElementById('terminal');
  const yamlView = document.getElementById('yaml-view');
  const codeTree = document.getElementById('code-tree');

  const chatWelcome = document.getElementById('chat-welcome');
  const pipelineFeed = document.getElementById('pipeline-feed');
  const feedUserMsg = document.getElementById('feed-user-msg');
  const feedSuccess = document.getElementById('feed-success');
  const successLink = document.getElementById('success-link');

  const templateCards = document.querySelectorAll('.template-card');
  const wbTabs = document.querySelectorAll('.wb-tab');
  const wbPanes = document.querySelectorAll('.wb-pane');

  const steps = {
    synth: document.getElementById('feed-step-synth'),
    net: document.getElementById('feed-step-net'),
    lxd: document.getElementById('feed-step-lxd'),
    health: document.getElementById('feed-step-health'),
  };

  const nodes = {
    'web-frontend': document.getElementById('node-web-frontend'),
    'api-gateway': document.getElementById('node-api-gateway'),
    'ai-worker': document.getElementById('node-ai-worker'),
    'db-postgres': document.getElementById('node-db-postgres'),
    'cache-valkey': document.getElementById('node-cache-valkey'),
  };

  let socket = null;

  // ─── Template Cards ───
  templateCards.forEach(card => {
    card.addEventListener('click', () => {
      promptInput.value = card.dataset.prompt;
      promptInput.focus();
    });
  });

  // ─── Ctrl/Cmd + Enter ───
  promptInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  // ─── Workbench Tab Switching ───
  wbTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      wbTabs.forEach(t => t.classList.remove('active'));
      wbPanes.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });

  // ─── WebSocket ───
  function connectWS() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${proto}//${location.host}`);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'log') {
        terminal.textContent += data.text + '\n';
        terminal.scrollTop = terminal.scrollHeight;

        // Detect pipeline phases
        const t = data.text.toLowerCase();
        if (t.includes('synthesiz')) setStep('synth', 'active');
        if (t.includes('subnet') || t.includes('network') || t.includes('10.160')) {
          setStep('synth', 'done');
          setStep('net', 'active');
        }
        if (t.includes('lxd') || t.includes('container') || t.includes('provision')) {
          setStep('net', 'done');
          setStep('lxd', 'active');
        }
        if (t.includes('health') || t.includes('audit') || t.includes('verif')) {
          setStep('lxd', 'done');
          setStep('health', 'active');
        }

      } else if (data.type === 'topology-update') {
        const node = nodes[data.serviceId];
        if (node) {
          node.className = 'topo-chip ' + data.status;
          if (data.serviceId.includes('db') || data.serviceId.includes('cache')) {
            node.classList.add('topo-chip--db');
          }
        }

      } else if (data.type === 'complete') {
        deployBtn.disabled = false;
        deployBtn.innerHTML = 'Deploy <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

        setStep('health', 'done');

        successLink.href = data.liveUrl;
        feedSuccess.classList.remove('hidden');

        // Scroll feed to bottom
        const scroll = document.querySelector('.panel-left__scroll');
        scroll.scrollTop = scroll.scrollHeight;
      }
    };

    socket.onclose = () => setTimeout(connectWS, 3000);
  }

  connectWS();

  // ─── Form Submit ───
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    // Transition to pipeline view
    chatWelcome.classList.add('hidden');
    pipelineFeed.classList.remove('hidden');
    feedUserMsg.textContent = prompt;
    feedSuccess.classList.add('hidden');

    deployBtn.disabled = true;
    deployBtn.textContent = 'Deploying…';
    terminal.textContent = '';

    // Reset pipeline steps
    Object.values(steps).forEach(s => {
      s.className = 'feed-msg feed-msg--system';
      const st = s.querySelector('.feed-step-status');
      if (st) { st.textContent = 'waiting'; st.dataset.status = 'waiting'; }
    });

    // Set all nodes to building
    Object.values(nodes).forEach(n => {
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
        yamlView.textContent = result.zeropsYml;
        renderCodeFiles(result.codeFiles);
      }
    } catch (err) {
      console.error('Synthesis error:', err);
    }

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action: 'deploy', prompt }));
    }

    promptInput.value = '';
  });

  function setStep(key, state) {
    const el = steps[key];
    if (!el) return;
    el.className = `feed-msg feed-msg--system ${state}`;
    const statusEl = el.querySelector('.feed-step-status');
    if (state === 'active') { statusEl.textContent = 'running'; statusEl.dataset.status = 'running'; }
    if (state === 'done') { statusEl.textContent = 'done'; statusEl.dataset.status = 'done'; }
  }

  function renderCodeFiles(files) {
    codeTree.innerHTML = '';
    for (const [filename, content] of Object.entries(files)) {
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
  }
});
