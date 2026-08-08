import http from 'node:http';
import { URL } from 'node:url';

const PORT = process.env.PORT || 3000;
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://apigateway:8080';

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ZeroStore E-Commerce</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 font-sans min-h-screen">
  <div class="max-w-6xl mx-auto p-6 space-y-8">
    <!-- Header -->
    <header class="flex items-center justify-between border-b border-slate-800 pb-5">
      <div class="flex items-center space-x-3">
        <span class="text-4xl">🛒</span>
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-white">ZeroStore Cloud Market</h1>
          <p class="text-xs text-slate-400">Multi-container E-Commerce Stack on Zerops (Go API + Python Rec Engine)</p>
        </div>
      </div>
      <div class="flex items-center space-x-4">
        <button id="cartBtn" class="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full px-4 py-1.5 text-xs font-semibold shadow">
          <span>Cart</span>
          <span id="cartBadge" class="bg-white text-indigo-950 rounded-full h-5 w-5 flex items-center justify-center font-extrabold text-[10px]">0</span>
        </button>
      </div>
    </header>

    <!-- Products Grid & Recommendations -->
    <main class="space-y-8">
      <section>
        <h2 class="text-lg font-semibold text-white mb-4">Featured Products</h2>
        <div id="productGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="text-center py-8 text-slate-500 text-sm col-span-4">Loading store products...</div>
        </div>
      </section>

      <!-- AI Recommendations Widget -->
      <section class="bg-slate-900 border border-indigo-500/20 rounded-xl p-6 shadow-xl space-y-4">
        <div class="flex items-center space-x-2">
          <span class="text-xl">🤖</span>
          <h2 class="text-lg font-semibold text-white">AI Recommended for You</h2>
          <span class="text-xs text-indigo-400 font-mono">Python Recommendation Worker</span>
        </div>
        <div id="recommendationsGrid" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="text-center py-4 text-slate-500 text-sm col-span-3">Fetching personalized recommendations...</div>
        </div>
      </section>
    </main>
  </div>

  <script>
    let cartCount = 0;

    async function loadProducts() {
      const grid = document.getElementById('productGrid');
      try {
        const res = await fetch('/api/products');
        if (!res.ok) throw new Error('Failed to load products');
        const products = await res.json();
        grid.innerHTML = products.map(p => \`
          <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-700 transition">
            <div>
              <div class="text-3xl mb-2">\${p.imageEmoji || '📦'}</div>
              <h3 class="font-bold text-white text-base">\${p.name}</h3>
              <p class="text-xs text-slate-400 mt-1 line-clamp-2">\${p.description}</p>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-slate-800">
              <span class="text-lg font-bold text-emerald-400">$\${p.price.toFixed(2)}</span>
              <button onclick="addToCart('\${p.id}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition">
                Add to Cart
              </button>
            </div>
          </div>
        \`).join('');
      } catch (err) {
        grid.innerHTML = '<div class="text-center py-8 text-rose-400 text-sm col-span-4">Failed to load product catalog</div>';
      }
    }

    async function loadRecommendations() {
      const recGrid = document.getElementById('recommendationsGrid');
      try {
        const res = await fetch('/api/recommendations');
        if (!res.ok) throw new Error('Failed to load recommendations');
        const recs = await res.json();
        recGrid.innerHTML = recs.map(r => \`
          <div class="bg-slate-950 border border-indigo-500/20 rounded-lg p-4 flex items-center space-x-3">
            <span class="text-2xl">\${r.imageEmoji || '✨'}</span>
            <div>
              <h4 class="text-xs font-bold text-white">\${r.name}</h4>
              <p class="text-[11px] text-emerald-400 font-mono font-semibold">$\${r.price.toFixed(2)} | Match score: \${(r.score * 100).toFixed(0)}%</p>
            </div>
          </div>
        \`).join('');
      } catch (err) {
        recGrid.innerHTML = '<div class="text-center py-4 text-slate-500 text-sm col-span-3">AI Recommendation worker offline</div>';
      }
    }

    function addToCart(productId) {
      cartCount++;
      document.getElementById('cartBadge').innerText = cartCount;
    }

    loadProducts();
    loadRecommendations();
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
  console.log(`[ecommerce-platform webapp] Listening on port ${PORT}`);
});
