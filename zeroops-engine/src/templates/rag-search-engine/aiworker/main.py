import os
import json
import hashlib
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.getenv("PORT", 8000))
DB_HOST = os.getenv("DB_HOST", "dbpostgres")
VALKEY_HOST = os.getenv("VALKEY_HOST", "cachevalkey")

class RAGWorkerHandler(BaseHTTPRequestHandler):
    def _set_json_headers(self, status_code=200):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self._set_json_headers(200)
            payload = {
                "status": "ok",
                "service": "aiworker-python",
                "embedding_model": "text-embedding-3-small",
                "db_host": DB_HOST,
                "valkey_host": VALKEY_HOST
            }
            self.wfile.write(json.dumps(payload).encode("utf-8"))
        else:
            self._set_json_headers(404)
            self.wfile.write(json.dumps({"error": "Not Found"}).encode("utf-8"))

    def do_POST(self):
        if self.path == "/embed":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            
            try:
                data = json.loads(body.decode("utf-8")) if body else {}
            except Exception:
                data = {}

            title = data.get("title", "Untitled")
            content = data.get("content", "")

            # Simulate text chunking & dense vector embedding generation
            chunks = [content[i:i+200] for i in range(0, max(1, len(content)), 200)]
            embeddings = []

            for index, chunk in enumerate(chunks):
                # Hash chunk text to generate deterministic 128-dimensional float vector
                seed = int(hashlib.md5(chunk.encode()).hexdigest()[:8], 16)
                vector = [((seed * (i + 1)) % 1000) / 1000.0 for i in range(16)]
                embeddings.append({
                    "chunkIndex": index,
                    "text": chunk,
                    "vectorDim": len(vector),
                    "vectorSample": vector[:4]
                })

            response_payload = {
                "documentTitle": title,
                "status": "embedded",
                "chunkCount": len(chunks),
                "embeddings": embeddings
            }

            self._set_json_headers(200)
            self.wfile.write(json.dumps(response_payload).encode("utf-8"))
        else:
            self._set_json_headers(404)
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode("utf-8"))

def run():
    server_address = ("0.0.0.0", PORT)
    httpd = HTTPServer(server_address, RAGWorkerHandler)
    print(f"[rag-search-engine aiworker] Python Embedding Worker running on port {PORT}")
    httpd.serve_forever()

if __name__ == "__main__":
    run()
