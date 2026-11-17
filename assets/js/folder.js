/*
 * FOLDER - Tactile 3D Real Folder Component (folder.js)
 *
 * Renders an authentic, physical 3D Manila/Windows folder with:
 *   - Top folder tab (.f3d-tab) with heavy-stroked brown-filled Lucide folder icon + label
 *   - Inner back board & pocket liner (.f3d-back)
 *   - Peeking document sheets (.f3d-sheets / .f3d-sheet) with file titles, thumbnails & extension badges
 *   - Hinged 3D front folder flap (.f3d-cover) with folder title, item count badge & specular sheen
 *   - Soft ground contact shadow (.f3d-ground)
 *   - 3D pointer tilt, click-to-peek/fan sheets, double-click to open folder, and drag-and-drop flap opening
 */
(function (global) {
  'use strict';

  var UID = 0;

  function clamp(n, min, max) {
    var v = Number(n);
    if (!isFinite(v)) return min;
    return Math.min(max, Math.max(min, v));
  }

  /** Compute readable ink color for a given hex background. */
  function readableInk(hex) {
    var m = /^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(String(hex || '').trim());
    if (!m) return '#2B1803';
    var h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16) / 255;
    var g = parseInt(h.slice(2, 4), 16) / 255;
    var b = parseInt(h.slice(4, 6), 16) / 255;
    var lin = function (c) {
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    var L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return L > 0.38 ? '#2B1803' : '#ffffff';
  }

  function normaliseItems(items) {
    if (!Array.isArray(items)) return [];
    return items
      .map(function (item) {
        if (item == null) return null;
        if (typeof item === 'string') return { title: item };
        return {
          title: String(item.title != null ? item.title : item.name || item.fileName || 'Untitled'),
          image: item.image || null,
          ext: item.ext || '',
          meta: item.meta || '',
          raw: item.raw || item,
        };
      })
      .filter(Boolean);
  }

  function makeEl(tag, className, attrs) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        el.setAttribute(key, attrs[key]);
      });
    }
    return el;
  }

  function create(options) {
    var o = Object.assign(
      {
        label: 'Folder',
        items: [],
        mode: 'flap',
        variant: 'solid',
        layout: 'stack',
        color: '#E8A850',
        paperColor: '#ffffff',
        tabPosition: 'left',
        openOn: 'click',
        emptyHint: 'Drop files here',
        size: 1,
        frost: 0.25,
        tilt: 0.5,
        speed: 1,
        bounce: 0.4,
        peek: true,
        intro: true,
        draggable: false,
        zoomOnClick: false,
        theme: 'light',
        open: false,
        delay: 0,
        key: '',
        countLabel: '',
        totalCount: null,
        onItemClick: null,
        onClick: null,
        onOpen: null,
        onClose: null,
      },
      options || {}
    );

    var id = 'f3d-' + ++UID;
    var root = makeEl('div', 'f3d');
    root.dataset.variant = o.variant === 'glass' ? 'glass' : 'solid';
    root.dataset.theme = o.theme === 'dark' ? 'dark' : 'light';
    root.dataset.mode = o.mode === 'book' ? 'book' : 'flap';
    root.dataset.layout = o.layout === 'spread' ? 'spread' : 'stack';
    root.dataset.tab = o.tabPosition === 'right' ? 'right' : 'left';
    root.dataset.peek = o.peek ? 'true' : 'false';
    root.dataset.intro = o.intro ? 'true' : 'false';
    if (o.key) root.dataset.folderKey = String(o.key);

    root.style.setProperty('--f3d-color', o.color);
    root.style.setProperty('--f3d-paper', o.paperColor);
    root.style.setProperty('--f3d-ink', readableInk(o.color));
    root.style.setProperty(
      '--f3d-speed',
      Math.round(clamp(620 / (Number(o.speed) || 1), 180, 1400)) + 'ms'
    );
    root.style.setProperty(
      '--f3d-ease',
      'cubic-bezier(0.22, ' + (1 + clamp(o.bounce, 0, 1) * 0.55).toFixed(2) + ', 0.36, 1)'
    );
    root.style.setProperty('--f3d-blur', Math.round(clamp(o.frost, 0, 1) * 18) + 'px');
    root.style.setProperty('--f3d-delay', Math.round(o.delay) + 'ms');
    var scale = clamp(o.size, 0.6, 2.4);
    root.style.setProperty('--f3d-w', Math.round(220 * scale) + 'px');
    root.style.setProperty('--f3d-h', Math.round(138 * scale) + 'px');

    var scene = makeEl('div', 'f3d-scene');
    var tilt = makeEl('div', 'f3d-tilt');
    var body = makeEl('div', 'f3d-body');
    var back = makeEl('div', 'f3d-back');
    var backTab = makeEl('span', 'f3d-back-tab', { 'aria-hidden': 'true' });
    var tabIcon = makeEl('span', 'f3d-tab-icon', { 'aria-hidden': 'true' });
    // Heavy-stroked Lucide folder icon with rich brown fill
    tabIcon.innerHTML =
      '<svg viewBox="0 0 24 24" fill="#D49B41" stroke="#5C3A08" stroke-width="2.3" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>';
    var tabLabel = makeEl('span', 'f3d-tab-label');
    tabLabel.textContent = o.label;
    backTab.appendChild(tabIcon);
    backTab.appendChild(tabLabel);
    back.appendChild(backTab);

    var empty = makeEl('div', 'f3d-empty', { 'aria-hidden': 'true' });
    empty.textContent = o.emptyHint || 'Drop files here';
    var sheets = makeEl('div', 'f3d-sheets');

    var cover = makeEl('button', 'f3d-cover', {
      type: 'button',
      'aria-expanded': o.open ? 'true' : 'false',
      'aria-label': o.label + ' folder',
    });

    // Front cover top lip tab & embossed details
    var coverCrease = makeEl('span', 'f3d-cover-crease', { 'aria-hidden': 'true' });
    var coverContent = makeEl('div', 'f3d-cover-content');
    var coverTitle = makeEl('span', 'f3d-label');
    coverTitle.textContent = o.label;
    var count = makeEl('span', 'f3d-count');
    var sheen = makeEl('span', 'f3d-sheen');
    var ground = makeEl('span', 'f3d-ground', { 'aria-hidden': 'true' });

    coverContent.appendChild(coverTitle);
    coverContent.appendChild(count);
    cover.appendChild(sheen);
    cover.appendChild(coverCrease);
    cover.appendChild(coverContent);

    body.appendChild(back);
    body.appendChild(empty);
    body.appendChild(sheets);
    body.appendChild(cover);
    tilt.appendChild(body);
    scene.appendChild(tilt);
    scene.appendChild(ground);
    root.appendChild(scene);

    /* ---- papers ------------------------------------------------------ */
    function renderItems(items) {
      var list = normaliseItems(items);
      sheets.textContent = '';
      var visible = list.slice(0, 6);
      // The topmost sheet is the LAST child, so index 0 sits deepest.
      visible.forEach(function (item, index) {
        var sheet = makeEl('button', 'f3d-sheet', { type: 'button' });
        if (item.image) {
          sheet.classList.add('has-image');
          var thumb = makeEl('span', 'f3d-sheet-thumb');
          var img = document.createElement('img');
          img.src = item.image;
          img.alt = '';
          img.loading = 'lazy';
          img.decoding = 'async';
          img.addEventListener('error', function () {
            sheet.classList.remove('has-image');
            if (thumb.parentNode) thumb.parentNode.removeChild(thumb);
          });
          thumb.appendChild(img);
          sheet.appendChild(thumb);
        }
        var title = makeEl('span', 'f3d-sheet-title');
        title.textContent = item.title;
        sheet.appendChild(title);
        sheet.style.setProperty('--i', String(index));
        var ext = item.ext || '';
        if (!ext) {
          var dot = item.title.lastIndexOf('.');
          if (dot > 0 && item.title.length - dot <= 6) ext = item.title.slice(dot + 1).toUpperCase();
        }
        if (ext) sheet.dataset.ext = ext;
        sheet.title = item.title;
        sheet.addEventListener('click', function (event) {
          event.stopPropagation();
          if (typeof o.onItemClick === 'function') o.onItemClick(item.raw || item, index);
        });
        sheets.appendChild(sheet);
        // reverse visual order: first item on top
        sheet.style.zIndex = String(visible.length - index);
      });
      updateCount(o.totalCount != null ? Number(o.totalCount) : list.length);
    }

    function updateCount(n) {
      var total = typeof n === 'number' && isFinite(n) ? n : 0;
      if (o.countLabel) {
        count.textContent = o.countLabel;
      } else {
        count.textContent = total === 1 ? '1 item' : total === 0 ? 'Empty folder' : total + ' items';
      }
      root.dataset.count = total === 0 ? '0' : total > 9 ? '9+' : String(total);
      root.classList.toggle('is-empty', total === 0);
    }

    /* ---- open / close ------------------------------------------------ */
    var open = Boolean(o.open);

    function setOpen(next) {
      var want = Boolean(next);
      if (want === open) return;
      open = want;
      root.classList.toggle('is-open', open);
      cover.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (o.zoomOnClick) {
        tilt.style.transform = open ? 'translateY(-4px) scale(1.03)' : '';
      }
      if (open && typeof o.onOpen === 'function') o.onOpen();
      if (!open && typeof o.onClose === 'function') o.onClose();
    }

    root.classList.toggle('is-open', open);

    if (o.openOn === 'hover') {
      root.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'touch') return;
        setOpen(true);
      });
      root.addEventListener('pointerleave', function () {
        setOpen(false);
      });
    }

    cover.addEventListener('click', function (event) {
      if (typeof o.onClick === 'function') {
        event.stopPropagation();
        o.onClick(event);
        return;
      }
      if (o.openOn === 'hover') {
        return;
      }
      event.stopPropagation();
      setOpen(!open);
    });
    cover.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (typeof o.onClick === 'function') {
          o.onClick(event);
          return;
        }
        setOpen(!open);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    });

    /* ---- pointer tilt ------------------------------------------------ */
    var tiltAmount = clamp(o.tilt, 0, 1);
    if (tiltAmount > 0) {
      var raf = 0;
      scene.addEventListener('pointermove', function (event) {
        if (event.pointerType === 'touch') return;
        if (raf) return;
        var box = scene.getBoundingClientRect();
        var px = (event.clientX - box.left) / box.width - 0.5;
        var py = (event.clientY - box.top) / box.height - 0.5;
        raf = window.requestAnimationFrame(function () {
          raf = 0;
          tilt.style.transform =
            'rotateY(' + (px * tiltAmount * 14).toFixed(2) + 'deg) rotateX(' +
            (-py * tiltAmount * 10).toFixed(2) + 'deg)';
        });
      });
      scene.addEventListener('pointerleave', function () {
        if (raf) {
          window.cancelAnimationFrame(raf);
          raf = 0;
        }
        tilt.style.transform = '';
      });
    }

    /* ---- dragging the folder itself ---------------------------------- */
    if (o.draggable) {
      cover.draggable = true;
      cover.addEventListener('dragstart', function (event) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', o.label);
        if (o.key) event.dataTransfer.setData('application/x-folder', String(o.key));
      });
    }

    if (o.intro) {
      var index = document.querySelectorAll('.f3d').length;
      root.style.setProperty('--f3d-delay', Math.min(index * 55, 330) + 'ms');
    }

    renderItems(o.items);

    root.open = function () {
      setOpen(true);
    };
    root.close = function () {
      setOpen(false);
    };
    root.toggle = function () {
      setOpen(!open);
    };
    root.setItems = function (items) {
      o.items = items || [];
      renderItems(o.items);
    };
    root.setLabel = function (text) {
      o.label = String(text || 'Folder');
      coverTitle.textContent = o.label;
      tabLabel.textContent = o.label;
      cover.setAttribute('aria-label', o.label + ' folder');
    };
    root.setCount = updateCount;
    root.isOpen = function () {
      return open;
    };
    root.folderId = id;
    root.options = o;

    return root;
  }

  global.FolderUI = { create: create, mount: create, readableInk: readableInk };
})(window);
