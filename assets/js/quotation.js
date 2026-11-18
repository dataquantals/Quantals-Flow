/* Quotation page.
   The document lives on the server (GET/PUT /api/quotation), not in the
   browser, so it follows the signed-in user across devices. The shell around
   it (profile avatar, log out) behaves like the dashboard's. */
(function () {
  'use strict';

  var CUR = 'ZMK ';
  var SAVE_DELAY_MS = 700;
  var RETRY_DELAY_MS = 4000;

  function blankItem() { return { q: '', d: '', p: '', t: '' }; }
  function blankItems(n) { return Array.from({ length: n }, blankItem); }

  function sample() {
    return {
      coName: 'Quantals Solution', tagline: 'delivering the Best',
      coAddr1: 'PHI off Great East Road', coAddr2: 'Lusaka Zambia', coPhone: 'Phone +260977445615',
      date: '2026-08-20', qno: '000072', cid: '', valid: '2026-12-01', prep: 'Richard Mumba',
      toName: 'Purchasing Officer', toOrg: 'ZESCO', toAddr1: 'Great East Road', toAddr2: 'Lusaka Zambia', toPhone: '',
      comments: 'None', sales: 'Richard Mumba', po: 'Non', shipDate: 'N/A', shipVia: 'N/A', fob: '', terms: 'Due on receipt',
      notes: '', rate: 8.6, other: 0,
      footer: 'If you have any questions concerning this quotation contact Richard Mumba at 0977445615 or Email: dataquantals@gmail.com',
      items: [{ q: 13, d: 'Empty Carton Boxes', p: 150, t: '' }].concat(blankItems(8))
    };
  }

  var $ = function (id) { return document.getElementById(id); };
  var rowsEl = $('rows');
  var statusEl = $('status');
  var sheet = $('sheet');
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
  function isValidQuotation(q) {
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

  function fillFields() {
    document.querySelectorAll('[data-k]').forEach(function (el) {
      var v = S[el.dataset.k];
      el.value = v == null ? '' : v;
    });
    $('rate').value = S.rate == null ? '' : S.rate;
    $('other').value = S.other == null ? '' : S.other;
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
    return fetch('/api/quotation', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quotation: S })
    }).then(function (res) {
      if (res.status === 401) { goToLogin(); return; }
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (d) {
          throw new Error(d.error || ('HTTP ' + res.status));
        });
      }
      return res.json().catch(function () { return {}; }).then(function (d) {
        if (!dirty) {
          setStatus('saved', d && d.convexSynced ? 'All changes saved to Convex Cloud' : 'All changes saved');
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
      fetch('/api/quotation', {
        method: 'PUT',
        credentials: 'same-origin',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotation: S })
      });
    } catch (e) { /* nothing more to do */ }
  }
  window.addEventListener('pagehide', flushOnLeave);

  /* ------------------------------------------------------------- navigation */
  function goToLogin() {
    window.location.replace('/login/?next=' + encodeURIComponent('/quotation/'));
  }

  /* ---------------------------------------------------------------- events */
  document.addEventListener('input', function (e) {
    if (!S) return;
    var el = e.target;
    if (el.dataset.k) S[el.dataset.k] = el.value;
    else if (el.id === 'rate') S.rate = el.value;
    else if (el.id === 'other') S.other = el.value;
    else if (el.dataset.f) S.items[el.closest('tr').dataset.i][el.dataset.f] = el.value;
    else return;
    calc();
    scheduleSave();
  });

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

  $('newQ').addEventListener('click', function () {
    if (!S) return;
    if (!window.confirm('Start a new quotation? The current line items will be cleared and the number will go up by one.')) return;
    var width = String(S.qno || '000000').length;
    S.qno = String((parseInt(S.qno, 10) || 0) + 1).padStart(width, '0');
    var d = new Date();
    S.date = d.toISOString().slice(0, 10);
    S.valid = new Date(d.getTime() + 14 * 864e5).toISOString().slice(0, 10);
    S.items = blankItems(9);
    S.other = 0;
    fillFields();
    buildRows();
    scheduleSave();
  });

  $('reset').addEventListener('click', function () {
    if (!S) return;
    if (!window.confirm('Replace everything on this quotation with the sample? This cannot be undone.')) return;
    S = sample();
    fillFields();
    buildRows();
    scheduleSave();
  });

  /* ------------------------------------------------------------ PDF Download & Prompt */
  function getDefaultFilename() {
    var qno = (S && S.qno ? String(S.qno).trim() : '000001');
    var org = (S && S.toOrg ? String(S.toOrg).trim() : '');
    var safeOrg = org.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    return safeOrg ? 'Quotation-' + qno + '-' + safeOrg + '.pdf' : 'Quotation-' + qno + '.pdf';
  }

  var dialogEl = $('downloadDialog');
  var formEl = $('downloadForm');
  var filenameInput = $('pdfFilename');
  var cancelBtn = $('cancelDownload');
  var downloadBtn = $('downloadPdf') || $('print');

  function openDownloadDialog() {
    if (!dialogEl || !filenameInput) {
      var name = window.prompt('Enter the name for the PDF file to be downloaded:', getDefaultFilename());
      if (name) generateAndDownloadPdf(name);
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

  function generateAndDownloadPdf(rawFilename) {
    var filename = (rawFilename || '').trim() || getDefaultFilename();
    if (!/\.pdf$/i.test(filename)) filename += '.pdf';

    setStatus('saving', 'Preparing ' + filename + '\u2026');

    if (typeof html2pdf !== 'undefined') {
      var sheetEl = $('sheet');
      if (!sheetEl) return;

      var clone = sheetEl.cloneNode(true);
      clone.id = 'sheet-pdf-export';
      clone.removeAttribute('aria-busy');
      clone.style.cssText =
        'width: 860px; max-width: 860px; box-sizing: border-box; background: #ffffff; ' +
        'padding: 30px 34px; border: 1px solid #d5d9e2; border-radius: 16px; ' +
        'box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05); margin: 0 auto; color: #172554; ' +
        'opacity: 1; pointer-events: auto; display: grid; gap: 20px; ' +
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;';

      var brandCol = clone.querySelector('.quote-brand > div');
      if (brandCol) {
        brandCol.style.flex = '1 1 auto';
        brandCol.style.minWidth = '220px';
      }

      var origInputs = sheetEl.querySelectorAll('input, select, textarea');
      var cloneInputs = clone.querySelectorAll('input, select, textarea');

      for (var i = 0; i < origInputs.length; i++) {
        var orig = origInputs[i];
        var cl = cloneInputs[i];
        if (!cl) continue;

        var cs = window.getComputedStyle(orig);
        var rawVal = orig.value != null ? String(orig.value) : '';
        var isPlaceholder = false;

        if (orig.tagName === 'SELECT') {
          var selOpt = orig.options && orig.options[orig.selectedIndex];
          rawVal = selOpt ? selOpt.text : rawVal;
        } else if (orig.type === 'date' && rawVal) {
          rawVal = formatDateDisplay(rawVal);
        } else if (!rawVal && orig.getAttribute('placeholder')) {
          rawVal = orig.getAttribute('placeholder');
          isPlaceholder = true;
        }

        var box = document.createElement('div');
        var textSpan = document.createElement('span');
        textSpan.textContent = rawVal;
        box.appendChild(textSpan);

        var inTable = Boolean(orig.closest('.quote-table'));
        var borderBottom = inTable
          ? '1px solid transparent'
          : (cs.borderBottomWidth && cs.borderBottomWidth !== '0px'
              ? cs.borderBottomWidth + ' ' + cs.borderBottomStyle + ' ' + cs.borderBottomColor
              : '1px solid #d5d9e2');

        box.style.cssText =
          'box-sizing: border-box; width: 100%; display: flex; align-items: center; ' +
          'font-family: ' + cs.fontFamily + '; ' +
          'font-size: ' + cs.fontSize + '; ' +
          'font-weight: ' + cs.fontWeight + '; ' +
          'line-height: ' + cs.lineHeight + '; ' +
          'letter-spacing: ' + cs.letterSpacing + '; ' +
          'color: ' + (isPlaceholder ? '#8a8f9c' : cs.color) + '; ' +
          'padding: ' + cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft + '; ' +
          'min-height: ' + (cs.minHeight && cs.minHeight !== '0px' ? cs.minHeight : '28px') + '; ' +
          'border-bottom: ' + borderBottom + '; ' +
          (orig.tagName === 'TEXTAREA' ? 'white-space: pre-wrap; word-break: break-word;' : 'white-space: nowrap; overflow: hidden;');

        var align = cs.textAlign;
        if (orig.type === 'date') {
          box.style.justifyContent = 'space-between';
          var calIcon = document.createElement('span');
          calIcon.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#64748b" stroke-width="2" style="display:block;flex:none;"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="5"/><line x1="16" y1="2" x2="16" y2="5"/></svg>';
          box.appendChild(calIcon);
        } else if (orig.tagName === 'SELECT') {
          box.style.justifyContent = 'center';
          box.style.gap = '4px';
          var chevIcon = document.createElement('span');
          chevIcon.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" style="display:block;flex:none;"><polyline points="6 9 12 15 18 9"/></svg>';
          box.appendChild(chevIcon);
        } else if (orig.classList.contains('n') || (orig.parentElement && orig.parentElement.classList.contains('n')) || align === 'right' || align === 'end') {
          box.style.justifyContent = 'flex-end';
          box.style.textAlign = 'right';
        } else if (align === 'center' || (orig.parentElement && orig.parentElement.classList.contains('c'))) {
          box.style.justifyContent = 'center';
          box.style.textAlign = 'center';
        } else {
          box.style.justifyContent = 'flex-start';
          box.style.textAlign = 'left';
        }

        if (orig.tagName === 'TEXTAREA') {
          box.style.alignItems = 'flex-start';
          box.style.minHeight = orig.getAttribute('rows') === '3' ? '56px' : '42px';
        }

        if (cl.parentNode) {
          cl.parentNode.replaceChild(box, cl);
        }
      }

      // Now remove blank spare rows from the table
      var rows = clone.querySelectorAll('.quote-table tbody tr');
      var nonBlankCount = 0;
      rows.forEach(function (tr) {
        if (!tr.classList.contains('is-blank')) nonBlankCount++;
      });
      rows.forEach(function (tr, idx) {
        if (tr.classList.contains('is-blank') && (nonBlankCount > 0 || idx > 0)) {
          tr.remove();
        }
      });

      // Remove the remove (×) column so the table ends cleanly at Amount
      var removeCells = clone.querySelectorAll('.quote-table th:last-child, .quote-table td.x');
      removeCells.forEach(function (c) { c.remove(); });

      var tableEl = clone.querySelector('.quote-table');
      if (tableEl) {
        tableEl.style.minWidth = '0';
        tableEl.style.width = '100%';
      }

      var prevScrollX = window.scrollX || window.pageXOffset || 0;
      var prevScrollY = window.scrollY || window.pageYOffset || 0;
      window.scrollTo(0, 0);

      var opt = {
        margin: [8, 8, 8, 8],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0,
          width: 892,
          windowWidth: 1100
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      var worker = html2pdf().set(opt).from(clone);
      worker
        .toContainer()
        .then(function () {
          var c = (this && this.prop && this.prop.container) || document.querySelector('.html2pdf__container');
          if (c) {
            c.style.margin = '0';
            c.style.left = '0';
            c.style.right = 'auto';
            c.style.top = '0';
            c.style.width = '892px';
            c.style.padding = '16px';
            c.style.boxSizing = 'border-box';
            c.style.backgroundColor = '#ffffff';
          }
        })
        .toCanvas()
        .toPdf()
        .then(function () {
          window.scrollTo(prevScrollX, prevScrollY);
          var canvas = this && this.prop && this.prop.canvas;
          var pdf = this && this.prop && this.prop.pdf;
          if (canvas && pdf) {
            var pageW = pdf.internal.pageSize.getWidth();   // 210 mm
            var pageH = pdf.internal.pageSize.getHeight();  // 297 mm
            var margin = 8;
            var availW = pageW - margin * 2;                // 194 mm
            var availH = pageH - margin * 2;                // 281 mm

            var imgData = canvas.toDataURL('image/jpeg', 0.98);
            var ratio = canvas.height / canvas.width;
            var renderW = availW;
            var renderH = renderW * ratio;

            // Scale proportionally if taller than 1 page so the entire quotation card fits cleanly
            if (renderH > availH) {
              renderH = availH;
              renderW = renderH / ratio;
            }
            var offsetX = (pageW - renderW) / 2;
            var offsetY = margin;

            var totalPages = pdf.internal.getNumberOfPages();
            for (var p = totalPages; p > 1; p--) {
              pdf.deletePage(p);
            }
            pdf.setPage(1);
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pageW, pageH, 'F');
            pdf.addImage(imgData, 'JPEG', offsetX, offsetY, renderW, renderH);
            pdf.save(filename);
          }
        })
        .then(function () {
          setStatus('saved', 'Downloaded ' + filename);
          setTimeout(function () {
            setStatus('saved', 'All changes saved to Convex Cloud');
          }, 3000);
        })
        .catch(function (err) {
          window.scrollTo(prevScrollX, prevScrollY);
          console.error('html2pdf generation error:', err);
          fallbackPrintDownload(filename);
        });
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
    var lines = ['Quotation #' + S.qno + ' | ' + S.date, 'For: ' + S.toOrg + ' (' + S.toName + ')', ''];
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
    var name = user.name || user.email || '';
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
  }

  var logout = $('logout');
  logout.addEventListener('click', function () {
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
        return fetch('/api/quotation', { credentials: 'same-origin' });
      })
      .then(function (res) {
        if (!res) return null;
        if (res.status === 401) { goToLogin(); return null; }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        var saved = data.quotation;
        var fresh = !isValidQuotation(saved);
        S = fresh ? sample() : saved;
        fillFields();
        buildRows();
        if (sheet) sheet.removeAttribute('aria-busy');
        if (fresh) {
          // First visit: store the sample so the number sequence starts server-side & in Convex.
          scheduleSave();
        } else {
          setStatus('saved', 'All changes saved to Convex Cloud');
          // Ensure existing quotation is also synced to Convex Cloud
          save();
        }
      })
      .catch(function (err) {
        if (sheet) sheet.removeAttribute('aria-busy');
        setStatus('error', 'We could not load your quotation (' + err.message + '). Refresh to try again.');
      });
  }

  boot();
})();
