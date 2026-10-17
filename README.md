# Shivshakti Furnitures website

## Public website and hosted content editor

The Render Blueprint in `render.yaml` deploys two services:

- `shivshakti-furnitures` serves the public website.
- `shivshakti-cms` provides a protected editor and stores changes on a persistent disk.

The public website includes an **Admin** link in its footer. The editor is available at `https://shivshakti-cms.onrender.com/cms.html`. Admin credentials are configured as private environment variables when the CMS service is created; they are not stored in the site files. The editor supports text, image and video URL edits, product card add/edit/remove, section add/remove, page reset, and JSON backup import/export. Save changes to publish them to the public site.

The CMS service uses Render's paid Starter web service and a 1 GB persistent disk so changes survive redeploys. The public site remains a static site.

## Local content editor

To edit on this computer, double-click `start-cms.bat`. The editor opens at `http://127.0.0.1:8765/cms.html`. Keep its minimized server window open. Choose a page, click text, images, videos, links, or a product card in the preview, then edit its fields. Click **Save changes** when finished.

Local edits are saved in `site-content.json`, which is intentionally excluded from Git. Use **Export backup** in the editor to keep a copy of your content changes.

## Website pages

- `index.html` — Home
- `products.html` — collection overview
- `seating-room.html` — living room furniture
- `bedroom.html` — bedroom furniture
- `dinning-room.html` — dining room furniture
- `workspace.html` — office and commercial furniture
- `services.html` — commercial furniture services
- `customize.html` — customization enquiry
- `about-us.html` — about the business
- `contact-us.html` — contact information
