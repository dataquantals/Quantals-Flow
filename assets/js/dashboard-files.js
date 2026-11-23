/* ==========================================================================
   Dashboard Files & 3D Folders (ported from Circuit-Overseer-s-visit)
   - Uses FolderUI (assets/js/folder.js) & NewFolderUI (assets/js/new-folder.js)
   - Signed Cloudinary uploads (POST /api/files/signature -> Cloudinary -> /api/files/save)
   - PDF/ZIP fallback via /api/files/upload so every file type previews reliably
   ========================================================================== */
(function () {
  'use strict';

  var FILES_LIMITS = {
    MAX_FILE_BYTES: 10 * 1024 * 1024, // 10 MB per file
    MAX_BATCH: 10,
    ALLOWED_EXTENSIONS: [
      'pdf', 'doc', 'docx', 'odt', 'rtf',
      'xls', 'xlsx', 'ods', 'csv',
      'ppt', 'pptx',
      'txt', 'md', 'json',
      'png', 'jpg', 'jpeg', 'webp', 'gif',
      'zip'
    ]
  };

  var STORAGE_BACKED_EXTENSIONS = ['pdf', 'zip'];
  var FOLDER_COLORS = ['#E8A850', '#D49B41', '#E2A044', '#C98E32', '#DFA247'];
  var FOLDER_LOOKS = [
    { mode: 'flap', variant: 'solid', layout: 'stack', tabPosition: 'left', theme: 'light', size: 1 },
    { mode: 'flap', variant: 'solid', layout: 'spread', tabPosition: 'left', theme: 'light', size: 1 }
  ];

  var state = {
    files: [],
    folders: [],
    fileOrder: {},
    pending: [],
    viewMode: 'grid',
    sortBy: 'date-desc',
    viewFolderId: null,
    selectedFileId: null,
    uploading: false,
    loaded: false,
    lastSyncAt: 0
  };

  function persistFilesCache(list) {
    state.files = Array.isArray(list) ? list : [];
  }

  function persistFoldersCache(list) {
    state.folders = Array.isArray(list) ? list : [];
  }

  function savePreferencesToServer(patch) {
    fetch('/api/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(patch)
    }).catch(function () {});
  }

  function saveFileOrderToServer(folderId, orderObj) {
    fetch('/api/files/order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ folderId: folderId || 'root', order: orderObj || {} })
    }).catch(function () {});
  }

  var draggedFileId = null;
  var readerState = { objectUrl: null, wired: false, currentFileId: null };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatFileBytes(bytes) {
    var n = Number(bytes) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
    return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  function fileExtension(name) {
    var parts = String(name || '').split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  function fileChipLabel(file) {
    var ext = fileExtension(file && (file.name || file.fileName));
    return ext ? ext.slice(0, 4).toUpperCase() : 'FILE';
  }

  function fileChipClass(file) {
    var ext = fileExtension(file && (file.name || file.fileName));
    if (ext === 'pdf') return 'files-chip-pdf';
    if (['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].indexOf(ext) !== -1) return 'files-chip-doc';
    if (['xls', 'xlsx', 'ods', 'csv'].indexOf(ext) !== -1) return 'files-chip-sheet';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].indexOf(ext) !== -1) return 'files-chip-image';
    if (['ppt', 'pptx'].indexOf(ext) !== -1) return 'files-chip-slide';
    return 'files-chip-generic';
  }

  function showAlert(msg, kind) {
    var box = $('files-alert');
    if (!box) return;
    if (!msg) {
      box.className = 'alert-box';
      box.textContent = '';
      return;
    }
    box.className = 'alert-box visible ' + (kind === 'error' ? 'alert-error' : kind === 'info' ? 'alert-info' : 'alert-success');
    box.textContent = msg;
    clearTimeout(box._hideTimer);
    if (kind !== 'error') {
      box._hideTimer = setTimeout(function () {
        box.className = 'alert-box';
        box.textContent = '';
      }, 4500);
    }
  }

  function updateSyncStatus(text, ok) {
    var el = $('files-sync-status');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('files-sync-error', ok === false);
    el.classList.toggle('files-sync-ok', ok === true);
  }

  function setProgress(visible, ratio, text) {
    var wrap = $('files-progress');
    var bar = $('files-progress-bar');
    var track = $('files-progress-track');
    var label = $('files-progress-text');
    if (!wrap) return;
    wrap.hidden = !visible;
    var pct = Math.max(0, Math.min(100, Math.round((Number(ratio) || 0) * 100)));
    if (bar) bar.style.width = pct + '%';
    if (track) track.setAttribute('aria-valuenow', String(pct));
    if (label && text) label.textContent = text;
  }

  function folderById(id) {
    if (!id) return null;
    var target = String(id).trim();
    return state.folders.find(function (row) {
      return row.id === target || row.key === target;
    }) || null;
  }

  function childFolders(parentId) {
    var parent = parentId || null;
    return state.folders
      .filter(function (row) { return (row.parentId || null) === parent; })
      .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
  }

  function filesInFolder(folderId) {
    var target = folderId || null;
    return state.files.filter(function (file) {
      return (file.folderId || null) === target;
    });
  }

  function descendantFolderIds(folderId) {
    if (!folderId) return [];
    var result = [];
    var seen = {};
    seen[folderId] = true;
    var queue = [folderId];
    while (queue.length && result.length < 250) {
      var cur = queue.shift();
      var kids = childFolders(cur);
      for (var i = 0; i < kids.length; i += 1) {
        var kidId = kids[i] && kids[i].id;
        if (kidId && !seen[kidId]) {
          seen[kidId] = true;
          result.push(kidId);
          queue.push(kidId);
        }
      }
    }
    return result;
  }

  function filesInFolderTree(folderId) {
    if (!folderId) return filesInFolder(null);
    var allIds = [folderId].concat(descendantFolderIds(folderId));
    var seen = {};
    var list = [];
    allIds.forEach(function (fid) {
      filesInFolder(fid).forEach(function (f) {
        if (f && f.id && !seen[f.id]) {
          seen[f.id] = true;
          list.push(f);
        }
      });
    });
    return list;
  }

  function sortFiles(list) {
    var mode = state.sortBy || 'date-desc';
    if (mode === 'order') {
      var order = state.fileOrder || {};
      return list.slice().sort(function (a, b) {
        var ra = Number(order[a.id]);
        var rb = Number(order[b.id]);
        var hasA = isFinite(ra);
        var hasB = isFinite(rb);
        if (hasA && hasB && ra !== rb) return ra - rb;
        if (hasA !== hasB) return hasA ? -1 : 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    }
    return list.slice().sort(function (a, b) {
      if (mode === 'name-asc') return String(a.name || '').localeCompare(String(b.name || ''));
      if (mode === 'name-desc') return String(b.name || '').localeCompare(String(a.name || ''));
      if (mode === 'size-asc') return (a.size || 0) - (b.size || 0);
      if (mode === 'size-desc') return (b.size || 0) - (a.size || 0);
      if (mode === 'date-asc') return (a.createdAt || 0) - (b.createdAt || 0);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  function reorderFiles(movingId, targetId) {
    if (!movingId || !targetId || movingId === targetId) return;
    var ids = sortFiles(filesInFolder(state.viewFolderId)).map(function (f) { return f.id; });
    var from = ids.indexOf(movingId);
    var to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, movingId);
    var order = Object.assign({}, state.fileOrder || {});
    ids.forEach(function (id, idx) { order[id] = idx; });
    state.fileOrder = order;
    state.sortBy = 'order';
    saveFileOrderToServer(state.viewFolderId || 'root', order);
    renderFilesList();
  }

  function folderSummary(folderId) {
    var subfolders = childFolders(folderId);
    var treeFiles = sortFiles(filesInFolderTree(folderId));
    var fileCount = treeFiles.length;
    var subCount = subfolders.length;
    var total = fileCount > 0 ? fileCount : subCount;
    var label = 'Empty folder';
    if (fileCount > 0) label = fileCount === 1 ? '1 item' : fileCount + ' items';
    else if (subCount > 0) label = subCount === 1 ? '1 folder' : subCount + ' folders';
    return { subfolders: subfolders, files: treeFiles, total: total, label: label };
  }

  function folderChain(id) {
    var chain = [];
    var cursor = id;
    for (var depth = 0; cursor && depth < 40; depth += 1) {
      var f = folderById(cursor);
      if (!f) break;
      chain.unshift(f);
      cursor = f.parentId || null;
    }
    return chain;
  }

  function renderBadges() {
    var count = state.files.length;
    var pill = $('files-count-pill');
    if (pill) pill.textContent = String(count);
    var navBadge = $('dash-badge-files');
    if (navBadge) {
      navBadge.textContent = String(count);
      navBadge.hidden = count === 0;
    }
    var totalBytes = state.files.reduce(function (s, f) { return s + (Number(f.size) || 0); }, 0);
    var totalEl = $('files-total-size');
    if (totalEl) totalEl.textContent = formatFileBytes(totalBytes);
  }

  function renderBreadcrumb() {
    var nav = $('files-breadcrumb');
    if (!nav) return;
    var chain = folderChain(state.viewFolderId);
    if (!chain.length) {
      nav.hidden = true;
      nav.textContent = '';
      return;
    }
    nav.hidden = false;
    var homeIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
    var folderIcon = '<svg class="windows-folder-glyph" width="18" height="15" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M1 4C1 2.89 1.89 2 3 2H9.2C9.8 2 10.4 2.3 10.8 2.8L12.2 4.2C12.6 4.7 13.2 5 13.8 5H21C22.1 5 23 5.89 23 7V17C23 18.1 22.1 19 21 19H3C1.89 19 1 18.1 1 17V4Z" fill="#E29505"/><path d="M1 7.2C1 6.1 1.89 5.2 3 5.2H21C22.1 5.2 23 6.1 23 7.2V17C23 18.1 22.1 19 21 19H3C1.89 19 1 18.1 1 17V7.2Z" fill="#F8C630" stroke="#C47800" stroke-width="0.8"/><path d="M2 6.2H22" stroke="white" stroke-opacity="0.65" stroke-width="0.9"/></svg>';
    var chev = '<span class="files-crumb-sep" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>';
    var html = '<button type="button" class="files-crumb files-crumb-root" data-crumb="" title="Back to Stored Files">' + homeIcon + '<span>Stored Files</span></button>';
    chain.forEach(function (f, i) {
      var last = i === chain.length - 1;
      html += chev + '<button type="button" class="files-crumb" data-crumb="' + escapeHtml(f.id) + '"' + (last ? ' aria-current="page"' : '') + '>' + folderIcon + '<span>' + escapeHtml(f.name) + '</span></button>';
    });
    nav.innerHTML = html;
  }

  function renderFoldersPanel() {
    var wrap = $('files-folders');
    if (!wrap) return;
    var isGrid = state.viewMode === 'grid';
    var kids = childFolders(state.viewFolderId);
    wrap.textContent = '';
    wrap.hidden = !isGrid || kids.length === 0;
    if (!isGrid || !kids.length) return;

    kids.forEach(function (folder, index) {
      var look = FOLDER_LOOKS[Math.abs(index) % FOLDER_LOOKS.length];
      var summary = folderSummary(folder.id);
      var fileItems = summary.files.map(function (file) {
        var ext = fileExtension(file && file.name);
        var isPhoto = ['png', 'jpg', 'jpeg', 'webp', 'gif'].indexOf(ext) !== -1;
        return {
          title: file.name || 'Untitled',
          image: isPhoto && file.url ? file.url : null,
          raw: file
        };
      });
      var subItems = summary.subfolders.map(function (sub) {
        return { title: sub.name, ext: 'DIR', raw: sub };
      });
      var items = fileItems.length > 0 ? fileItems.concat(subItems) : subItems;

      var card = document.createElement('div');
      card.className = 'files-folder-card';
      card.dataset.folderId = folder.id;

      if (window.FolderUI && typeof window.FolderUI.create === 'function') {
        card.appendChild(window.FolderUI.create(Object.assign({}, look, {
          label: folder.name,
          items: items,
          countLabel: summary.label,
          totalCount: summary.total,
          color: FOLDER_COLORS[index % FOLDER_COLORS.length],
          paperColor: '#FFFFFF',
          openOn: 'hover',
          tilt: 0.5,
          speed: 1,
          bounce: 0.4,
          frost: 0.25,
          peek: items.length > 0,
          intro: true,
          key: folder.id,
          onClick: function () { setFilesView(folder.id); },
          onItemClick: function (item) {
            var raw = item && item.raw ? item.raw : item;
            if (raw && raw.type === 'folder' && raw.id) {
              setFilesView(raw.id);
              return;
            }
            if (raw && raw.id) readFile(raw.id);
          }
        })));
      }

      var bar = document.createElement('div');
      bar.className = 'files-folder-actions';
      bar.innerHTML =
        '<div class="files-folder-tools">' +
          '<button type="button" class="files-folder-tool" data-folder-action="rename" title="Rename folder" aria-label="Rename ' + escapeHtml(folder.name) + '">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>' +
          '</button>' +
          '<button type="button" class="files-folder-tool is-danger" data-folder-action="delete" title="Delete folder" aria-label="Delete ' + escapeHtml(folder.name) + '">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>' +
          '</button>' +
          '<button type="button" class="files-folder-tool" data-folder-action="context" title="Folder options" aria-label="Options for ' + escapeHtml(folder.name) + '">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/></svg>' +
          '</button>' +
        '</div>';
      card.appendChild(bar);
      wrap.appendChild(card);
    });
  }

  function renderPendingHtml() {
    return state.pending.map(function (item) {
      var pct = Math.max(0, Math.min(100, Math.round((Number(item.percent) || 0) * 100)));
      var failed = item.state === 'error';
      var done = item.state === 'done';
      var statusText = failed ? (item.message || 'Upload failed') : done ? 'Uploaded' : (item.label || 'Uploading…');
      var chipClass = failed ? 'files-chip-pdf' : done ? 'files-chip-sheet' : 'files-chip-pending';
      var chipInner = failed ? 'ERR' : done ? 'OK' : '<span class="files-spinner" aria-hidden="true"></span>';
      var stateClass = failed ? ' files-row-pending-error' : done ? ' files-row-pending-done' : '';
      var fillWidth = failed || done ? 100 : pct;
      return '<li class="files-row files-row-pending' + stateClass + '">' +
        '<span class="files-chip ' + chipClass + '" aria-hidden="true">' + chipInner + '</span>' +
        '<div class="files-row-info">' +
          '<div class="files-row-name" title="' + escapeHtml(item.name) + '">' + escapeHtml(item.name) + '</div>' +
          '<div class="files-pending-track"><span class="files-pending-fill' + (failed ? ' files-pending-fill-error' : '') + '" style="width:' + fillWidth + '%"></span></div>' +
          '<div class="files-row-sub files-pending-status">' + escapeHtml(statusText) + '</div>' +
        '</div>' +
        '<div class="files-row-actions"><span class="files-pending-pct">' + (failed ? '' : pct + '%') + '</span></div>' +
      '</li>';
    }).join('');
  }

  function renderFilesList() {
    renderFoldersPanel();
    renderBreadcrumb();
    renderBadges();

    var viewId = state.viewFolderId;
    var isGrid = state.viewMode === 'grid';
    var direct = filesInFolder(viewId);
    var files = sortFiles(viewId && direct.length === 0 ? filesInFolderTree(viewId) : direct);
    var kids = childFolders(viewId);

    var btnGrid = $('btn-files-view-grid');
    var btnList = $('btn-files-view-list');
    if (btnGrid) {
      btnGrid.classList.toggle('is-active', isGrid);
      btnGrid.setAttribute('aria-pressed', isGrid ? 'true' : 'false');
    }
    if (btnList) {
      btnList.classList.toggle('is-active', !isGrid);
      btnList.setAttribute('aria-pressed', !isGrid ? 'true' : 'false');
    }
    var sortSel = $('files-sort-select');
    if (sortSel) sortSel.value = state.sortBy;

    var emptyEl = $('files-empty');
    if (emptyEl) {
      emptyEl.style.display = (files.length || state.pending.length || kids.length) ? 'none' : 'flex';
    }

    var listEl = $('files-list');
    var tableWrap = $('files-table-container');
    var tableBody = $('files-table-body');

    if (isGrid) {
      if (tableWrap) tableWrap.hidden = true;
      if (listEl) {
        listEl.hidden = false;
        listEl.innerHTML = renderPendingHtml() + files.map(function (file) {
          var whenText = file.createdAt ? new Date(file.createdAt).toLocaleString() : '';
          var isSel = state.selectedFileId === file.id;
          var subFolder = viewId && file.folderId && file.folderId !== viewId ? folderById(file.folderId) : null;
          var destBadge = file.url ? 'Cloudinary' : 'Vault';
          return '<li class="files-row ' + (isSel ? 'is-selected' : '') + '" data-file-id="' + escapeHtml(file.id) + '" draggable="true" tabindex="0">' +
            '<span class="files-chip ' + fileChipClass(file) + '" aria-hidden="true">' + escapeHtml(fileChipLabel(file)) + '</span>' +
            '<div class="files-row-info">' +
              '<div class="files-row-name" title="' + escapeHtml(file.name) + '">' + escapeHtml(file.name) + '</div>' +
              '<div class="files-row-meta">' +
                '<span>' + escapeHtml(formatFileBytes(file.size)) + '</span>' +
                '<span class="files-meta-sep" aria-hidden="true">&bull;</span>' +
                '<span>' + destBadge + '</span>' +
                (subFolder ? '<span class="files-meta-sep" aria-hidden="true">&bull;</span><span>' + escapeHtml(subFolder.name) + '</span>' : '') +
                (whenText ? '<span class="files-meta-sep" aria-hidden="true">&bull;</span><span>' + escapeHtml(whenText) + '</span>' : '') +
              '</div>' +
              (file.uploadedBy ? '<div class="files-row-sub">Uploaded by ' + escapeHtml(file.uploadedBy) + '</div>' : '') +
            '</div>' +
            '<div class="files-row-actions">' +
              '<button type="button" class="files-row-btn" data-files-action="share" data-file-id="' + escapeHtml(file.id) + '" title="Share">Share</button>' +
              '<button type="button" class="files-row-btn" data-files-action="read" data-file-id="' + escapeHtml(file.id) + '">Read</button>' +
              '<button type="button" class="files-row-btn" data-files-action="download" data-file-id="' + escapeHtml(file.id) + '">Download</button>' +
              '<button type="button" class="files-row-btn files-row-btn-danger" data-files-action="delete" data-file-id="' + escapeHtml(file.id) + '">Delete</button>' +
              '<button type="button" class="files-folder-tool" data-files-action="context" data-file-id="' + escapeHtml(file.id) + '" title="More options">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/></svg>' +
              '</button>' +
            '</div>' +
          '</li>';
        }).join('');
      }
    } else {
      if ($('files-folders')) $('files-folders').hidden = true;
      if (listEl) listEl.hidden = true;
      if (tableWrap) tableWrap.hidden = false;
      if (tableBody) {
        var rowsHtml = '';
        kids.forEach(function (folder) {
          var summary = folderSummary(folder.id);
          var whenText = folder.updatedAt ? new Date(folder.updatedAt).toLocaleDateString() : '';
          rowsHtml += '<tr class="files-table-row files-folder-row" data-folder-id="' + escapeHtml(folder.id) + '" tabindex="0">' +
            '<td class="files-table-name-cell">' +
              '<svg class="files-table-icon windows-folder-glyph" width="22" height="18" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M1 4C1 2.89 1.89 2 3 2H9.2C9.8 2 10.4 2.3 10.8 2.8L12.2 4.2C12.6 4.7 13.2 5 13.8 5H21C22.1 5 23 5.89 23 7V17C23 18.1 22.1 19 21 19H3C1.89 19 1 18.1 1 17V4Z" fill="#E29505"/><path d="M1 7.2C1 6.1 1.89 5.2 3 5.2H21C22.1 5.2 23 6.1 23 7.2V17C23 18.1 22.1 19 21 19H3C1.89 19 1 18.1 1 17V7.2Z" fill="#F8C630" stroke="#C47800" stroke-width="0.8"/><path d="M2 6.2H22" stroke="white" stroke-opacity="0.65" stroke-width="0.9"/></svg>' +
              '<span title="' + escapeHtml(folder.name) + '">' + escapeHtml(folder.name) + '</span>' +
            '</td>' +
            '<td><span class="apple-folder-meta-pill">Folder</span></td>' +
            '<td>' + escapeHtml(summary.label) + '</td>' +
            '<td>' + escapeHtml(whenText) + '</td>' +
            '<td class="files-table-actions-cell">' +
              '<button type="button" class="files-folder-tool" data-folder-action="rename" title="Rename"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>' +
              '<button type="button" class="files-folder-tool is-danger" data-folder-action="delete" title="Delete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg></button>' +
            '</td>' +
          '</tr>';
        });
        files.forEach(function (file) {
          var ext = fileExtension(file.name).toUpperCase() || 'FILE';
          var whenText = file.createdAt ? new Date(file.createdAt).toLocaleDateString() : '';
          var isSel = state.selectedFileId === file.id;
          rowsHtml += '<tr class="files-table-row files-file-row ' + (isSel ? 'is-selected' : '') + '" data-file-id="' + escapeHtml(file.id) + '" draggable="true" tabindex="0">' +
            '<td class="files-table-name-cell">' +
              '<span class="files-chip ' + fileChipClass(file) + '" style="width:28px;height:24px;font-size:9.5px;border-radius:6px;" aria-hidden="true">' + escapeHtml(fileChipLabel(file)) + '</span>' +
              '<span title="' + escapeHtml(file.name) + '">' + escapeHtml(file.name) + '</span>' +
            '</td>' +
            '<td>' + escapeHtml(ext) + ' Document</td>' +
            '<td>' + escapeHtml(formatFileBytes(file.size)) + '</td>' +
            '<td>' + escapeHtml(whenText) + '</td>' +
            '<td class="files-table-actions-cell">' +
              '<button type="button" class="files-row-btn" data-files-action="share" data-file-id="' + escapeHtml(file.id) + '">Share</button>' +
              '<button type="button" class="files-row-btn" data-files-action="read" data-file-id="' + escapeHtml(file.id) + '">Read</button>' +
              '<button type="button" class="files-row-btn" data-files-action="download" data-file-id="' + escapeHtml(file.id) + '">Download</button>' +
              '<button type="button" class="files-row-btn files-row-btn-danger" data-files-action="delete" data-file-id="' + escapeHtml(file.id) + '">Delete</button>' +
            '</td>' +
          '</tr>';
        });
        tableBody.innerHTML = rowsHtml;
      }
    }
  }

  function setFilesView(folderId) {
    state.viewFolderId = folderId || null;
    renderFilesList();
  }

  async function loadFiles(options) {
    var opts = options || {};
    if (!opts.silent) updateSyncStatus('Syncing…', null);
    try {
      var res = await fetch('/api/files', { credentials: 'same-origin', cache: 'no-store' });
      var data = await res.json().catch(function () { return null; });
      if (res.status === 401) {
        updateSyncStatus('Session expired - sign in again', false);
        renderFilesList();
        return;
      }
      if (!res.ok || !data || data.success === false) {
        throw new Error((data && data.error) || 'Could not load files.');
      }
      persistFilesCache(Array.isArray(data.files) ? data.files : []);
      persistFoldersCache(Array.isArray(data.folders) ? data.folders : []);
      if (data.fileOrder && typeof data.fileOrder === 'object') {
        state.fileOrder = data.fileOrder;
      }
      if (data.preferences && typeof data.preferences === 'object') {
        if (data.preferences.filesViewMode === 'grid' || data.preferences.filesViewMode === 'list') {
          state.viewMode = data.preferences.filesViewMode;
        }
        if (data.preferences.filesSortBy) {
          state.sortBy = data.preferences.filesSortBy;
        }
      }
      state.loaded = true;
      state.lastSyncAt = Date.now();
      renderFilesList();
      updateSyncStatus('Synced ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), true);
    } catch (err) {
      updateSyncStatus('Offline — showing last known list', false);
      renderFilesList();
    }
  }

  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || '');
        var idx = result.indexOf(',');
        resolve(idx >= 0 ? result.slice(idx + 1) : result);
      };
      reader.onerror = function () { reject(new Error('Could not read file.')); };
      reader.readAsDataURL(file);
    });
  }

  function uploadXhr(url, formData, startRatio, spanRatio, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.responseType = 'json';
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable && e.total && typeof onProgress === 'function') {
          var r = e.loaded / e.total;
          onProgress(startRatio + r * spanRatio, 'Uploading ' + Math.round(r * 100) + '%');
        }
      };
      xhr.onerror = function () { reject(new Error('Upload interrupted. Check your connection.')); };
      xhr.onload = function () {
        var payload = xhr.response;
        if (!payload || typeof payload !== 'object') {
          try { payload = JSON.parse(xhr.responseText || 'null'); } catch (err) { payload = null; }
        }
        if (xhr.status < 200 || xhr.status >= 300 || !payload || payload.success === false) {
          reject(new Error((payload && (payload.error && payload.error.message || payload.error || payload.message)) || ('Upload failed (' + xhr.status + ')')));
          return;
        }
        resolve(payload);
      };
      xhr.send(formData);
    });
  }

  async function uploadSingleFile(file, folderId, onProgress) {
    var report = function (r, lbl) { if (typeof onProgress === 'function') onProgress(r, lbl); };
    var ext = fileExtension(file.name);

    if (STORAGE_BACKED_EXTENSIONS.indexOf(ext) !== -1) {
      report(0.1, 'Preparing upload…');
      var base64 = await readFileAsBase64(file);
      report(0.5, 'Uploading…');
      var res = await fetch('/api/files/upload', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          folderId: folderId || null,
          dataBase64: base64
        })
      });
      var savedLocal = await res.json().catch(function () { return null; });
      if (!res.ok || !savedLocal || !savedLocal.success) {
        throw new Error((savedLocal && savedLocal.error) || 'Upload failed.');
      }
      report(1, 'Uploaded');
      return savedLocal;
    }

    // Signed Cloudinary direct upload (same flow as Circuit-Overseer-s-visit)
    report(0.02, 'Requesting Cloudinary signature…');
    var sigRes = await fetch('/api/files/signature', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name })
    });
    var sig = await sigRes.json().catch(function () { return null; });
    if (!sigRes.ok || !sig || sig.success === false) {
      throw new Error((sig && sig.error) || 'Could not start Cloudinary upload.');
    }

    report(0.06, 'Uploading to Cloudinary…');
    var form = new FormData();
    form.append('file', file);
    form.append('api_key', sig.apiKey);
    form.append('timestamp', String(sig.timestamp));
    form.append('folder', sig.folder);
    form.append('signature', sig.signature);

    var asset = await uploadXhr(sig.uploadUrl, form, 0.06, 0.84, report);
    if (!asset.secure_url || !asset.public_id) {
      throw new Error('Cloudinary upload did not return an asset URL.');
    }

    report(0.95, 'Saving file details…');
    var saveRes = await fetch('/api/files/save', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: asset.secure_url,
        publicId: asset.public_id,
        resourceType: asset.resource_type || 'auto',
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: Number(asset.bytes) || file.size,
        folderId: folderId || null
      })
    });
    var saved = await saveRes.json().catch(function () { return null; });
    if (!saveRes.ok || !saved || saved.success === false) {
      throw new Error((saved && saved.error) || 'File reached Cloudinary but could not be saved.');
    }
    report(1, 'Uploaded');
    return saved;
  }

  async function handleFilesSelected(fileList) {
    var incoming = Array.prototype.slice.call(fileList || []);
    if (!incoming.length) return;
    if (incoming.length > FILES_LIMITS.MAX_BATCH) {
      showAlert('Please upload at most ' + FILES_LIMITS.MAX_BATCH + ' files at a time.', 'error');
      return;
    }

    var accepted = [];
    var rejected = [];
    incoming.forEach(function (file) {
      if (!file || file.size === 0) {
        rejected.push('"' + (file ? file.name : 'File') + '" is empty.');
      } else if (file.size > FILES_LIMITS.MAX_FILE_BYTES) {
        rejected.push('"' + file.name + '" exceeds ' + formatFileBytes(FILES_LIMITS.MAX_FILE_BYTES) + '.');
      } else {
        var ext = fileExtension(file.name);
        if (!ext || FILES_LIMITS.ALLOWED_EXTENSIONS.indexOf(ext) === -1) {
          rejected.push('"' + file.name + '" is not an accepted file type.');
        } else {
          accepted.push(file);
        }
      }
    });

    if (rejected.length) {
      showAlert(rejected.join(' '), 'error');
      if (!accepted.length) return;
    }

    var targetFolderId = state.viewFolderId;
    state.uploading = true;
    var pickBtn = $('btn-files-pick');
    if (pickBtn) pickBtn.disabled = true;

    state.pending = accepted.map(function (f, i) {
      return { key: 'p-' + Date.now() + '-' + i, name: f.name, percent: 0, state: 'uploading', label: 'Waiting…' };
    });
    renderFilesList();

    var uploadedCount = 0;
    var failures = 0;

    for (var i = 0; i < accepted.length; i += 1) {
      var file = accepted[i];
      var row = state.pending[i];
      var base = i / accepted.length;
      var slice = 1 / accepted.length;
      setProgress(true, base, 'Uploading ' + (i + 1) + ' of ' + accepted.length + ' — ' + file.name);
      try {
        await uploadSingleFile(file, targetFolderId, function (r, lbl) {
          row.percent = base + r * slice;
          if (lbl) row.label = lbl;
          setProgress(true, row.percent, 'Uploading ' + (i + 1) + ' of ' + accepted.length + ' — ' + file.name);
          renderFilesList();
        });
        row.state = 'done';
        row.percent = base + slice;
        row.label = 'Uploaded';
        uploadedCount += 1;
      } catch (err) {
        failures += 1;
        row.state = 'error';
        row.percent = base + slice;
        row.message = err.message || 'Upload failed';
        if (accepted.length === 1) showAlert(row.message, 'error');
      }
      renderFilesList();
    }

    setProgress(false, 0, '');
    state.pending = state.pending.filter(function (p) { return p.state === 'error'; });
    await loadFiles({ silent: true });

    if (uploadedCount > 0) {
      var noun = uploadedCount === 1 ? 'file' : 'files';
      showAlert(uploadedCount + ' ' + noun + ' uploaded to Cloudinary' + (failures ? ' (' + failures + ' failed)' : ''), failures ? 'info' : 'success');
    }

    state.uploading = false;
    if (pickBtn) pickBtn.disabled = false;
  }

  async function createFolder(name, hooks) {
    var clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!clean) {
      if (hooks && hooks.setError) hooks.setError('Give the folder a name first.');
      return { ok: false, message: 'Give the folder a name first.' };
    }
    var clash = childFolders(state.viewFolderId).some(function (f) {
      return f.name.toLowerCase() === clean.toLowerCase();
    });
    if (clash) {
      var msg = 'A folder called "' + clean + '" already exists here.';
      if (hooks && hooks.setError) hooks.setError(msg);
      return { ok: false, message: msg };
    }
    var key = 'folder-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    var now = Date.now();
    var beforeFolders = state.folders.slice();
    var optimistic = {
      id: key,
      key: key,
      name: clean,
      type: 'folder',
      parentId: state.viewFolderId || null,
      createdAt: now,
      updatedAt: now
    };
    persistFoldersCache(state.folders.concat([optimistic]));
    renderFilesList();
    try {
      var res = await fetch('/api/folders', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key, name: clean, parentId: state.viewFolderId || null })
      });
      var data = await res.json().catch(function () { return null; });
      if (!res.ok || !data || !data.success) {
        throw new Error((data && data.error) || 'Could not create folder.');
      }
      await loadFiles({ silent: true });
      showAlert('Folder "' + clean + '" created.', 'success');
      return { ok: true };
    } catch (err) {
      persistFoldersCache(beforeFolders);
      renderFilesList();
      if (hooks && hooks.setError) hooks.setError(err.message);
      showAlert(err.message || 'Could not create folder.', 'error');
      return { ok: false, message: err.message };
    }
  }

  async function renameFolder(folderId, nextName) {
    var folder = folderById(folderId);
    if (!folder) return;
    var clean = String(nextName || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!clean || clean === folder.name) return;
    var beforeFolders = state.folders.slice();
    persistFoldersCache(state.folders.map(function (f) {
      return f.id === folderId ? Object.assign({}, f, { name: clean, updatedAt: Date.now() }) : f;
    }));
    renderFilesList();
    try {
      var res = await fetch('/api/folders', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: folderId, name: clean, parentId: folder.parentId || null })
      });
      if (!res.ok) throw new Error('Rename failed');
      await loadFiles({ silent: true });
      showAlert('Folder renamed to "' + clean + '".', 'success');
    } catch (err) {
      persistFoldersCache(beforeFolders);
      renderFilesList();
      showAlert('Could not rename folder.', 'error');
    }
  }

  async function deleteFolder(folderId) {
    var folder = folderById(folderId);
    if (!folder) return;
    var confirmed = await window.QFDialog.confirm({
      title: 'Delete folder "' + folder.name + '"?',
      message: 'Files and folders inside it move up one level. Nothing is deleted.',
      confirmLabel: 'Delete Folder',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });
    if (!confirmed) return;
    var parentId = folder.parentId || null;
    var beforeFolders = state.folders.slice();
    var beforeFiles = state.files.slice();
    persistFoldersCache(state.folders
      .filter(function (f) { return f.id !== folderId; })
      .map(function (f) { return f.parentId === folderId ? Object.assign({}, f, { parentId: parentId }) : f; }));
    persistFilesCache(state.files.map(function (f) {
      return f.folderId === folderId ? Object.assign({}, f, { folderId: parentId }) : f;
    }));
    if (state.viewFolderId === folderId) state.viewFolderId = parentId;
    renderFilesList();
    try {
      var res = await fetch('/api/folders/' + encodeURIComponent(folderId) + '/delete', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      if (!res.ok) throw new Error('Delete failed');
      await loadFiles({ silent: true });
      showAlert('Folder deleted. Its contents moved up one level.', 'success');
    } catch (err) {
      persistFoldersCache(beforeFolders);
      persistFilesCache(beforeFiles);
      renderFilesList();
      showAlert('Could not delete folder.', 'error');
    }
  }

  async function moveFileTo(fileId, folderId) {
    var file = state.files.find(function (f) { return f.id === fileId; });
    var dest = folderId || null;
    if (!file || (file.folderId || null) === dest) return;
    var prevFolderId = file.folderId || null;
    var beforeFiles = state.files.slice();
    persistFilesCache(state.files.map(function (f) {
      return f.id === fileId ? Object.assign({}, f, { folderId: dest }) : f;
    }));
    renderFilesList();
    try {
      var res = await fetch('/api/files/' + encodeURIComponent(fileId) + '/move', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: dest })
      });
      if (!res.ok) throw new Error('Move failed');
      await loadFiles({ silent: true });
      var target = folderById(dest);
      showAlert(target ? ('Moved "' + file.name + '" into ' + target.name + '.') : ('Moved "' + file.name + '" back to Stored Files.'), 'success');
    } catch (err) {
      persistFilesCache(beforeFiles.map(function (f) {
        return f.id === fileId ? Object.assign({}, f, { folderId: prevFolderId }) : f;
      }));
      renderFilesList();
      showAlert('Could not move file.', 'error');
    }
  }

  async function deleteFile(fileId) {
    var file = state.files.find(function (f) { return f.id === fileId; });
    var label = (file && file.name) || 'this file';
    var confirmed = await window.QFDialog.confirm({
      title: 'Delete "' + label + '"?',
      message: 'It will be removed from Cloudinary and from your file list. This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });
    if (!confirmed) return;
    try {
      var res = await fetch('/api/files/' + encodeURIComponent(fileId) + '/delete', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      if (!res.ok) throw new Error('Delete failed');
      await loadFiles({ silent: true });
      showAlert('"' + label + '" was deleted.', 'success');
    } catch (err) {
      showAlert('Could not delete "' + label + '".', 'error');
    }
  }

  async function downloadFile(fileId) {
    var file = state.files.find(function (f) { return f.id === fileId; });
    var name = (file && file.name) || 'download';
    try {
      var res = await fetch('/api/files/' + encodeURIComponent(fileId) + '/content', { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) throw new Error('Download failed');
      var blob = await res.blob();
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    } catch (err) {
      showAlert('Could not download "' + name + '".', 'error');
    }
  }

  function closeReader() {
    var modal = $('file-reader-modal');
    if (modal) modal.style.display = 'none';
    if (readerState.objectUrl) {
      URL.revokeObjectURL(readerState.objectUrl);
      readerState.objectUrl = null;
    }
    var body = $('file-reader-body');
    if (body) body.textContent = '';
  }

  async function readFile(fileId) {
    var file = state.files.find(function (f) { return f.id === fileId; });
    var name = (file && file.name) || 'File';
    var modal = $('file-reader-modal');
    var body = $('file-reader-body');
    var title = $('file-reader-title');
    if (!modal || !body || !title) return;

    if (!readerState.wired) {
      readerState.wired = true;
      var closeBtn = $('btn-file-reader-close');
      if (closeBtn) closeBtn.addEventListener('click', closeReader);
      var dlBtn = $('btn-file-reader-download');
      if (dlBtn) dlBtn.addEventListener('click', function () {
        if (readerState.currentFileId) downloadFile(readerState.currentFileId);
      });
      modal.addEventListener('click', function (e) { if (e.target === modal) closeReader(); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.style.display !== 'none') closeReader();
      });
    }

    if (readerState.objectUrl) {
      URL.revokeObjectURL(readerState.objectUrl);
      readerState.objectUrl = null;
    }
    readerState.currentFileId = fileId;
    title.textContent = name;
    body.innerHTML = '<div class="file-reader-status">Opening file&hellip;</div>';
    modal.style.display = 'flex';

    try {
      var res = await fetch('/api/files/' + encodeURIComponent(fileId) + '/content', { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var blob = await res.blob();
      var ext = fileExtension(name);

      if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].indexOf(ext) !== -1) {
        readerState.objectUrl = URL.createObjectURL(blob);
        body.innerHTML = '<img class="file-reader-img" src="' + readerState.objectUrl + '" alt="' + escapeHtml(name) + '">';
      } else if (ext === 'pdf') {
        readerState.objectUrl = URL.createObjectURL(blob);
        body.innerHTML = '<iframe class="file-reader-pdf-frame" src="' + readerState.objectUrl + '" title="' + escapeHtml(name) + '"></iframe>';
      } else if (['txt', 'md', 'json', 'csv', 'log', 'rtf'].indexOf(ext) !== -1) {
        var text = await blob.text();
        var pre = document.createElement('pre');
        pre.className = 'file-reader-pre';
        pre.textContent = text;
        body.innerHTML = '';
        body.appendChild(pre);
      } else {
        body.innerHTML = '<div class="file-reader-unsupported"><p>Preview is not available for .' + escapeHtml(ext || 'file') + ' files.</p>' +
          '<button type="button" class="files-pick-btn" id="btn-reader-fallback-dl">Download ' + escapeHtml(name) + '</button></div>';
        var fb = $('btn-reader-fallback-dl');
        if (fb) fb.addEventListener('click', function () { downloadFile(fileId); });
      }
    } catch (err) {
      body.innerHTML = '<div class="file-reader-status">Could not open this file. Try downloading it instead.</div>';
    }
  }

  function init() {
    var dropzone = $('files-dropzone');
    var input = $('files-input');
    var pickBtn = $('btn-files-pick');
    var refreshBtn = $('btn-files-refresh');
    var viewGridBtn = $('btn-files-view-grid');
    var viewListBtn = $('btn-files-view-list');
    var sortSelect = $('files-sort-select');
    var breadcrumb = $('files-breadcrumb');
    var foldersWrap = $('files-folders');
    var listEl = $('files-list');
    var tableBody = $('files-table-body');
    var contextMenu = $('files-context-menu');

    if (!dropzone) return;

    function openPicker() {
      if (input) input.click();
    }

    if (pickBtn) {
      pickBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openPicker();
      });
    }

    dropzone.addEventListener('click', openPicker);
    dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }
    });
    ['dragenter', 'dragover'].forEach(function (evt) {
      dropzone.addEventListener(evt, function (e) {
        e.preventDefault();
        dropzone.classList.add('files-dropzone-active');
      });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      dropzone.addEventListener(evt, function (e) {
        e.preventDefault();
        dropzone.classList.remove('files-dropzone-active');
      });
    });
    dropzone.addEventListener('drop', function (e) {
      var dropped = e.dataTransfer && e.dataTransfer.files;
      if (dropped && dropped.length) handleFilesSelected(dropped);
    });

    if (input) {
      input.addEventListener('change', function (e) {
        var chosen = Array.prototype.slice.call(e.target.files || []);
        e.target.value = '';
        if (chosen.length) handleFilesSelected(chosen);
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        refreshBtn.disabled = true;
        state.pending = [];
        loadFiles().finally(function () { refreshBtn.disabled = false; });
      });
    }

    if (viewGridBtn) {
      viewGridBtn.addEventListener('click', function () {
        state.viewMode = 'grid';
        savePreferencesToServer({ filesViewMode: 'grid' });
        renderFilesList();
      });
    }
    if (viewListBtn) {
      viewListBtn.addEventListener('click', function () {
        state.viewMode = 'list';
        savePreferencesToServer({ filesViewMode: 'list' });
        renderFilesList();
      });
    }
    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        state.sortBy = sortSelect.value;
        savePreferencesToServer({ filesSortBy: state.sortBy });
        renderFilesList();
      });
    }

    if (window.NewFolderUI && $('files-newfolder') && $('btn-files-new-folder')) {
      window.NewFolderUI.mount({
        form: $('files-newfolder'),
        trigger: $('btn-files-new-folder'),
        input: $('files-newfolder-input'),
        createBtn: $('files-newfolder-create'),
        cancelBtn: $('files-newfolder-cancel'),
        errorEl: $('files-newfolder-error'),
        scrim: $('files-newfolder-scrim'),
        grab: $('files-newfolder-grab'),
        onOpen: function () {
          var parent = $('files-newfolder-parent');
          if (!parent) return;
          var crumb = document.querySelector('#files-breadcrumb [aria-current="page"]');
          parent.textContent = crumb ? crumb.textContent.trim() : 'Stored Files';
        },
        onSubmit: function (name, hooks) {
          return createFolder(name, hooks);
        }
      });
    }

    var contextTarget = null;
    var shareTarget = null;
    var shareMenu = $('files-share-menu');

    function showContextMenu(x, y, target) {
      if (!contextMenu) return;
      hideShareMenu();
      contextTarget = target;
      var dlBtn = contextMenu.querySelector('[data-menu-action="download"]');
      var shareBtn = contextMenu.querySelector('[data-menu-action="share"]');
      var rnBtn = contextMenu.querySelector('[data-menu-action="rename"]');
      if (dlBtn) dlBtn.hidden = target.type === 'folder';
      if (shareBtn) shareBtn.hidden = target.type === 'folder';
      if (rnBtn) rnBtn.hidden = target.type === 'file';

      contextMenu.hidden = false;
      contextMenu.style.left = Math.max(10, Math.min(x, window.innerWidth - 210)) + 'px';
      contextMenu.style.top = Math.max(10, Math.min(y, window.innerHeight - 230)) + 'px';
    }
    function hideContextMenu() {
      if (!contextMenu) return;
      contextMenu.hidden = true;
      contextTarget = null;
    }

    function fileShareUrl(file) {
      if (!file) return '';
      return file.url || file.secureUrl || file.secure_url || file.downloadUrl || file.download_url || '';
    }

    function showShareMenu(x, y, fileId) {
      if (!shareMenu) return;
      var file = state.files.find(function (f) { return f.id === fileId; });
      if (!file) return;
      var url = fileShareUrl(file);
      if (!url) {
        showAlert('This file does not have a shareable link yet.', 'error');
        return;
      }
      shareTarget = { id: fileId, name: file.name || 'File', url: url };
      hideContextMenu();

      var nativeBtn = shareMenu.querySelector('[data-share-action="native"]');
      var nativeDivider = shareMenu.querySelector('[data-share-native-divider]');
      var canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
      if (nativeBtn) nativeBtn.hidden = !canNative;
      if (nativeDivider) nativeDivider.hidden = !canNative;

      shareMenu.hidden = false;
      shareMenu.setAttribute('aria-hidden', 'false');
      // Position after unhide so offsetWidth/Height are available
      var menuW = shareMenu.offsetWidth || 200;
      var menuH = shareMenu.offsetHeight || 220;
      var left = Math.max(10, Math.min(x, window.innerWidth - menuW - 10));
      var top = Math.max(10, Math.min(y, window.innerHeight - menuH - 10));
      shareMenu.style.left = left + 'px';
      shareMenu.style.top = top + 'px';
    }

    function hideShareMenu() {
      if (!shareMenu) return;
      shareMenu.hidden = true;
      shareMenu.setAttribute('aria-hidden', 'true');
      shareTarget = null;
    }

    function shareFile(fileId, anchorEl) {
      var rect = null;
      if (anchorEl && anchorEl.getBoundingClientRect) {
        rect = anchorEl.getBoundingClientRect();
      }
      var x = rect ? rect.left : (window.innerWidth / 2 - 100);
      var y = rect ? (rect.bottom + 6) : (window.innerHeight / 2 - 80);
      showShareMenu(x, y, fileId);
    }

    async function openShare(action) {
      var target = shareTarget;
      if (!target || !target.url) { hideShareMenu(); return; }
      var name = target.name || 'File';
      var url = target.url;
      var text = 'Shared file: ' + name;
      hideShareMenu();

      if (action === 'whatsapp') {
        var wa = 'https://wa.me/?text=' + encodeURIComponent(text + '\n' + url);
        window.open(wa, '_blank', 'noopener');
      } else if (action === 'email') {
        var mail = 'mailto:?subject=' + encodeURIComponent('Shared file: ' + name) +
          '&body=' + encodeURIComponent('Hi,\n\nHere is the file "' + name + '":\n' + url + '\n');
        window.location.href = mail;
      } else if (action === 'copy') {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
          } else {
            var ta = document.createElement('textarea');
            ta.value = url;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          showAlert('Link copied to clipboard.', 'success');
        } catch (err) {
          showAlert('Could not copy link.', 'error');
        }
      } else if (action === 'native') {
        try {
          if (navigator.share) {
            await navigator.share({ title: name, text: text, url: url });
          }
        } catch (err) {
          // User cancelled or share failed — ignore aborts
          if (err && err.name !== 'AbortError') {
            showAlert('Could not open share sheet.', 'error');
          }
        }
      }
    }

    if (contextMenu) {
      contextMenu.addEventListener('click', function (e) {
        var item = e.target.closest('[data-menu-action]');
        if (!item || !contextTarget) return;
        var action = item.getAttribute('data-menu-action');
        var target = Object.assign({}, contextTarget);
        hideContextMenu();
        if (action === 'open') {
          if (target.type === 'folder') setFilesView(target.id);
          else readFile(target.id);
        } else if (action === 'share') {
          if (target.type === 'file') shareFile(target.id);
        } else if (action === 'rename') {
          if (target.type === 'folder') {
            var folder = folderById(target.id);
            window.QFDialog.prompt({
              title: 'Rename folder',
              defaultValue: folder ? folder.name : '',
              confirmLabel: 'Rename',
              cancelLabel: 'Cancel'
            }).then(function (next) {
              if (next != null) renameFolder(target.id, next);
            });
          }
        } else if (action === 'download') {
          if (target.type === 'file') downloadFile(target.id);
        } else if (action === 'delete') {
          if (target.type === 'folder') deleteFolder(target.id);
          else deleteFile(target.id);
        }
      });
    }

    if (shareMenu) {
      shareMenu.addEventListener('click', function (e) {
        var item = e.target.closest('[data-share-action]');
        if (!item) return;
        var action = item.getAttribute('data-share-action');
        openShare(action);
      });
    }
    document.addEventListener('click', function (e) {
      if (contextMenu && !contextMenu.contains(e.target)) hideContextMenu();
      if (shareMenu && !shareMenu.contains(e.target)) hideShareMenu();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { hideContextMenu(); hideShareMenu(); }
      if (e.key === ' ' || e.code === 'Space') {
        var filesView = $('dash-files-view');
        if (!filesView || filesView.hidden) return;
        var activeTag = document.activeElement && document.activeElement.tagName.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
        var readerModal = $('file-reader-modal');
        if (readerModal && readerModal.style.display !== 'none') {
          e.preventDefault();
          closeReader();
        } else if (state.selectedFileId) {
          e.preventDefault();
          readFile(state.selectedFileId);
        }
      }
    });

    document.addEventListener('visibilitychange', function () {
      var filesView = $('dash-files-view');
      if (document.visibilityState !== 'visible' || !filesView || filesView.hidden) return;
      if (Date.now() - state.lastSyncAt > 3000) {
        loadFiles({ silent: true });
      }
    });

    if (breadcrumb) {
      breadcrumb.addEventListener('click', function (e) {
        var crumb = e.target.closest('[data-crumb]');
        if (crumb) setFilesView(crumb.getAttribute('data-crumb') || null);
      });
      breadcrumb.addEventListener('dragover', function (e) {
        var crumb = e.target.closest('[data-crumb]');
        if (!crumb || !draggedFileId) return;
        e.preventDefault();
        crumb.classList.add('is-drop-target');
      });
      breadcrumb.addEventListener('dragleave', function (e) {
        var crumb = e.target.closest('[data-crumb]');
        if (crumb) crumb.classList.remove('is-drop-target');
      });
      breadcrumb.addEventListener('drop', function (e) {
        var crumb = e.target.closest('[data-crumb]');
        if (!crumb) return;
        e.preventDefault();
        crumb.classList.remove('is-drop-target');
        var id = draggedFileId;
        draggedFileId = null;
        if (id) moveFileTo(id, crumb.getAttribute('data-crumb') || null);
      });
    }

    if (foldersWrap) {
      foldersWrap.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-folder-action]');
        var sheet = e.target.closest('.f3d-sheet');
        var card = e.target.closest('[data-folder-id]');
        var id = card && card.getAttribute('data-folder-id');
        if (!id || sheet) return;
        if (!btn) { setFilesView(id); return; }
        var action = btn.getAttribute('data-folder-action');
        if (action === 'rename') {
          var folder = folderById(id);
          window.QFDialog.prompt({
            title: 'Rename folder',
            defaultValue: folder ? folder.name : '',
            confirmLabel: 'Rename',
            cancelLabel: 'Cancel'
          }).then(function (next) {
            if (next != null) renameFolder(id, next);
          });
        } else if (action === 'delete') {
          deleteFolder(id);
        } else if (action === 'context') {
          var rect = btn.getBoundingClientRect();
          showContextMenu(rect.left, rect.bottom + 4, { type: 'folder', id: id });
        }
      });
      foldersWrap.addEventListener('contextmenu', function (e) {
        var card = e.target.closest('[data-folder-id]');
        if (!card) return;
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, { type: 'folder', id: card.getAttribute('data-folder-id') });
      });
      foldersWrap.addEventListener('dragover', function (e) {
        var card = e.target.closest('[data-folder-id]');
        if (!card || !draggedFileId) return;
        e.preventDefault();
        card.classList.add('is-drop-target');
        var shell = card.querySelector('.f3d');
        if (shell) shell.classList.add('is-drop');
      });
      foldersWrap.addEventListener('dragleave', function (e) {
        var card = e.target.closest('[data-folder-id]');
        if (!card || card.contains(e.relatedTarget)) return;
        card.classList.remove('is-drop-target');
        var shell = card.querySelector('.f3d');
        if (shell) shell.classList.remove('is-drop');
      });
      foldersWrap.addEventListener('drop', function (e) {
        var card = e.target.closest('[data-folder-id]');
        if (!card) return;
        e.preventDefault();
        card.classList.remove('is-drop-target');
        var shell = card.querySelector('.f3d');
        if (shell) shell.classList.remove('is-drop');
        var id = draggedFileId;
        draggedFileId = null;
        var target = card.getAttribute('data-folder-id');
        if (id && target) moveFileTo(id, target);
      });
    }

    if (listEl) {
      listEl.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-files-action]');
        if (btn) {
          var fileId = btn.getAttribute('data-file-id');
          var action = btn.getAttribute('data-files-action');
          if (action === 'share') shareFile(fileId, btn);
          else if (action === 'read') readFile(fileId);
          else if (action === 'download') downloadFile(fileId);
          else if (action === 'delete') deleteFile(fileId);
          else if (action === 'context') {
            var r = btn.getBoundingClientRect();
            showContextMenu(r.left, r.bottom + 4, { type: 'file', id: fileId });
          }
          return;
        }
        var row = e.target.closest('.files-row[data-file-id]');
        if (row) {
          state.selectedFileId = row.getAttribute('data-file-id');
          listEl.querySelectorAll('.files-row').forEach(function (r) {
            r.classList.toggle('is-selected', r === row);
          });
        }
      });
      listEl.addEventListener('dblclick', function (e) {
        var row = e.target.closest('.files-row[data-file-id]');
        if (row && !e.target.closest('button')) {
          readFile(row.getAttribute('data-file-id'));
        }
      });
      listEl.addEventListener('contextmenu', function (e) {
        var row = e.target.closest('.files-row[data-file-id]');
        if (!row) return;
        e.preventDefault();
        var id = row.getAttribute('data-file-id');
        state.selectedFileId = id;
        showContextMenu(e.clientX, e.clientY, { type: 'file', id: id });
      });
      listEl.addEventListener('dragstart', function (e) {
        var row = e.target.closest('.files-row[data-file-id]');
        if (!row) return;
        draggedFileId = row.getAttribute('data-file-id');
        row.classList.add('files-row-dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', draggedFileId);
        }
      });
      listEl.addEventListener('dragend', function () {
        draggedFileId = null;
        listEl.querySelectorAll('.files-row-dragging').forEach(function (r) {
          r.classList.remove('files-row-dragging');
        });
      });
      listEl.addEventListener('dragover', function (e) {
        var row = e.target.closest('.files-row[data-file-id]');
        if (!row || !draggedFileId || row.getAttribute('data-file-id') === draggedFileId) return;
        e.preventDefault();
        row.classList.add('files-row-drop-target');
      });
      listEl.addEventListener('dragleave', function (e) {
        var row = e.target.closest('.files-row[data-file-id]');
        if (row) row.classList.remove('files-row-drop-target');
      });
      listEl.addEventListener('drop', function (e) {
        var row = e.target.closest('.files-row[data-file-id]');
        if (!row) return;
        e.preventDefault();
        row.classList.remove('files-row-drop-target');
        var id = draggedFileId;
        draggedFileId = null;
        if (id) reorderFiles(id, row.getAttribute('data-file-id'));
      });
    }

    var filesTable = $('files-table');
    if (filesTable) {
      filesTable.addEventListener('click', function (e) {
        var th = e.target.closest('th[data-sort-col]');
        if (!th) return;
        var col = th.getAttribute('data-sort-col');
        if (col === 'name') state.sortBy = state.sortBy === 'name-asc' ? 'name-desc' : 'name-asc';
        else if (col === 'size') state.sortBy = state.sortBy === 'size-desc' ? 'size-asc' : 'size-desc';
        else if (col === 'date') state.sortBy = state.sortBy === 'date-desc' ? 'date-asc' : 'date-desc';
        savePreferencesToServer({ filesSortBy: state.sortBy });
        renderFilesList();
      });
    }

    if (tableBody) {
      tableBody.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (btn) {
          var fAct = btn.getAttribute('data-folder-action');
          if (fAct) {
            var fRow = btn.closest('[data-folder-id]');
            var fid = fRow && fRow.getAttribute('data-folder-id');
            if (fAct === 'rename') {
              var folder = folderById(fid);
              window.QFDialog.prompt({
                title: 'Rename folder',
                defaultValue: folder ? folder.name : '',
                confirmLabel: 'Rename',
                cancelLabel: 'Cancel'
              }).then(function (next) {
                if (next != null) renameFolder(fid, next);
              });
            } else if (fAct === 'delete') deleteFolder(fid);
            return;
          }
          var act = btn.getAttribute('data-files-action');
          if (act) {
            var id = btn.getAttribute('data-file-id');
            if (act === 'share') shareFile(id, btn);
            else if (act === 'read') readFile(id);
            else if (act === 'download') downloadFile(id);
            else if (act === 'delete') deleteFile(id);
            return;
          }
        }
        var folderRow = e.target.closest('.files-folder-row');
        if (folderRow) {
          setFilesView(folderRow.getAttribute('data-folder-id'));
          return;
        }
        var fileRow = e.target.closest('.files-file-row');
        if (fileRow) {
          state.selectedFileId = fileRow.getAttribute('data-file-id');
          tableBody.querySelectorAll('.files-file-row').forEach(function (r) {
            r.classList.toggle('is-selected', r === fileRow);
          });
        }
      });
      tableBody.addEventListener('dblclick', function (e) {
        var fileRow = e.target.closest('.files-file-row');
        if (fileRow && !e.target.closest('button')) {
          readFile(fileRow.getAttribute('data-file-id'));
        }
      });
      tableBody.addEventListener('contextmenu', function (e) {
        var folderRow = e.target.closest('.files-folder-row');
        var fileRow = e.target.closest('.files-file-row');
        if (folderRow) {
          e.preventDefault();
          showContextMenu(e.clientX, e.clientY, { type: 'folder', id: folderRow.getAttribute('data-folder-id') });
        } else if (fileRow) {
          e.preventDefault();
          var id = fileRow.getAttribute('data-file-id');
          state.selectedFileId = id;
          showContextMenu(e.clientX, e.clientY, { type: 'file', id: id });
        }
      });
    }

    // Paint immediately from localStorage cache
    renderFilesList();
  }

  document.addEventListener('DOMContentLoaded', init);

  window.DashboardFiles = {
    onShow: function () {
      if (!state.loaded) loadFiles();
      else renderFilesList();
    },
    reload: loadFiles
  };
})();
