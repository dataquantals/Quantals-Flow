/* ==========================================================================
   Modular WBS Tree Diagram Component (wbs-tree-diagram.js)
   Crafted following Apple Design & Emil Kowalski Design Engineering Principles:
   - Root Node: Prominent royal blue capsule with concentric inner white border
   - Connectors: Clean orthogonal stem down, horizontal crossbar, junction dots
   - Pillars: Horizontal Level-1 Category capsules (white with crisp dark outline)
   - Vertical Stacks: Left bracket spine connecting each child deliverable
   - Alternating Tier-2 Capsules: Soft blue/gray vs deep navy blue fills
   - Accessible, high contrast (WCAG AAA), zero AI-clutter, auto-wrapping text
   ========================================================================== */

(function () {
  'use strict';

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Generates the complete HTML string for the WBS Tree Diagram.
   * @param {Object} data - Tree dataset
   * @param {string} data.projectName - Title of root node
   * @param {Array} data.pillars - Array of category/phase pillars:
   *   [{ id, title, wbs, items: [{ id, title, wbs, duration, status, assignee }] }]
   * @param {Object} [options] - Configuration flags
   * @param {boolean} [options.editable=true] - Whether to allow clicks to open task drawer
   * @param {boolean} [options.showQuickAdd=true] - Whether to show "+ Add item" on pillars
   */
  function getHtml(data, options) {
    options = options || {};
    var rootTitle = data.projectName || data.rootTitle || 'Project Plan / WBS Tree';
    var pillars = data.pillars || data.phases || [];
    var totalItems = 0;

    pillars.forEach(function (col) {
      totalItems += (col.items || col.tasks || []).length;
    });

    var html = '<div class="wbs-tree-canvas" id="wbs-tree-canvas">';

    // Visual Tree Hierarchy Stage
    html += '<div class="wbs-tree-stage">';

    // 1. Root Node Capsule
    html +=
      '<div class="wbs-root-wrapper">' +
        '<div class="wbs-root-node" id="wbs-root-node" title="Root: ' + escapeHtml(rootTitle) + '" tabindex="0" role="button" aria-label="Root Project Node">' +
          '<span class="wbs-root-title">' + escapeHtml(rootTitle) + '</span>' +
        '</div>' +
        '<div class="wbs-root-stem"></div>' +
      '</div>';

    // 2. Pillars Row with Top Crossbar
    if (pillars.length > 0) {
      html += '<div class="wbs-pillars-row">';

      // Horizontal crossbar bar connector
      html += '<div class="wbs-crossbar" aria-hidden="true"></div>';

      pillars.forEach(function (pillar, colIdx) {
        var items = pillar.items || pillar.tasks || [];
        var isOdd = (colIdx % 2 === 1);
        var pillarColorClass = isOdd ? 'wbs-col--navy' : 'wbs-col--light';
        var pillarId = pillar.id || pillar.wbs || ('col-' + colIdx);

        html +=
          '<div class="wbs-pillar ' + pillarColorClass + '" data-pillar-idx="' + colIdx + '" data-pillar-id="' + escapeHtml(pillarId) + '">';

        // Top vertical connector stem & junction dot marker
        html +=
          '<div class="wbs-pillar-stem-top" aria-hidden="true"></div>' +
          '<div class="wbs-pillar-junction-dot" aria-hidden="true"></div>';

        // Level-1 Category Header Capsule
        html +=
          '<div class="wbs-pillar-header" data-pillar-header="' + escapeHtml(pillarId) + '" title="Category: ' + escapeHtml(pillar.title) + '">' +
            '<span class="wbs-pillar-title">' + escapeHtml(pillar.title) + '</span>' +
            (options.showDelete === false
              ? ''
              : '<button class="wbs-pillar-delete" data-delete-pillar="' + escapeHtml(pillarId) + '" type="button" title="Delete ' + escapeHtml(pillar.title) + '" aria-label="Delete ' + escapeHtml(pillar.title) + '">' +
                  '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/></svg>' +
                '</button>') +
          '</div>';

        // Pillar Bracket Trunk & Child Task Stack
        html += '<div class="wbs-pillar-stack-wrap">';

        if (items.length > 0) {
          html += '<div class="wbs-pillar-stack">';

          items.forEach(function (task, taskIdx) {
            var taskId = task.id || ('task-' + colIdx + '-' + taskIdx);
            var taskTitle = task.title || ('Deliverable ' + (taskIdx + 1));
            var capsuleClass = isOdd ? 'wbs-capsule--navy' : 'wbs-capsule--light';

            html +=
              '<div class="wbs-task-row" data-task-row="' + escapeHtml(taskId) + '">' +
                '<div class="wbs-branch-arm" aria-hidden="true"></div>' +
                '<div class="wbs-capsule ' + capsuleClass + '" ' +
                     'data-open-task="' + escapeHtml(taskId) + '" ' +
                     'tabindex="0" role="button" ' +
                     'title="' + escapeHtml(taskTitle) + '">' +
                  '<span class="wbs-capsule-text">' + escapeHtml(taskTitle) + '</span>' +
                '</div>' +
              '</div>';
          });

          html += '</div>'; // .wbs-pillar-stack
        }

        // Quick Add Deliverable button at bottom of pillar
        if (options.showQuickAdd !== false) {
          html +=
            '<div class="wbs-pillar-add-row">' +
              '<div class="wbs-branch-arm wbs-branch-arm--add" aria-hidden="true"></div>' +
              '<button class="wbs-btn-add-item" data-add-pillar-item="' + escapeHtml(pillarId) + '" type="button" title="Add item to ' + escapeHtml(pillar.title) + '">' +
                '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M12 5v14M5 12h14"/></svg>' +
                '<span>Add task</span>' +
              '</button>' +
            '</div>';
        }

        html += '</div>'; // .wbs-pillar-stack-wrap
        html += '</div>'; // .wbs-pillar
      });

      html += '</div>'; // .wbs-pillars-row
    }

    html += '</div>'; // .wbs-tree-stage
    html += '</div>'; // .wbs-tree-canvas

    return html;
  }

  /**
   * Mounts or updates the WBS Tree Diagram inside a target DOM container.
   * @param {HTMLElement|string} container - Container element or selector
   * @param {Object} data - Tree dataset
   * @param {Object} [options] - Options & callbacks (onTaskClick, onAddTask, onRootClick)
   */
  function render(container, data, options) {
    var el = (typeof container === 'string') ? document.querySelector(container) : container;
    if (!el) return null;

    options = options || {};
    el.innerHTML = getHtml(data, options);

    // Bind event handlers
    el.querySelectorAll('[data-open-task]').forEach(function (taskEl) {
      taskEl.addEventListener('click', function (e) {
        e.preventDefault();
        var id = taskEl.dataset.openTask;
        if (typeof options.onTaskClick === 'function') {
          options.onTaskClick(id, taskEl);
        } else if (window.ProjectPlanningSuite && typeof window.ProjectPlanningSuite.openTaskDrawer === 'function') {
          window.ProjectPlanningSuite.openTaskDrawer(id);
        }
      });
      taskEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          taskEl.click();
        }
      });
    });

    el.querySelectorAll('[data-add-pillar-item]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var pId = btn.dataset.addPillarItem;
        if (typeof options.onAddTask === 'function') {
          options.onAddTask(pId);
        }
      });
    });

    var rootNode = el.querySelector('#wbs-root-node');
    if (rootNode && typeof options.onRootClick === 'function') {
      rootNode.addEventListener('click', function (e) {
        options.onRootClick(e);
      });
    }

    return el;
  }

  // React-compatible wrapper declaration
  function ReactWbsTreeDiagram(props) {
    props = props || {};
    var ref = { current: null };
    // Returns renderable structure or mounts on ref
    return {
      type: 'div',
      props: {
        className: 'wbs-tree-react-wrapper',
        ref: function (node) {
          ref.current = node;
          if (node && props.data) {
            render(node, props.data, {
              onTaskClick: props.onTaskClick,
              onAddTask: props.onAddTask,
              onRootClick: props.onRootClick
            });
          }
        }
      }
    };
  }

  // Export module globally and for bundlers
  window.WbsTreeDiagram = {
    render: render,
    getHtml: getHtml,
    ReactComponent: ReactWbsTreeDiagram
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.WbsTreeDiagram;
  }
})();
