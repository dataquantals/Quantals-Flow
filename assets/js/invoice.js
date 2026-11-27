/* Invoice page.
   The document lives on the server (GET/PUT /api/invoice), not in the
   browser, so it follows the signed-in user across devices. The shell around
   it (profile avatar, log out) behaves like the dashboard's. */
(function () {
  'use strict';

  var CUR = 'ZMK ';
  var VALID_DAYS = 15;
  var DOC_PREFIX = 'INV';
  var SAVE_DELAY_MS = 700;
  var RETRY_DELAY_MS = 4000;
  var DEFAULT_LOGO_SRC = '/assets/img/quotation-logo.jpg';
  var ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  var MAX_LOGO_BYTES = 5 * 1024 * 1024;

  function pad2(n) { return String(n).padStart(2, '0'); }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function addDaysIso(iso, days) {
    var base = /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? String(iso) : todayIso();
    var parts = base.split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime())) d = new Date();
    d.setDate(d.getDate() + (Number(days) || 0));
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function generateDocNumber(current) {
    var stamp = todayIso().replace(/-/g, '');
    var raw = String(current || '').trim();
    if (!raw) return DOC_PREFIX + '-' + stamp + '-001';
    var dated = raw.match(/^([A-Za-z]+)-(\d{8})-(\d+)$/);
    if (dated) {
      if (dated[2] === stamp) {
        return dated[1] + '-' + stamp + '-' + String(parseInt(dated[3], 10) + 1).padStart(dated[3].length, '0');
      }
      return dated[1] + '-' + stamp + '-001';
    }
    var trailing = raw.match(/^(.*?)(\d+)$/);
    if (trailing) {
      return trailing[1] + String((parseInt(trailing[2], 10) || 0) + 1).padStart(trailing[2].length, '0');
    }
    return DOC_PREFIX + '-' + stamp + '-001';
  }

  function blankItem() { return { q: '', d: '', p: '', t: '' }; }
  function blankItems(n) { return Array.from({ length: n }, blankItem); }

  function sample() {
    var today = todayIso();
    return {
      coName: 'Quantals Solution', tagline: 'Delivering the Best',
      coAddr1: 'PHI off Great East Road', coAddr2: 'Lusaka Zambia', coPhone: 'Phone +260977445615',
      date: today, qno: generateDocNumber(''), cid: '', valid: addDaysIso(today, VALID_DAYS), prep: 'Richard Mumba',
      toName: 'Purchasing Officer', toOrg: 'ZESCO', toAddr1: 'Great East Road', toAddr2: 'Lusaka Zambia', toPhone: '',
      comments: 'None', sales: 'Richard Mumba', po: 'Non', shipDate: 'N/A', shipVia: 'N/A', fob: '', terms: 'Due on receipt',
      notes: 'Thank you for your business!', rate: 8.6, other: 0,
      footer: 'If you have any questions concerning this invoice contact Richard Mumba at 0977445615 or Email: dataquantals@gmail.com',
      items: [{ q: 13, d: 'Empty Carton Boxes', p: 150, t: '' }].concat(blankItems(8))
    };
  }

  var $ = function (id) { return document.getElementById(id); };
  var rowsEl = $('rows');
  var statusEl = $('status');
  var sheet = $('sheet');
  var logoImgEl = $('quoteLogoImg');
  var logoUploadBtn = $('logoUploadBtn');
  var logoFileInput = $('logoFileInput');
  var S = null;

  /* ---------------------------------------------------------------- status */
  function setStatus(state, text) {
    statusEl.dataset.state = state;
    statusEl.textContent = text;
  }

  /* --------------------------------------------------------------- numbers */
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function money(n) {
    return CUR + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function isBlank(it) {
    return !it || ((it.q === '' || it.q == null) && (it.d === '' || it.d == null) && (it.p === '' || it.p == null));
  }
  function isValidInvoice(q) {
    return Boolean(
      q &&
      typeof q === 'object' &&
      typeof q.coName === 'string' &&
      q.coName.trim().length > 0 &&
      typeof q.qno === 'string' &&
      Array.isArray(q.items) &&
      q.items.length > 0 &&
      q.items[0] &&
      ('q' in q.items[0] || 'd' in q.items[0] || 'p' in q.items[0])
    );
  }

  /* ---------------------------------------------------------------- render */
  function buildRows() {
    rowsEl.innerHTML = '';
    S.items.forEach(function (it, i) {
      var tr = document.createElement('tr');
      tr.dataset.i = i;
      tr.innerHTML =
        '<td><input type="number" min="0" step="any" inputmode="decimal" data-f="q" aria-label="Quantity, line ' + (i + 1) + '"></td>' +
        '<td><input data-f="d" aria-label="Description, line ' + (i + 1) + '"></td>' +
        '<td class="n"><input type="number" min="0" step="any" inputmode="decimal" data-f="p" aria-label="Unit price, line ' + (i + 1) + '"></td>' +
        '<td class="c"><select data-f="t" aria-label="Taxable, line ' + (i + 1) + '"><option value="">No</option><option value="T">Yes</option></select></td>' +
        '<td class="amt" data-a></td>' +
        '<td class="x"><button class="quote-rm" type="button" data-rm aria-label="Remove line ' + (i + 1) + '">&times;</button></td>';
      tr.querySelectorAll('[data-f]').forEach(function (el) {
        var v = it[el.dataset.f];
        el.value = v == null ? '' : v;
      });
      rowsEl.appendChild(tr);
    });
    calc();
  }

  function calc() {
    var sub = 0, taxable = 0;
    S.items.forEach(function (it, i) {
      var a = num(it.q) * num(it.p);               // amount = quantity x unit price
      sub += a;
      if (it.t === 'T') taxable += a;
      var tr = rowsEl.children[i];
      if (!tr) return;
      tr.classList.toggle('is-blank', isBlank(it));
      tr.querySelector('[data-a]').textContent = (it.q === '' && it.p === '') ? '' : money(a);
    });
    var tax = num(S.rate) / 100 * taxable;         // sales tax = rate x taxable lines
    var total = sub + tax + num(S.other);          // total = subtotal + tax + other
    $('sub').textContent = money(sub);
    $('tax').textContent = money(tax);
    $('total').textContent = money(total);
    return { sub: sub, tax: tax, total: total };
  }

  function renderLogo() {
    if (!logoImgEl) return;
    var nextSrc = (S && typeof S.logoUrl === 'string' && S.logoUrl.trim()) ? S.logoUrl.trim() : DEFAULT_LOGO_SRC;
    if (logoImgEl.getAttribute('src') !== nextSrc) {
      logoImgEl.src = nextSrc;
    }
  }

  function fillFields() {
    document.querySelectorAll('[data-k]').forEach(function (el) {
      var v = S[el.dataset.k];
      el.value = v == null ? '' : v;
    });
    $('rate').value = S.rate == null ? '' : S.rate;
    $('other').value = S.other == null ? '' : S.other;
    renderLogo();
  }

  /* ------------------------------------------------------------------ save */
  var saveTimer = null;
  var inFlight = false;
  var dirty = false;

  function scheduleSave() {
    if (!S) return;
    dirty = true;
    setStatus('saving', 'Saving\u2026');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, SAVE_DELAY_MS);
  }

  function save() {
    clearTimeout(saveTimer);
    if (!dirty) return Promise.resolve();
    if (inFlight) { saveTimer = setTimeout(save, SAVE_DELAY_MS); return Promise.resolve(); }
    inFlight = true;
    dirty = false;
    return fetch('/api/invoice', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice: S })
    }).then(function (res) {
      if (res.status === 401) { goToLogin(); return; }
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (d) {
          throw new Error(d.error || ('HTTP ' + res.status));
        });
      }
      return res.json().catch(function () { return {}; }).then(function (d) {
        if (!dirty) {
          setStatus('saved', 'All changes saved');
        }
      });
    }).catch(function (err) {
      dirty = true;
      setStatus('error', 'Could not save (' + err.message + '). Retrying\u2026');
      saveTimer = setTimeout(save, RETRY_DELAY_MS);
    }).then(function () { inFlight = false; });
  }

  // Last chance to hand unsent edits to the server when the tab closes.
  function flushOnLeave() {
    if (!dirty || !S) return;
    try {
      fetch('/api/invoice', {
        method: 'PUT',
        credentials: 'same-origin',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice: S })
      });
    } catch (e) { /* nothing more to do */ }
  }
  window.addEventListener('pagehide', flushOnLeave);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushOnLeave();
  });

  /* ------------------------------------------------------------- navigation */
  function goToLogin() {
    window.location.replace('/login/?next=' + encodeURIComponent(window.location.pathname || '/dashboard/invoice/'));
  }

  /* ---------------------------------------------------------------- events */
  function handleFieldChange(e) {
    if (!S) return;
    var el = e.target;
    if (el.dataset.k) {
      S[el.dataset.k] = el.value;
      if (el.dataset.k === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(el.value)) {
        S.valid = addDaysIso(el.value, VALID_DAYS);
        var validEl = $('valid');
        if (validEl) validEl.value = S.valid;
      }
    }
    else if (el.id === 'rate') S.rate = el.value;
    else if (el.id === 'other') S.other = el.value;
    else if (el.dataset.f) S.items[el.closest('tr').dataset.i][el.dataset.f] = el.value;
    else return;
    calc();
    scheduleSave();
  }
  (sheet || document).addEventListener('input', handleFieldChange);
  (sheet || document).addEventListener('change', handleFieldChange);

  rowsEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]');
    if (!b || !S) return;
    var i = +b.closest('tr').dataset.i;
    S.items.splice(i, 1);
    if (!S.items.length) S.items.push(blankItem());
    buildRows();
    scheduleSave();
    var next = rowsEl.children[Math.min(i, rowsEl.children.length - 1)];
    if (next) next.querySelector('input').focus();
  });

  $('addRow').addEventListener('click', function () {
    if (!S) return;
    S.items.push(blankItem());
    buildRows();
    scheduleSave();
    var r = rowsEl.lastElementChild;
    if (r) r.querySelector('input').focus();
  });

  $('newQ').addEventListener('click', async function () {
    if (!S) return;
    var confirmed = await window.QFDialog.confirm({
      title: 'Start a new invoice?',
      message: 'The current line items will be cleared and the invoice number will increment by one.',
      confirmLabel: 'Start New',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });
    if (!confirmed) return;
    S.qno = generateDocNumber(S.qno);
    S.date = todayIso();
    S.valid = addDaysIso(S.date, VALID_DAYS);
    S.items = blankItems(9);
    S.other = 0;
    fillFields();
    buildRows();
    scheduleSave();
  });

  $('reset').addEventListener('click', async function () {
    if (!S) return;
    var confirmed = await window.QFDialog.confirm({
      title: 'Replace invoice with sample?',
      message: 'Everything on this invoice will be replaced with the sample. This cannot be undone.',
      confirmLabel: 'Replace',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });
    if (!confirmed) return;
    S = sample();
    fillFields();
    buildRows();
    scheduleSave();
  });

  /* ------------------------------------------------------------ Logo Upload */
  if (logoImgEl) {
    logoImgEl.addEventListener('error', function () {
      if (logoImgEl.getAttribute('src') !== DEFAULT_LOGO_SRC) {
        logoImgEl.src = DEFAULT_LOGO_SRC;
      }
    });
  }

  if (logoUploadBtn && logoFileInput) {
    logoUploadBtn.addEventListener('click', function () {
      if (!S) return;
      logoFileInput.click();
    });

    logoFileInput.addEventListener('change', function () {
      var file = logoFileInput.files && logoFileInput.files[0];
      logoFileInput.value = '';
      if (!file || !S) return;

      if (ALLOWED_LOGO_TYPES.indexOf(file.type) === -1) {
        setStatus('error', 'Invalid file format. Please choose a PNG, JPG, WebP, GIF, or SVG image.');
        return;
      }
      if (file.size > MAX_LOGO_BYTES) {
        setStatus('error', 'Logo exceeds the 5MB limit. Please choose a smaller image.');
        return;
      }

      var prevSrc = (S && S.logoUrl) ? S.logoUrl : DEFAULT_LOGO_SRC;
      var previewUrl = URL.createObjectURL(file);
      if (logoImgEl) logoImgEl.src = previewUrl;
      logoUploadBtn.classList.add('is-uploading');
      logoUploadBtn.disabled = true;
      setStatus('saving', 'Uploading logo\u2026');

      fetch('/api/invoice/logo', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': file.type },
        body: file
      }).then(function (res) {
        if (res.status === 401) { goToLogin(); return null; }
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
          return data;
        });
      }).then(function (data) {
        if (!data) return;
        if (!data.logoUrl) throw new Error('The upload service did not return a logo URL.');
        S.logoUrl = data.logoUrl;
        S.logoStorageId = data.storageId || '';
        if (logoImgEl) logoImgEl.src = data.logoUrl;
        dirty = true;
        return save();
      }).catch(function (err) {
        if (logoImgEl) logoImgEl.src = prevSrc;
        setStatus('error', 'Logo upload failed (' + err.message + ').');
      }).then(function () {
        URL.revokeObjectURL(previewUrl);
        logoUploadBtn.classList.remove('is-uploading');
        logoUploadBtn.disabled = false;
      });
    });
  }

  /* ------------------------------------------------------------ PDF Download & Prompt */
  function getDefaultFilename() {
    var qno = (S && S.qno ? String(S.qno).trim() : '000001');
    var org = (S && S.toOrg ? String(S.toOrg).trim() : '');
    var safeOrg = org.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    return safeOrg ? 'Invoice-' + qno + '-' + safeOrg + '.pdf' : 'Invoice-' + qno + '.pdf';
  }

  var dialogEl = $('downloadDialog');
  var formEl = $('downloadForm');
  var filenameInput = $('pdfFilename');
  var cancelBtn = $('cancelDownload');
  var downloadBtn = $('downloadPdf') || $('print');

  function openDownloadDialog() {
    if (!dialogEl || !filenameInput) {
      window.QFDialog.prompt({
        title: 'Download PDF',
        message: 'Enter the name for the PDF file to be downloaded:',
        defaultValue: getDefaultFilename(),
        confirmLabel: 'Download',
        cancelLabel: 'Cancel'
      }).then(function (name) {
        if (name) generateAndDownloadPdf(name);
      });
      return;
    }
    var defName = getDefaultFilename();
    filenameInput.value = defName;
    dialogEl.hidden = false;

    setTimeout(function () {
      filenameInput.focus();
      var dotIndex = defName.lastIndexOf('.');
      if (dotIndex > 0) {
        filenameInput.setSelectionRange(0, dotIndex);
      } else {
        filenameInput.select();
      }
    }, 50);
  }

  function closeDownloadDialog() {
    if (dialogEl) dialogEl.hidden = true;
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', openDownloadDialog);
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeDownloadDialog);
  }
  if (dialogEl) {
    dialogEl.addEventListener('click', function (e) {
      if (e.target === dialogEl) closeDownloadDialog();
    });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && dialogEl && !dialogEl.hidden) {
        closeDownloadDialog();
      }
    });
  }

  if (formEl) {
    formEl.addEventListener('submit', function (e) {
      e.preventDefault();
      var rawName = filenameInput ? filenameInput.value : '';
      closeDownloadDialog();
      generateAndDownloadPdf(rawName);
    });
  }

  function formatDateDisplay(val) {
    if (!val || typeof val !== 'string') return val || '';
    var m = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
    return val;
  }

  function getLogoDataUrl() {
    var img = logoImgEl || document.querySelector('.quote-brand img');
    if (!img || !img.complete || !img.naturalWidth) return null;
    try {
      var c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      return {
        dataUrl: c.toDataURL('image/jpeg', 0.95),
        width: img.naturalWidth,
        height: img.naturalHeight
      };
    } catch (e) {
      return null;
    }
  }

  function buildVectorInvoicePdf(pdf, filename) {
    var data = S || sample();
    var totals = calc();

    // Palette matching quotation.css (.invoice-body)
    var NAVY = [42, 65, 182];       // #2a41b6
    var GREEN = [13, 122, 85];      // rgba(13, 122, 85, 0.6) — invoice bars (60% opacity)
    var BAR_INK = [6, 36, 23];      // #062417 — 6.55:1 contrast on 60% emerald bar
    var BAR_OPACITY = 0.6;
    var ORANGE = [217, 72, 15];     // #d9480f
    var INK = [22, 27, 38];         // #161b26
    var MUTED = [91, 102, 130];     // #5b6682
    var LINE = [213, 217, 226];     // #d5d9e2
    var LINE_SOFT = [238, 240, 244];// #eef0f4
    var WHITE = [255, 255, 255];

    var pageW = pdf.internal.pageSize.getWidth();   // 210 mm
    var pageH = pdf.internal.pageSize.getHeight();  // 297 mm
    var cardX = 12;
    var cardY = 12;
    var cardW = pageW - 24;                         // 186 mm
    var L = 20;                                     // inner left
    var R = pageW - 20;                             // inner right (190 mm)
    var W = R - L;                                  // 170 mm

    // Clean white page background
    pdf.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
    pdf.rect(0, 0, pageW, pageH, 'F');

    function hLine(x1, x2, yPos, color, width) {
      pdf.setDrawColor(color[0], color[1], color[2]);
      pdf.setLineWidth(width || 0.25);
      pdf.line(x1, yPos, x2, yPos);
    }

    // Green document bars are drawn at 60% opacity. Graphics state is scoped to
    // the fill only, so labels/borders drawn afterwards stay fully opaque.
    function fillBar(x, yPos, width, height) {
      var opaque = false;
      try {
        if (pdf.setGState && pdf.GState) {
          pdf.setGState(new pdf.GState({ opacity: BAR_OPACITY }));
          opaque = true;
        }
      } catch (e) { /* older jsPDF: fall back to solid fill */ }
      pdf.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
      pdf.rect(x, yPos, width, height, 'F');
      if (opaque) {
        try { pdf.setGState(new pdf.GState({ opacity: 1 })); } catch (e) {}
      }
    }

    // ---- 1. Header Block (Logo + Company Info | QUOTATION + Date/Q#/CID) ----
    var y = 21;
    var logoData = getLogoDataUrl();
    if (logoData && logoData.dataUrl) {
      var maxW = 20;
      var maxH = 14;
      var ratio = (logoData.width && logoData.height) ? (logoData.width / logoData.height) : (20 / 12.6);
      var drawW = maxW;
      var drawH = drawW / ratio;
      if (drawH > maxH) {
        drawH = maxH;
        drawW = drawH * ratio;
      }
      pdf.addImage(logoData.dataUrl, 'JPEG', L, y - 2, drawW, drawH);
    }

    var coX = L + 24;
    var coR = 114;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    pdf.text(String(data.coName || 'Quantals Solution'), coX, y + 3);
    hLine(coX, coR, y + 5, LINE);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2]);
    pdf.text(String(data.tagline || ''), coX, y + 9.5);
    hLine(coX, coR, y + 11.5, LINE);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    pdf.text(String(data.coAddr1 || ''), coX, y + 16);
    hLine(coX, coR, y + 18, LINE);
    pdf.text(String(data.coAddr2 || ''), coX, y + 22);
    hLine(coX, coR, y + 24, LINE);
    pdf.text(String(data.coPhone || ''), coX, y + 28);
    hLine(coX, coR, y + 30, LINE);

    // Right header: QUOTATION + Metadata
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2]);
    pdf.text('INVOICE', R, y + 3, { align: 'right' });

    var kvLblX = 148;
    var kvValX = 151;
    var kvY = y + 11.5;

    function drawKV(label, value, yPos) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      pdf.text(label, kvLblX, yPos, { align: 'right' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(INK[0], INK[1], INK[2]);
      pdf.text(String(value || ''), kvValX, yPos);
      hLine(kvValX - 1, R, yPos + 2, LINE);
    }

    drawKV('DATE', formatDateDisplay(data.date), kvY);
    drawKV('INVOICE #', data.qno, kvY + 7.5);
    drawKV('TPIN/ID', data.cid, kvY + 15);

    // ---- 2. Quotation For & Valid Until / Prepared By ----
    y = 58;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    pdf.text('BILL TO', L, y);

    var forLines = [
      data.toName || '',
      data.toOrg || '',
      data.toAddr1 || '',
      data.toAddr2 || '',
      data.toPhone || ''
    ];
    var fy = y + 6;
    forLines.forEach(function (lineText) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(INK[0], INK[1], INK[2]);
      if (lineText) {
        pdf.text(String(lineText), L + 1, fy);
      }
      hLine(L, coR, fy + 2, LINE);
      fy += 7;
    });

    drawKV('DUE DATE', formatDateDisplay(data.valid), y + 6);
    drawKV('PREPARED BY', data.prep, y + 13.5);

    // ---- 3. Comments or Special Instructions ----
    y = fy + 5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    pdf.text('COMMENTS OR PAYMENT INSTRUCTIONS', L, y);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    var commentLines = pdf.splitTextToSize(String(data.comments || ''), W - 2);
    if (commentLines.length) {
      pdf.text(commentLines, L + 1, y + 5.5);
    }
    var commentH = Math.max(1, commentLines.length) * 4.5;
    hLine(L, R, y + 5.5 + commentH, LINE);

    // ---- 4. Order Details Strip ----
    y = y + 11 + commentH;
    var stripCols = [
      { label: 'SALESPERSON', val: data.sales || '', w: 30 },
      { label: 'P.O. NUMBER', val: data.po || '', w: 26 },
      { label: 'SHIP DATE', val: data.shipDate || '', w: 26 },
      { label: 'SHIP VIA', val: data.shipVia || '', w: 26 },
      { label: 'F.O.B. POINT', val: data.fob || '', w: 28 },
      { label: 'TERMS', val: data.terms || '', w: 34 }
    ];
    var stripHdrH = 6.5;
    var stripValH = 8;

    fillBar(L, y, W, stripHdrH);

    pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
    pdf.setLineWidth(0.25);
    pdf.rect(L, y, W, stripHdrH + stripValH, 'S');

    var sx = L;
    stripCols.forEach(function (col, idx) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6.5);
      pdf.setTextColor(BAR_INK[0], BAR_INK[1], BAR_INK[2]);
      pdf.text(col.label, sx + 2, y + 4.4);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(INK[0], INK[1], INK[2]);
      var cellLines = pdf.splitTextToSize(String(col.val), col.w - 4);
      if (cellLines.length) {
        pdf.text(cellLines[0], sx + 2, y + stripHdrH + 5.2);
      }
      if (idx > 0) {
        pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
        pdf.line(sx, y + stripHdrH, sx, y + stripHdrH + stripValH);
      }
      sx += col.w;
    });

    // ---- 5. Line Items Table ----
    y += stripHdrH + stripValH + 6;
    var tblCols = [
      { label: 'QUANTITY', w: 22, align: 'left' },
      { label: 'DESCRIPTION', w: 78, align: 'left' },
      { label: 'UNIT PRICE', w: 24, align: 'right' },
      { label: 'TAXABLE', w: 18, align: 'center' },
      { label: 'AMOUNT', w: 28, align: 'right' }
    ];
    var tblHdrH = 7;

    function drawTableHeader(yPos) {
      fillBar(L, yPos, W, tblHdrH);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(BAR_INK[0], BAR_INK[1], BAR_INK[2]);
      var tx = L;
      tblCols.forEach(function (c) {
        var textX = c.align === 'right' ? tx + c.w - 2 : (c.align === 'center' ? tx + c.w / 2 : tx + 2);
        pdf.text(c.label, textX, yPos + 4.8, { align: c.align });
        tx += c.w;
      });
    }

    drawTableHeader(y);
    y += tblHdrH;

    var activeItems = (data.items || []).filter(function (it) { return !isBlank(it); });
    if (!activeItems.length) activeItems = [blankItem()];

    activeItems.forEach(function (it) {
      var descLines = pdf.splitTextToSize(String(it.d || ''), 74);
      var rowH = Math.max(7.5, descLines.length * 4.5 + 3);

      // Page break if needed before drawing row
      if (y + rowH > pageH - 28) {
        pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(cardX, cardY, cardW, Math.min(y + 4 - cardY, pageH - 24), 3.5, 3.5, 'S');
        pdf.addPage();
        pdf.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
        pdf.rect(0, 0, pageW, pageH, 'F');
        y = 20;
        drawTableHeader(y);
        y += tblHdrH;
      }

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(INK[0], INK[1], INK[2]);

      var rowY = y + 5;
      var qStr = it.q === '' || it.q == null ? '' : String(it.q);
      var pStr = it.p === '' || it.p == null ? '' : String(it.p);
      var tStr = it.t === 'T' ? 'Yes' : 'No';
      var aStr = (it.q === '' && it.p === '') ? '' : money(num(it.q) * num(it.p));

      pdf.text(qStr, L + 2, rowY);
      if (descLines.length) pdf.text(descLines, L + 24, rowY);
      pdf.text(pStr, L + 22 + 78 + 24 - 2, rowY, { align: 'right' });
      pdf.text(tStr, L + 22 + 78 + 24 + 9, rowY, { align: 'center' });
      pdf.text(aStr, R - 2, rowY, { align: 'right' });

      hLine(L, R, y + rowH, LINE_SOFT, 0.25);
      y += rowH;
    });

    // ---- 6. Notes & Totals ----
    if (y + 58 > pageH - 20) {
      pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(cardX, cardY, cardW, y + 4 - cardY, 3.5, 3.5, 'S');
      pdf.addPage();
      pdf.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
      pdf.rect(0, 0, pageW, pageH, 'F');
      y = 22;
    } else {
      y += 7;
    }

    var notesTop = y;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    pdf.text('NOTES', L, notesTop);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    var noteLines = pdf.splitTextToSize(String(data.notes || ''), 94);
    if (noteLines.length) {
      pdf.text(noteLines, L + 1, notesTop + 5.5);
    }
    var notesEndY = notesTop + 14 + Math.max(0, noteLines.length - 1) * 4.5;
    hLine(L, coR, notesEndY, LINE);

    var totLblX = 154;
    var totValX = R;
    var ty = notesTop + 1;

    function drawTotRow(label, val, underlineVal) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      pdf.text(label, totLblX, ty, { align: 'right' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(INK[0], INK[1], INK[2]);
      pdf.text(String(val), totValX, ty, { align: 'right' });

      if (underlineVal) {
        hLine(158, R, ty + 2, LINE);
      }
      ty += 7.5;
    }

    drawTotRow('SUBTOTAL', money(totals.sub), false);
    drawTotRow('TAX RATE (%)', data.rate == null ? '0' : String(data.rate), true);
    drawTotRow('SALES TAX', money(totals.tax), false);
    drawTotRow('OTHER', data.other == null ? '0' : String(data.other), true);

    // Blue accent divider above Total
    hLine(132, totLblX, ty - 3, NAVY, 0.55);
    hLine(158, R, ty - 3, NAVY, 0.55);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12.5);
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    pdf.text('Total Due', totLblX, ty + 2.5, { align: 'right' });

    pdf.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2]);
    pdf.text(money(totals.total), totValX, ty + 2.5, { align: 'right' });

    // ---- 7. Footer ----
    y = Math.max(notesEndY, ty + 6) + 8;
    hLine(L, R, y, LINE);
    y += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    var footLines = pdf.splitTextToSize(String(data.footer || ''), W);
    if (footLines.length) {
      pdf.text(footLines, pageW / 2, y, { align: 'center' });
    }
    var contentBottom = y + Math.max(1, footLines.length) * 4 + 4;

    // Outer card rounded border
    var cardH = Math.max(contentBottom - cardY, 120);
    pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(cardX, cardY, cardW, Math.min(cardH, pageH - 24), 3.5, 3.5, 'S');

    pdf.save(filename);
  }

  function generateAndDownloadPdf(rawFilename) {
    var filename = (rawFilename || '').trim() || getDefaultFilename();
    if (!/\.pdf$/i.test(filename)) filename += '.pdf';

    setStatus('saving', 'Preparing ' + filename + '\u2026');

    if (typeof html2pdf !== 'undefined') {
      try {
        var tinyCanvas = document.createElement('canvas');
        tinyCanvas.width = 1;
        tinyCanvas.height = 1;
        var worker = html2pdf().set({
          margin: [0, 0, 0, 0],
          filename: filename,
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        });
        worker.prop.canvas = tinyCanvas;
        worker
          .setPageSize()
          .toPdf()
          .then(function () {
            var pdf = this && this.prop && this.prop.pdf;
            if (!pdf) throw new Error('jsPDF instance unavailable');
            buildVectorInvoicePdf(pdf, filename);
          })
          .then(function () {
            setStatus('saved', 'Downloaded ' + filename);
            setTimeout(function () {
              setStatus('saved', 'All changes saved');
            }, 3000);
          })
          .catch(function (err) {
            console.error('Vector PDF generation error:', err);
            fallbackPrintDownload(filename);
          });
      } catch (err) {
        console.error('Vector PDF init error:', err);
        fallbackPrintDownload(filename);
      }
    } else {
      fallbackPrintDownload(filename);
    }
  }

  function fallbackPrintDownload(filename) {
    var prevTitle = document.title;
    document.title = filename.replace(/\.pdf$/i, '');
    window.print();
    setTimeout(function () { document.title = prevTitle; }, 2000);
    setStatus('saved', 'Downloaded ' + filename);
  }

  $('copy').addEventListener('click', function () {
    if (!S) return;
    var t = calc();
    var lines = ['Invoice #' + S.qno + ' | ' + S.date, 'Bill to: ' + S.toOrg + ' (' + S.toName + ')', ''];
    S.items.forEach(function (it) {
      if (num(it.q) || num(it.p)) lines.push(it.q + ' x ' + it.d + ' @ ' + money(it.p) + ' = ' + money(num(it.q) * num(it.p)));
    });
    lines.push('', 'Subtotal: ' + money(t.sub), 'Sales tax (' + S.rate + '%): ' + money(t.tax), 'Other: ' + money(S.other), 'Total: ' + money(t.total));
    var txt = lines.join('\n');
    var note = function (msg) {
      var prev = { s: statusEl.dataset.state, t: statusEl.textContent };
      setStatus('saved', msg);
      setTimeout(function () { if (statusEl.textContent === msg) setStatus(prev.s || 'saved', prev.t); }, 2400);
    };
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(
      function () { note('Summary copied'); },
      function () { setStatus('error', 'Your browser blocked copying. Use Print or Save PDF instead.'); }
    );
  });

  /* ------------------------------------------------------------ header chrome */
  function wireChrome(user) {
    var name = (user.name && user.name.trim()) ? user.name.trim() : (user.email || '');
    var initialEl = $('dash-initial');
    if (initialEl) {
      var img = user.avatar_url || user.avatarUrl || user.imageUrl || user.avatar;
      if (img) {
        var el = document.createElement('img');
        el.src = img; el.alt = '';
        el.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;';
        initialEl.textContent = '';
        initialEl.appendChild(el);
      } else {
        initialEl.textContent = (name.charAt(0) || '?').toUpperCase();
      }
    }
    var profileNameEl = $('dash-profile-name') || document.querySelector('.dash-profile-btn span:last-child');
    if (profileNameEl && name) {
      profileNameEl.textContent = name;
    }
  }

  var logout = $('logout');
  if (logout) logout.addEventListener('click', function () {
    logout.disabled = true;
    logout.textContent = 'Logging out\u2026';
    var done = function () {
      try {
        Object.keys(localStorage).forEach(function (k) {
          if (k.indexOf('quantalflow_') === 0) localStorage.removeItem(k);
        });
        sessionStorage.clear();
      } catch (e) { /* storage may be blocked */ }
      goToLogin();
    };
    save().then(function () {
      return fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    }).then(done, done);
  });

  /* ------------------------------------------------------------------ boot */
  function boot() {
    // Immediately render default state and clear aria-busy so the sheet is never grayed out
    S = sample();
    fillFields();
    buildRows();
    if (sheet) sheet.removeAttribute('aria-busy');

    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (res) {
        if (res.status === 401) { goToLogin(); return null; }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.user) return null;
        wireChrome(data.user);
        return fetch('/api/invoice', { credentials: 'same-origin', cache: 'no-store' });
      })
      .then(function (res) {
        if (!res) return null;
        if (res.status === 401) { goToLogin(); return null; }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        if (dirty) return;
        var saved = data.invoice;
        var fresh = !isValidInvoice(saved);
        S = fresh ? sample() : saved;
        var autoFilled = false;
        if (!S.date || !/^\d{4}-\d{2}-\d{2}$/.test(S.date)) { S.date = todayIso(); autoFilled = true; }
        if (!S.valid || !/^\d{4}-\d{2}-\d{2}$/.test(S.valid)) { S.valid = addDaysIso(S.date, VALID_DAYS); autoFilled = true; }
        if (!S.qno || !String(S.qno).trim()) { S.qno = generateDocNumber(''); autoFilled = true; }
        fillFields();
        buildRows();
        if (sheet) sheet.removeAttribute('aria-busy');
        if (fresh || autoFilled) {
          // First visit or backfilled date/number: store server-side & in Convex.
          scheduleSave();
        } else {
          setStatus('saved', 'All changes saved');
          // Ensure existing invoice is also synced to Convex Cloud
          save();
        }
      })
      .catch(function (err) {
        if (sheet) sheet.removeAttribute('aria-busy');
        setStatus('error', 'We could not load your invoice (' + err.message + '). Refresh to try again.');
      });
  }

  boot();
})();
