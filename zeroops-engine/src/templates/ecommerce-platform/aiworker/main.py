import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.getenv("PORT", 8000))
DB_HOST = os.getenv("DB_HOST", "dbpostgres")
VALKEY_HOST = os.getenv("VALKEY_HOST", "cachevalkey")

class RecommendationWorkerHandler(BaseHTTPRequestHandler):
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
                "engine": "collaborative-filtering-v2",
                "db_host": DB_HOST,
                "valkey_host": VALKEY_HOST
            }
            self.wfile.write(json.dumps(payload).encode("utf-8"))
        elif self.path == "/recommend":
            # Matrix factorization & vector similarity recommendation simulation
            recommendations = [
                {
                    "id": "p2",
                    "name": "Smart Fitness Watch",
                    "price": 149.50,
                    "imageEmoji": "⌚",
                    "score": 0.96
                },
                {
                    "id": "p4",
                    "name": "Mechanical RGB Keyboard",
                    "price": 119.95,
                    "imageEmoji": "⌨️",
                    "score": 0.91
                },
                {
                    "id": "p1",
                    "name": "Wireless Noise-Canceling Headphones",
                    "price": 199.99,
                    "imageEmoji": "🎧",
                    "score": 0.88
                }
            ]
            self._set_json_headers(200)
            self.wfile.write(json.dumps(recommendations).encode("utf-8"))
        else:
            self._set_json_headers(404)
            self.wfile.write(json.dumps({"error": "Not Found"}).encode("utf-8"))

def run():
    server_address = ("0.0.0.0", PORT)
    httpd = HTTPServer(server_address, RecommendationWorkerHandler)
    print(f"[ecommerce-platform aiworker] Python Recommendation Worker running on port {PORT}")
    httpd.serve_forever()

if __name__ == "__main__":
    run()
