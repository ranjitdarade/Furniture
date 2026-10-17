# Shivshakti Furnitures website

## Public website deployment

This project is prepared for a Render Static Site. The `render.yaml` blueprint runs `build_public.py` and publishes the generated `public/` folder. The public build contains the customer-facing pages and removes the local editor and its Admin link. That keeps the private, unauthenticated local CMS out of the public deployment.

After the repository is pushed to GitHub:

1. Sign in to Render and choose **New → Blueprint**.
2. Connect the `shivshakti-furnitures` GitHub repository.
3. Confirm the service named `shivshakti-furnitures` and deploy it.
4. Render will provide the public `onrender.com` address and redeploy on later pushes.

## Local content editor

To edit this website on this computer, double-click `start-cms.bat`. The editor opens at `http://127.0.0.1:8765/cms.html`. Keep its minimized server window open. Choose a page, click text, images, videos, links, or a product card in the preview, then edit its fields. Product Card tools can edit, remove, or add a card in the same gallery. The Add Content panel can create a new section. Click **Save changes** when finished.

Local edits are saved in `site-content.json`, which is intentionally excluded from Git. The current Render static deployment publishes the website content from the HTML source; the local editor and its saved data are not available on the public server. Hosting an editable public CMS needs a protected login and persistent storage configured for that Render service.

Use **Export backup** in the editor to keep a copy of your local content changes.

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
