/*
 * NOTE PAD — typed & drawn notes with auto-save
 *
 * A small multi-note pad inside the Coordinator dashboard.
 *  - "Type" mode: keyboard input into a textarea.
 *  - "Draw" mode: pen/eraser ink on a canvas, with AI handwriting reading.
 *  Notes persist to localStorage on this device and save automatically
 *  (debounced) as you type or draw, plus when the tab is hidden or closed.
 *
 * No framework. Uses native Canvas + Fetch + localStorage.
 */

(function () {
  'use strict';

  const CONFIG = {
    aiUrl: (function () {
      const override = window.localStorage.getItem('co_notepad_ai_url');
      if (override) return override;
      return '/api/ai/predict';
    })(),
    defaultColor: '#1E4472',
    defaultSize: 4,
  };

  const STORAGE_KEY = 'co_notepad_notes_v1';

  // ---- Canvas (draw mode) ----
  let canvasEl, ctx, dpr;
  let activeTool = 'pen';
  let activeColor = CONFIG.defaultColor;
  let penColor = CONFIG.defaultColor; // last chosen ink colour (not the eraser)
  let activeSize = CONFIG.defaultSize;
  let isDrawing = false;
  let lastPoint = null;
  let canvasTouched = false;

  // ---- Notes state ----
  let notes = [];
  let activeNoteId = null;
  let mode = 'type'; // 'type' | 'draw'
  let saveTimer = null;
  let deleteArmed = false;
  let cloudSyncTimer = null;
  let cloudLoaded = false;
  let cloudLoadInFlight = false;
  let localDirty = false;

  // ---- DOM ----
  let titleInput, textArea, drawPanel, notesListEl, notesCountEl, saveStatusEl;
  let predictionTextEl, predictionConfEl, insertPredictionBtn, deleteBtn, alertEl;

  let isInitialized = false;

  const $id = (id) => document.getElementById(id);

  // ==================================================
  // Canvas
  // ==================================================

  function resizeCanvas() {
    if (!ctx || !canvasEl) return;

    const rect = canvasEl.getBoundingClientRect();

    // Hidden panel (display:none) measures 0x0. Resizing to that would zero
    // the backing store, so hold the current buffer until the panel is
    // actually on screen; activateAdminTab() re-runs init at that point.
    if (rect.width < 1 || rect.height < 1) return;

    let oldImage = null;
    if (canvasEl.width > 0 && canvasEl.height > 0) {
      try {
        oldImage = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
      } catch (err) {
        oldImage = null;
      }
    }

    dpr = window.devicePixelRatio || 1;
    // Display size is governed by CSS (width:100%), so only the backing
    // store is set here — writing inline px here would stop it from
    // following the container on a fluid, resizing layout.
    canvasEl.width = Math.round(rect.width * dpr);
    canvasEl.height = Math.round(rect.height * dpr);

    // Assigning width/height resets the context state, so scale once here.
    ctx.scale(dpr, dpr);
    setupStrokeStyle();

    if (oldImage) ctx.putImageData(oldImage, 0, 0);
  }

  function startDraw(point) {
    isDrawing = true;
    lastPoint = point;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  function moveDraw(point) {
    if (!isDrawing) return;
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint = point;
    canvasTouched = true;
  }

  function endDraw() {
    if (!isDrawing) return;
    isDrawing = false;
    lastPoint = null;
    if (canvasTouched) scheduleSave();
  }

  function getPoint(e) {
    const rect = canvasEl.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    // CSS-pixel coordinates: the context is already scaled by dpr, so
    // multiplying here would double-scale on retina screens.
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function setupStrokeStyle() {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = activeSize;
    ctx.strokeStyle = activeColor;
    ctx.globalCompositeOperation =
      activeTool === 'eraser' ? 'destination-out' : 'source-over';
  }

  function refreshStroke() {
    const sizeEl = $id('notepad-pen-size');
    let base = parseInt(sizeEl && sizeEl.value ? sizeEl.value : CONFIG.defaultSize, 10);
    if (!isFinite(base) || base <= 0) base = CONFIG.defaultSize;
    if (activeTool === 'eraser') {
      activeColor = '#FFFFFF';
      activeSize = base * 2;
    } else {
      activeColor = penColor;
      activeSize = base;
    }
    setupStrokeStyle();
  }

  function clearCanvasSilent() {
    if (ctx && canvasEl) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }

  function clearCanvas() {
    clearCanvasSilent();
    canvasTouched = true;
    if (predictionTextEl) predictionTextEl.textContent = '';
    if (predictionConfEl) predictionConfEl.textContent = '';
    if (insertPredictionBtn) insertPredictionBtn.hidden = true;
    scheduleSave();
    showAlert('Drawing cleared.', 'success');
  }

  function captureInk() {
    if (!canvasEl || !ctx) return null;
    if (canvasEl.width < 1 || canvasEl.height < 1) return null;
    let has = false;
    try {
      const data = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
      for (let i = 3; i < data.data.length; i += 4) {
        if (data.data[i] !== 0) {
          has = true;
          break;
        }
      }
    } catch (err) {
      return null;
    }
    return has ? canvasEl.toDataURL('image/png') : null;
  }

  function restoreInk(dataUrl) {
    if (!ctx || !canvasEl || !dataUrl) return;
    const img = new Image();
    img.onload = function () {
      if (!ctx || !canvasEl) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      ctx.drawImage(img, 0, 0, canvasEl.width, canvasEl.height);
      ctx.restore();
      setupStrokeStyle();
    };
    img.src = dataUrl;
  }

  // ==================================================
  // Notes persistence
  // ==================================================

  function loadNotes() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (err) {
      return [];
    }
  }

  function persistNotes() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (err) {
      console.warn('[Note Pad] Could not save notes:', err.message);
    }
  }

  function getActiveNote() {
    for (let i = 0; i < notes.length; i += 1) {
      if (notes[i].id === activeNoteId) return notes[i];
    }
    return null;
  }

  // ==================================================
  // Rendering
  // ==================================================

  function timeAgo(ts) {
    if (!ts) return '';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24);
    return d + 'd ago';
  }

  function snippetText(text) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    return clean.length > 60 ? clean.slice(0, 60) + '…' : clean;
  }

  function renderNotesList() {
    if (!notesListEl) return;
    notesListEl.textContent = '';
    if (notesCountEl) notesCountEl.textContent = String(notes.length);

    if (!notes.length) {
      const empty = document.createElement('div');
      empty.className = 'notepad-notes-empty';
      empty.textContent = 'No notes yet. Tap "New Note" to start.';
      notesListEl.appendChild(empty);
      return;
    }

    const sorted = notes.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    sorted.forEach((note) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'notepad-note-item' + (note.id === activeNoteId ? ' is-active' : '');
      item.setAttribute('data-id', note.id);

      const title = document.createElement('span');
      title.className = 'notepad-note-item-title';
      title.textContent = note.title || 'Untitled note';

      const snippet = document.createElement('span');
      snippet.className = 'notepad-note-item-snippet';
      snippet.textContent = note.text
        ? snippetText(note.text)
        : note.ink
          ? 'Drawing'
          : 'Empty note';

      const time = document.createElement('span');
      time.className = 'notepad-note-item-time';
      time.textContent = timeAgo(note.updatedAt || note.createdAt);

      item.appendChild(title);
      item.appendChild(snippet);
      item.appendChild(time);

      item.addEventListener('click', () => switchNote(note.id));

      notesListEl.appendChild(item);
    });
  }

  function renderEditor() {
    const note = getActiveNote();
    const hasNote = !!note;

    if (titleInput) {
      titleInput.disabled = !hasNote;
      titleInput.value = hasNote ? note.title || '' : '';
    }
    if (textArea) {
      textArea.disabled = !hasNote;
      textArea.value = hasNote ? note.text || '' : '';
      textArea.placeholder = hasNote
        ? 'Start typing your note…'
        : 'Select or create a note to begin.';
    }
    if (deleteBtn) {
      deleteBtn.disabled = !hasNote;
      resetDeleteArm();
    }
    document.querySelectorAll('.notepad-mode-btn').forEach((btn) => {
      btn.disabled = !hasNote;
    });
    updateSaveStatus('', null);
  }

  function updateSaveStatus(text, state) {
    if (!saveStatusEl) return;
    saveStatusEl.textContent = text || '';
    saveStatusEl.classList.toggle('is-saving', state === 'saving');
    saveStatusEl.classList.toggle('is-saved', state === 'saved');
    saveStatusEl.classList.toggle('is-synced', state === 'synced');
  }

  function setMode(nextMode) {
    mode = nextMode === 'draw' ? 'draw' : 'type';

    document.querySelectorAll('.notepad-mode-btn').forEach((btn) => {
      const active = btn.getAttribute('data-mode') === mode;
      btn.classList.toggle('notepad-mode-active', active);
      btn.setAttribute('aria-selected', String(active));
    });

    const isDraw = mode === 'draw';
    if (drawPanel) drawPanel.hidden = !isDraw;
    if (textArea) textArea.hidden = isDraw;

    if (isDraw) {
      ensureDraftNote();
      resizeCanvas();
      clearCanvasSilent();
      const note = getActiveNote();
      if (note && note.ink) restoreInk(note.ink);
    }
  }

  // ==================================================
  // Actions
  // ==================================================

  function saveActiveNote() {
    const note = getActiveNote();
    if (!note) return;
    note.title = String(titleInput.value || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    note.text = textArea.value;
    if (canvasTouched) {
      note.ink = captureInk();
      canvasTouched = false;
    }
    note.updatedAt = Date.now();
    persistNotes();
    renderNotesList();
    updateSaveStatus('Saved', 'saved');
    scheduleCloudSync();
  }

  function scheduleSave() {
    localDirty = true;
    if (saveTimer) clearTimeout(saveTimer);
    updateSaveStatus('Saving…', 'saving');
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveActiveNote();
    }, 600);
  }

  function flushSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
      saveActiveNote();
    }
    if (cloudSyncTimer) {
      clearTimeout(cloudSyncTimer);
      cloudSyncTimer = null;
      syncToCloud();
    }
  }

  function syncToCloud() {
    if (!window.ConvexNotes || typeof window.ConvexNotes.save !== 'function') return;
    if (window.ConvexNotes.isAvailable && !window.ConvexNotes.isAvailable()) return;
    return window.ConvexNotes
      .save(notes)
      .then(() => updateSaveStatus('Synced to Convex', 'synced'))
      .catch((err) => {
        console.warn('[Note Pad] Cloud sync failed:', err.message);
        showAlert('Could not sync to Convex. Your note is kept on this device.', 'error');
      });
  }

  function scheduleCloudSync() {
    if (!window.ConvexNotes || typeof window.ConvexNotes.save !== 'function') return;
    if (window.ConvexNotes.isAvailable && !window.ConvexNotes.isAvailable()) return;
    if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(() => {
      cloudSyncTimer = null;
      syncToCloud();
    }, 2500);
  }

  async function loadFromCloud() {
    if (!window.ConvexNotes || typeof window.ConvexNotes.load !== 'function') return;
    if (window.ConvexNotes.isAvailable && !window.ConvexNotes.isAvailable()) return;
    if (cloudLoadInFlight || cloudLoaded) return;
    cloudLoadInFlight = true;
    try {
      const remote = await window.ConvexNotes.load();
      if (remote === null) return; // Convex unreachable; keep the local cache
      cloudLoaded = true;
      if (remote.length === 0 && notes.length > 0) {
        // Server has no notes yet: push the local cache up instead of wiping it.
        syncToCloud();
        return;
      }
      if (!localDirty) {
        notes = remote;
        if (!activeNoteId || !notes.some((n) => n.id === activeNoteId)) {
          activeNoteId = notes.length ? notes[0].id : null;
        }
        ensureDraftNote();
        persistNotes();
        renderNotesList();
        renderEditor();
        setMode(mode);
      }
    } catch (err) {
      console.warn('[Note Pad] Cloud load failed:', err.message);
    } finally {
      cloudLoadInFlight = false;
    }
  }

  function blankNote() {
    return {
      id: 'n-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
      title: '',
      text: '',
      ink: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  // Everything in the editor -- the title, the body, the Type/Draw toggle and
  // the drawing surface itself -- is rendered against one active note, and
  // renderEditor() disables all of those controls while no note exists. Notes
  // are per-browser until cloud sync lands, so a phone that has never used the
  // Note Pad opens with an empty list: the Draw tab renders disabled, the draw
  // panel stays hidden and the canvas never gets a size, which reads as "the
  // draw page is broken". Never let the UI reach a state with nothing to edit;
  // hold a draft open the way any notes app does on first launch.
  function ensureDraftNote() {
    if (notes.length) {
      if (!activeNoteId || !notes.some((n) => n.id === activeNoteId)) {
        activeNoteId = notes[0].id;
      }
      return getActiveNote();
    }
    const note = blankNote();
    notes.unshift(note);
    activeNoteId = note.id;
    persistNotes();
    return note;
  }

  function createNote() {
    flushSave();
    const note = blankNote();
    notes.unshift(note);
    activeNoteId = note.id;
    localDirty = true;
    persistNotes();
    scheduleCloudSync();
    renderNotesList();
    renderEditor();
    setMode('type');
    if (titleInput && !titleInput.disabled) titleInput.focus();
  }

  function switchNote(id) {
    if (!id || id === activeNoteId) return;
    flushSave();
    activeNoteId = id;
    renderNotesList();
    renderEditor();
    setMode(mode);
  }

  function resetDeleteArm() {
    deleteArmed = false;
    if (deleteBtn) {
      deleteBtn.textContent = 'Delete';
      deleteBtn.classList.remove('is-armed');
    }
  }

  function onDeleteClick() {
    if (!getActiveNote()) return;
    if (!deleteArmed) {
      deleteArmed = true;
      deleteBtn.textContent = 'Confirm delete?';
      deleteBtn.classList.add('is-armed');
      setTimeout(() => {
        if (deleteArmed) resetDeleteArm();
      }, 3000);
      return;
    }
    resetDeleteArm();
    deleteNote(activeNoteId);
  }

  function deleteNote(id) {
    const idx = notes.findIndex((n) => n.id === id);
    if (idx < 0) return;
    notes.splice(idx, 1);
    if (activeNoteId === id) {
      activeNoteId = notes.length ? notes[0].id : null;
    }
    ensureDraftNote();
    localDirty = true;
    persistNotes();
    scheduleCloudSync();
    renderNotesList();
    renderEditor();
    setMode(mode);
    showAlert('Note deleted.', 'success');
  }

  function insertPrediction() {
    const text = predictionTextEl ? predictionTextEl.textContent : '';
    if (!text || !getActiveNote()) return;
    const current = textArea.value.replace(/\s+$/, '');
    textArea.value = current ? current + '\n\n' + text : text;
    if (predictionTextEl) predictionTextEl.textContent = '';
    if (predictionConfEl) predictionConfEl.textContent = '';
    if (insertPredictionBtn) insertPredictionBtn.hidden = true;
    setMode('type');
    scheduleSave();
    showAlert('Prediction added to your note.', 'success');
  }

  // ==================================================
  // AI handwriting prediction
  // ==================================================

  async function predictHandwriting() {
    if (!canvasEl || !ctx) return;

    let hasDrawing = false;
    try {
      const imgData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
      for (let i = 3; i < imgData.data.length; i += 4) {
        if (imgData.data[i] !== 0) {
          hasDrawing = true;
          break;
        }
      }
    } catch (err) {
      /* ignore */
    }

    if (!hasDrawing) {
      showAlert('Please draw something first before asking AI.', 'error');
      return;
    }

    const btn = $id('btn-notepad-ai-predict');
    if (!btn) return;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Analyzing…';
    if (predictionTextEl) predictionTextEl.textContent = '';
    if (predictionConfEl) predictionConfEl.textContent = '';
    if (insertPredictionBtn) insertPredictionBtn.hidden = true;

    try {
      const dataUrl = canvasEl.toDataURL('image/png');

      const response = await fetch(CONFIG.aiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: dataUrl,
          task: 'handwriting_prediction',
          language: 'en',
        }),
      });

      if (!response.ok) {
        throw new Error('AI server returned ' + response.status);
      }

      const result = await response.json();

      if (result.ok && result.prediction) {
        if (predictionTextEl) predictionTextEl.textContent = result.prediction;
        if (predictionConfEl) {
          predictionConfEl.textContent = result.confidence
            ? 'Confidence: ' + Math.round(result.confidence * 100) + '%'
            : '';
        }
        if (insertPredictionBtn) insertPredictionBtn.hidden = false;
        showAlert('AI prediction complete.', 'success');
      } else {
        throw new Error(result.error || 'No prediction returned');
      }
    } catch (err) {
      console.warn('[Note Pad] AI prediction failed:', err.message);

      const fallback = localPrediction();
      if (predictionTextEl) predictionTextEl.textContent = fallback.text;
      if (predictionConfEl) predictionConfEl.textContent = fallback.confidence;
      if (insertPredictionBtn) insertPredictionBtn.hidden = true;
      showAlert('AI service unavailable — using local prediction fallback.', 'info');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  function localPrediction() {
    const imgData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
    let inkPixels = 0;
    for (let i = 3; i < imgData.data.length; i += 4) {
      if (imgData.data[i] > 0) inkPixels++;
    }
    const total = imgData.data.length / 4;
    const density = total > 0 ? inkPixels / total : 0;

    let guess = 'No writing detected';
    if (density > 0.15) guess = 'A page of handwritten notes';
    else if (density > 0.05) guess = 'A few handwritten words';
    else if (density > 0.01) guess = 'Some pen marks';

    return {
      text: guess,
      confidence: Math.min(density * 3, 1),
    };
  }

  // ==================================================
  // Alert
  // ==================================================

  function showAlert(message, type) {
    if (!alertEl) return;
    alertEl.className = 'alert-box visible alert-' + type;
    alertEl.textContent = message;
    if (typeof alertEl.scrollIntoView === 'function') {
      alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    setTimeout(() => {
      alertEl.className = 'alert-box';
    }, 4000);
  }

  // ==================================================
  // Wiring
  // ==================================================

  function wireEvents() {
    canvasEl.addEventListener('pointerdown', (e) => {
      if (isDrawing) return; // a second finger or palm must not restart the stroke
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      // Capture the pointer so pointermove/pointerup keep flowing to the
      // canvas after the finger crosses the canvas edge mid-stroke. Browsers
      // without implicit touch capture otherwise strand the stroke at the
      // boundary — the classic "drawing dies on Android" failure.
      try {
        canvasEl.setPointerCapture(e.pointerId);
      } catch (err) {}
      startDraw(getPoint(e));
    });
    canvasEl.addEventListener('pointermove', (e) => {
      if (!isDrawing) return;
      // High-frequency digitizers batch several samples into one event;
      // drawing only the last one leaves gaps in fast finger strokes.
      const samples =
        typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
      if (samples && samples.length) {
        for (let i = 0; i < samples.length; i += 1) moveDraw(getPoint(samples[i]));
      } else {
        moveDraw(getPoint(e));
      }
    });
    canvasEl.addEventListener('pointerup', endDraw);
    canvasEl.addEventListener('pointercancel', endDraw);

    // pointerleave is deliberately NOT the end of a stroke: with capture it
    // only fires after pointerup, and without it a finger drifting past the
    // canvas edge would kill strokes that then never resume, because no new
    // pointerdown happens until the finger is lifted.

    if (window.PointerEvent) {
      // Belt-and-braces next to touch-action:none: suppresses the long-press
      // context menu and double-tap zoom on the canvas.
      canvasEl.addEventListener(
        'touchstart',
        (e) => e.preventDefault(),
        { passive: false }
      );
      canvasEl.addEventListener(
        'touchmove',
        (e) => e.preventDefault(),
        { passive: false }
      );
    } else {
      // Old Android WebViews and browsers never fire pointer events; drive
      // the same stroke logic from raw Touch Events so drawing still works.
      canvasEl.addEventListener(
        'touchstart',
        (e) => {
          if (isDrawing || !e.touches.length) return;
          e.preventDefault();
          startDraw(getPoint(e.touches[0]));
        },
        { passive: false }
      );
      canvasEl.addEventListener(
        'touchmove',
        (e) => {
          if (!isDrawing || !e.touches.length) return;
          e.preventDefault();
          moveDraw(getPoint(e.touches[0]));
        },
        { passive: false }
      );
      canvasEl.addEventListener('touchend', endDraw);
      canvasEl.addEventListener('touchcancel', endDraw);

      canvasEl.addEventListener('mousedown', (e) => {
        if (isDrawing || e.button !== 0) return;
        startDraw(getPoint(e));
      });
      canvasEl.addEventListener('mousemove', (e) => {
        if (isDrawing) moveDraw(getPoint(e));
      });
      window.addEventListener('mouseup', endDraw);
    }

    document.querySelectorAll('.notepad-tool-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document
          .querySelectorAll('.notepad-tool-btn')
          .forEach((b) => b.classList.remove('notepad-tool-active'));
        btn.classList.add('notepad-tool-active');
        activeTool = btn.getAttribute('data-tool');
        refreshStroke();
      });
    });

    const sizeSlider = $id('notepad-pen-size');
    if (sizeSlider) sizeSlider.addEventListener('input', refreshStroke);

    document.querySelectorAll('.notepad-color-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document
          .querySelectorAll('.notepad-color-btn')
          .forEach((b) => b.classList.remove('notepad-color-active'));
        btn.classList.add('notepad-color-active');
        penColor = btn.getAttribute('data-color');
        refreshStroke();
      });
    });

    const clearBtn = $id('btn-notepad-clear');
    if (clearBtn) clearBtn.addEventListener('click', clearCanvas);

    const aiBtn = $id('btn-notepad-ai-predict');
    if (aiBtn) aiBtn.addEventListener('click', predictHandwriting);

    if (insertPredictionBtn) {
      insertPredictionBtn.addEventListener('click', insertPrediction);
    }

    const newBtn = $id('btn-notepad-new');
    if (newBtn) newBtn.addEventListener('click', createNote);

    if (deleteBtn) deleteBtn.addEventListener('click', onDeleteClick);

    if (titleInput) titleInput.addEventListener('input', scheduleSave);
    if (textArea) textArea.addEventListener('input', scheduleSave);

    document.querySelectorAll('.notepad-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.getAttribute('data-mode')));
    });

    window.addEventListener('resize', resizeCanvas);

    // The sidebar/panel can change width without a window resize, so keep
    // the backing store in step with the rendered box.
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(resizeCanvas).observe(canvasEl);
    }

    // Persist pending edits even if the user never lets the debounce fire.
    window.addEventListener('beforeunload', flushSave);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushSave();
    });
  }

  // ==================================================
  // Init
  // ==================================================

  function init() {
    canvasEl = $id('notepad-canvas');
    titleInput = $id('notepad-title');
    textArea = $id('notepad-text');
    drawPanel = $id('notepad-draw-panel');
    notesListEl = $id('notepad-notes-list');
    notesCountEl = $id('notepad-notes-count');
    saveStatusEl = $id('notepad-save-status');
    predictionTextEl = $id('notepad-prediction-text');
    predictionConfEl = $id('notepad-prediction-confidence');
    insertPredictionBtn = $id('btn-notepad-insert-prediction');
    deleteBtn = $id('btn-notepad-delete');
    alertEl = $id('notepad-alert');

    if (!canvasEl || !textArea) return;

    ctx = canvasEl.getContext('2d', { willReadFrequently: true });
    dpr = window.devicePixelRatio || 1;

    if (isInitialized) {
      // Re-entered the tab: commit any pending edits before re-rendering.
      flushSave();
    } else {
      notes = loadNotes();
      if (!activeNoteId) {
        activeNoteId = notes.length ? notes[0].id : null;
      } else if (!notes.some((n) => n.id === activeNoteId)) {
        activeNoteId = notes.length ? notes[0].id : null;
      }
      wireEvents();
      isInitialized = true;
    }

    ensureDraftNote();
    renderNotesList();
    renderEditor();
    setMode(mode);

    if (!cloudLoaded) loadFromCloud();
  }

  window.initNotepad = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
