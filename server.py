from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import hmac
import json
import os
import secrets
import threading
import time

ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"
HOSTED = os.environ.get("CMS_REQUIRE_AUTH", "false").lower() == "true"
HOST = os.environ.get("HOST", "0.0.0.0" if HOSTED else "127.0.0.1")
PORT = int(os.environ.get("PORT", "8765"))
MAX_BODY = 12 * 1024 * 1024
SESSION_SECONDS = 12 * 60 * 60
COOKIE_NAME = "shivshakti_admin"
DATA_FILE = Path(os.environ.get("CMS_DATA_FILE", str(ROOT / "site-content.json")))
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
ADMIN_ORIGIN = os.environ.get("CMS_ADMIN_ORIGIN", "").rstrip("/")
PUBLIC_ORIGIN = os.environ.get("CMS_PUBLIC_ORIGIN", "").rstrip("/")

sessions = {}
failed_logins = {}
session_lock = threading.Lock()
login_lock = threading.Lock()

ADMIN_FILES = {"cms.html", "cms.css", "cms.js", "cms-runtime.js"}
PUBLIC_FILES = {
    path.name for path in ROOT.glob("*.html") if path.name != "cms.html"
}
PUBLIC_FILES.update({"styles.css", "category.css", "pages.css", "services.css", "script.js"})


def is_authenticated(handler):
    if not HOSTED:
        return True
    cookie = SimpleCookie()
    try:
        cookie.load(handler.headers.get("Cookie", ""))
    except Exception:
        return False
    morsel = cookie.get(COOKIE_NAME)
    if morsel is None:
        return False
    token = morsel.value
    now = time.time()
    with session_lock:
        expiry = sessions.get(token)
        if expiry is None or expiry < now:
            sessions.pop(token, None)
            return False
        sessions[token] = now + SESSION_SECONDS
        return True


LOGIN_PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin login · Shivshakti Furniture</title>
<style>
:root{color-scheme:light;--ink:#24221f;--muted:#716b63;--line:#e7e1d8;--paper:#fff;--accent:#9a663d}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f5f2ed;color:var(--ink);font-family:Inter,Arial,sans-serif}
.login{width:min(100%,420px);padding:38px;background:var(--paper);border:1px solid var(--line);box-shadow:0 20px 70px #30271912}
.brand{font-size:13px;letter-spacing:.16em;font-weight:700;color:var(--accent)}h1{margin:25px 0 8px;font-family:Georgia,serif;font-size:34px;font-weight:500}.intro{margin:0 0 26px;color:var(--muted);line-height:1.6}
label{display:block;margin:16px 0 7px;font-size:13px;font-weight:600}input{width:100%;padding:12px 13px;border:1px solid var(--line);font:inherit}button{width:100%;margin-top:22px;padding:13px;border:0;background:#292621;color:white;font:inherit;font-weight:600;cursor:pointer}.error{min-height:20px;margin:13px 0 0;color:#a3372d;font-size:13px}.home{display:block;margin-top:20px;text-align:center;color:var(--muted);font-size:13px;text-decoration:none}
</style></head><body><main class="login"><div class="brand">SHIVSHAKTI FURNITURE</div><h1>Admin login</h1><p class="intro">Sign in to manage the website content.</p>
<form id="login"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required><button type="submit">Sign in</button><p class="error" id="error" role="alert"></p></form><a class="home" href="https://shivshakti-furnitures.onrender.com/">Back to the website</a></main>
<script>document.querySelector('#login').addEventListener('submit',async event=>{event.preventDefault();const error=document.querySelector('#error');error.textContent='';const button=event.currentTarget.querySelector('button');button.disabled=true;try{const response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.querySelector('#username').value,password:document.querySelector('#password').value})});if(!response.ok)throw new Error(response.status===429?'Too many attempts. Please wait and try again.':'Login details did not match.');location.assign('/cms.html')}catch(reason){error.textContent=reason.message}finally{button.disabled=false}});</script>
</body></html>"""


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        super().end_headers()

    def translate_path(self, path):
        name = Path(urlsplit(path).path).name
        if name in ADMIN_FILES:
            return str(ROOT / name)
        if name in PUBLIC_FILES:
            base = PUBLIC_DIR if HOSTED else ROOT
            return str(base / name)
        return str(ROOT / "__not_found__")

    def send_json(self, status, payload, extra_headers=None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if extra_headers:
            for name, value in extra_headers.items():
                self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def cors_headers(self):
        origin = self.headers.get("Origin", "").rstrip("/")
        if origin and origin in {ADMIN_ORIGIN, PUBLIC_ORIGIN}:
            return {"Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true", "Vary": "Origin"}
        return {}

    def origin_is_admin(self):
        if not HOSTED:
            return True
        origin = self.headers.get("Origin", "").rstrip("/")
        return bool(ADMIN_ORIGIN and origin == ADMIN_ORIGIN)

    def do_OPTIONS(self):
        if urlsplit(self.path).path == "/api/content" and self.headers.get("Origin", "").rstrip("/") == PUBLIC_ORIGIN:
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", PUBLIC_ORIGIN)
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Credentials", "true")
            self.send_header("Vary", "Origin")
            self.end_headers()
            return
        self.send_error(403, "Origin not allowed")

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/health":
            self.send_json(200, {"ok": True})
            return
        if path == "/api/session":
            self.send_json(200, {"authenticated": is_authenticated(self)})
            return
        if path == "/api/content":
            try:
                payload = DATA_FILE.read_bytes() if DATA_FILE.exists() else b"{}"
            except OSError:
                self.send_json(500, {"error": "Content storage is unavailable."})
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            for name, value in self.cors_headers().items():
                self.send_header(name, value)
            self.end_headers()
            self.wfile.write(payload)
            return
        if Path(path).name in ADMIN_FILES and not is_authenticated(self):
            if path != "/cms.html":
                self.send_error(403, "Sign in to access the admin editor.")
                return
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(LOGIN_PAGE.encode("utf-8"))))
            self.end_headers()
            self.wfile.write(LOGIN_PAGE.encode("utf-8"))
            return
        if path == "/" and is_authenticated(self) and HOSTED:
            self.send_response(302)
            self.send_header("Location", "/cms.html")
            self.end_headers()
            return
        if path == "/":
            self.path = "/index.html"
        super().do_GET()

    def do_POST(self):
        path = urlsplit(self.path).path
        if path == "/api/login":
            if not self.origin_is_admin():
                self.send_json(403, {"error": "Origin not allowed."})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0 or length > 4096:
                    self.send_json(400, {"error": "Invalid login request."})
                    return
                payload = json.loads(self.rfile.read(length))
            except (ValueError, json.JSONDecodeError):
                self.send_json(400, {"error": "Invalid login request."})
                return
            ip = self.client_address[0]
            now = time.time()
            with login_lock:
                window = [stamp for stamp in failed_logins.get(ip, []) if now - stamp < 900]
                if len(window) >= 10:
                    failed_logins[ip] = window
                    self.send_json(429, {"error": "Too many attempts."})
                    return
                user_ok = hmac.compare_digest(str(payload.get("username", "")), ADMIN_USERNAME)
                pass_ok = hmac.compare_digest(str(payload.get("password", "")), ADMIN_PASSWORD)
                if not ADMIN_USERNAME or not ADMIN_PASSWORD:
                    self.send_json(503, {"error": "Admin login is not configured."})
                    return
                if not (user_ok and pass_ok):
                    window.append(now)
                    failed_logins[ip] = window
                    self.send_json(401, {"error": "Login details did not match."})
                    return
                failed_logins.pop(ip, None)
            token = secrets.token_urlsafe(32)
            with session_lock:
                sessions[token] = now + SESSION_SECONDS
            secure = "; Secure" if HOSTED else ""
            cookie = f"{COOKIE_NAME}={token}; Path=/; Max-Age={SESSION_SECONDS}; HttpOnly; SameSite=Strict{secure}"
            self.send_json(200, {"authenticated": True}, {"Set-Cookie": cookie})
            return
        if path == "/api/logout":
            if not self.origin_is_admin():
                self.send_json(403, {"error": "Origin not allowed."})
                return
            cookie = SimpleCookie()
            try:
                cookie.load(self.headers.get("Cookie", ""))
                token = cookie.get(COOKIE_NAME).value if cookie.get(COOKIE_NAME) else None
            except Exception:
                token = None
            if token:
                with session_lock:
                    sessions.pop(token, None)
            self.send_json(200, {"authenticated": False}, {"Set-Cookie": f"{COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict" + ("; Secure" if HOSTED else "")})
            return
        if path != "/api/content":
            self.send_error(404)
            return
        if HOSTED and (not is_authenticated(self) or not self.origin_is_admin()):
            self.send_json(401, {"error": "Please sign in to save website changes."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                self.send_json(413, {"error": "Content size is missing or too large."})
                return
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict) or any(not isinstance(value, dict) for value in data.values()):
                self.send_json(400, {"error": "Expected a page-to-content map."})
                return
            DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
            temp_file = DATA_FILE.with_suffix(".json.tmp")
            temp_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            os.replace(temp_file, DATA_FILE)
            self.send_json(200, {"saved": True})
        except (ValueError, OSError) as exc:
            self.send_json(400, {"error": str(exc)})


if __name__ == "__main__":
    if HOSTED and (not ADMIN_ORIGIN or not PUBLIC_ORIGIN):
        raise RuntimeError("CMS_ADMIN_ORIGIN and CMS_PUBLIC_ORIGIN must be configured for hosted CMS use.")
    print(f"Shivshakti CMS server listening on {HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
