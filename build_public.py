from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parent
PUBLISH_DIR = ROOT / "public"
GTM_ID = "GTM-KQCSHWQK"
GTM_HEAD = f'''<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){{w[l]=w[l]||[];w[l].push({{'gtm.start':
new Date().getTime(),event:'gtm.js'}});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
}})(window,document,'script','dataLayer','{GTM_ID}');</script>
<!-- End Google Tag Manager -->'''
GTM_BODY = f'''<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id={GTM_ID}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->'''

PUBLISH_DIR.mkdir(exist_ok=True)
for old_file in PUBLISH_DIR.iterdir():
    if old_file.is_file() or old_file.is_symlink():
        old_file.unlink()

for page in ROOT.glob("*.html"):
    if page.name == "cms.html":
        continue
    html = page.read_text(encoding="utf-8-sig")
    if "googletagmanager.com/gtm.js?id=" not in html:
        html = re.sub(r"(<head\b[^>]*>)", r"\1\n" + GTM_HEAD, html, count=1, flags=re.I)
    if "googletagmanager.com/ns.html?id=" not in html:
        html = re.sub(r"(<body\b[^>]*>)", r"\1\n" + GTM_BODY, html, count=1, flags=re.I)
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
