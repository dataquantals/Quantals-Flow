/* ==========================================================================
   Files page — Cloudinary-backed file manager for QuantalFlow.
   Upload flow (mirrors Circuit-Overseer):
     1. POST /api/files/signature  -> signed upload ticket
     2. Browser uploads the bytes directly to Cloudinary
     3. POST /api/files            -> record metadata in SQLite
   ========================================================================== */
(function () {
  'use strict';

  const dropzone = document.getElementById('files-dropzone');
  const input = document.getElementById('files-input');
  const uploadBtn = document.getElementById('files-upload-btn');
  const grid = document.getElementById('files-grid');
  const empty = document.getElementById('files-empty');
  const countEl = document.getElementById('files-count');
  const searchInput = document.getElementById('files-search');
  const refreshBtn = document.getElementById('files-refresh');

  let allFiles = [];
  let searchQuery = '';

  function humanSize(bytes) {
    bytes = Number(bytes) || 0;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function formatDate(ts) {
    try { return new Date(ts).toLocaleString(); } catch (e) { return ''; }
  }

  function isImage(mime, name) {
    mime = String(mime || '').toLowerCase();
    if (mime.startsWith('image/')) return true;
    return /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(name || '');
  }

  function fileIcon(mime, name) {
    const m = String(mime || '').toLowerCase();
    const n = String(name || '').toLowerCase();
    if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/.test(n)) return '🖼️';
    if (m === 'application/pdf' || n.endsWith('.pdf')) return '📕';
    if (m.startsWith('video/')) return '🎬';
    if (m.startsWith('audio/')) return '🎵';
    if (m.includes('spreadsheet') || /\.(xlsx?|csv)$/.test(n)) return '📊';
    if (m.includes('presentation') || /\.(pptx?)$/.test(n)) return '📽️';
    if (m.includes('word') || /\.(docx?)$/.test(n)) return '📝';
    if (m.includes('zip') || /\.(zip|tar|gz|rar)$/.test(n)) return '🗜️';
    return '📄';
  }

  async function api(path, options) {
    const res = await fetch(path, Object.assign({ credentials: 'same-origin' }, options || {}));
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }
    if (!res.ok) throw new Error(data.error || data.message || ('HTTP ' + res.status));
    return data;
  }

  async function loadFiles() {
    try {
      const data = await api('/api/files');
      allFiles = Array.isArray(data.files) ? data.files : [];
      render();
    } catch (err) {
      console.warn('[files] load failed', err);
      countEl.textContent = 'Could not load files';
    }
  }

  function filtered() {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allFiles;
    return allFiles.filter(function (f) {
      return String(f.name || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  function render() {
    const list = filtered();
    countEl.textContent = list.length + ' file' + (list.length === 1 ? '' : 's');
    grid.innerHTML = '';
    if (!list.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    list.forEach(function (f) {
      const card = document.createElement('div');
      card.className = 'file-card';
      const mime = f.mimeType || f.mime || '';
      const createdAt = f.createdAt || f.created_at || Date.now();
      const imgHtml = isImage(mime, f.name)
        ? '<img class="file-card__thumb" src="' + f.url + '" alt="" loading="lazy" />'
        : '<div class="file-card__icon">' + fileIcon(mime, f.name) + '</div>';
      card.innerHTML =
        imgHtml +
        '<div class="file-card__body">' +
          '<div class="file-card__name" title="' + (f.name || '') + '">' + (f.name || 'Untitled') + '</div>' +
          '<div class="file-card__meta">' + humanSize(f.size) + ' · ' + formatDate(createdAt) + '</div>' +
        '</div>' +
        '<div class="file-card__actions">' +
          '<a class="file-card__btn" href="' + f.url + '" target="_blank" rel="noopener" title="Open">Open</a>' +
          '<button class="file-card__btn file-card__btn--danger" type="button" data-delete-id="' + f.id + '" title="Delete">Delete</button>' +
        '</div>';
      grid.appendChild(card);
    });
  }

  async function uploadOne(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      await window.QFDialog.alert({
        title: 'File too large',
        message: file.name + ' is larger than 10 MB and was skipped.',
        buttonLabel: 'OK',
        tone: 'primary'
      });
      return;
    }
    // 1. Get signed upload ticket
    const ticket = await api('/api/files/signature', { method: 'POST' });
    // 2. Upload bytes directly to Cloudinary
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', ticket.apiKey);
    form.append('timestamp', String(ticket.timestamp));
    form.append('signature', ticket.signature);
    form.append('folder', ticket.folder);
    const uploadUrl = 'https://api.cloudinary.com/v1_1/' + ticket.cloudName + '/auto/upload';
    const upRes = await fetch(uploadUrl, { method: 'POST', body: form });
    const upData = await upRes.json();
    if (!upRes.ok || !upData.secure_url) {
      throw new Error((upData && upData.error && upData.error.message) || 'Upload failed');
    }
    // 3. Record metadata
    await api('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        mime: file.type || '',
        url: upData.secure_url,
        publicId: upData.public_id,
        resourceType: upData.resource_type
      })
    });
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    dropzone.classList.add('is-uploading');
    let done = 0;
    let failed = 0;
    for (const f of files) {
      try {
        await uploadOne(f);
        done += 1;
      } catch (err) {
        failed += 1;
        console.warn('[files] upload failed', f.name, err);
        await window.QFDialog.alert({
          title: 'Upload failed',
          message: 'Failed to upload ' + f.name + ': ' + (err && err.message),
          buttonLabel: 'OK',
          tone: 'danger'
        });
      }
    }
    dropzone.classList.remove('is-uploading');
    await loadFiles();
    if (done) {
      // small toast-less confirmation via count update
    }
  }

  async function deleteFile(id) {
    var confirmed = await window.QFDialog.confirm({
      title: 'Delete this file?',
      message: 'This action cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });
    if (!confirmed) return;
    try {
      await api('/api/files/' + encodeURIComponent(id), { method: 'DELETE' });
      await loadFiles();
    } catch (err) {
      await window.QFDialog.alert({
        title: 'Delete failed',
        message: 'Delete failed: ' + (err && err.message),
        buttonLabel: 'OK',
        tone: 'danger'
      });
    }
  }

  // Wire events
  if (uploadBtn && input) {
    uploadBtn.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      handleFiles(input.files);
      input.value = '';
    });
  }

  if (dropzone) {
    dropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    });
    dropzone.addEventListener('dragleave', function () {
      dropzone.classList.remove('is-dragover');
    });
    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
      handleFiles(e.dataTransfer && e.dataTransfer.files);
    });
    dropzone.addEventListener('click', function () {
      if (input) input.click();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      searchQuery = searchInput.value || '';
      render();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadFiles);
  }

  if (grid) {
    grid.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-delete-id]');
      if (btn) deleteFile(btn.dataset.deleteId);
    });
  }

  const logoutBtn = document.getElementById('files-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function () {
      try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch (e) {}
      window.location.href = '/login/';
    });
  }

  // Initial load
  loadFiles();
})();
