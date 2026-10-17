const pageNames = Object.fromEntries([...document.querySelectorAll('#pageSelect option')].map(o => [o.value, o.textContent]));
const pageSelect = document.querySelector('#pageSelect');
const preview = document.querySelector('#preview');
const status = document.querySelector('#status');
const textField = document.querySelector('#textField');
const mediaField = document.querySelector('#mediaField');
const altField = document.querySelector('#altField');
const linkField = document.querySelector('#linkField');
const uploadField = document.querySelector('#uploadField');
const selectionNote = document.querySelector('#selectionNote');
const resetItemBtn = document.querySelector('#resetItemBtn');
const removeSectionBtn = document.querySelector('#removeSectionBtn');
const cardFields = {
  title: document.querySelector('#cardTitle'), text: document.querySelector('#cardText'),
  image: document.querySelector('#cardImage'), alt: document.querySelector('#cardAlt'), href: document.querySelector('#cardLink')
};
const cardHelp = document.querySelector('#cardHelp');
const addCardBtn = document.querySelector('#addCardBtn');
const removeCardBtn = document.querySelector('#removeCardBtn');
let data = {};
let selected = null;
let connected = false;
const isHostedAdmin = location.hostname === 'shivshakti-cms.onrender.com';
const previewOrigin = isHostedAdmin ? 'https://shivshakti-furnitures.onrender.com' : location.origin;
const apiOrigin = location.origin;
const pageKey = () => pageSelect.value;
const setStatus = (message, kind = '') => { status.textContent = message; status.className = `cms-status ${kind}`; };
const parseBackground = (value = '') => value.match(/^url\(["']?(.*?)["']?\)$/)?.[1] || value;
const updatePreview = () => {
  if (!selected || !preview.contentWindow) return;
  preview.contentWindow.postMessage({ source: 'shivshakti-cms-editor', type: 'update', key: selected.key, record: selected.record }, previewOrigin);
};
const updatePagePreview = () => {
  preview.contentWindow?.postMessage({ source: 'shivshakti-cms-editor', type: 'render-state', pageData: data[pageKey()] || {} }, previewOrigin);
};
const resetFields = () => {
  selected = null;
  selectionNote.textContent = 'Nothing selected yet. Click a text block, image, video, or link in the preview.';
  textField.value = mediaField.value = altField.value = linkField.value = '';
  textField.disabled = mediaField.disabled = altField.disabled = linkField.disabled = true;
  uploadField.disabled = true;
  resetItemBtn.disabled = true;
  removeSectionBtn.disabled = true;
  Object.values(cardFields).forEach(field => { field.value = ''; field.disabled = true; });
  addCardBtn.disabled = removeCardBtn.disabled = true;
  cardHelp.textContent = 'Select a product card or gallery image in the preview to edit, remove, or add a card beside it.';
};
const loadPreview = () => {
  resetFields();
  const previewUrl = new URL(`${previewOrigin}/${pageKey()}`);
  previewUrl.searchParams.set('cmsEdit', '1');
  previewUrl.searchParams.set('cmsApi', apiOrigin);
  previewUrl.searchParams.set('cmsParent', location.origin);
  previewUrl.searchParams.set('v', Date.now());
  preview.src = previewUrl.href;
  document.querySelector('#previewHint').textContent = `Editing ${pageNames[pageKey()]}`;
};
async function saveData(showMessage = true) {
  if (!connected) { setStatus('Start the local CMS with start-cms.bat before saving.', 'error'); return false; }
  try {
    const response = await fetch('/api/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || `Save failed (${response.status})`);
    }
    if (showMessage) setStatus('Saved. Your site pages will show the updated content.', 'saved');
    return true;
  } catch (error) { setStatus(`Could not save: ${error.message}`, 'error'); return false; }
}
function populateSelection(message) {
  selected = { page: message.page, key: message.key, tag: message.tag, sectionKey: message.sectionKey, sectionId: message.sectionId, cardKey: message.cardKey, containerKey: message.containerKey, cardId: message.cardId, canAddCard: message.canAddCard, record: { ...(message.record || {}) } };
  const saved = data[message.page]?.[message.key];
  if (saved) selected.record = { ...selected.record, ...saved };
  const record = selected.record;
  const media = /^(IMG|VIDEO)$/.test(message.tag);
  const background = !!record.background;
  textField.disabled = media;
  mediaField.disabled = !(media || background);
  altField.disabled = message.tag !== 'IMG';
  linkField.disabled = message.tag !== 'A';
  uploadField.disabled = message.tag !== 'IMG';
  textField.value = record.text ?? '';
  mediaField.value = media ? (record.src || '') : background ? parseBackground(record.background) : '';
  altField.value = record.alt ?? '';
  linkField.value = record.href ?? '';
  selectionNote.textContent = `${pageNames[message.page] || message.page} · ${message.tag.toLowerCase()} · ${message.label || 'Selected item'}`;
  resetItemBtn.disabled = false;
  removeSectionBtn.disabled = !(selected.sectionKey || selected.sectionId);
  const cardData = selected.cardId ? (data[message.page]?.__addedCards || []).find(card => card.id === selected.cardId) : (data[message.page]?.__cardEdits?.[selected.cardKey] || message.cardData);
  Object.entries(cardFields).forEach(([key, field]) => { field.disabled = !selected.cardKey; field.value = cardData?.[key] || ''; });
  addCardBtn.disabled = !(selected.cardKey && selected.canAddCard);
  removeCardBtn.disabled = !selected.cardKey;
  cardHelp.textContent = selected.cardKey ? `${selected.canAddCard ? 'Selected card. Edit fields here, add a card to this gallery, or remove this card.' : 'Selected card. Edit its fields or remove it.'}` : 'Select a product card or gallery image in the preview.';
}
function saveField(field) {
  if (!selected) return;
  const record = { ...(data[selected.page]?.[selected.key] || selected.record) };
  if (field === 'text') record.text = textField.value;
  if (field === 'media') {
    if (/^(IMG|VIDEO)$/.test(selected.tag)) record.src = mediaField.value;
    else record.background = mediaField.value ? `url("${mediaField.value.replaceAll('"', '%22')}")` : '';
  }
  if (field === 'alt') record.alt = altField.value;
  if (field === 'href') record.href = linkField.value;
  data[selected.page] ||= {};
  data[selected.page][selected.key] = record;
  selected.record = record;
  updatePreview();
  setStatus('Unsaved change — choose Save changes to keep it.', '');
}
window.addEventListener('message', (event) => {
  if (event.origin !== previewOrigin || event.source !== preview.contentWindow || event.data?.source !== 'shivshakti-cms') return;
  if (event.data.type === 'ready') document.querySelector('#previewHint').textContent = `Click an item to edit · ${pageNames[pageKey()]}`;
  if (event.data.type === 'selection') populateSelection(event.data);
});
pageSelect.addEventListener('change', loadPreview);
textField.addEventListener('input', () => saveField('text'));
mediaField.addEventListener('input', () => saveField('media'));
altField.addEventListener('input', () => saveField('alt'));
linkField.addEventListener('input', () => saveField('href'));
uploadField.addEventListener('change', () => {
  const file = uploadField.files?.[0];
  if (!file || !selected || selected.tag !== 'IMG') return;
  const reader = new FileReader();
  reader.onload = () => { mediaField.value = reader.result; saveField('media'); setStatus('Image loaded in preview. Save changes to keep it.', ''); };
  reader.readAsDataURL(file);
});
document.querySelector('#saveBtn').addEventListener('click', () => saveData());
document.querySelector('#reloadBtn').addEventListener('click', loadPreview);
resetItemBtn.addEventListener('click', async () => {
  if (!selected) return;
  delete data[selected.page]?.[selected.key];
  await saveData(false); loadPreview(); setStatus('Selected item restored to the original page content.', 'saved');
});
removeSectionBtn.addEventListener('click', async () => {
  if (!selected?.sectionKey && !selected?.sectionId) return;
  const pageData = data[pageKey()] ||= {};
  if (selected.sectionId) {
    pageData.__sections = (pageData.__sections || []).filter(section => section.id !== selected.sectionId);
  } else {
    pageData.__removedSections ||= [];
    if (!pageData.__removedSections.includes(selected.sectionKey)) pageData.__removedSections.push(selected.sectionKey);
  }
  updatePagePreview(); resetFields();
  setStatus('Section removed in the preview — choose Save changes to keep it.', '');
});
document.querySelector('#addSectionBtn').addEventListener('click', () => {
  const title = document.querySelector('#newSectionTitle').value.trim();
  const text = document.querySelector('#newSectionText').value.trim();
  const image = document.querySelector('#newSectionImage').value.trim();
  const href = document.querySelector('#newSectionLink').value.trim();
  if (!title && !text && !image) { setStatus('Add a heading, text, or image for the new section.', 'error'); return; }
  const pageData = data[pageKey()] ||= {};
  pageData.__sections ||= [];
  pageData.__sections.push({ id: `section-${Date.now()}`, title, text, image, href, linkLabel: 'Learn more' });
  updatePagePreview();
  document.querySelector('#newSectionTitle').value = '';
  document.querySelector('#newSectionText').value = '';
  document.querySelector('#newSectionImage').value = '';
  document.querySelector('#newSectionLink').value = '';
  setStatus('Section added in the preview — choose Save changes to keep it.', '');
});
function saveCardField(fieldName) {
  if (!selected?.cardKey) return;
  const pageData = data[pageKey()] ||= {};
  const updated = Object.fromEntries(Object.entries(cardFields).map(([key, field]) => [key, field.value.trim()]));
  if (selected.cardId) {
    const item = (pageData.__addedCards || []).find(card => card.id === selected.cardId);
    if (item) Object.assign(item, updated);
  } else {
    pageData.__cardEdits ||= {};
    pageData.__cardEdits[selected.cardKey] = { ...(pageData.__cardEdits[selected.cardKey] || selected.cardData || {}), ...updated };
  }
  selected.cardData = updated;
  updatePagePreview();
  setStatus('Card updated in the preview — choose Save changes to keep it.', '');
}
Object.entries(cardFields).forEach(([key, field]) => field.addEventListener('input', () => saveCardField(key)));
addCardBtn.addEventListener('click', () => {
  if (!selected?.canAddCard) return;
  const values = Object.fromEntries(Object.entries(cardFields).map(([key, field]) => [key, field.value.trim()]));
  if (!values.title && !values.text && !values.image) { setStatus('Enter a card title, description, or image first.', 'error'); return; }
  const pageData = data[pageKey()] ||= {};
  pageData.__addedCards ||= [];
  pageData.__addedCards.push({ ...values, id: `card-${Date.now()}`, containerKey: selected.containerKey });
  updatePagePreview();
  setStatus('Card added to the selected gallery — choose Save changes to keep it.', '');
});
removeCardBtn.addEventListener('click', () => {
  if (!selected?.cardKey) return;
  const pageData = data[pageKey()] ||= {};
  if (selected.cardId) pageData.__addedCards = (pageData.__addedCards || []).filter(card => card.id !== selected.cardId);
  else { pageData.__removedCards ||= []; if (!pageData.__removedCards.includes(selected.cardKey)) pageData.__removedCards.push(selected.cardKey); }
  updatePagePreview(); resetFields();
  setStatus('Card removed in the preview — choose Save changes to keep it.', '');
});
document.querySelector('#resetPageBtn').addEventListener('click', async () => {
  if (!confirm(`Restore all ${pageNames[pageKey()]} content to the original?`)) return;
  delete data[pageKey()]; await saveData(false); loadPreview(); setStatus('This page has been restored to its original content.', 'saved');
});
document.querySelector('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'shivshakti-site-content.json'; link.click(); URL.revokeObjectURL(link.href);
});
document.querySelector('#importFile').addEventListener('change', async (event) => {
  const file = event.target.files?.[0]; if (!file) return;
  try { const imported = JSON.parse(await file.text()); if (!imported || typeof imported !== 'object' || Array.isArray(imported)) throw new Error('The backup file is not a valid CMS export.'); data = imported; if (await saveData(false)) { loadPreview(); setStatus('Backup imported and saved.', 'saved'); } }
  catch (error) { setStatus(`Import failed: ${error.message}`, 'error'); }
  event.target.value = '';
});
(async () => {
  if (location.protocol === 'file:') {
    setStatus('This file copy cannot save. Double-click start-cms.bat, then use the local editor link below.', 'error');
    const openLink = document.createElement('a');
    openLink.href = 'http://127.0.0.1:8765/cms.html';
    openLink.textContent = 'Open local CMS';
    openLink.className = 'cms-open-local';
    status.append(' ', openLink);
    loadPreview();
    return;
  }
  try {
    if (isHostedAdmin) {
      const session = await fetch('/api/session', { credentials: 'include' });
      if (!session.ok || !(await session.json()).authenticated) { location.assign('/cms.html'); return; }
    }
    const response = await fetch('/api/content', { credentials: 'include' });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || (isHostedAdmin ? 'Could not load saved website content.' : 'Local CMS server was not found.'));
    }
    data = await response.json(); connected = true;
    setStatus('Connected. Select any text, image, video, or link in the preview to edit it.', 'saved');
  }
  catch (error) { setStatus(`Could not connect to the CMS server (${error.message}).`, 'error'); }
  loadPreview();
})();
