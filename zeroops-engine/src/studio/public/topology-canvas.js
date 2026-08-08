/**
 * topology-canvas.js
 * HTML5 2D Canvas Container Topology Map with animated packet flows and glowing health states.
 */

class TopologyCanvas {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.nodes = {
      'web-frontend': {
        id: 'web-frontend',
        name: 'web-frontend',
        type: 'Node.js Runtime',
        status: 'IDLE',
        x: 120,
        y: 80,
        width: 140,
        height: 64,
        privateIp: '10.160.0.12:3000'
      },
      'api-gateway': {
        id: 'api-gateway',
        name: 'api-gateway',
        type: 'Go API Gateway',
        status: 'IDLE',
        x: 390,
        y: 80,
        width: 140,
        height: 64,
        privateIp: '10.160.0.15:8080'
      },
      'ai-worker': {
        id: 'ai-worker',
        name: 'ai-worker',
        type: 'Python Worker',
        status: 'IDLE',
        x: 660,
        y: 80,
        width: 140,
        height: 64,
        privateIp: '10.160.0.18:5000'
      },
      'db-postgres': {
        id: 'db-postgres',
        name: 'db-postgres',
        type: 'PostgreSQL HA',
        status: 'IDLE',
        x: 390,
        y: 220,
        width: 140,
        height: 64,
        privateIp: '10.160.0.21:5432'
      },
      'cache-valkey': {
        id: 'cache-valkey',
        name: 'cache-valkey',
        type: 'Valkey Cache',
        status: 'IDLE',
        x: 660,
        y: 220,
        width: 140,
        height: 64,
        privateIp: '10.160.0.25:6379'
      }
    };

    this.edges = [
      { from: 'web-frontend', to: 'api-gateway' },
      { from: 'api-gateway', to: 'ai-worker' },
      { from: 'api-gateway', to: 'db-postgres' },
      { from: 'api-gateway', to: 'cache-valkey' },
      { from: 'ai-worker', to: 'db-postgres' },
      { from: 'ai-worker', to: 'cache-valkey' }
    ];

    this.particles = [];
    this.animationFrame = null;
    this.selectedNodeId = null;

    this.initCanvas();
    this.initEvents();
    this.startAnimation();
  }

  initCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);

    // Create animated network particles
    this.particles = [];
    for (let i = 0; i < 16; i++) {
      const edge = this.edges[i % this.edges.length];
      this.particles.push({
        edge,
        progress: Math.random(),
        speed: 0.005 + Math.random() * 0.008
      });
    }
  }

  initEvents() {
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      let clicked = null;
      for (const key in this.nodes) {
        const node = this.nodes[key];
        if (
          x >= node.x - node.width / 2 &&
          x <= node.x + node.width / 2 &&
          y >= node.y - node.height / 2 &&
          y <= node.y + node.height / 2
        ) {
          clicked = node;
          break;
        }
      }

      this.selectedNodeId = clicked ? clicked.id : null;
      this.showNodePopover(clicked);
    });

    window.addEventListener('resize', () => {
      this.initCanvas();
    });
  }

  showNodePopover(node) {
    const popover = document.getElementById('node-detail-panel');
    if (!popover) return;

    if (!node) {
      popover.classList.add('hidden');
      return;
    }

    document.getElementById('detail-node-name').textContent = node.name;
    document.getElementById('detail-node-type').textContent = node.type;
    document.getElementById('detail-node-status').textContent = node.status;
    document.getElementById('detail-node-ip').textContent = node.privateIp || '10.160.0.x';

    popover.classList.remove('hidden');

    const closeBtn = document.getElementById('close-popover');
    if (closeBtn) {
      closeBtn.onclick = () => popover.classList.add('hidden');
    }
  }

  updateNodeStatus(serviceId, status, privateIp) {
    let targetKey = serviceId;
    if (!this.nodes[targetKey]) {
      // Map generic names
      if (serviceId.includes('frontend') || serviceId === 'web') targetKey = 'web-frontend';
      else if (serviceId.includes('api') || serviceId.includes('gateway')) targetKey = 'api-gateway';
      else if (serviceId.includes('worker') || serviceId.includes('ai')) targetKey = 'ai-worker';
      else if (serviceId.includes('postgres') || serviceId === 'db') targetKey = 'db-postgres';
      else if (serviceId.includes('valkey') || serviceId === 'cache') targetKey = 'cache-valkey';
    }

    if (this.nodes[targetKey]) {
      this.nodes[targetKey].status = status.toUpperCase();
      if (privateIp) {
        this.nodes[targetKey].privateIp = privateIp;
      }
    }
  }

  getStatusColor(status) {
    switch (status) {
      case 'HEALTHY':
      case 'READY':
      case 'RUNNING':
        return '#22c55e'; // Green
      case 'BUILDING':
      case 'DEPLOYING':
        return '#eab308'; // Amber
      case 'FAILED':
      case 'ERROR':
        return '#ef4444'; // Red
      default:
        return '#64748b'; // Slate/Gray
    }
  }

  drawEdges() {
    for (const edge of this.edges) {
      const from = this.nodes[edge.from];
      const to = this.nodes[edge.to];
      if (!from || !to) continue;

      this.ctx.beginPath();
      this.ctx.moveTo(from.x, from.y);
      this.ctx.lineTo(to.x, to.y);
      this.ctx.strokeStyle = '#1e293b';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }
  }

  drawParticles() {
    for (const p of this.particles) {
      const from = this.nodes[p.edge.from];
      const to = this.nodes[p.edge.to];
      if (!from || !to) continue;

      p.progress += p.speed;
      if (p.progress >= 1) p.progress = 0;

      const px = from.x + (to.x - from.x) * p.progress;
      const py = from.y + (to.y - from.y) * p.progress;

      this.ctx.beginPath();
      this.ctx.arc(px, py, 3, 0, Math.PI * 2);
      this.ctx.fillStyle = '#06b6d4';
      this.ctx.shadowColor = '#06b6d4';
      this.ctx.shadowBlur = 8;
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    }
  }

  drawNodes() {
    const time = Date.now() * 0.003;

    for (const key in this.nodes) {
      const node = this.nodes[key];
      const color = this.getStatusColor(node.status);
      const isSelected = this.selectedNodeId === node.id;

      // Glow effect for building/healthy states
      if (node.status === 'BUILDING') {
        const pulse = Math.sin(time * 2) * 4 + 6;
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = pulse;
      } else if (node.status === 'HEALTHY' || node.status === 'READY') {
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 10;
      } else if (isSelected) {
        this.ctx.shadowColor = '#06b6d4';
        this.ctx.shadowBlur = 12;
      } else {
        this.ctx.shadowBlur = 0;
      }

      // Draw Container Card Background
      this.ctx.fillStyle = '#0f172a';
      this.ctx.strokeStyle = isSelected ? '#06b6d4' : color;
      this.ctx.lineWidth = isSelected ? 2 : 1.5;

      const x = node.x - node.width / 2;
      const y = node.y - node.height / 2;

      this.ctx.beginPath();
      this.ctx.roundRect(x, y, node.width, node.height, 8);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;

      // Status indicator pill dot
      this.ctx.beginPath();
      this.ctx.arc(x + 16, y + 20, 5, 0, Math.PI * 2);
      this.ctx.fillStyle = color;
      this.ctx.fill();

      // Node Name Title
      this.ctx.font = '600 12px Inter, sans-serif';
      this.ctx.fillStyle = '#f8fafc';
      this.ctx.fillText(node.name, x + 28, y + 24);

      // Node Type Subtitle
      this.ctx.font = '400 10px Inter, sans-serif';
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.fillText(node.type, x + 16, y + 42);

      // IP Tag
      this.ctx.font = '400 9px "JetBrains Mono", monospace';
      this.ctx.fillStyle = '#06b6d4';
      this.ctx.fillText(node.privateIp || '10.160.0.x', x + 16, y + 54);
    }
  }

  render() {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);

    this.drawEdges();
    this.drawParticles();
    this.drawNodes();

    this.animationFrame = requestAnimationFrame(() => this.render());
  }

  startAnimation() {
    if (!this.animationFrame) {
      this.render();
    }
  }

  stopAnimation() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }
}

window.TopologyCanvas = TopologyCanvas;
