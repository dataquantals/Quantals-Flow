/* ==========================================================================
   QuantalFlow Reusable In-App Dialog Component (Confirm / Alert / Prompt)
   Replaces native browser window.confirm(), alert(), and prompt() with
   accessible, theme-matched modals supporting backdrop click & Escape.
   ========================================================================== */
(function () {
  'use strict';

  var activeCleanup = null;

  var ICONS = {
    danger:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
        '<line x1="12" y1="9" x2="12" y2="13"/>' +
        '<line x1="12" y1="17" x2="12.01" y2="17"/>' +
      '</svg>',
    primary:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="10"/>' +
        '<line x1="12" y1="16" x2="12" y2="12"/>' +
        '<line x1="12" y1="8" x2="12.01" y2="8"/>' +
      '</svg>',
    prompt:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 20h9"/>' +
        '<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>' +
      '</svg>'
  };

  function normalizeOpts(input, defaults) {
    if (typeof input === 'string') {
      return Object.assign({}, defaults, { message: input });
    }
    return Object.assign({}, defaults, input || {});
  }

  function getFocusable(container) {
    return Array.prototype.slice.call(
      container.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
    );
  }

  function openDialog(mode, rawOpts) {
    if (typeof activeCleanup === 'function') {
      activeCleanup('superseded');
    }

    var defaults = {
      title: mode === 'alert' ? 'Notice' : (mode === 'prompt' ? 'Enter value' : 'Confirm action'),
      message: '',
      confirmLabel: mode === 'alert' ? 'OK' : (mode === 'prompt' ? 'Save' : 'Confirm'),
      cancelLabel: 'Cancel',
      tone: mode === 'confirm' ? 'danger' : 'primary',
      placeholder: '',
      defaultValue: '',
      inputType: 'text'
    };
    var opts = normalizeOpts(rawOpts, defaults);

    return new Promise(function (resolve) {
      var prevFocused = document.activeElement;
      var settled = false;

      var backdrop = document.createElement('div');
      backdrop.className = 'qf-dialog-backdrop';
      backdrop.setAttribute('data-qf-dialog', 'true');

      var card = document.createElement('div');
      card.className = 'qf-dialog';
      card.setAttribute('role', mode === 'alert' ? 'alertdialog' : 'dialog');
      card.setAttribute('aria-modal', 'true');
      card.setAttribute('aria-labelledby', 'qf-dialog-title');
      if (opts.message) {
        card.setAttribute('aria-describedby', 'qf-dialog-message');
      }

      var header = document.createElement('div');
      header.className = 'qf-dialog__header';

      var iconTone = mode === 'prompt' ? 'prompt' : (opts.tone === 'danger' ? 'danger' : 'primary');
      var iconWrap = document.createElement('div');
      iconWrap.className = 'qf-dialog__icon qf-dialog__icon--' + iconTone;
      iconWrap.innerHTML = ICONS[iconTone] || ICONS.primary;

      var textCol = document.createElement('div');
      textCol.className = 'qf-dialog__text';

      var titleEl = document.createElement('h3');
      titleEl.id = 'qf-dialog-title';
      titleEl.className = 'qf-dialog__title';
      titleEl.textContent = opts.title || defaults.title;
      textCol.appendChild(titleEl);

      if (opts.message) {
        var msgEl = document.createElement('p');
        msgEl.id = 'qf-dialog-message';
        msgEl.className = 'qf-dialog__message';
        msgEl.textContent = opts.message;
        textCol.appendChild(msgEl);
      }

      header.appendChild(iconWrap);
      header.appendChild(textCol);
      card.appendChild(header);

      var inputEl = null;
      if (mode === 'prompt') {
        var fieldWrap = document.createElement('div');
        fieldWrap.className = 'qf-dialog__field';
        inputEl = document.createElement('input');
        inputEl.type = opts.inputType || 'text';
        inputEl.className = 'qf-dialog__input';
        inputEl.value = opts.defaultValue != null ? String(opts.defaultValue) : '';
        if (opts.placeholder) inputEl.placeholder = opts.placeholder;
        inputEl.setAttribute('aria-label', opts.title || 'Value');
        fieldWrap.appendChild(inputEl);
        card.appendChild(fieldWrap);
      }

      var footer = document.createElement('div');
      footer.className = 'qf-dialog__footer';

      var cancelBtn = null;
      if (mode !== 'alert') {
        cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'qf-dialog__btn qf-dialog__btn--secondary';
        cancelBtn.textContent = opts.cancelLabel || 'Cancel';
        footer.appendChild(cancelBtn);
      }

      var confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'qf-dialog__btn ' + (opts.tone === 'danger' ? 'qf-dialog__btn--danger' : 'qf-dialog__btn--primary');
      confirmBtn.textContent = opts.confirmLabel || defaults.confirmLabel;
      footer.appendChild(confirmBtn);

      card.appendChild(footer);
      backdrop.appendChild(card);
      document.body.appendChild(backdrop);

      function finish(result) {
        if (settled) return;
        settled = true;
        activeCleanup = null;
        document.removeEventListener('keydown', onKeyDown, true);
        backdrop.classList.remove('is-open');
        setTimeout(function () {
          if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        }, 150);
        if (prevFocused && typeof prevFocused.focus === 'function' && document.contains(prevFocused)) {
          try { prevFocused.focus(); } catch (e) {}
        }
        resolve(result);
      }

      function cancelResult() {
        if (mode === 'confirm') return false;
        if (mode === 'prompt') return null;
        return undefined;
      }

      function confirmResult() {
        if (mode === 'confirm') return true;
        if (mode === 'prompt') return inputEl ? inputEl.value : '';
        return undefined;
      }

      activeCleanup = function () {
        finish(cancelResult());
      };

      function onKeyDown(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          finish(cancelResult());
          return;
        }
        if (e.key === 'Enter' && mode === 'prompt' && document.activeElement === inputEl) {
          e.preventDefault();
          e.stopPropagation();
          finish(confirmResult());
          return;
        }
        if (e.key === 'Tab') {
          var focusable = getFocusable(card);
          if (!focusable.length) return;
          var first = focusable[0];
          var last = focusable[focusable.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === first || !card.contains(document.activeElement)) {
              e.preventDefault();
              last.focus();
            }
          } else if (document.activeElement === last || !card.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }

      backdrop.addEventListener('mousedown', function (e) {
        if (e.target === backdrop) {
          e.preventDefault();
          finish(cancelResult());
        }
      });

      if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
          finish(cancelResult());
        });
      }

      confirmBtn.addEventListener('click', function () {
        finish(confirmResult());
      });

      document.addEventListener('keydown', onKeyDown, true);

      requestAnimationFrame(function () {
        backdrop.classList.add('is-open');
        if (inputEl) {
          inputEl.focus();
          try { inputEl.select(); } catch (e) {}
        } else if (opts.tone === 'danger' && cancelBtn) {
          cancelBtn.focus();
        } else {
          confirmBtn.focus();
        }
      });
    });
  }

  window.QFDialog = {
    confirm: function (opts) {
      return openDialog('confirm', opts);
    },
    alert: function (opts) {
      return openDialog('alert', opts);
    },
    prompt: function (opts) {
      return openDialog('prompt', opts);
    }
  };
})();
