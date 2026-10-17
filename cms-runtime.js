(() => {
  const page = location.pathname.split('/').pop() || 'index.html';
  const params = new URLSearchParams(location.search);
  const isEditor = params.has('cmsEdit');
  const apiOrigin = params.get('cmsApi') || (location.hostname === '127.0.0.1' ? location.origin : 'https://shivshakti-cms.onrender.com');
  const parentOrigin = params.get('cmsParent') || location.origin;
  const editable = 'h1,h2,h3,h4,p,li,a,button,figcaption,small,strong,img,video';
  const selectorFor = (el) => {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const path = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      const parent = el.parentElement;
      if (!parent) break;
      const siblings = [...parent.children].filter(item => item.tagName === el.tagName);
      path.unshift(`${el.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(el) + 1})`);
      el = parent;
    }
    return `body>${path.join('>')}`;
  };
  const originalSections = new Map([...document.querySelectorAll('main > section')].map(section => [selectorFor(section), section]));
  const sectionCatalog = () => [...(document.querySelector('main')?.children || [])].filter(section => section.tagName === 'SECTION' && !section.hidden).map(section => {
    const customId = section.dataset.cmsSectionId;
    const originalKey = [...originalSections.entries()].find(([, node]) => node === section)?.[0];
    const token = customId ? `custom:${customId}` : originalKey ? `original:${originalKey}` : null;
    return token ? { token, title: section.querySelector('h1,h2,h3,h4')?.innerText?.trim() || (section.querySelector('.cms-creative-embed,.cms-feature-embed') ? 'Creative feature' : 'Untitled section') } : null;
  }).filter(Boolean);
  const applySectionOrder = (order = []) => {
    const main = document.querySelector('main');
    if (!main) return;
    const catalog = sectionCatalog();
    const nodes = new Map(catalog.map(item => [item.token, item.token.startsWith('custom:') ? [...main.children].find(node => node.dataset.cmsSectionId === item.token.slice(7)) : originalSections.get(item.token.slice(9))]));
    const ordered = [...order.map(token => nodes.get(token)).filter(Boolean), ...catalog.map(item => nodes.get(item.token)).filter(node => node && !order.some(token => nodes.get(token) === node))];
    ordered.forEach(node => main.append(node));
  };
  const originalCards = new Map([...document.querySelectorAll('main figure,main article,main .product-card,main .visual-product,main .collection-card,main .room-card')].map(card => [selectorFor(card), card]));
  const keyFor = (el) => { const key = selectorFor(el); el.dataset.cmsKey = key; return key; };
  const getRecord = (el) => ({
    text: /^(IMG|VIDEO)$/.test(el.tagName) ? undefined : el.innerText,
    src: /^(IMG|VIDEO)$/.test(el.tagName) ? (el.currentSrc || el.src) : undefined,
    alt: el.tagName === 'IMG' ? (el.alt || '') : undefined,
    href: el.tagName === 'A' ? el.href : undefined,
    background: getComputedStyle(el).backgroundImage && getComputedStyle(el).backgroundImage !== 'none' ? getComputedStyle(el).backgroundImage : undefined
  });
  const applyOne = (key, record) => {
    const el = document.querySelector(key);
    if (!el || !record) return;
    el.dataset.cmsKey = key;
    if (Object.hasOwn(record, 'text') && !/^(IMG|VIDEO)$/.test(el.tagName)) {
      if (el.closest('header.topbar,nav.drawer,footer.footer') && el.children.length) {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);
        const textNode = textNodes.reverse().find(node => node.textContent.trim());
        if (textNode) textNode.textContent = record.text;
        else el.append(document.createTextNode(record.text));
      } else el.textContent = record.text;
    }
    if (Object.hasOwn(record, 'src') && /^(IMG|VIDEO)$/.test(el.tagName)) { el.src = record.src; if (el.tagName === 'VIDEO') el.load(); }
    if (el.tagName === 'IMG' && Object.hasOwn(record, 'alt')) el.alt = record.alt;
    if (el.tagName === 'A' && Object.hasOwn(record, 'href')) el.href = record.href;
    if (Object.hasOwn(record, 'background')) el.style.backgroundImage = record.background ? `url("${record.background.replace(/^url\(["']?|["']?\)$/g, '').replaceAll('"', '%22')}")` : 'none';
  };
  const createEmbedBlock = (code, className) => {
    if (!code) return null;
    const embedBox = document.createElement('div'); embedBox.className = className;
    const isCreativeDocument = /<!doctype\s+html|<(?:html|head|body|script|style|section|div|img|a|p|h[1-6])\b/i.test(code);
    if (isCreativeDocument) {
      const frame = document.createElement('iframe');
      frame.title = 'Embedded creative'; frame.loading = 'lazy';
      frame.setAttribute('sandbox', 'allow-scripts allow-popups');
      frame.referrerPolicy = 'no-referrer'; frame.style.width = '100%'; frame.style.height = '640px'; frame.style.border = '0';
      const resizeScript = '<script>(()=>{const send=()=>parent.postMessage({source:"shivshakti-creative-embed",height:Math.ceil(document.documentElement.scrollHeight)},"*");addEventListener("load",send);if("ResizeObserver" in window)new ResizeObserver(send).observe(document.documentElement);setTimeout(send,250)})();<\/script>';
      frame.srcdoc = /<\/body\s*>/i.test(code) ? code.replace(/<\/body\s*>/i, `${resizeScript}</body>`) : `${code}${resizeScript}`;
      window.addEventListener('message', event => {
        if (event.source !== frame.contentWindow || event.data?.source !== 'shivshakti-creative-embed') return;
        const height = Number(event.data.height);
        if (Number.isFinite(height)) frame.style.height = `${Math.max(240, Math.min(4000, height))}px`;
      });
      embedBox.append(frame);
      return embedBox;
    }
    const template = document.createElement('template'); template.innerHTML = code;
    template.content.querySelectorAll('script,object,embed,form').forEach(node => node.remove());
    template.content.querySelectorAll('iframe').forEach(frame => {
      const src = frame.getAttribute('src') || '';
      try { if (new URL(src, location.href).protocol !== 'https:') { frame.remove(); return; } } catch { frame.remove(); return; }
      [...frame.attributes].forEach(attr => { if (!['src','title','width','height','allow','allowfullscreen','loading','referrerpolicy'].includes(attr.name.toLowerCase())) frame.removeAttribute(attr.name); });
      frame.loading = 'lazy'; frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.style.width = '100%'; frame.style.maxWidth = '100%'; frame.style.border = '0';
      if (!frame.hasAttribute('height')) frame.height = '360';
      embedBox.append(frame);
    });
    template.content.querySelectorAll('video').forEach(video => {
      const src = video.getAttribute('src') || '';
      if (!src || !src.startsWith('https://')) { video.remove(); return; }
      [...video.attributes].forEach(attr => { if (!['src','controls','muted','loop','poster','playsinline'].includes(attr.name.toLowerCase())) video.removeAttribute(attr.name); });
      const poster = video.getAttribute('poster');
      if (poster && !poster.startsWith('https://')) video.removeAttribute('poster');
      video.replaceChildren(); video.controls = true; video.style.width = '100%'; embedBox.append(video);
    });
    return embedBox.childElementCount ? embedBox : null;
  };
  const applySectionEmbeds = (embeds = {}) => Object.entries(embeds).forEach(([key, code]) => {
    const section = originalSections.get(key);
    if (!section) return;
    section.querySelectorAll(':scope > .cms-feature-embed').forEach(node => node.remove());
    const block = createEmbedBlock(code, 'cms-feature-embed');
    if (block) section.append(block);
  });
  const renderSections = (sections = []) => {
    document.querySelectorAll('.cms-custom-block').forEach(el => el.remove());
    const main = document.querySelector('main');
    if (!main) return;
    sections.forEach((section) => {
      const block = document.createElement('section');
      block.className = 'cms-custom-block section-pad';
      block.dataset.cmsSectionId = section.id;
      const content = document.createElement('div');
      content.className = 'cms-custom-content';
      const copy = document.createElement('div');
      copy.className = 'cms-custom-copy';
      if (section.title) { const title = document.createElement('h2'); title.textContent = section.title; copy.append(title); }
      if (section.text) { const paragraph = document.createElement('p'); paragraph.textContent = section.text; copy.append(paragraph); }
      if (section.href) {
        const link = document.createElement('a');
        link.className = 'button button-dark'; link.href = section.href; link.textContent = section.linkLabel || 'Learn more';
        copy.append(link);
      }
      if (copy.childElementCount) content.append(copy);
      if (section.image) {
        const image = document.createElement('img');
        image.src = section.image; image.alt = section.alt || section.title || 'Section image'; image.loading = 'lazy';
        content.append(image);
      }
      const embed = createEmbedBlock(section.embed, 'cms-creative-embed');
      if (embed) content.append(embed);
      if (!copy.childElementCount && !section.image && embed) content.classList.add('cms-embed-only');
      block.append(content); main.append(block);
    });
  };
  const applyCardEdit = (key, edit) => {
    const card = document.querySelector(key);
    if (!card || !edit) return;
    card.dataset.cmsCardKey = key;
    let image = card.querySelector('img');
    if (edit.image && image) image.src = edit.image;
    else if (edit.image && !image) card.style.backgroundImage = `url("${edit.image.replaceAll('"', '%22')}")`;
    else if (edit.image === '' && image) image.remove();
    if (edit.alt !== undefined && image) image.alt = edit.alt;
    let title = card.querySelector('h1,h2,h3,h4,figcaption');
    if (!title && edit.title) { title = document.createElement('figcaption'); card.append(title); }
    if (title && edit.title !== undefined) {
      const small = title.querySelector('small');
      if (small) { [...title.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).forEach(node => node.remove()); title.insertBefore(document.createTextNode(`${edit.title} `), small); }
      else title.textContent = edit.title;
    }
    let description = card.querySelector('figcaption small,.product-info p,.card-copy p');
    if (edit.text !== undefined) {
      if (!description && edit.text) { description = document.createElement('small'); (title || card).append(description); }
      if (description) description.textContent = edit.text;
    }
    let link = card.querySelector('a');
    if (edit.href !== undefined) {
      if (link) link.href = edit.href;
      else if (edit.href) { link = document.createElement('a'); link.className = 'cms-card-link'; link.href = edit.href; link.textContent = edit.title || 'View details'; card.append(link); }
    }
  };
  const renderAddedCards = (cards = []) => {
    document.querySelectorAll('.cms-added-card').forEach(card => card.remove());
    cards.forEach((item) => {
      const container = document.querySelector(item.containerKey);
      if (!container) return;
      const card = document.createElement('figure'); card.className = 'cms-added-card'; card.dataset.cmsCardId = item.id;
      if (item.image) { const image = document.createElement('img'); image.src = item.image; image.alt = item.alt || item.title || ''; image.loading = 'lazy'; card.append(image); }
      const caption = document.createElement('figcaption');
      if (item.title) { const title = document.createElement('strong'); title.textContent = item.title; caption.append(title); }
      if (item.text) { const desc = document.createElement('small'); desc.textContent = item.text; caption.append(desc); }
      if (item.href) { const link = document.createElement('a'); link.className = 'cms-card-link'; link.href = item.href; link.textContent = 'View details'; caption.append(link); }
      card.append(caption); container.append(card);
    });
  };
  const removeSections = (keys = []) => keys.forEach(key => { const section = originalSections.get(key); if (section) section.hidden = true; });
  const renderPageState = (pageData = {}, sharedData = {}) => {
    originalSections.forEach(section => { section.hidden = false; });
    originalCards.forEach(card => { card.hidden = false; });
    Object.entries(sharedData).forEach(([key, record]) => applyOne(key, record));
    Object.entries(pageData).filter(([key]) => !key.startsWith('__')).forEach(([key, record]) => applyOne(key, record));
    Object.entries(pageData.__cardEdits || {}).forEach(([key, edit]) => applyCardEdit(key, edit));
    renderAddedCards(pageData.__addedCards || []);
    renderSections(pageData.__sections || []);
    applySectionEmbeds(pageData.__sectionEmbeds || {});
    applySectionOrder(pageData.__sectionOrder || []);
    (pageData.__removedCards || []).forEach(key => { const card = originalCards.get(key); if (card) card.hidden = true; });
    removeSections(pageData.__removedSections || []);
    message('sections', { sections: sectionCatalog() });
  };
  const message = (type, extra = {}) => parent.postMessage({ source: 'shivshakti-cms', type, page, ...extra }, parentOrigin);

  // In editor mode the parent CMS owns the current in-memory content. Fetching
  // the saved copy here can race with edits and erase a newly added section.
  if (!isEditor) {
    fetch(`${apiOrigin}/api/content`, { credentials: 'include' }).then(r => r.ok ? r.json() : {}).then(data => renderPageState(data?.[page], data?.__shared)).catch(() => {});
    return;
  }
  document.body.classList.add('cms-editing');
  document.addEventListener('click', (event) => {
    const target = event.target.closest(`${editable},figure,article,.product-card,.visual-product,.collection-card,.room-card,.hero,.made-photo,.feature-image,.services-hero,.category-hero,.content-image,.product-picture,.cms-custom-block`);
    if (!target) return;
    event.preventDefault(); event.stopPropagation();
    document.querySelectorAll('.cms-selected').forEach(el => el.classList.remove('cms-selected'));
    target.classList.add('cms-selected');
    const block = target.closest('main > section');
    const card = target.closest('figure,article,.product-card,.visual-product,.collection-card,.room-card');
    const container = card?.parentElement;
    card?.classList.add('cms-selected');
    const image = card?.querySelector('img');
    const caption = card?.querySelector('figcaption');
    const captionText = caption && [...caption.childNodes].find(node => node.nodeType === Node.TEXT_NODE)?.textContent.trim();
    const cardTitle = card?.querySelector('h1,h2,h3,h4')?.innerText?.trim() || caption?.querySelector('strong')?.innerText?.trim() || captionText || '';
    const cardDescription = card?.querySelector('figcaption small,.product-info p,.card-copy p')?.innerText?.trim() || '';
    const cardLink = card?.querySelector('a')?.href || '';
    message('selection', {
      key: keyFor(target), tag: target.tagName, record: getRecord(target),
      scope: target.closest('header.topbar,nav.drawer,footer.footer') ? 'shared' : 'page',
      label: target.innerText?.trim().slice(0, 100) || target.alt || target.tagName,
      sectionKey: block && !block.dataset.cmsSectionId ? keyFor(block) : null,
      sectionId: block?.dataset.cmsSectionId || null,
      cardKey: card ? keyFor(card) : null,
      containerKey: container ? keyFor(container) : null,
      canAddCard: !!container?.matches('.service-gallery,.visual-grid,.catalog-grid,.collection-grid,.room-list'),
      cardData: card ? { title: cardTitle, text: cardDescription, image: image?.currentSrc || image?.src || '', alt: image?.alt || '', href: cardLink } : null,
      cardId: card?.dataset.cmsCardId || null
    });
  }, true);
  window.addEventListener('message', (event) => {
    if (event.origin !== parentOrigin || event.data?.source !== 'shivshakti-cms-editor') return;
    if (event.data.type === 'update') applyOne(event.data.key, event.data.record);
    if (event.data.type === 'render-state') renderPageState(event.data.pageData, event.data.shared);
    if (event.data.type === 'scroll-section') {
      const target = sectionCatalog().find(item => item.token === event.data.token);
      if (target) {
        const node = target.token.startsWith('custom:') ? document.querySelector(`[data-cms-section-id="${CSS.escape(target.token.slice(7))}"]`) : originalSections.get(target.token.slice(9));
        node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    if (event.data.type === 'reload') location.reload();
  });
  window.addEventListener('DOMContentLoaded', () => message('ready'));
  setTimeout(() => message('ready'), 300);
})();
