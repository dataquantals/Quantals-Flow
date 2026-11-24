/* ==========================================================================
   Starter Frameworks & Service-Specific Suggested Templates
   Shared by the Dashboard sidebar ("Workspaces & Pages") and the "New Board"
   creation modal. Clicking any workspace service (Project Planning, Mind Map,
   Kanban Board, Perspective Matrix, Brainstorm Canvas) opens the project
   setup dialog tailored to that service and suggests curated templates.
   ========================================================================== */
(function () {
  'use strict';

  window.WorkspaceFrameworks = [
    {
      id: 'whiteboard',
      module: 'whiteboard',
      label: 'Whiteboarding',
      badge: 'VISUAL OS',
      badgeBg: '#eef2ff',
      badgeColor: '#4f46e5',
      blurb: 'Infinite smart canvas with layers, AI assistant, doc/slide generation, workflows & dashboards',
      defaultTitle: 'Visual Strategy Workspace',
      category: 'Strategy & Planning',
      tint: '#eef2ff',
      ink: '#4f46e5',
      heading: 'Create Whiteboarding Visual Workspace',
      subtitle: 'Launch an AI-assisted infinite canvas combining visual thinking, tasks, decisions, process maps, and dashboards.',
      namePlaceholder: 'e.g. Q4 Visual Strategy & Execution Hub',
      descPlaceholder: 'Workshop goal, team scope, or key decisions…',
      submitLabel: 'Open Whiteboarding \u2192',
      icon:
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 9h4m-4 4h10"/></svg>',
      templates: [
        {
          id: 'wb-strategy-hub',
          label: 'Visual Strategy & Execution Hub',
          tag: 'Recommended',
          defaultTitle: 'Visual Strategy Workspace',
          blurb: 'Smart stickies, KPI cards, decision cards, knowledge graph links, and live dashboard sync.',
          structure: 'Smart Stickies \u2022 KPIs \u2022 Decisions',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#f8faff 0%,#eef2ff 100%);">' +
            '<rect x="14" y="14" width="46" height="36" rx="6" fill="#fef08a" stroke="#eab308" stroke-width="1.2"/>' +
            '<rect x="74" y="12" width="52" height="44" rx="6" fill="#fff" stroke="#4f46e5" stroke-width="1.4"/>' +
            '<rect x="140" y="16" width="46" height="36" rx="6" fill="#dcfce7" stroke="#16a34a" stroke-width="1.2"/>' +
            '<path d="M60 32 H74 M126 32 H140" stroke="#6366f1" stroke-width="1.6" stroke-dasharray="3 2"/>' +
            '</svg>'
        },
        {
          id: 'wb-process-bpmn',
          label: 'Business Process & BPMN Swimlanes',
          tag: 'Workflows',
          defaultTitle: 'Operations Process Map',
          blurb: 'Swimlanes, decision diamonds, automated workflow validation, and SOP document export.',
          structure: 'Swimlanes \u2022 BPMN \u2022 Validation',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#f0fdf4 0%,#ecfeff 100%);">' +
            '<rect x="14" y="24" width="38" height="24" rx="5" fill="#fff" stroke="#0d9488" stroke-width="1.4"/>' +
            '<polygon points="94,16 116,36 94,56 72,36" fill="#fff" stroke="#f59e0b" stroke-width="1.4"/>' +
            '<rect x="140" y="24" width="44" height="24" rx="5" fill="#0d9488"/>' +
            '<path d="M52 36 H72 M116 36 H140" stroke="#0f766e" stroke-width="1.6"/>' +
            '</svg>'
        },
        {
          id: 'wb-org-twin',
          label: 'Organisational Map & Visual Database',
          tag: 'Enterprise',
          defaultTitle: 'Company Operating Map',
          blurb: 'Company to Department to Project hierarchy with Table, Kanban, Timeline & Dashboard views.',
          structure: 'Org Levels \u2022 Multi-View DB',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#eff6ff 0%,#f8fafc 100%);">' +
            '<rect x="74" y="10" width="52" height="18" rx="4" fill="#1e293b"/>' +
            '<rect x="20" y="44" width="44" height="18" rx="4" fill="#2563eb"/>' +
            '<rect x="78" y="44" width="44" height="18" rx="4" fill="#0ea5e9"/>' +
            '<rect x="136" y="44" width="44" height="18" rx="4" fill="#10b981"/>' +
            '<path d="M100 28 V36 M42 36 H158 M42 36 V44 M100 36 V44 M158 36 V44" stroke="#64748b" stroke-width="1.4"/>' +
            '</svg>'
        }
      ]
    },
    {
      id: 'project-planning',
      module: 'project-planning',
      label: 'Project Planning',
      badge: 'WBS',
      badgeBg: '#ecfdf5',
      badgeColor: '#059669',
      blurb: 'Gantt, WBS, Kanban, timesheets and RAID in one plan',
      defaultTitle: 'Q4 Product & WBS Plan',
      category: 'Strategy & Planning',
      tint: '#ecfdf5',
      ink: '#059669',
      heading: 'Create Project Planning Workspace',
      subtitle: 'Enter your project details and choose a suggested Project Planning & WBS template to get started.',
      namePlaceholder: 'e.g. Q4 Enterprise Launch & WBS Plan',
      descPlaceholder: 'Key deliverables, target launch window, or executive sponsors…',
      submitLabel: 'Create Project Plan \u2192',
      icon:
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M3 9h18M8 2.5V6M16 2.5V6M7.5 13h5M7.5 17h9"/></svg>',
      templates: [
        {
          id: 'pp-wbs-roadmap',
          label: 'WBS & Milestone Roadmap',
          tag: 'Recommended',
          defaultTitle: 'Q4 Product & WBS Plan',
          blurb: 'Multi-phase Work Breakdown Structure (1.0–4.0), interactive Gantt timeline, and key milestones.',
          structure: '4 WBS Phases \u2022 8 Tasks \u2022 4 Milestones',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%);">' +
            '<rect x="14" y="10" width="36" height="11" rx="3" fill="#2563eb"/>' +
            '<rect x="56" y="10" width="46" height="11" rx="3" fill="#94a3b8"/>' +
            '<rect x="108" y="10" width="40" height="11" rx="3" fill="#94a3b8"/>' +
            '<polygon points="172,10 177,15.5 172,21 167,15.5" fill="#0f172a"/>' +
            '<path d="M14 30 h172 M14 50 h172" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 3"/>' +
            '<rect x="20" y="26" width="48" height="8" rx="2" fill="#3b82f6"/>' +
            '<rect x="74" y="36" width="56" height="8" rx="2" fill="#10b981"/>' +
            '<rect x="136" y="46" width="42" height="8" rx="2" fill="#f59e0b"/>' +
            '<path d="M68 30 h6 v6" stroke="#94a3b8" stroke-width="1.2" fill="none"/>' +
            '<path d="M130 40 h6 v6" stroke="#94a3b8" stroke-width="1.2" fill="none"/>' +
            '</svg>'
        },
        {
          id: 'pp-agile-release',
          label: 'Agile Release & Sprint Plan',
          tag: 'Agile Delivery',
          defaultTitle: 'Agile Sprint & Release Plan',
          blurb: 'Sprint backlog, story point velocity, resource capacity allocation, and RAID risk log.',
          structure: '3 Sprints \u2022 Capacity & RAID Log',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#eff6ff 0%,#e0e7ff 100%);">' +
            '<rect x="14" y="12" width="52" height="50" rx="5" fill="#fff" stroke="#bfdbfe" stroke-width="1.2"/>' +
            '<rect x="74" y="12" width="52" height="50" rx="5" fill="#fff" stroke="#bfdbfe" stroke-width="1.2"/>' +
            '<rect x="134" y="12" width="52" height="50" rx="5" fill="#fff" stroke="#bfdbfe" stroke-width="1.2"/>' +
            '<rect x="20" y="18" width="40" height="7" rx="2" fill="#2563eb"/>' +
            '<rect x="80" y="18" width="40" height="7" rx="2" fill="#4f46e5"/>' +
            '<rect x="140" y="18" width="40" height="7" rx="2" fill="#10b981"/>' +
            '<rect x="20" y="29" width="34" height="6" rx="2" fill="#dbeafe"/>' +
            '<rect x="20" y="38" width="38" height="6" rx="2" fill="#dbeafe"/>' +
            '<rect x="80" y="29" width="38" height="6" rx="2" fill="#c7d2fe"/>' +
            '<rect x="140" y="29" width="36" height="6" rx="2" fill="#d1fae5"/>' +
            '<rect x="140" y="38" width="32" height="6" rx="2" fill="#d1fae5"/>' +
            '</svg>'
        },
        {
          id: 'pp-engineering-rollout',
          label: 'Engineering & System Rollout',
          tag: 'Technical',
          defaultTitle: 'Platform Architecture Rollout',
          blurb: 'Architecture specification, implementation packages, QA sign-off, and change control pipeline.',
          structure: 'Architecture \u2022 Dev \u2022 Security QA',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);">' +
            '<path d="M48 37 H64 M104 37 H120 M160 37 H174" stroke="#059669" stroke-width="2" stroke-linecap="round"/>' +
            '<rect x="14" y="25" width="34" height="24" rx="4" fill="#fff" stroke="#059669" stroke-width="1.5"/>' +
            '<text x="31" y="39" text-anchor="middle" fill="#059669" font-size="7" font-weight="700" font-family="sans-serif">RFC</text>' +
            '<rect x="64" y="25" width="40" height="24" rx="4" fill="#059669"/>' +
            '<text x="84" y="39" text-anchor="middle" fill="#fff" font-size="7" font-weight="700" font-family="sans-serif">BUILD</text>' +
            '<rect x="120" y="25" width="40" height="24" rx="4" fill="#fff" stroke="#059669" stroke-width="1.5"/>' +
            '<text x="140" y="39" text-anchor="middle" fill="#059669" font-size="7" font-weight="700" font-family="sans-serif">TEST</text>' +
            '<polygon points="184,25 194,37 184,49 174,37" fill="#10b981"/>' +
            '</svg>'
        },
        {
          id: 'pp-blank',
          label: 'Blank Project Plan',
          tag: 'Clean Slate',
          defaultTitle: 'New Project Plan',
          blurb: 'Start with an empty Project Planning & WBS workspace and build phases from scratch.',
          structure: 'Empty WBS, Gantt & Kanban',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:#f8fafc;">' +
            '<rect x="16" y="14" width="168" height="46" rx="6" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4 4" fill="#ffffff"/>' +
            '<path d="M100 28 v18 M91 37 h18" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>' +
            '<text x="100" y="54" text-anchor="middle" fill="#94a3b8" font-size="7.5" font-weight="600" font-family="sans-serif">Empty Workspace</text>' +
            '</svg>'
        }
      ]
    },
    {
      id: 'mindmap',
      module: 'mindmap',
      label: 'Mind Map',
      badge: 'Ideas',
      badgeBg: '#fef3c7',
      badgeColor: '#d97706',
      blurb: 'A central idea with connected branch nodes',
      defaultTitle: 'Concept & Idea Mind Map',
      category: 'UX & Discovery',
      tint: '#eef2ff',
      ink: '#4262ff',
      heading: 'Create Mind Map Workspace',
      subtitle: 'Enter the details for your Mind Map and choose a suggested Mind Map template to get started.',
      namePlaceholder: 'e.g. Product Strategy & Feature Mind Map',
      descPlaceholder: 'Central thesis, core question, or key themes to branch out…',
      submitLabel: 'Create Mind Map \u2192',
      icon:
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/>' +
        '<path d="m9.5 10.5-3-3m5 4.5 3-3m-5 3-3 3m5-3 3 3"/></svg>',
      templates: [
        {
          id: 'mm-concept',
          label: 'Central Idea & Topic Map',
          tag: 'Recommended',
          defaultTitle: 'Concept & Idea Mind Map',
          blurb: 'A central core idea node connected to 4 color-coded primary topic branches and sub-ideas.',
          structure: 'Central Hub \u2022 4 Primary Branches \u2022 Sub-nodes',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#eef2ff 0%,#e0e7ff 100%);">' +
            '<path d="M76 37 C54 37, 50 18, 38 18 M76 37 C54 37, 50 56, 38 56 M124 37 C146 37, 150 18, 162 18 M124 37 C146 37, 150 56, 162 56" stroke="#4262ff" stroke-width="2" stroke-linecap="round"/>' +
            '<path d="M12 18 H6 M12 56 H6 M188 18 H194 M188 56 H194" stroke="#94a3b8" stroke-width="1.2" stroke-linecap="round"/>' +
            '<rect x="74" y="26" width="52" height="22" rx="11" fill="#4262ff"/>' +
            '<text x="100" y="40" text-anchor="middle" fill="#fff" font-size="7.5" font-weight="700" font-family="sans-serif">Main Idea</text>' +
            '<rect x="12" y="10" width="32" height="16" rx="5" fill="#fff" stroke="#f59e0b" stroke-width="1.5"/>' +
            '<text x="28" y="21" text-anchor="middle" fill="#d97706" font-size="7" font-weight="700" font-family="sans-serif">Topic 1</text>' +
            '<rect x="12" y="48" width="32" height="16" rx="5" fill="#fff" stroke="#10b981" stroke-width="1.5"/>' +
            '<text x="28" y="59" text-anchor="middle" fill="#059669" font-size="7" font-weight="700" font-family="sans-serif">Topic 2</text>' +
            '<rect x="156" y="10" width="32" height="16" rx="5" fill="#fff" stroke="#8b5cf6" stroke-width="1.5"/>' +
            '<text x="172" y="21" text-anchor="middle" fill="#7c3aed" font-size="7" font-weight="700" font-family="sans-serif">Topic 3</text>' +
            '<rect x="156" y="48" width="32" height="16" rx="5" fill="#fff" stroke="#f97316" stroke-width="1.5"/>' +
            '<text x="172" y="59" text-anchor="middle" fill="#ea580c" font-size="7" font-weight="700" font-family="sans-serif">Topic 4</text>' +
            '</svg>'
        },
        {
          id: 'mm-architecture',
          label: 'Product & System Architecture Map',
          tag: 'Engineering & UX',
          defaultTitle: 'Product Architecture Mind Map',
          blurb: 'Map out Frontend UX, API Services, Data Models, and Auth/Security dependencies around your product core.',
          structure: 'System Core \u2022 Frontend, API, Data & Security',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);">' +
            '<path d="M100 22 V30 M32 30 H168 M32 30 V37 M77 30 V37 M123 30 V37 M168 30 V37" stroke="#059669" stroke-width="1.5" stroke-linecap="round"/>' +
            '<path d="M32 51 V58 M77 51 V58 M123 51 V58 M168 51 V58" stroke="#86efac" stroke-width="1.3"/>' +
            '<rect x="72" y="6" width="56" height="16" rx="4" fill="#059669"/>' +
            '<text x="100" y="17" text-anchor="middle" fill="#fff" font-size="7" font-weight="700" font-family="sans-serif">System Core</text>' +
            '<rect x="14" y="37" width="36" height="14" rx="3" fill="#fff" stroke="#2563eb" stroke-width="1.4"/>' +
            '<text x="32" y="47" text-anchor="middle" fill="#2563eb" font-size="6.5" font-weight="700" font-family="sans-serif">Frontend</text>' +
            '<rect x="59" y="37" width="36" height="14" rx="3" fill="#fff" stroke="#059669" stroke-width="1.4"/>' +
            '<text x="77" y="47" text-anchor="middle" fill="#059669" font-size="6.5" font-weight="700" font-family="sans-serif">API</text>' +
            '<rect x="105" y="37" width="36" height="14" rx="3" fill="#fff" stroke="#7c3aed" stroke-width="1.4"/>' +
            '<text x="123" y="47" text-anchor="middle" fill="#7c3aed" font-size="6.5" font-weight="700" font-family="sans-serif">Data</text>' +
            '<rect x="150" y="37" width="36" height="14" rx="3" fill="#fff" stroke="#ea580c" stroke-width="1.4"/>' +
            '<text x="168" y="47" text-anchor="middle" fill="#ea580c" font-size="6.5" font-weight="700" font-family="sans-serif">Security</text>' +
            '<rect x="20" y="58" width="24" height="9" rx="2" fill="#dbeafe"/>' +
            '<rect x="65" y="58" width="24" height="9" rx="2" fill="#d1fae5"/>' +
            '<rect x="111" y="58" width="24" height="9" rx="2" fill="#ede9fe"/>' +
            '<rect x="156" y="58" width="24" height="9" rx="2" fill="#ffedd5"/>' +
            '</svg>'
        },
        {
          id: 'mm-research',
          label: 'User Research & Synthesis Map',
          tag: 'Discovery',
          defaultTitle: 'User Research Synthesis Map',
          blurb: 'Organize customer interview insights, pain points, user personas, and feature opportunities.',
          structure: 'Research Hub \u2022 Personas, Pain Points & Insights',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#faf5ff 0%,#f3e8ff 100%);">' +
            '<path d="M54 37 C64 37, 64 16, 76 16 M54 37 H76 M54 37 C64 37, 64 58, 76 58" stroke="#7c3aed" stroke-width="1.6" stroke-linecap="round"/>' +
            '<path d="M122 16 H140 M122 37 H140 M122 58 H140" stroke="#c4b5fd" stroke-width="1.4" stroke-linecap="round"/>' +
            '<rect x="10" y="26" width="44" height="22" rx="11" fill="#7c3aed"/>' +
            '<text x="32" y="40" text-anchor="middle" fill="#fff" font-size="7" font-weight="700" font-family="sans-serif">Research</text>' +
            '<rect x="76" y="8" width="46" height="15" rx="4" fill="#fff" stroke="#2563eb" stroke-width="1.4"/>' +
            '<text x="99" y="18" text-anchor="middle" fill="#2563eb" font-size="6.5" font-weight="700" font-family="sans-serif">Personas</text>' +
            '<rect x="76" y="29.5" width="46" height="15" rx="4" fill="#fff" stroke="#db2777" stroke-width="1.4"/>' +
            '<text x="99" y="39.5" text-anchor="middle" fill="#db2777" font-size="6.5" font-weight="700" font-family="sans-serif">Pain Points</text>' +
            '<rect x="76" y="51" width="46" height="15" rx="4" fill="#fff" stroke="#059669" stroke-width="1.4"/>' +
            '<text x="99" y="61" text-anchor="middle" fill="#059669" font-size="6.5" font-weight="700" font-family="sans-serif">Insights</text>' +
            '<rect x="140" y="10" width="48" height="11" rx="3" fill="#dbeafe"/>' +
            '<rect x="140" y="31.5" width="48" height="11" rx="3" fill="#fce7f3"/>' +
            '<rect x="140" y="53" width="48" height="11" rx="3" fill="#d1fae5"/>' +
            '</svg>'
        },
        {
          id: 'mm-gtm',
          label: 'Go-To-Market & Growth Strategy Map',
          tag: 'Strategy',
          defaultTitle: 'Go-To-Market Strategy Mind Map',
          blurb: 'Branch out target audience segments, positioning pillars, acquisition channels, and launch KPIs.',
          structure: 'GTM Core \u2022 Audience, Channels, Messaging & KPIs',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%);">' +
            '<circle cx="100" cy="37" r="26" stroke="#fed7aa" stroke-width="1.2" stroke-dasharray="3 3"/>' +
            '<path d="M100 22 V14 M100 52 V60 M82 29 L42 18 M82 45 L42 56 M118 29 L158 18 M118 45 L158 56" stroke="#ea580c" stroke-width="1.5" stroke-linecap="round"/>' +
            '<circle cx="100" cy="37" r="16" fill="#ea580c"/>' +
            '<text x="100" y="39.5" text-anchor="middle" fill="#fff" font-size="7" font-weight="700" font-family="sans-serif">GTM</text>' +
            '<rect x="78" y="4" width="44" height="11" rx="5.5" fill="#fff" stroke="#f59e0b" stroke-width="1.2"/>' +
            '<text x="100" y="12" text-anchor="middle" fill="#d97706" font-size="6" font-weight="700" font-family="sans-serif">Positioning</text>' +
            '<rect x="78" y="59" width="44" height="11" rx="5.5" fill="#fff" stroke="#059669" stroke-width="1.2"/>' +
            '<text x="100" y="67" text-anchor="middle" fill="#059669" font-size="6" font-weight="700" font-family="sans-serif">Pricing</text>' +
            '<rect x="10" y="10" width="36" height="13" rx="6.5" fill="#fff" stroke="#2563eb" stroke-width="1.2"/>' +
            '<text x="28" y="19" text-anchor="middle" fill="#2563eb" font-size="6" font-weight="700" font-family="sans-serif">Audience</text>' +
            '<rect x="10" y="51" width="36" height="13" rx="6.5" fill="#fff" stroke="#7c3aed" stroke-width="1.2"/>' +
            '<text x="28" y="60" text-anchor="middle" fill="#7c3aed" font-size="6" font-weight="700" font-family="sans-serif">Messaging</text>' +
            '<rect x="154" y="10" width="36" height="13" rx="6.5" fill="#fff" stroke="#059669" stroke-width="1.2"/>' +
            '<text x="172" y="19" text-anchor="middle" fill="#059669" font-size="6" font-weight="700" font-family="sans-serif">Channels</text>' +
            '<rect x="154" y="51" width="36" height="13" rx="6.5" fill="#fff" stroke="#ea580c" stroke-width="1.2"/>' +
            '<text x="172" y="60" text-anchor="middle" fill="#ea580c" font-size="6" font-weight="700" font-family="sans-serif">Metrics</text>' +
            '</svg>'
        }
      ]
    },
    {
      id: 'kanban',
      module: 'kanban',
      label: 'Kanban Board',
      badge: 'Agile',
      badgeBg: '#eff6ff',
      badgeColor: '#2563eb',
      blurb: 'To Do, In Progress and Done columns, ready for cards',
      defaultTitle: 'Agile Sprint Kanban',
      category: 'Engineering & Delivery',
      tint: '#fff7ed',
      ink: '#ea580c',
      heading: 'Create Kanban Board Workspace',
      subtitle: 'Enter the details for your Kanban Board and choose a suggested Agile workflow template.',
      namePlaceholder: 'e.g. Sprint 24 Engineering Kanban',
      descPlaceholder: 'Sprint goal, team workflow rules, or delivery focus…',
      submitLabel: 'Create Kanban Board \u2192',
      icon:
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/></svg>',
      templates: [
        {
          id: 'kb-sprint',
          label: 'Agile Sprint Delivery Board',
          tag: 'Recommended',
          defaultTitle: 'Agile Sprint Kanban',
          blurb: 'Classic Backlog, To Do, In Progress, and Done columns structured for agile sprint execution.',
          structure: '4 Columns \u2022 Backlog, To Do, In Progress, Done',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%);">' +
            '<rect x="10" y="10" width="41" height="54" rx="4" fill="#fff" stroke="#fdba74" stroke-width="1.2"/>' +
            '<rect x="56" y="10" width="41" height="54" rx="4" fill="#fff" stroke="#fcd34d" stroke-width="1.2"/>' +
            '<rect x="102" y="10" width="41" height="54" rx="4" fill="#fff" stroke="#93c5fd" stroke-width="1.2"/>' +
            '<rect x="148" y="10" width="41" height="54" rx="4" fill="#fff" stroke="#6ee7b7" stroke-width="1.2"/>' +
            '<rect x="14" y="16" width="33" height="10" rx="2" fill="#fed7aa"/>' +
            '<rect x="14" y="30" width="33" height="10" rx="2" fill="#fed7aa"/>' +
            '<rect x="60" y="16" width="33" height="10" rx="2" fill="#fef08a"/>' +
            '<rect x="106" y="16" width="33" height="10" rx="2" fill="#bfdbfe"/>' +
            '<rect x="106" y="30" width="33" height="10" rx="2" fill="#bfdbfe"/>' +
            '<rect x="152" y="16" width="33" height="10" rx="2" fill="#a7f3d0"/>' +
            '</svg>'
        },
        {
          id: 'kb-bug-triage',
          label: 'Bug Triage & QA Pipeline',
          tag: 'Quality & Eng',
          defaultTitle: 'Bug Triage & QA Board',
          blurb: 'Track incoming defects through Reported, Investigating, Fixing, and Verified QA stages.',
          structure: '4 Columns \u2022 Triage, Active Fix, QA & Verified',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#fdf2f8 0%,#fce7f3 100%);">' +
            '<rect x="10" y="8" width="180" height="27" rx="4" fill="#fff" stroke="#f472b6" stroke-width="1.2"/>' +
            '<rect x="10" y="39" width="180" height="27" rx="4" fill="#fff" stroke="#cbd5e1" stroke-width="1.2"/>' +
            '<text x="16" y="24" fill="#db2777" font-size="6.5" font-weight="700" font-family="sans-serif">P0</text>' +
            '<text x="16" y="55" fill="#475569" font-size="6.5" font-weight="700" font-family="sans-serif">P1</text>' +
            '<line x1="34" y1="8" x2="34" y2="66" stroke="#e2e8f0" stroke-width="1"/>' +
            '<line x1="88" y1="8" x2="88" y2="66" stroke="#e2e8f0" stroke-width="1"/>' +
            '<line x1="140" y1="8" x2="140" y2="66" stroke="#e2e8f0" stroke-width="1"/>' +
            '<rect x="40" y="13" width="42" height="16" rx="3" fill="#fbcfe8"/><circle cx="48" cy="21" r="2.5" fill="#db2777"/>' +
            '<rect x="94" y="13" width="40" height="16" rx="3" fill="#fed7aa"/>' +
            '<rect x="146" y="13" width="38" height="16" rx="3" fill="#a7f3d0"/>' +
            '<rect x="40" y="44" width="42" height="16" rx="3" fill="#dbeafe"/>' +
            '<rect x="146" y="44" width="38" height="16" rx="3" fill="#d1fae5"/>' +
            '</svg>'
        },
        {
          id: 'kb-launch',
          label: 'Product Launch Readiness Board',
          tag: 'Cross-Functional',
          defaultTitle: 'Product Launch Kanban',
          blurb: 'Coordinate Product, Design, Engineering, and Marketing deliverables leading up to launch day.',
          structure: 'Planning \u2022 In Review \u2022 Ready for Launch',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#f5f3ff 0%,#ede9fe 100%);">' +
            '<rect x="14" y="10" width="172" height="14" rx="4" fill="#fff" stroke="#c4b5fd" stroke-width="1.2"/>' +
            '<rect x="20" y="15" width="90" height="4" rx="2" fill="#e2e8f0"/><rect x="20" y="15" width="64" height="4" rx="2" fill="#7c3aed"/>' +
            '<text x="176" y="19.5" text-anchor="end" fill="#7c3aed" font-size="6.5" font-weight="700" font-family="sans-serif">72%</text>' +
            '<rect x="14" y="30" width="52" height="34" rx="4" fill="#fff" stroke="#c4b5fd" stroke-width="1.2"/>' +
            '<rect x="74" y="30" width="52" height="34" rx="4" fill="#fff" stroke="#a78bfa" stroke-width="1.2"/>' +
            '<rect x="134" y="30" width="52" height="34" rx="4" fill="#8b5cf6"/>' +
            '<path d="M22 40 h30 M22 48 h22 M82 40 h30 M82 48 h24" stroke="#a78bfa" stroke-width="2" stroke-linecap="round"/>' +
            '<path d="M150 47 l5 5 l11 -11" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
            '</svg>'
        },
        {
          id: 'kb-discovery',
          label: 'Continuous Discovery & Experiments',
          tag: 'Product UX',
          defaultTitle: 'Discovery Experiments Board',
          blurb: 'Move product hypotheses from Idea Intake to Prototyping, User Testing, and Validated.',
          structure: 'Hypotheses \u2022 Prototyping \u2022 Testing \u2022 Validated',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);">' +
            '<polygon points="12,10 54,14 54,60 12,64" fill="#d1fae5" stroke="#10b981" stroke-width="1.2"/>' +
            '<polygon points="60,14 102,19 102,55 60,60" fill="#dbeafe" stroke="#3b82f6" stroke-width="1.2"/>' +
            '<polygon points="108,19 150,24 150,50 108,55" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.2"/>' +
            '<rect x="156" y="24" width="32" height="26" rx="5" fill="#059669"/>' +
            '<path d="M165 37 l4 4 l9 -9" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
            '</svg>'
        }
      ]
    },
    {
      id: 'perspective',
      module: 'perspective',
      label: 'Perspective Matrix',
      badge: 'Matrix',
      badgeBg: '#faf5ff',
      badgeColor: '#7c3aed',
      blurb: 'Strategic vision, objectives, risks and roadmap quadrants',
      defaultTitle: 'Strategic Vision & OKR Matrix',
      category: 'Strategy & Planning',
      tint: '#faf5ff',
      ink: '#7c3aed',
      heading: 'Create Perspective Matrix Workspace',
      subtitle: 'Enter the details for your Perspective Matrix and choose a suggested strategic quadrant template.',
      namePlaceholder: 'e.g. 2026 Product Vision & Risk Matrix',
      descPlaceholder: 'Strategic horizon, key stakeholders, or decision criteria…',
      submitLabel: 'Create Perspective Matrix \u2192',
      icon:
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
      templates: [
        {
          id: 'ps-okr',
          label: 'Strategic Vision & OKR Matrix',
          tag: 'Recommended',
          defaultTitle: 'Strategic Vision & OKR Matrix',
          blurb: 'Four strategic quadrants: Vision & Scope, Key Objectives & OKRs, Critical Risks, and Roadmap.',
          structure: '2\u00d72 Quadrants \u2022 Vision, OKRs, Risks & Roadmap',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#faf5ff 0%,#f3e8ff 100%);">' +
            '<rect x="14" y="8" width="80" height="26" rx="4" fill="#fff" stroke="#c4b5fd" stroke-width="1.2"/>' +
            '<rect x="106" y="8" width="80" height="26" rx="4" fill="#fff" stroke="#c4b5fd" stroke-width="1.2"/>' +
            '<rect x="14" y="40" width="80" height="26" rx="4" fill="#fff" stroke="#c4b5fd" stroke-width="1.2"/>' +
            '<rect x="106" y="40" width="80" height="26" rx="4" fill="#fff" stroke="#c4b5fd" stroke-width="1.2"/>' +
            '<text x="22" y="18" fill="#7c3aed" font-size="6" font-weight="700">VISION</text>' +
            '<rect x="22" y="21" width="30" height="8" rx="2" fill="#dbeafe"/>' +
            '<text x="114" y="18" fill="#7c3aed" font-size="6" font-weight="700">OKRS</text>' +
            '<rect x="114" y="21" width="30" height="8" rx="2" fill="#d1fae5"/>' +
            '<text x="22" y="50" fill="#7c3aed" font-size="6" font-weight="700">RISKS</text>' +
            '<rect x="22" y="53" width="30" height="8" rx="2" fill="#fee2e2"/>' +
            '<text x="114" y="50" fill="#7c3aed" font-size="6" font-weight="700">ROADMAP</text>' +
            '<rect x="114" y="53" width="30" height="8" rx="2" fill="#fef3c7"/>' +
            '</svg>'
        },
        {
          id: 'ps-swot',
          label: 'SWOT Strategic Analysis',
          tag: 'Competitive',
          defaultTitle: 'SWOT Strategic Matrix',
          blurb: 'Evaluate internal Strengths & Weaknesses alongside external Opportunities & Threats.',
          structure: '2\u00d72 Quadrants \u2022 Strengths, Weaknesses, Opps, Threats',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#fdf2f8 0%,#fce7f3 100%);">' +
            '<rect x="16" y="8" width="78" height="26" rx="4" fill="#d1fae5" stroke="#10b981" stroke-width="1.2"/>' +
            '<rect x="106" y="8" width="78" height="26" rx="4" fill="#ffedd5" stroke="#f97316" stroke-width="1.2"/>' +
            '<rect x="16" y="40" width="78" height="26" rx="4" fill="#dbeafe" stroke="#3b82f6" stroke-width="1.2"/>' +
            '<rect x="106" y="40" width="78" height="26" rx="4" fill="#fce7f3" stroke="#ec4899" stroke-width="1.2"/>' +
            '<text x="55" y="24" text-anchor="middle" fill="#059669" font-size="7.5" font-weight="700">STRENGTHS</text>' +
            '<text x="145" y="24" text-anchor="middle" fill="#ea580c" font-size="7.5" font-weight="700">WEAKNESSES</text>' +
            '<text x="55" y="56" text-anchor="middle" fill="#2563eb" font-size="7.5" font-weight="700">OPPORTUNITIES</text>' +
            '<text x="145" y="56" text-anchor="middle" fill="#db2777" font-size="7.5" font-weight="700">THREATS</text>' +
            '</svg>'
        },
        {
          id: 'ps-impact-effort',
          label: 'Impact vs. Effort Prioritization',
          tag: 'Prioritization',
          defaultTitle: 'Impact vs. Effort Matrix',
          blurb: 'Prioritize initiatives into Quick Wins, Major Bets, Incremental Fill-Ins, and Low-Value items.',
          structure: '2\u00d72 Quadrants \u2022 Quick Wins, Major Bets & Tradeoffs',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:#f8fafc;">' +
            '<line x1="22" y1="62" x2="184" y2="62" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>' +
            '<line x1="22" y1="10" x2="22" y2="62" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>' +
            '<line x1="22" y1="36" x2="184" y2="36" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="3 3"/>' +
            '<line x1="103" y1="10" x2="103" y2="62" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="3 3"/>' +
            '<text x="16" y="16" text-anchor="end" fill="#64748b" font-size="6" font-weight="700">HI</text>' +
            '<circle cx="48" cy="20" r="6" fill="#10b981"/><circle cx="72" cy="25" r="5" fill="#10b981"/>' +
            '<circle cx="136" cy="19" r="7" fill="#3b82f6"/><circle cx="162" cy="27" r="5" fill="#6366f1"/>' +
            '<circle cx="56" cy="50" r="5" fill="#f59e0b"/><circle cx="152" cy="51" r="6" fill="#ef4444"/>' +
            '</svg>'
        },
        {
          id: 'ps-stakeholder',
          label: 'Stakeholder & Alignment Matrix',
          tag: 'Governance',
          defaultTitle: 'Stakeholder Alignment Matrix',
          blurb: 'Map stakeholders by influence and interest to align communication and executive sign-off.',
          structure: '2\u00d72 Quadrants \u2022 Manage Closely, Inform & Consult',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#f8fafc 0%,#eff6ff 100%);">' +
            '<circle cx="100" cy="37" r="32" fill="#dbeafe" fill-opacity="0.45" stroke="#93c5fd" stroke-width="1"/>' +
            '<circle cx="100" cy="37" r="21" fill="#bfdbfe" fill-opacity="0.65" stroke="#60a5fa" stroke-width="1"/>' +
            '<circle cx="100" cy="37" r="10" fill="#2563eb"/>' +
            '<text x="100" y="39.5" text-anchor="middle" fill="#fff" font-size="6" font-weight="700">CORE</text>' +
            '<circle cx="80" cy="25" r="3.5" fill="#10b981"/><circle cx="122" cy="46" r="3.5" fill="#7c3aed"/>' +
            '<circle cx="138" cy="22" r="3.5" fill="#f59e0b"/><circle cx="62" cy="48" r="3.5" fill="#ec4899"/>' +
            '</svg>'
        }
      ]
    },
    {
      id: 'brainstorm',
      module: 'brainstorm',
      label: 'Brainstorm',
      badge: 'Canvas',
      badgeBg: '#fff7ed',
      badgeColor: '#ea580c',
      blurb: 'A central topic ringed with blank idea notes',
      defaultTitle: 'Team Ideation Brainstorm',
      category: 'UX & Discovery',
      tint: '#fef9c3',
      ink: '#ca8a04',
      heading: 'Create Brainstorm Canvas Workspace',
      subtitle: 'Enter the details for your Brainstorm session and choose a suggested ideation canvas template.',
      namePlaceholder: 'e.g. Q4 Growth & Feature Ideation Jam',
      descPlaceholder: 'Session prompt, problem statement, or brainstorming goal…',
      submitLabel: 'Create Brainstorm Canvas \u2192',
      icon:
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 5.5v1.5a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V16c1.5-1 3-3 3-5.5a7 7 0 0 0-7-7Z"/></svg>',
      templates: [
        {
          id: 'bs-ideation',
          label: 'Rapid Ideation Cluster',
          tag: 'Recommended',
          defaultTitle: 'Team Ideation Brainstorm',
          blurb: 'Central challenge prompt surrounded by color-coded sticky notes ready for rapid team ideation.',
          structure: 'Central Prompt \u2022 6 Ideation Sticky Notes',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#fefce8 0%,#fef08a 100%);">' +
            '<rect x="74" y="26" width="52" height="22" rx="11" fill="#eab308"/>' +
            '<text x="100" y="40" text-anchor="middle" fill="#fff" font-size="7.5" font-weight="700" font-family="sans-serif">Topic</text>' +
            '<rect x="18" y="10" width="22" height="20" rx="3" fill="#fff" stroke="#eab308" stroke-width="1.2" transform="rotate(-4 29 20)"/>' +
            '<rect x="18" y="44" width="22" height="20" rx="3" fill="#fff" stroke="#10b981" stroke-width="1.2" transform="rotate(3 29 54)"/>' +
            '<rect x="160" y="10" width="22" height="20" rx="3" fill="#fff" stroke="#ec4899" stroke-width="1.2" transform="rotate(4 171 20)"/>' +
            '<rect x="160" y="44" width="22" height="20" rx="3" fill="#fff" stroke="#8b5cf6" stroke-width="1.2" transform="rotate(-3 171 54)"/>' +
            '</svg>'
        },
        {
          id: 'bs-retro',
          label: 'Sprint Retrospective Jam',
          tag: 'Team Ritual',
          defaultTitle: 'Sprint Retrospective Session',
          blurb: 'Reflect on Went Well, To Improve, and Action Items with structured sticky clusters.',
          structure: '3 Zones \u2022 Went Well, To Improve & Action Items',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%);">' +
            '<rect x="14" y="10" width="52" height="54" rx="4" fill="#a7f3d0" stroke="#059669" stroke-width="1.2"/>' +
            '<rect x="74" y="10" width="52" height="54" rx="4" fill="#fed7aa" stroke="#ea580c" stroke-width="1.2"/>' +
            '<rect x="134" y="10" width="52" height="54" rx="4" fill="#fbcfe8" stroke="#db2777" stroke-width="1.2"/>' +
            '<text x="40" y="22" text-anchor="middle" fill="#059669" font-size="6" font-weight="700">WENT WELL</text>' +
            '<text x="100" y="22" text-anchor="middle" fill="#ea580c" font-size="6" font-weight="700">IMPROVE</text>' +
            '<text x="160" y="22" text-anchor="middle" fill="#db2777" font-size="6" font-weight="700">ACTIONS</text>' +
            '<rect x="22" y="28" width="36" height="12" rx="2" fill="#fff"/>' +
            '<rect x="82" y="28" width="36" height="12" rx="2" fill="#fff"/>' +
            '<rect x="142" y="28" width="36" height="12" rx="2" fill="#fff"/>' +
            '</svg>'
        },
        {
          id: 'bs-journey',
          label: 'Customer Journey Touchpoints',
          tag: 'UX Flow',
          defaultTitle: 'Customer Journey Brainstorm',
          blurb: 'Brainstorm touchpoints and friction fixes across Awareness, Onboarding, Adoption, and Retention.',
          structure: '4 Connected Stages \u2022 Touchpoint Notes',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 100%);">' +
            '<path d="M36 24 H164" stroke="#0284c7" stroke-width="2"/>' +
            '<circle cx="36" cy="24" r="8" fill="#0284c7"/>' +
            '<circle cx="78" cy="24" r="8" fill="#0284c7"/>' +
            '<circle cx="122" cy="24" r="8" fill="#0284c7"/>' +
            '<circle cx="164" cy="24" r="8" fill="#0284c7"/>' +
            '<rect x="26" y="38" width="20" height="18" rx="3" fill="#fff" stroke="#7dd3fc" stroke-width="1.2"/>' +
            '<rect x="68" y="38" width="20" height="18" rx="3" fill="#fff" stroke="#7dd3fc" stroke-width="1.2"/>' +
            '<rect x="112" y="38" width="20" height="18" rx="3" fill="#fff" stroke="#7dd3fc" stroke-width="1.2"/>' +
            '<rect x="154" y="38" width="20" height="18" rx="3" fill="#fff" stroke="#7dd3fc" stroke-width="1.2"/>' +
            '</svg>'
        },
        {
          id: 'bs-hmw',
          label: '“How Might We” Design Thinking',
          tag: 'Workshop',
          defaultTitle: 'How Might We Design Workshop',
          blurb: 'Frame user problems as How Might We questions, cluster solutions, and dot-vote top ideas.',
          structure: 'HMW Prompts \u2022 Solution Clusters \u2022 Dot Voting',
          previewSvg:
            '<svg viewBox="0 0 200 74" width="100%" height="74" fill="none" style="background:linear-gradient(135deg,#fef9c3 0%,#fde047 100%);">' +
            '<rect x="20" y="10" width="74" height="24" rx="4" fill="#fff" stroke="#eab308" stroke-width="1.2"/>' +
            '<text x="57" y="24" text-anchor="middle" fill="#ca8a04" font-size="7" font-weight="700">HMW Prompt 1</text>' +
            '<rect x="106" y="10" width="74" height="24" rx="4" fill="#fff" stroke="#eab308" stroke-width="1.2"/>' +
            '<text x="143" y="24" text-anchor="middle" fill="#ca8a04" font-size="7" font-weight="700">HMW Prompt 2</text>' +
            '<rect x="24" y="40" width="30" height="20" rx="3" fill="#dcfce7" stroke="#86efac" stroke-width="1"/>' +
            '<rect x="60" y="40" width="30" height="20" rx="3" fill="#dbeafe" stroke="#93c5fd" stroke-width="1"/>' +
            '<rect x="110" y="40" width="30" height="20" rx="3" fill="#fce7f3" stroke="#f472b6" stroke-width="1"/>' +
            '<circle cx="82" cy="46" r="3" fill="#ef4444"/>' +
            '</svg>'
        }
      ]
    }
  ];

  window.WorkspaceFrameworks.byId = function (id) {
    for (var i = 0; i < window.WorkspaceFrameworks.length; i++) {
      if (window.WorkspaceFrameworks[i].id === id) return window.WorkspaceFrameworks[i];
    }
    return null;
  };

  // Merge imported EdrawMax Mind Map / Concept Map / Bubble Diagram templates
  if (Array.isArray(window.QFEdrawMindMapTemplates) && window.QFEdrawMindMapTemplates.length) {
    var mmFw = null;
    for (var fi = 0; fi < window.WorkspaceFrameworks.length; fi += 1) {
      if (window.WorkspaceFrameworks[fi].id === 'mindmap') { mmFw = window.WorkspaceFrameworks[fi]; break; }
    }
    if (mmFw && Array.isArray(mmFw.templates)) {
      window.QFEdrawMindMapTemplates.forEach(function (tpl) {
        if (!tpl || !tpl.id) return;
        var safeAlt = String(tpl.label || 'Mind Map Template').replace(/"/g, '&quot;');
        mmFw.templates.push({
          id: tpl.id,
          label: tpl.label,
          tag: tpl.tag || 'Mind Map',
          defaultTitle: tpl.defaultTitle || tpl.label,
          blurb: tpl.blurb || '',
          structure: tpl.structure || '',
          previewSvg: tpl.previewImg
            ? '<img src="' + tpl.previewImg + '" alt="' + safeAlt + '" loading="lazy" style="width:100%;height:74px;object-fit:contain;background:#ffffff;display:block;" />'
            : ''
        });
      });
    }
  }

  window.WorkspaceFrameworks.findTemplate = function (frameworkId, templateId) {
    var fw = window.WorkspaceFrameworks.byId(frameworkId);
    if (!fw || !Array.isArray(fw.templates)) return null;
    for (var i = 0; i < fw.templates.length; i++) {
      if (fw.templates[i].id === templateId) return fw.templates[i];
    }
    return fw.templates[0] || null;
  };

  /**
   * Builds initial canvas items & connectors (or initial Project Plan) for a
   * chosen service + suggested template, incorporating the user's project name
   * and description so the workspace opens tailored to their input.
   */
  window.WorkspaceFrameworks.buildInitialWorkspace = function (frameworkId, templateId, projectTitle, projectDesc) {
    var cleanTitle = String(projectTitle || '').trim() || 'New Workspace';
    var cleanDesc = String(projectDesc || '').trim();
    var sx = 180;
    var sy = 110;
    var items = [];
    var connectors = [];

    if (frameworkId === 'mindmap') {
      var edrawTpl = null;
      if (Array.isArray(window.QFEdrawMindMapTemplates)) {
        for (var ei = 0; ei < window.QFEdrawMindMapTemplates.length; ei += 1) {
          if (window.QFEdrawMindMapTemplates[ei].id === templateId) {
            edrawTpl = window.QFEdrawMindMapTemplates[ei];
            break;
          }
        }
      }

      if (edrawTpl && Array.isArray(edrawTpl.nodes) && edrawTpl.nodes.length) {
        items.push({
          id: 'mm-frame-1',
          type: 'frame',
          x: sx - 50,
          y: sy - 50,
          w: Math.max(960, Number(edrawTpl.width) || 1080),
          h: Math.max(540, Number(edrawTpl.height) || 680),
          color: 'blue',
          shapeType: 'rect',
          text: cleanTitle + (cleanDesc ? ' — ' + cleanDesc : ''),
          votes: 0
        });
        edrawTpl.nodes.forEach(function (node) {
          items.push({
            id: node.id,
            type: 'shape',
            x: sx + (Number(node.x) || 0),
            y: sy + (Number(node.y) || 0),
            w: Number(node.w) || 150,
            color: node.color || 'blue',
            shapeType: node.shapeType || 'round',
            text: node.isRoot ? ('<strong>' + node.text + '</strong>') : node.text,
            votes: 0
          });
        });
        (edrawTpl.connectors || []).forEach(function (c, idx) {
          connectors.push({
            id: 'mm-edraw-conn-' + (idx + 1),
            fromId: c.fromId,
            toId: c.toId
          });
        });
        return { items: items, connectors: connectors, plan: null };
      }

      items.push({
        id: 'mm-frame-1',
        type: 'frame',
        x: sx - 60,
        y: sy - 60,
        w: 1020,
        h: 520,
        color: 'blue',
        shapeType: 'rect',
        text: cleanTitle + (cleanDesc ? ' — ' + cleanDesc : ''),
        votes: 0
      });

      if (templateId === 'mm-architecture') {
        // Top-down hierarchical architecture tree
        items.push({
          id: 'mm-root',
          type: 'shape',
          x: sx + 340,
          y: sy,
          w: 220,
          color: 'mint',
          shapeType: 'round',
          text: '<strong>' + cleanTitle + '</strong>' + (cleanDesc ? '<br><small>' + cleanDesc + '</small>' : ''),
          votes: 0
        });
        var archCols = [
          { title: 'Frontend & UX', sub: 'Components & State', color: 'blue' },
          { title: 'API Services', sub: 'REST & Realtime', color: 'mint' },
          { title: 'Data Layer', sub: 'SQLite & Cloud Sync', color: 'violet' },
          { title: 'Auth & Security', sub: 'Sessions & RBAC', color: 'orange' }
        ];
        archCols.forEach(function (col, idx) {
          var cx = sx + idx * 235;
          var bId = 'mm-branch-' + (idx + 1);
          var sId = 'mm-sub-' + (idx + 1);
          items.push({ id: bId, type: 'shape', x: cx, y: sy + 145, w: 185, color: col.color, shapeType: 'rect', text: col.title, votes: 0 });
          items.push({ id: sId, type: 'sticky', x: cx + 2, y: sy + 265, color: col.color, shapeType: 'rect', text: col.sub, votes: 0 });
          connectors.push(
            { id: 'mm-conn-r-' + (idx + 1), fromId: 'mm-root', toId: bId },
            { id: 'mm-conn-s-' + (idx + 1), fromId: bId, toId: sId }
          );
        });
      } else if (templateId === 'mm-research') {
        // Left-to-right horizontal synthesis tree
        items.push({
          id: 'mm-root',
          type: 'shape',
          x: sx,
          y: sy + 165,
          w: 200,
          color: 'violet',
          shapeType: 'round',
          text: '<strong>' + cleanTitle + '</strong>' + (cleanDesc ? '<br><small>' + cleanDesc + '</small>' : ''),
          votes: 0
        });
        var resRows = [
          { title: 'Target Personas', sub: 'Core user archetypes', color: 'blue' },
          { title: 'Key Pain Points', sub: 'Workflow bottlenecks', color: 'pink' },
          { title: 'Product Insights', sub: 'High-impact opportunities', color: 'mint' }
        ];
        resRows.forEach(function (row, idx) {
          var ry = sy + idx * 165;
          var bId = 'mm-branch-' + (idx + 1);
          var sId = 'mm-sub-' + (idx + 1);
          items.push({ id: bId, type: 'shape', x: sx + 290, y: ry + 20, w: 190, color: row.color, shapeType: 'round', text: row.title, votes: 0 });
          items.push({ id: sId, type: 'sticky', x: sx + 570, y: ry, color: row.color, shapeType: 'rect', text: row.sub, votes: 0 });
          connectors.push(
            { id: 'mm-conn-r-' + (idx + 1), fromId: 'mm-root', toId: bId },
            { id: 'mm-conn-s-' + (idx + 1), fromId: bId, toId: sId }
          );
        });
      } else if (templateId === 'mm-gtm') {
        // 360-degree orbital constellation
        items.push({
          id: 'mm-root',
          type: 'shape',
          x: sx + 340,
          y: sy + 165,
          w: 210,
          color: 'orange',
          shapeType: 'round',
          text: '<strong>' + cleanTitle + '</strong>' + (cleanDesc ? '<br><small>' + cleanDesc + '</small>' : ''),
          votes: 0
        });
        var gtmRing = [
          { title: 'Positioning', x: sx + 355, y: sy - 5, color: 'yellow' },
          { title: 'Pricing & Tiers', x: sx + 355, y: sy + 335, color: 'mint' },
          { title: 'Target Audience', x: sx + 35, y: sy + 45, color: 'blue' },
          { title: 'Messaging Pillars', x: sx + 35, y: sy + 275, color: 'violet' },
          { title: 'Growth Channels', x: sx + 665, y: sy + 45, color: 'mint' },
          { title: 'Launch KPIs', x: sx + 665, y: sy + 275, color: 'orange' }
        ];
        gtmRing.forEach(function (node, idx) {
          var bId = 'mm-branch-' + (idx + 1);
          items.push({ id: bId, type: 'shape', x: node.x, y: node.y, w: 180, color: node.color, shapeType: 'round', text: node.title, votes: 0 });
          connectors.push({ id: 'mm-conn-r-' + (idx + 1), fromId: 'mm-root', toId: bId });
        });
      } else {
        // Classic bilateral radial mind map (mm-concept)
        items.push({
          id: 'mm-root',
          type: 'shape',
          x: sx + 340,
          y: sy + 155,
          w: 220,
          color: 'blue',
          shapeType: 'round',
          text: '<strong>' + cleanTitle + '</strong>' + (cleanDesc ? '<br><small>' + cleanDesc + '</small>' : ''),
          votes: 0
        });
        var mmBranches = [
          { title: 'Core Theme 1', sub: 'Key supporting idea', color: 'yellow', x: sx + 40, y: sy + 35, subX: sx - 20, subY: sy + 120 },
          { title: 'Core Theme 2', sub: 'Key supporting idea', color: 'mint', x: sx + 40, y: sy + 270, subX: sx - 20, subY: sy + 355 },
          { title: 'Core Theme 3', sub: 'Key supporting idea', color: 'violet', x: sx + 660, y: sy + 35, subX: sx + 730, subY: sy + 120 },
          { title: 'Core Theme 4', sub: 'Key supporting idea', color: 'orange', x: sx + 660, y: sy + 270, subX: sx + 730, subY: sy + 355 }
        ];
        mmBranches.forEach(function (b, idx) {
          var branchId = 'mm-branch-' + (idx + 1);
          var subId = 'mm-sub-' + (idx + 1);
          items.push({ id: branchId, type: 'shape', x: b.x, y: b.y, w: 185, color: b.color, shapeType: 'round', text: b.title, votes: 0 });
          items.push({ id: subId, type: 'sticky', x: b.subX, y: b.subY, color: b.color, shapeType: 'rect', text: b.sub, votes: 0 });
          connectors.push(
            { id: 'mm-conn-r-' + (idx + 1), fromId: 'mm-root', toId: branchId },
            { id: 'mm-conn-s-' + (idx + 1), fromId: branchId, toId: subId }
          );
        });
      }
    } else if (frameworkId === 'kanban') {
      var columns;
      if (templateId === 'kb-bug-triage') {
        columns = [
          { title: 'REPORTED', color: 'pink', cards: [' Reproduce reported issue', 'Collect browser & server logs'] },
          { title: 'INVESTIGATING', color: 'orange', cards: ['Root-cause analysis in progress'] },
          { title: 'FIX IN PROGRESS', color: 'blue', cards: ['Patch & regression unit test'] },
          { title: 'VERIFIED QA', color: 'mint', cards: ['Staging verification complete'] }
        ];
      } else if (templateId === 'kb-launch') {
        columns = [
          { title: 'PRODUCT & SPECS', color: 'violet', cards: ['Finalize launch scope', 'Sign off release notes'] },
          { title: 'DESIGN & ASSETS', color: 'pink', cards: ['Hero visuals & walkthrough'] },
          { title: 'ENGINEERING QA', color: 'blue', cards: ['Production readiness check'] },
          { title: 'LAUNCH READY', color: 'mint', cards: ['Go-live announcement'] }
        ];
      } else if (templateId === 'kb-discovery') {
        columns = [
          { title: 'HYPOTHESIS INTAKE', color: 'yellow', cards: ['User problem statement', 'Target metric baseline'] },
          { title: 'PROTOTYPING', color: 'violet', cards: ['Interactive wireframe flow'] },
          { title: 'USER TESTING', color: 'blue', cards: ['5 customer usability sessions'] },
          { title: 'VALIDATED', color: 'mint', cards: ['Ready for engineering backlog'] }
        ];
      } else {
        columns = [
          { title: 'BACKLOG', color: 'violet', cards: [cleanDesc || 'Define sprint scope & acceptance criteria'] },
          { title: 'TO DO', color: 'yellow', cards: ['Core feature implementation', 'API & data integration'] },
          { title: 'IN PROGRESS', color: 'blue', cards: ['Active sprint deliverable'] },
          { title: 'DONE', color: 'mint', cards: ['Workspace kick-off & setup'] }
        ];
      }

      items.push({
        id: 'kb-frame-1',
        type: 'frame',
        x: sx - 50,
        y: sy - 55,
        w: 980,
        h: 440,
        color: 'blue',
        shapeType: 'rect',
        text: cleanTitle + (cleanDesc ? ' — ' + cleanDesc : ''),
        votes: 0
      });

      columns.forEach(function (col, cIdx) {
        var colX = sx + cIdx * 230;
        items.push({
          id: 'kb-col-' + (cIdx + 1),
          type: 'text',
          x: colX + 8,
          y: sy - 10,
          color: 'yellow',
          shapeType: 'rect',
          text: col.title,
          votes: 0
        });
        col.cards.forEach(function (cardText, rIdx) {
          items.push({
            id: 'kb-card-' + (cIdx + 1) + '-' + (rIdx + 1),
            type: 'sticky',
            x: colX,
            y: sy + 35 + rIdx * 165,
            color: col.color,
            shapeType: 'rect',
            text: cardText,
            votes: 0
          });
        });
      });
    } else if (frameworkId === 'perspective') {
      var quads;
      if (templateId === 'ps-swot') {
        quads = [
          { title: 'Strengths (Internal)', notes: ['Core product differentiation', 'Technical velocity'], colors: ['mint', 'mint'] },
          { title: 'Weaknesses (Internal)', notes: ['Resource bottlenecks', 'Technical debt areas'], colors: ['orange', 'orange'] },
          { title: 'Opportunities (External)', notes: ['Market expansion segment', 'AI workflow automation'], colors: ['blue', 'blue'] },
          { title: 'Threats (External)', notes: ['Competitive pressure', 'Regulatory / security shifts'], colors: ['pink', 'pink'] }
        ];
      } else if (templateId === 'ps-impact-effort') {
        quads = [
          { title: 'High Impact \u2022 Low Effort (Quick Wins)', notes: ['High-leverage UX polish', 'Onboarding streamline'], colors: ['mint', 'yellow'] },
          { title: 'High Impact \u2022 High Effort (Major Bets)', notes: [cleanTitle + ' core initiative', 'Platform architecture'], colors: ['blue', 'violet'] },
          { title: 'Low Impact \u2022 Low Effort (Fill-Ins)', notes: ['Minor UI refinements', 'Documentation updates'], colors: ['yellow', 'mint'] },
          { title: 'Low Impact \u2022 High Effort (Defer)', notes: ['Legacy custom integrations', 'Non-core requests'], colors: ['orange', 'pink'] }
        ];
      } else if (templateId === 'ps-stakeholder') {
        quads = [
          { title: 'High Influence \u2022 High Interest (Manage Closely)', notes: ['Executive Sponsors', 'Product & Eng Leads'], colors: ['blue', 'mint'] },
          { title: 'High Influence \u2022 Low Interest (Keep Satisfied)', notes: ['Security & Compliance', 'Finance Approvers'], colors: ['violet', 'yellow'] },
          { title: 'Low Influence \u2022 High Interest (Keep Informed)', notes: ['Beta Customer Advisory', 'Design Guild'], colors: ['mint', 'blue'] },
          { title: 'Low Influence \u2022 Low Interest (Monitor)', notes: ['External Vendors', 'General Observers'], colors: ['orange', 'pink'] }
        ];
      } else {
        quads = [
          { title: 'Strategic Vision & Scope', notes: [cleanDesc || ('Core vision for ' + cleanTitle), 'Target customer outcomes'], colors: ['blue', 'mint'] },
          { title: 'Key Objectives & OKRs', notes: ['Primary Objective 1', 'Measurable Key Results (KRs)'], colors: ['yellow', 'violet'] },
          { title: 'Critical Risks & Mitigation', notes: ['Key dependencies & blockers', 'Mitigation protocol'], colors: ['orange', 'pink'] },
          { title: 'High-Level Roadmap & Milestones', notes: ['M1: Foundation & Design', 'M2: Production Launch'], colors: ['blue', 'mint'] }
        ];
      }

      var qCoords = [
        { x: sx - 40, y: sy - 40 },
        { x: sx + 420, y: sy - 40 },
        { x: sx - 40, y: sy + 240 },
        { x: sx + 420, y: sy + 240 }
      ];

      quads.forEach(function (q, qIdx) {
        var qc = qCoords[qIdx];
        items.push({
          id: 'ps-frame-' + (qIdx + 1),
          type: 'frame',
          x: qc.x,
          y: qc.y,
          w: 430,
          h: 245,
          color: 'blue',
          shapeType: 'rect',
          text: q.title,
          votes: 0
        });
        q.notes.forEach(function (nText, nIdx) {
          items.push({
            id: 'ps-note-' + (qIdx + 1) + '-' + (nIdx + 1),
            type: 'sticky',
            x: qc.x + 24 + nIdx * 195,
            y: qc.y + 52,
            color: q.colors[nIdx % q.colors.length],
            shapeType: 'rect',
            text: nText,
            votes: 0
          });
        });
      });
    } else if (frameworkId === 'brainstorm') {
      if (templateId === 'bs-retro') {
        items.push({
          id: 'bs-frame-1',
          type: 'frame',
          x: sx - 50,
          y: sy - 55,
          w: 780,
          h: 410,
          color: 'blue',
          shapeType: 'rect',
          text: cleanTitle + (cleanDesc ? ' — ' + cleanDesc : ''),
          votes: 0
        });
        var retroCols = [
          { title: 'WENT WELL', color: 'mint', x: sx, notes: ['Strong team velocity', 'Smooth release deploy'] },
          { title: 'TO IMPROVE', color: 'orange', x: sx + 240, notes: ['Earlier QA handoff', 'Clearer spec scope'] },
          { title: 'ACTION ITEMS', color: 'pink', x: sx + 480, notes: ['Automate pre-release checklist'] }
        ];
        retroCols.forEach(function (col, cIdx) {
          items.push({ id: 'bs-rcol-' + cIdx, type: 'text', x: col.x + 8, y: sy - 10, color: 'yellow', shapeType: 'rect', text: col.title, votes: 0 });
          col.notes.forEach(function (nt, nIdx) {
            items.push({ id: 'bs-rnote-' + cIdx + '-' + nIdx, type: 'sticky', x: col.x, y: sy + 35 + nIdx * 165, color: col.color, shapeType: 'rect', text: nt, votes: 0 });
          });
        });
      } else if (templateId === 'bs-journey') {
        items.push({
          id: 'bs-frame-1',
          type: 'frame',
          x: sx - 50,
          y: sy - 55,
          w: 920,
          h: 390,
          color: 'blue',
          shapeType: 'rect',
          text: cleanTitle + (cleanDesc ? ' — ' + cleanDesc : ''),
          votes: 0
        });
        var stages = [
          { title: '1. Awareness', color: 'blue', note: 'First discovery touchpoint' },
          { title: '2. Consideration', color: 'violet', note: 'Evaluating value & templates' },
          { title: '3. Onboarding', color: 'mint', note: 'First workspace created' },
          { title: '4. Expansion', color: 'yellow', note: 'Team collaboration & sharing' }
        ];
        stages.forEach(function (st, sIdx) {
          var stId = 'bs-stage-' + (sIdx + 1);
          var sxPos = sx + sIdx * 215;
          items.push({ id: stId, type: 'shape', x: sxPos, y: sy + 15, w: 175, color: st.color, shapeType: 'round', text: st.title, votes: 0 });
          items.push({ id: 'bs-stnote-' + (sIdx + 1), type: 'sticky', x: sxPos, y: sy + 120, color: st.color, shapeType: 'rect', text: st.note, votes: 0 });
          if (sIdx > 0) {
            connectors.push({ id: 'bs-sconn-' + sIdx, fromId: 'bs-stage-' + sIdx, toId: stId });
          }
        });
      } else {
        var promptLabel = templateId === 'bs-hmw'
          ? '<strong>How Might We:</strong> ' + cleanTitle
          : '<strong>' + cleanTitle + '</strong>' + (cleanDesc ? '<br><small>' + cleanDesc + '</small>' : '');
        items.push({
          id: 'bs-frame-1',
          type: 'frame',
          x: sx - 50,
          y: sy - 55,
          w: 860,
          h: 460,
          color: 'blue',
          shapeType: 'rect',
          text: cleanTitle + (cleanDesc ? ' — ' + cleanDesc : ''),
          votes: 0
        });
        items.push({
          id: 'bs-topic',
          type: 'shape',
          x: sx + 275,
          y: sy + 145,
          w: 220,
          color: 'blue',
          shapeType: 'round',
          text: promptLabel,
          votes: 0
        });
        var stickyIdeas = templateId === 'bs-hmw'
          ? [
              { x: sx + 20, y: sy + 20, color: 'yellow', text: 'HMW simplify onboarding in 60 seconds?' },
              { x: sx + 20, y: sy + 210, color: 'mint', text: 'HMW surface smart templates automatically?' },
              { x: sx + 555, y: sy + 20, color: 'pink', text: 'HMW enable real-time async review?' },
              { x: sx + 555, y: sy + 210, color: 'violet', text: 'HMW turn brainstorm notes into tasks?' }
            ]
          : [
              { x: sx + 20, y: sy + 20, color: 'yellow', text: 'Idea 1: High-impact concept…' },
              { x: sx + 20, y: sy + 210, color: 'mint', text: 'Idea 2: Quick-win experiment…' },
              { x: sx + 555, y: sy + 20, color: 'pink', text: 'Idea 3: Customer workflow boost…' },
              { x: sx + 555, y: sy + 210, color: 'violet', text: 'Idea 4: Differentiator feature…' }
            ];
        stickyIdeas.forEach(function (st, idx) {
          items.push({
            id: 'bs-idea-' + (idx + 1),
            type: 'sticky',
            x: st.x,
            y: st.y,
            color: st.color,
            shapeType: 'rect',
            text: st.text,
            votes: 0
          });
        });
      }
    }

    var plan = null;
    if (frameworkId === 'project-planning' && templateId && templateId !== 'pp-blank') {
      var codePrefix = templateId === 'pp-agile-release' ? 'AGL' : (templateId === 'pp-engineering-rollout' ? 'ENG' : 'PLN');
      var phases;
      var tasks;
      var milestones;

      if (templateId === 'pp-agile-release') {
        phases = [
          { wbs: '1.0', title: 'Sprint 1 — Discovery & Backlog', packages: [{ wbs: '1.1', title: 'User Stories & Acceptance Criteria' }] },
          { wbs: '2.0', title: 'Sprint 2 — Core Feature Build', packages: [{ wbs: '2.1', title: 'Frontend & API Delivery' }] },
          { wbs: '3.0', title: 'Sprint 3 — Hardening & Release', packages: [{ wbs: '3.1', title: 'QA, Performance & Launch' }] }
        ];
        tasks = [
          { id: 'TSK-101', wbs: '1.1.1', parentWbs: '1.1', phaseWbs: '1.0', title: cleanTitle + ' — Scope & Backlog Refinement', status: 'done', priority: 'high', assigneeId: 'res-1', sprint: 'Sprint 1', storyPoints: 5, startDay: 1, durationDays: 4, progress: 100, budget: 12000, dependencies: [] },
          { id: 'TSK-102', wbs: '1.1.2', parentWbs: '1.1', phaseWbs: '1.0', title: 'UX Wireframes & Component Specs', status: 'in-progress', priority: 'high', assigneeId: 'res-2', sprint: 'Sprint 1', storyPoints: 5, startDay: 5, durationDays: 5, progress: 60, budget: 15000, dependencies: [{ fromTaskId: 'TSK-101', type: 'FS' }] },
          { id: 'TSK-201', wbs: '2.1.1', parentWbs: '2.1', phaseWbs: '2.0', title: 'Core Application & API Implementation', status: 'todo', priority: 'critical', assigneeId: 'res-1', sprint: 'Sprint 2', storyPoints: 8, startDay: 10, durationDays: 8, progress: 0, budget: 28000, dependencies: [{ fromTaskId: 'TSK-102', type: 'FS' }] },
          { id: 'TSK-301', wbs: '3.1.1', parentWbs: '3.1', phaseWbs: '3.0', title: 'End-to-End QA & Production Release', status: 'todo', priority: 'critical', assigneeId: 'res-2', sprint: 'Sprint 3', storyPoints: 5, startDay: 18, durationDays: 5, progress: 0, budget: 16000, dependencies: [{ fromTaskId: 'TSK-201', type: 'FS' }] }
        ];
        milestones = [
          { id: 'MS-1', title: 'M1: Sprint 1 Scope Locked', day: 9, phaseWbs: '1.0', status: 'on-track', owner: 'Project Lead' },
          { id: 'MS-2', title: 'M2: Feature Complete & GA Launch', day: 23, phaseWbs: '3.0', status: 'on-track', owner: 'Engineering Lead' }
        ];
      } else if (templateId === 'pp-engineering-rollout') {
        phases = [
          { wbs: '1.0', title: 'Architecture & Security Design', packages: [{ wbs: '1.1', title: 'RFC & Threat Modeling' }] },
          { wbs: '2.0', title: 'Platform Implementation', packages: [{ wbs: '2.1', title: 'Core Services & Database Schema' }] },
          { wbs: '3.0', title: 'Load Testing & Production Cutover', packages: [{ wbs: '3.1', title: 'Staging Canary & Rollout' }] }
        ];
        tasks = [
          { id: 'TSK-101', wbs: '1.1.1', parentWbs: '1.1', phaseWbs: '1.0', title: cleanTitle + ' — Architecture RFC', status: 'done', priority: 'critical', assigneeId: 'res-1', sprint: 'Phase 1', storyPoints: 8, startDay: 1, durationDays: 5, progress: 100, budget: 20000, dependencies: [] },
          { id: 'TSK-201', wbs: '2.1.1', parentWbs: '2.1', phaseWbs: '2.0', title: 'Service & Schema Migration', status: 'in-progress', priority: 'critical', assigneeId: 'res-1', sprint: 'Phase 2', storyPoints: 13, startDay: 6, durationDays: 8, progress: 45, budget: 36000, dependencies: [{ fromTaskId: 'TSK-101', type: 'FS' }] },
          { id: 'TSK-301', wbs: '3.1.1', parentWbs: '3.1', phaseWbs: '3.0', title: 'Security Audit & Canary Cutover', status: 'todo', priority: 'high', assigneeId: 'res-2', sprint: 'Phase 3', storyPoints: 8, startDay: 14, durationDays: 6, progress: 0, budget: 22000, dependencies: [{ fromTaskId: 'TSK-201', type: 'FS' }] }
        ];
        milestones = [
          { id: 'MS-1', title: 'M1: Architecture RFC Approved', day: 5, phaseWbs: '1.0', status: 'completed', owner: 'Principal Architect' },
          { id: 'MS-2', title: 'M2: Production Cutover Complete', day: 20, phaseWbs: '3.0', status: 'on-track', owner: 'Platform Lead' }
        ];
      } else {
        phases = [
          { wbs: '1.0', title: 'Initiation & Planning', packages: [{ wbs: '1.1', title: 'Project Charter & Scope' }] },
          { wbs: '2.0', title: 'Design & Architecture', packages: [{ wbs: '2.1', title: 'System & Experience Design' }] },
          { wbs: '3.0', title: 'Execution & Delivery', packages: [{ wbs: '3.1', title: 'Core Build & Integration' }] },
          { wbs: '4.0', title: 'Launch & Handover', packages: [{ wbs: '4.1', title: 'QA Verification & Go-Live' }] }
        ];
        tasks = [
          { id: 'TSK-101', wbs: '1.1.1', parentWbs: '1.1', phaseWbs: '1.0', title: cleanTitle + ' — Charter & Requirements', status: 'done', priority: 'high', assigneeId: 'res-1', sprint: 'Sprint 1', storyPoints: 5, startDay: 1, durationDays: 4, progress: 100, budget: 14000, dependencies: [] },
          { id: 'TSK-201', wbs: '2.1.1', parentWbs: '2.1', phaseWbs: '2.0', title: 'Architecture & Design Sign-off', status: 'in-progress', priority: 'high', assigneeId: 'res-2', sprint: 'Sprint 1', storyPoints: 8, startDay: 5, durationDays: 6, progress: 50, budget: 22000, dependencies: [{ fromTaskId: 'TSK-101', type: 'FS' }] },
          { id: 'TSK-301', wbs: '3.1.1', parentWbs: '3.1', phaseWbs: '3.0', title: 'Core Deliverable Execution', status: 'todo', priority: 'critical', assigneeId: 'res-1', sprint: 'Sprint 2', storyPoints: 13, startDay: 11, durationDays: 8, progress: 0, budget: 35000, dependencies: [{ fromTaskId: 'TSK-201', type: 'FS' }] },
          { id: 'TSK-401', wbs: '4.1.1', parentWbs: '4.1', phaseWbs: '4.0', title: 'Final QA & Stakeholder Launch', status: 'todo', priority: 'high', assigneeId: 'res-2', sprint: 'Sprint 3', storyPoints: 5, startDay: 19, durationDays: 4, progress: 0, budget: 15000, dependencies: [{ fromTaskId: 'TSK-301', type: 'FS' }] }
        ];
        milestones = [
          { id: 'MS-1', title: 'M1: Charter & Scope Approved', day: 4, phaseWbs: '1.0', status: 'completed', owner: 'Project Lead' },
          { id: 'MS-2', title: 'M2: Design Freeze', day: 11, phaseWbs: '2.0', status: 'on-track', owner: 'Design Lead' },
          { id: 'MS-3', title: 'M3: Production Launch', day: 23, phaseWbs: '4.0', status: 'on-track', owner: 'Project Lead' }
        ];
      }

      plan = {
        workspaceMode: 'project-planning',
        stateVersion: 2,
        projectName: cleanTitle,
        projectCode: codePrefix + '-2026',
        projectDescription: cleanDesc,
        activeSprint: 'Sprint 1',
        baseBudget: 120000,
        activeModule: 'gantt',
        ganttScale: 'days',
        taskSubView: 'wbs',
        wbsPhases: phases,
        resources: [
          { id: 'res-1', name: 'Project Lead', role: 'Principal Architect', category: 'Personnel — Engineering', maxHours: 40, rate: 140, availability: 'Available', avatar: 'PL' },
          { id: 'res-2', name: 'Delivery Lead', role: 'Staff Product & UX', category: 'Personnel — Product & Design', maxHours: 40, rate: 130, availability: 'Available', avatar: 'DL' }
        ],
        tasks: tasks,
        milestones: milestones,
        timesheets: [],
        wikiPages: cleanDesc ? [{ id: 'wiki-1', title: cleanTitle + ' — Overview', updatedAt: 'Just now', author: 'Project Lead', content: cleanDesc }] : [],
        sharedFiles: [],
        raidItems: [],
        changeRequests: []
      };
    }

    return {
      items: items,
      connectors: connectors,
      plan: plan
    };
  };
})();
