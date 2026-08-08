import http from 'node:http';
import { URL } from 'node:url';

const PORT = process.env.PORT || 3000;
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://apigateway:8080';

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Video Clipper Studio</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 font-sans min-h-screen">
  <div class="max-w-6xl mx-auto p-6 space-y-8">
    <!-- Header -->
    <header class="flex items-center justify-between border-b border-slate-800 pb-5">
      <div class="flex items-center space-x-3">
        <span class="text-4xl">🎬</span>
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-white">AI Video Clipper</h1>
          <p class="text-xs text-slate-400">Powered by Go API Gateway & Whisper AI Worker on Zerops</p>
        </div>
      </div>
      <div class="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-full px-4 py-1.5 text-xs">
        <span class="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <span class="font-semibold text-emerald-400">STACK ONLINE</span>
      </div>
    </header>

    <!-- Main Grid -->
    <main class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Clip Creation Panel -->
      <div class="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <h2 class="text-lg font-semibold text-white">Create New Video Clip</h2>
        <form id="clipForm" class="space-y-4">
          <div>
            <label class="block text-xs text-slate-400 mb-1">Video Title</label>
            <input type="text" id="title" required placeholder="e.g. Keynote Speech Highlight"
              class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">Source Video URL</label>
            <input type="url" id="sourceUrl" required placeholder="https://example.com/video.mp4"
              class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-slate-400 mb-1">Start Time (sec)</label>
              <input type="number" id="startTime" value="0" min="0"
                class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">End Time (sec)</label>
              <input type="number" id="endTime" value="60" min="1"
                class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
            </div>
          </div>
          <button type="submit"
            class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-lg py-2.5 transition">
            Submit for AI Transcription
          </button>
        </form>
      </div>

      <!-- Clips List & Transcripts -->
      <div class="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-white">Processed Clips & Transcripts</h2>
          <button id="refreshBtn" class="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition">
            Refresh List
          </button>
        </div>
        <div id="clipsContainer" class="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          <div class="text-center py-8 text-slate-500 text-sm">Loading clips...</div>
        </div>
      </div>
    </main>
  </div>

  <script>
    async function loadClips() {
      const container = document.getElementById('clipsContainer');
      try {
        const res = await fetch('/api/clips');
        if (!res.ok) throw new Error('Failed to fetch clips');
        const clips = await res.json();
        if (!clips || clips.length === 0) {
          container.innerHTML = '<div class="text-center py-8 text-slate-500 text-sm">No video clips created yet. Submit one above!</div>';
          return;
        }
        container.innerHTML = clips.map(c => \`
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
            <div class="flex items-center justify-between">
              <h3 class="font-bold text-white text-sm">\${c.title}</h3>
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold \${
                c.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                c.status === 'transcribing' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                'bg-slate-800 text-slate-400'
              }">\${c.status.toUpperCase()}</span>
            </div>
            <p class="text-xs text-slate-400 font-mono">Range: \${c.startTime}s - \${c.endTime}s | ID: \${c.id}</p>
            <div class="bg-slate-900 rounded p-3 text-xs font-mono text-slate-300 border border-slate-800">
              \${c.transcript || 'AI Whisper worker processing audio transcript...'}
            </div>
          </div>
        \`).join('');
      } catch (err) {
        container.innerHTML = '<div class="text-center py-8 text-rose-400 text-sm">Error connecting to API Gateway</div>';
      }
    }

    document.getElementById('clipForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        title: document.getElementById('title').value,
        sourceUrl: document.getElementById('sourceUrl').value,
        startTime: parseInt(document.getElementById('startTime').value, 10),
        endTime: parseInt(document.getElementById('endTime').value, 10)
      };
      try {
        const res = await fetch('/api/clips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          document.getElementById('title').value = '';
          loadClips();
        }
      } catch (err) {
        alert('Failed to submit clip');
      }
    });

    document.getElementById('refreshBtn').addEventListener('click', loadClips);
    loadClips();
    setInterval(loadClips, 5000);
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  if (parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'webapp', timestamp: new Date().toISOString() }));
    return;
  }

  if (parsedUrl.pathname.startsWith('/api/')) {
    // Proxy request to Go API Gateway
    const targetUrl = new URL(req.url, API_GATEWAY_URL);
    const proxyReq = http.request(targetUrl, {
      method: req.method,
      headers: req.headers
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API Gateway connection failure', details: err.message }));
    });

    req.pipe(proxyReq, { end: true });
    return;
  }

  // Serve static HTML UI
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(HTML_CONTENT);
});

server.listen(PORT, () => {
  console.log(`[ai-video-clipper webapp] Listening on port ${PORT}`);
});
