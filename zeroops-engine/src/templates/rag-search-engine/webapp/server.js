import http from 'node:http';
import { URL } from 'node:url';

const PORT = process.env.PORT || 3000;
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://apigateway:8080';

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RAG Intelligence Search</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 font-sans min-h-screen">
  <div class="max-w-6xl mx-auto p-6 space-y-8">
    <!-- Header -->
    <header class="flex items-center justify-between border-b border-slate-800 pb-5">
      <div class="flex items-center space-x-3">
        <span class="text-4xl">🔍</span>
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-white">RAG Search Engine</h1>
          <p class="text-xs text-slate-400">Retrieval-Augmented Vector Search with Go API & Python Embedding Worker on Zerops</p>
        </div>
      </div>
      <div class="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-full px-4 py-1.5 text-xs">
        <span class="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <span class="font-semibold text-emerald-400">VECTOR INDEX ONLINE</span>
      </div>
    </header>

    <!-- Main Grid -->
    <main class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Search & Results Column -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Search Box -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <form id="searchForm" class="space-y-3">
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400">Natural Language Knowledge Base Query</label>
            <div class="flex gap-2">
              <input type="text" id="queryInput" required placeholder="Ask anything, e.g. How does Zerops deploy multi-container microservices?"
                class="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500">
              <button type="submit"
                class="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-lg px-6 py-3 transition shadow">
                Search RAG
              </button>
            </div>
          </form>
        </div>

        <!-- AI Synthesis & Results -->
        <div id="resultsPanel" class="hidden bg-slate-900 border border-indigo-500/20 rounded-xl p-6 shadow-xl space-y-6">
          <div class="space-y-2">
            <div class="flex items-center space-x-2">
              <span class="text-xl">⚡</span>
              <h2 class="text-base font-bold text-white">Synthesized AI Response</h2>
            </div>
            <div id="aiSummary" class="bg-slate-950 border border-slate-800 rounded-lg p-4 text-sm font-sans text-slate-200 leading-relaxed">
              Generating RAG response context...
            </div>
          </div>

          <div class="space-y-3">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Retrieved Document Chunks (Cosine Distance)</h3>
            <div id="chunksList" class="space-y-3"></div>
          </div>
        </div>
      </div>

      <!-- Document Ingestion Sidebar -->
      <div class="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <h2 class="text-lg font-semibold text-white">Ingest Knowledge Document</h2>
        <p class="text-xs text-slate-400">Chunked & embedded into PostgreSQL vector storage by Python worker</p>
        <form id="ingestForm" class="space-y-4">
          <div>
            <label class="block text-xs text-slate-400 mb-1">Document Title</label>
            <input type="text" id="docTitle" required placeholder="e.g. Zerops Architecture Specs"
              class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">Document Text Content</label>
            <textarea id="docContent" rows="6" required placeholder="Paste plain text document content here to chunk and embed..."
              class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"></textarea>
          </div>
          <button type="submit"
            class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-lg py-2.5 transition">
            Process & Vectorize Document
          </button>
        </form>
      </div>
    </main>
  </div>

  <script>
    document.getElementById('searchForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = document.getElementById('queryInput').value;
      const resultsPanel = document.getElementById('resultsPanel');
      const aiSummary = document.getElementById('aiSummary');
      const chunksList = document.getElementById('chunksList');

      resultsPanel.classList.remove('hidden');
      aiSummary.innerText = 'Performing vector similarity search & context aggregation...';
      chunksList.innerHTML = '<div class="text-xs text-slate-500 font-mono">Querying vector index...</div>';

      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        });
        if (!res.ok) throw new Error('Search request failed');
        const data = await res.json();
        
        aiSummary.innerText = data.answer || 'No direct answer synthesized.';
        chunksList.innerHTML = (data.documents || []).map(doc => \`
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-indigo-400">\${doc.title}</span>
              <span class="text-emerald-400 font-mono">Similarity Score: \${(doc.score * 100).toFixed(1)}%</span>
            </div>
            <p class="text-xs font-mono text-slate-300">\${doc.snippet}</p>
          </div>
        \`).join('');
      } catch (err) {
        aiSummary.innerText = 'Search API gateway unreachable.';
        chunksList.innerHTML = '';
      }
    });

    document.getElementById('ingestForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('docTitle').value;
      const content = document.getElementById('docContent').value;
      try {
        const res = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content })
        });
        if (res.ok) {
          alert('Document successfully ingested and vectorized!');
          document.getElementById('docTitle').value = '';
          document.getElementById('docContent').value = '';
        }
      } catch (err) {
        alert('Document ingestion failed');
      }
    });
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

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(HTML_CONTENT);
});

server.listen(PORT, () => {
  console.log(`[rag-search-engine webapp] Listening on port ${PORT}`);
});
