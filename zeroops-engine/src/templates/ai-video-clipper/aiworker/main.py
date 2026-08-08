import os
import json
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.getenv("PORT", 8000))
DB_HOST = os.getenv("DB_HOST", "dbpostgres")
VALKEY_HOST = os.getenv("VALKEY_HOST", "cachevalkey")

class AIWorkerHandler(BaseHTTPRequestHandler):
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
                "model": "openai/whisper-large-v3",
                "db_host": DB_HOST,
                "valkey_host": VALKEY_HOST
            }
            self.wfile.write(json.dumps(payload).encode("utf-8"))
        else:
            self._set_json_headers(404)
            self.wfile.write(json.dumps({"error": "Not Found"}).encode("utf-8"))

    def do_POST(self):
        if self.path == "/transcribe":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            
            try:
                data = json.loads(body.decode("utf-8")) if body else {}
            except Exception:
                data = {}

            clip_id = data.get("clipId", "clip-unknown")
            title = data.get("title", "Untitled Clip")
            start = data.get("startTime", 0)
            end = data.get("endTime", 30)

            # Simulate Whisper AI inference processing delay & transcript output
            timestamp_str = f"[{start:02d}:00 - {end:02d}:00]"
            sample_quotes = [
                "ZeroOps cloud automation simplifies multi-container architecture deployment.",
                "Whisper AI worker extracts raw audio waveforms and returns structured JSON transcripts.",
                "High availability PostgreSQL and Valkey cache provide millisecond latency for video highlights."
            ]
            selected_quote = sample_quotes[hash(title) % len(sample_quotes)]
            
            transcript = f"{timestamp_str} {title}: '{selected_quote}' (Transcribed via Whisper AI Worker)"

            response_payload = {
                "clipId": clip_id,
                "status": "completed",
                "transcript": transcript,
                "confidenceScore": 0.984,
                "processedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }

            self._set_json_headers(200)
            self.wfile.write(json.dumps(response_payload).encode("utf-8"))
        else:
            self._set_json_headers(404)
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode("utf-8"))

def run():
    server_address = ("0.0.0.0", PORT)
    httpd = HTTPServer(server_address, AIWorkerHandler)
    print(f"[ai-video-clipper aiworker] Python Whisper Worker running on port {PORT}")
    httpd.serve_forever()

if __name__ == "__main__":
    run()
