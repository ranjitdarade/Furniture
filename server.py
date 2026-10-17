from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "site-content.json"
HOST = "127.0.0.1"
PORT = 8765
MAX_BODY = 12 * 1024 * 1024

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if urlparse(self.path).path == "/api/health":
            payload = b"ok"
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        if urlparse(self.path).path == "/api/content":
            if DATA_FILE.exists():
                payload = DATA_FILE.read_bytes()
            else:
                payload = b"{}"
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != "/api/content":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                self.send_error(413, "Content size is missing or too large")
                return
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict) or any(not isinstance(v, dict) for v in data.values()):
                self.send_error(400, "Expected a page-to-content map")
                return
            temp_file = DATA_FILE.with_suffix(".json.tmp")
            temp_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            os.replace(temp_file, DATA_FILE)
            response = json.dumps({"saved": True}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        except (ValueError, OSError) as exc:
            self.send_error(400, str(exc))

if __name__ == "__main__":
    print(f"Shivshakti CMS: http://{HOST}:{PORT}/cms.html")
    print("Local only. Keep this window open while editing or viewing the site.")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
