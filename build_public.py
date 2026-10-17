from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parent
PUBLISH_DIR = ROOT / "public"

PUBLISH_DIR.mkdir(exist_ok=True)
for old_file in PUBLISH_DIR.iterdir():
    if old_file.is_file() or old_file.is_symlink():
        old_file.unlink()

for page in ROOT.glob("*.html"):
    if page.name == "cms.html":
        continue
    html = page.read_text(encoding="utf-8-sig")
    html = re.sub(
        r'<a\s+href="(?:cms\.html|http://127\.0\.0\.1:8765/cms\.html)">Admin</a>',
        '<a href="https://shivshakti-cms.onrender.com/cms.html">Admin</a>',
        html,
        flags=re.I,
    )
    (PUBLISH_DIR / page.name).write_text(html, encoding="utf-8")

for asset in ROOT.iterdir():
    if asset.is_file() and asset.suffix.lower() in {".css", ".js"}:
        if asset.name in {"cms.css", "cms.js"}:
            continue
        shutil.copy2(asset, PUBLISH_DIR / asset.name)
