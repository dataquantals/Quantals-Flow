/* ==========================================================================
   Starter frameworks
   One data-only list shared by the dashboard "Start New Board" gallery and,
   later, the in-app template picker. Each entry describes a workspace the
   user can start from a clean structure.

   Fields:
     id            stable key, also the ?template= / ?module= value
     module        workspace module the app should open
     label         card title
     blurb         one line under the title
     defaultTitle  board name prefilled when the card is picked
     category      dashboard space the board belongs to
     tint / ink    icon chip colours
     icon          stroke SVG (24x24, currentColor) matching the app icon set
   ========================================================================== */
(function () {
  'use strict';

  window.WorkspaceFrameworks = [
    {
      id: 'project-planning',
      module: 'project-planning',
      label: 'Project Planning',
      blurb: 'Gantt, WBS, Kanban, timesheets and RAID in one plan',
      defaultTitle: 'Project Plan',
      category: 'Strategy & Planning',
      tint: '#f1f5f9',
      ink: '#0f172a',
      icon:
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M8 6h10"/><path d="M6 12h9"/><path d="M11 18h7"/></svg>'
    },
    {
      id: 'mindmap',
      module: 'mindmap',
      label: 'Mind Map',
      blurb: 'A central idea with connected branch nodes',
      defaultTitle: 'Mind Map',
      category: 'UX & Discovery',
      tint: '#eef2ff',
      ink: '#4262ff',
      icon:
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/>' +
        '<path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/></svg>'
    },
    {
      id: 'kanban',
      module: 'kanban',
      label: 'Kanban Board',
      blurb: 'To Do, In Progress and Done columns, ready for cards',
      defaultTitle: 'Kanban Board',
      category: 'Engineering & Delivery',
      tint: '#fff7ed',
      ink: '#ea580c',
      icon:
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect width="6" height="14" x="4" y="5" rx="1"/><rect width="6" height="10" x="14" y="5" rx="1"/></svg>'
    },
    {
      id: 'perspective',
      module: 'perspective',
      label: 'Perspective Matrix',
      blurb: 'Strategic vision, objectives, risks and roadmap quadrants',
      defaultTitle: 'Perspective Matrix',
      category: 'Strategy & Planning',
      tint: '#faf5ff',
      ink: '#7c3aed',
      icon:
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/>' +
        '<rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>'
    },
    {
      id: 'brainstorm',
      module: 'brainstorm',
      label: 'Brainstorm',
      blurb: 'A central topic ringed with blank idea notes',
      defaultTitle: 'Brainstorm Session',
      category: 'UX & Discovery',
      tint: '#fef9c3',
      ink: '#ca8a04',
      icon:
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>' +
        '<path d="M9 18h6"/><path d="M10 22h4"/></svg>'
    }
  ];

  window.WorkspaceFrameworks.byId = function (id) {
    for (var i = 0; i < window.WorkspaceFrameworks.length; i++) {
      if (window.WorkspaceFrameworks[i].id === id) return window.WorkspaceFrameworks[i];
    }
    return null;
  };
})();
