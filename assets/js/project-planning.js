/* ==========================================================================
   Enterprise Project Planning Workspace Engine (project-planning.js)
   Human-Crafted & Anti-AI Design Philosophy:
   - Emil Kowalski & Apple HIG: Generous whitespace, tactile micro-interactions, progressive disclosure
   - Spatial Clarity: Hover-only dependency paths, sharp monochrome diamond milestones
   - Nested Interactive WBS Tree (1.1 -> 1.1.1) & Calm, Broad Kanban Board
   - Ultra-Thin 4px Resource Capacity Bars & Distraction-Free Timesheet
   - Flyout Slide-Over Action Drawer (Off-dashboard chats, @mentions, wiki specs & files)
   - Single High-Fidelity Velocity Area Chart & Scannable Executive Text Digest
   - Symmetrical Flat RAID Log & Single-Column Change Management Timeline
   ========================================================================== */
(function () {
  'use strict';

  /* One friendly line for every AI/provider failure (must match
     AI_UNAVAILABLE_MESSAGE in server/routes.js and assets/js/app.js). */
  var AI_UNAVAILABLE_MESSAGE =
    'Unable to use ai at this time, try later. If the persist, contact the support team';

  function aiUnavailableError() {
    var err = new Error(AI_UNAVAILABLE_MESSAGE);
    err.aiUnavailable = true;
    return err;
  }

  var STORAGE_PREFIX = 'quantalflow_pp_state_v2_';
  var STATE_VERSION = 2;
  var KNOWN_TEMPLATES = ['project-planning', 'mindmap', 'flow', 'kanban', 'retro', 'brainstorm', 'swot', 'journey', 'blank'];
  var LEGACY_DEMO_CLEANUP_KEY = 'quantalflow_pp_blank_workspace_v1';
  var LIST_KEYS = ['wbsPhases', 'resources', 'tasks', 'milestones', 'timesheets', 'wikiPages', 'sharedFiles', 'raidItems', 'changeRequests'];
  /* Must match BLANK_PROJECT_PLANNING_BOARD_ID in server/db.js: the dedicated,
     deliberately empty workspace the dashboard sidebar links to. */
  var BLANK_WORKSPACE_ID = 'project-planning-workspace';

  /* A brand new workspace contains a clean, empty plan. No demo deliverables,
     no invented team, no sample risks - just the structural defaults the UI
     needs to render its base layout. Demo content lives in createSampleState()
     and is only ever loaded on explicit request. */
  function createEmptyState(projectTitle) {
    return {
      workspaceMode: 'project-planning',
      stateVersion: STATE_VERSION,
      projectName: projectTitle || 'Untitled Project',
      projectCode: '',
      activeSprint: '',
      baseBudget: 0,
      activeModule: 'gantt', // gantt | tasks | resources | collab | reporting | risk
      ganttScale: 'days', // days | weeks | months | quarters
      taskSubView: 'wbs', // wbs | kanban | backlog
      activeDrawerTab: 'details', // details | comments | wiki | files
      raidFilter: 'ALL', // ALL | Risk | Assumption | Issue | Dependency
      activeWikiId: null,
      searchQuery: '',
      assigneeFilter: 'ALL',
      collapsedWbs: {},
      wbsPhases: [],
      resources: [],
      tasks: [],
      milestones: [],
      timesheets: [],
      wikiPages: [],
      sharedFiles: [],
      raidItems: [],
      changeRequests: []
    };
  }

  /* Master Reference WBS Tree Plan (Construction of a House / Data Quantals Master Plan) */
  function createDataQuantalsPlanState(projectTitle) {
    return {
      workspaceMode: 'project-planning',
      stateVersion: STATE_VERSION,
      projectName: projectTitle || 'Construction of a House',
      projectCode: 'WBS-2026',
      activeSprint: 'Sprint 22 (Execution Phase)',
      baseBudget: 420000,
      activeModule: 'tasks',
      ganttScale: 'days',
      taskSubView: 'wbs',
      wbsView: 'diagram',
      activeDrawerTab: 'details',
      raidFilter: 'ALL',
      activeWikiId: 'wiki-1',
      searchQuery: '',
      assigneeFilter: 'ALL',
      collapsedWbs: {},
      wbsPhases: [
        {
          wbs: '1.0',
          title: 'Planning & Admin',
          packages: [
            { wbs: '1.1', title: 'Architecture & Specifications' }
          ]
        },
        {
          wbs: '2.0',
          title: 'Substructure',
          packages: [
            { wbs: '2.1', title: 'Site Prep & Foundation' }
          ]
        },
        {
          wbs: '3.0',
          title: 'Envelope',
          packages: [
            { wbs: '3.1', title: 'Framing, Shell & Exterior' }
          ]
        },
        {
          wbs: '4.0',
          title: 'Finishes & Finish Carpentry',
          packages: [
            { wbs: '4.1', title: 'Interior Finishes & Carpentry' }
          ]
        },
        {
          wbs: '5.0',
          title: 'Utilities & Systems',
          packages: [
            { wbs: '5.1', title: 'Mechanical, Electrical & Plumbing' }
          ]
        }
      ],
      resources: [
        { id: 'res-1', name: 'Andrey V.', role: 'Principal Architect', category: 'Personnel — Engineering', maxHours: 40, rate: 145, availability: 'Available', avatar: 'AV' },
        { id: 'res-2', name: 'Elena R.', role: 'Staff Frontend Lead', category: 'Personnel — Engineering', maxHours: 40, rate: 135, availability: 'High Load', avatar: 'ER' },
        { id: 'res-3', name: 'Marcus T.', role: 'Senior Backend Eng', category: 'Personnel — Engineering', maxHours: 40, rate: 130, availability: 'Available', avatar: 'MT' },
        { id: 'res-4', name: 'Rad K.', role: 'Group Product Manager', category: 'Personnel — Product & Design', maxHours: 40, rate: 125, availability: 'Available', avatar: 'RK' },
        { id: 'res-5', name: 'Brie S.', role: 'Staff Design Systems', category: 'Personnel — Product & Design', maxHours: 36, rate: 120, availability: 'Available', avatar: 'BS' },
        { id: 'res-6', name: 'Devon L.', role: 'Lead QA & SecOps', category: 'Personnel — QA & Security', maxHours: 40, rate: 115, availability: 'Available', avatar: 'DL' }
      ],
      tasks: [
        // Column 1: Planning & Admin
        { id: 'TSK-101', wbs: '1.1.1', parentWbs: '1.1', phaseWbs: '1.0', title: 'Design & Architectural Rendering', status: 'done', priority: 'high', assigneeId: 'res-1', sprint: 'Sprint 21', storyPoints: 8, startDay: 1, durationDays: 5, progress: 100, budget: 24000, dependencies: [] },
        { id: 'TSK-102', wbs: '1.1.2', parentWbs: '1.1', phaseWbs: '1.0', title: 'Plans & Drawings', status: 'done', priority: 'high', assigneeId: 'res-5', sprint: 'Sprint 21', storyPoints: 5, startDay: 6, durationDays: 4, progress: 100, budget: 16000, dependencies: [{ fromTaskId: 'TSK-101', type: 'FS' }] },
        { id: 'TSK-103', wbs: '1.1.3', parentWbs: '1.1', phaseWbs: '1.0', title: 'Specifications', status: 'done', priority: 'medium', assigneeId: 'res-2', sprint: 'Sprint 21', storyPoints: 3, startDay: 10, durationDays: 3, progress: 100, budget: 12000, dependencies: [{ fromTaskId: 'TSK-102', type: 'FS' }] },
        { id: 'TSK-104', wbs: '1.1.4', parentWbs: '1.1', phaseWbs: '1.0', title: 'Permits', status: 'done', priority: 'critical', assigneeId: 'res-6', sprint: 'Sprint 21', storyPoints: 5, startDay: 13, durationDays: 6, progress: 100, budget: 18000, dependencies: [{ fromTaskId: 'TSK-103', type: 'FS' }] },

        // Column 2: Substructure
        { id: 'TSK-201', wbs: '2.1.1', parentWbs: '2.1', phaseWbs: '2.0', title: 'Excavation', status: 'done', priority: 'high', assigneeId: 'res-3', sprint: 'Sprint 22', storyPoints: 5, startDay: 19, durationDays: 5, progress: 100, budget: 22000, dependencies: [{ fromTaskId: 'TSK-104', type: 'FS' }] },
        { id: 'TSK-202', wbs: '2.1.2', parentWbs: '2.1', phaseWbs: '2.0', title: 'Foundation', status: 'in-progress', priority: 'critical', assigneeId: 'res-3', sprint: 'Sprint 22', storyPoints: 8, startDay: 24, durationDays: 7, progress: 75, budget: 35000, dependencies: [{ fromTaskId: 'TSK-201', type: 'FS' }] },
        { id: 'TSK-203', wbs: '2.1.3', parentWbs: '2.1', phaseWbs: '2.0', title: 'Footings', status: 'in-progress', priority: 'high', assigneeId: 'res-3', sprint: 'Sprint 22', storyPoints: 5, startDay: 31, durationDays: 4, progress: 40, budget: 19000, dependencies: [{ fromTaskId: 'TSK-202', type: 'FS' }] },

        // Column 3: Envelope
        { id: 'TSK-301', wbs: '3.1.1', parentWbs: '3.1', phaseWbs: '3.0', title: 'Frame, Beams, Ties, Trusses', status: 'todo', priority: 'critical', assigneeId: 'res-1', sprint: 'Sprint 22', storyPoints: 13, startDay: 35, durationDays: 8, progress: 0, budget: 48000, dependencies: [{ fromTaskId: 'TSK-203', type: 'FS' }] },
        { id: 'TSK-302', wbs: '3.1.2', parentWbs: '3.1', phaseWbs: '3.0', title: 'Sub Floor', status: 'todo', priority: 'high', assigneeId: 'res-2', sprint: 'Sprint 22', storyPoints: 5, startDay: 43, durationDays: 4, progress: 0, budget: 18000, dependencies: [{ fromTaskId: 'TSK-301', type: 'FS' }] },
        { id: 'TSK-303', wbs: '3.1.3', parentWbs: '3.1', phaseWbs: '3.0', title: 'Exterior Walls', status: 'todo', priority: 'high', assigneeId: 'res-4', sprint: 'Sprint 23', storyPoints: 8, startDay: 47, durationDays: 6, progress: 0, budget: 29000, dependencies: [{ fromTaskId: 'TSK-302', type: 'FS' }] },
        { id: 'TSK-304', wbs: '3.1.4', parentWbs: '3.1', phaseWbs: '3.0', title: 'Exterior Doors', status: 'todo', priority: 'medium', assigneeId: 'res-5', sprint: 'Sprint 23', storyPoints: 3, startDay: 53, durationDays: 3, progress: 0, budget: 12000, dependencies: [{ fromTaskId: 'TSK-303', type: 'FS' }] },
        { id: 'TSK-305', wbs: '3.1.5', parentWbs: '3.1', phaseWbs: '3.0', title: 'Windows', status: 'todo', priority: 'medium', assigneeId: 'res-5', sprint: 'Sprint 23', storyPoints: 5, startDay: 56, durationDays: 4, progress: 0, budget: 16000, dependencies: [{ fromTaskId: 'TSK-304', type: 'FS' }] },
        { id: 'TSK-306', wbs: '3.1.6', parentWbs: '3.1', phaseWbs: '3.0', title: 'Siding', status: 'todo', priority: 'high', assigneeId: 'res-2', sprint: 'Sprint 23', storyPoints: 6, startDay: 60, durationDays: 5, progress: 0, budget: 24000, dependencies: [{ fromTaskId: 'TSK-305', type: 'FS' }] },

        // Column 4: Finishes & Finish Carpentry
        { id: 'TSK-401', wbs: '4.1.1', parentWbs: '4.1', phaseWbs: '4.0', title: 'Paint', status: 'todo', priority: 'medium', assigneeId: 'res-5', sprint: 'Sprint 23', storyPoints: 5, startDay: 65, durationDays: 5, progress: 0, budget: 15000, dependencies: [{ fromTaskId: 'TSK-306', type: 'FS' }] },
        { id: 'TSK-402', wbs: '4.1.2', parentWbs: '4.1', phaseWbs: '4.0', title: 'Tile', status: 'todo', priority: 'medium', assigneeId: 'res-3', sprint: 'Sprint 23', storyPoints: 6, startDay: 70, durationDays: 6, progress: 0, budget: 21000, dependencies: [{ fromTaskId: 'TSK-401', type: 'FS' }] },
        { id: 'TSK-403', wbs: '4.1.3', parentWbs: '4.1', phaseWbs: '4.0', title: 'Flooring', status: 'todo', priority: 'high', assigneeId: 'res-3', sprint: 'Sprint 24', storyPoints: 5, startDay: 76, durationDays: 5, progress: 0, budget: 26000, dependencies: [{ fromTaskId: 'TSK-402', type: 'FS' }] },
        { id: 'TSK-404', wbs: '4.1.4', parentWbs: '4.1', phaseWbs: '4.0', title: 'Cabinetry', status: 'todo', priority: 'high', assigneeId: 'res-4', sprint: 'Sprint 24', storyPoints: 8, startDay: 81, durationDays: 7, progress: 0, budget: 32000, dependencies: [{ fromTaskId: 'TSK-403', type: 'FS' }] },
        { id: 'TSK-405', wbs: '4.1.5', parentWbs: '4.1', phaseWbs: '4.0', title: 'Drywall, Plaster', status: 'todo', priority: 'high', assigneeId: 'res-2', sprint: 'Sprint 24', storyPoints: 6, startDay: 88, durationDays: 6, progress: 0, budget: 24000, dependencies: [{ fromTaskId: 'TSK-404', type: 'FS' }] },
        { id: 'TSK-406', wbs: '4.1.6', parentWbs: '4.1', phaseWbs: '4.0', title: 'Baseboard, Molding', status: 'todo', priority: 'low', assigneeId: 'res-1', sprint: 'Sprint 24', storyPoints: 4, startDay: 94, durationDays: 4, progress: 0, budget: 14000, dependencies: [{ fromTaskId: 'TSK-405', type: 'FS' }] },

        // Column 5: Utilities & Systems
        { id: 'TSK-501', wbs: '5.1.1', parentWbs: '5.1', phaseWbs: '5.0', title: 'Electric', status: 'todo', priority: 'critical', assigneeId: 'res-6', sprint: 'Sprint 23', storyPoints: 8, startDay: 62, durationDays: 7, progress: 0, budget: 34000, dependencies: [{ fromTaskId: 'TSK-301', type: 'FS' }] },
        { id: 'TSK-502', wbs: '5.1.2', parentWbs: '5.1', phaseWbs: '5.0', title: 'Heating & Air Conditioning', status: 'todo', priority: 'critical', assigneeId: 'res-6', sprint: 'Sprint 23', storyPoints: 8, startDay: 69, durationDays: 6, progress: 0, budget: 38000, dependencies: [{ fromTaskId: 'TSK-501', type: 'FS' }] },
        { id: 'TSK-503', wbs: '5.1.3', parentWbs: '5.1', phaseWbs: '5.0', title: 'Plumbing', status: 'todo', priority: 'critical', assigneeId: 'res-3', sprint: 'Sprint 23', storyPoints: 8, startDay: 75, durationDays: 7, progress: 0, budget: 36000, dependencies: [{ fromTaskId: 'TSK-502', type: 'FS' }] },
        { id: 'TSK-504', wbs: '5.1.4', parentWbs: '5.1', phaseWbs: '5.0', title: 'Gas', status: 'todo', priority: 'high', assigneeId: 'res-3', sprint: 'Sprint 24', storyPoints: 4, startDay: 82, durationDays: 4, progress: 0, budget: 18000, dependencies: [{ fromTaskId: 'TSK-503', type: 'FS' }] },
        { id: 'TSK-505', wbs: '5.1.5', parentWbs: '5.1', phaseWbs: '5.0', title: 'Water', status: 'todo', priority: 'high', assigneeId: 'res-3', sprint: 'Sprint 24', storyPoints: 4, startDay: 86, durationDays: 4, progress: 0, budget: 16000, dependencies: [{ fromTaskId: 'TSK-504', type: 'FS' }] },
        { id: 'TSK-506', wbs: '5.1.6', parentWbs: '5.1', phaseWbs: '5.0', title: 'Internet', status: 'todo', priority: 'medium', assigneeId: 'res-1', sprint: 'Sprint 24', storyPoints: 3, startDay: 90, durationDays: 3, progress: 0, budget: 11000, dependencies: [{ fromTaskId: 'TSK-505', type: 'FS' }] }
      ],
      milestones: [
        { id: 'MS-1', title: 'M1: Architecture, Specifications & Permits Approved', day: 19, phaseWbs: '1.0', status: 'completed', owner: 'Andrey V.' },
        { id: 'MS-2', title: 'M2: Substructure & Foundation Poured', day: 35, phaseWbs: '2.0', status: 'on-track', owner: 'Marcus T.' },
        { id: 'MS-3', title: 'M3: Building Envelope & Siding Weatherproof', day: 65, phaseWbs: '3.0', status: 'on-track', owner: 'Elena R.' },
        { id: 'MS-4', title: 'M4: Utilities & Systems Certified', day: 93, phaseWbs: '5.0', status: 'on-track', owner: 'Devon L.' },
        { id: 'MS-5', title: 'M5: Interior Finishes & Occupancy Handover', day: 98, phaseWbs: '4.0', status: 'on-track', owner: 'Rad K.' }
      ],
      timesheets: [],
      wikiPages: [],
      sharedFiles: [],
      raidItems: [],
      changeRequests: []
    };
  }

  /* Explicit opt-in sample project (formerly the default state). */
  function createSampleState(projectTitle) {
    return {
      workspaceMode: 'project-planning',
      stateVersion: STATE_VERSION,
      projectName: projectTitle || 'Project Planning Workspace — Enterprise Release',
      projectCode: 'PRJ-2026-Q4',
      activeSprint: 'Sprint 22 (Nov 1 – Nov 14)',
      baseBudget: 240000,
      activeModule: 'gantt', // gantt | tasks | resources | collab | reporting | risk
      ganttScale: 'days', // days | weeks | months | quarters
      taskSubView: 'wbs', // wbs | kanban | backlog
      activeDrawerTab: 'details', // details | comments | wiki | files
      raidFilter: 'ALL', // ALL | Risk | Assumption | Issue | Dependency
      activeWikiId: 'wiki-1',
      searchQuery: '',
      assigneeFilter: 'ALL',
      collapsedWbs: {},
      wbsPhases: [
        {
          wbs: '1.0',
          title: 'Discovery, Architecture & Security Baseline',
          packages: [
            { wbs: '1.1', title: 'System Architecture & Data Model' },
            { wbs: '1.2', title: 'Security & Compliance Specification' }
          ]
        },
        {
          wbs: '2.0',
          title: 'Core Agile Platform & Planning Engine',
          packages: [
            { wbs: '2.1', title: 'Interactive Gantt, WBS & Kanban Views' },
            { wbs: '2.2', title: 'Resource Capacity, Timesheets & Sync API' }
          ]
        },
        {
          wbs: '3.0',
          title: 'Enterprise QA, Analytics & GA Rollout',
          packages: [
            { wbs: '3.1', title: 'Executive Reporting & RAID Governance' },
            { wbs: '3.2', title: 'Performance Hardening & Production Launch' }
          ]
        }
      ],
      resources: [
        { id: 'res-1', name: 'Andrey V.', role: 'Principal Architect', category: 'Personnel — Engineering', maxHours: 40, rate: 145, availability: 'Available', avatar: 'AV' },
        { id: 'res-2', name: 'Elena R.', role: 'Staff Frontend Lead', category: 'Personnel — Engineering', maxHours: 40, rate: 135, availability: 'High Load', avatar: 'ER' },
        { id: 'res-3', name: 'Marcus T.', role: 'Senior Backend Eng', category: 'Personnel — Engineering', maxHours: 40, rate: 130, availability: 'Available', avatar: 'MT' },
        { id: 'res-4', name: 'Rad K.', role: 'Group Product Manager', category: 'Personnel — Product & Design', maxHours: 40, rate: 125, availability: 'Available', avatar: 'RK' },
        { id: 'res-5', name: 'Brie S.', role: 'Staff Design Systems', category: 'Personnel — Product & Design', maxHours: 36, rate: 120, availability: 'Available', avatar: 'BS' },
        { id: 'res-6', name: 'Devon L.', role: 'Lead QA & SecOps', category: 'Personnel — QA & Security', maxHours: 40, rate: 115, availability: 'Available', avatar: 'DL' },
        { id: 'res-7', name: 'GPU Inference Cluster (4x H100)', role: 'AI Compute Node Pool', category: 'Hardware & Cloud Assets', maxHours: 168, rate: 45, availability: 'Active (94%)', avatar: 'H1' },
        { id: 'res-8', name: 'Staging & E2E Load Cluster', role: 'Kubernetes Test Rig', category: 'Hardware & Cloud Assets', maxHours: 168, rate: 20, availability: 'Online', avatar: 'K8' },
        { id: 'res-9', name: 'CyberGuard SOC2 Auditors', role: 'External Security Partner', category: 'Third-Party Assets & Vendors', maxHours: 24, rate: 210, availability: 'Contracted', avatar: 'CG' },
        { id: 'res-10', name: 'Convex Realtime Cloud Tier', role: 'Managed Sync Infrastructure', category: 'Third-Party Assets & Vendors', maxHours: 168, rate: 18, availability: 'SLA 99.99%', avatar: 'CX' }
      ],
      tasks: [
        {
          id: 'TSK-101', wbs: '1.1.1', parentWbs: '1.1', phaseWbs: '1.0',
          title: 'Define Enterprise Schema & Multi-Workspace Sync Protocol',
          status: 'done', priority: 'critical', assigneeId: 'res-1', sprint: 'Sprint 21',
          storyPoints: 8, startDay: 1, durationDays: 5, progress: 100, budget: 24000,
          dependencies: [],
          comments: [
            { id: 'c-1', author: 'Andrey V.', time: '2 days ago', text: 'Completed SQLite + Convex state schema with optimistic locking. cc @Elena @Marcus' },
            { id: 'c-2', author: 'Marcus T.', time: 'Yesterday', text: 'Verified zero-downtime migration scripts on staging.' }
          ]
        },
        {
          id: 'TSK-102', wbs: '1.1.2', parentWbs: '1.1', phaseWbs: '1.0',
          title: 'Design System Tokens & Left Navigation Architecture',
          status: 'done', priority: 'high', assigneeId: 'res-5', sprint: 'Sprint 21',
          storyPoints: 5, startDay: 2, durationDays: 5, progress: 100, budget: 16500,
          dependencies: [{ fromTaskId: 'TSK-101', type: 'SS' }],
          comments: [
            { id: 'c-3', author: 'Brie S.', time: 'Yesterday', text: 'Delivered WCAG AA contrast tokens and minimalist border specs.' }
          ]
        },
        {
          id: 'TSK-103', wbs: '1.2.1', parentWbs: '1.2', phaseWbs: '1.0',
          title: 'RBAC Session Gate & Zero-Trust API Audit',
          status: 'done', priority: 'critical', assigneeId: 'res-6', sprint: 'Sprint 21',
          storyPoints: 5, startDay: 6, durationDays: 4, progress: 100, budget: 18000,
          dependencies: [{ fromTaskId: 'TSK-101', type: 'FS' }],
          comments: []
        },
        {
          id: 'TSK-104', wbs: '2.1.1', parentWbs: '2.1', phaseWbs: '2.0',
          title: 'Multi-Tier Interactive Gantt Engine & Dependency Arrows',
          status: 'in-progress', priority: 'critical', assigneeId: 'res-2', sprint: 'Sprint 22',
          storyPoints: 13, startDay: 9, durationDays: 7, progress: 72, budget: 36000,
          dependencies: [{ fromTaskId: 'TSK-103', type: 'FS' }],
          comments: [
            { id: 'c-4', author: 'Elena R.', time: '3 hours ago', text: 'Horizontal drag-and-drop and FS/SS conflict detection are live! @Rad please review.' }
          ]
        },
        {
          id: 'TSK-105', wbs: '2.1.2', parentWbs: '2.1', phaseWbs: '2.0',
          title: 'Hierarchical WBS Tree-Grid & Kanban Drag-and-Drop Sync',
          status: 'in-progress', priority: 'high', assigneeId: 'res-2', sprint: 'Sprint 22',
          storyPoints: 8, startDay: 13, durationDays: 6, progress: 65, budget: 28000,
          dependencies: [{ fromTaskId: 'TSK-104', type: 'FS' }],
          comments: [
            { id: 'c-5', author: 'Rad K.', time: '1 hour ago', text: 'Note: @Elena started WBS early — let us check the FS dependency overlap alert on Gantt.' }
          ]
        },
        {
          id: 'TSK-106', wbs: '2.2.1', parentWbs: '2.2', phaseWbs: '2.0',
          title: 'Weekly Timesheet Grid & Capacity Overallocation Engine',
          status: 'review', priority: 'high', assigneeId: 'res-3', sprint: 'Sprint 22',
          storyPoints: 8, startDay: 14, durationDays: 5, progress: 88, budget: 26000,
          dependencies: [{ fromTaskId: 'TSK-103', type: 'FS' }],
          comments: []
        },
        {
          id: 'TSK-107', wbs: '2.2.2', parentWbs: '2.2', phaseWbs: '2.0',
          title: 'Flyout Task Drawer, Rich-Text @Mentions & Wiki Repository',
          status: 'todo', priority: 'medium', assigneeId: 'res-4', sprint: 'Sprint 22',
          storyPoints: 5, startDay: 19, durationDays: 5, progress: 25, budget: 21000,
          dependencies: [{ fromTaskId: 'TSK-106', type: 'FS' }],
          comments: []
        },
        {
          id: 'TSK-108', wbs: '3.1.1', parentWbs: '3.1', phaseWbs: '3.0',
          title: 'Burn-Down, Cumulative Flow (CFD) & Executive Health Generator',
          status: 'todo', priority: 'high', assigneeId: 'res-1', sprint: 'Sprint 23',
          storyPoints: 8, startDay: 24, durationDays: 4, progress: 15, budget: 24500,
          dependencies: [{ fromTaskId: 'TSK-107', type: 'FS' }],
          comments: []
        },
        {
          id: 'TSK-109', wbs: '3.2.1', parentWbs: '3.2', phaseWbs: '3.0',
          title: 'RAID Risk Register, Change Control Workflow & GA Launch',
          status: 'backlog', priority: 'critical', assigneeId: 'res-6', sprint: 'Sprint 23',
          storyPoints: 8, startDay: 28, durationDays: 5, progress: 0, budget: 29000,
          dependencies: [{ fromTaskId: 'TSK-108', type: 'FS' }],
          comments: []
        }
      ],
      milestones: [
        { id: 'MS-1', title: 'M1: Architecture & Security Sign-Off', day: 9, phaseWbs: '1.0', status: 'completed', owner: 'Andrey V.' },
        { id: 'MS-2', title: 'M2: Core Planning Suite Code Complete', day: 23, phaseWbs: '2.0', status: 'on-track', owner: 'Elena R.' },
        { id: 'MS-3', title: 'M3: Enterprise GA Release Readiness', day: 33, phaseWbs: '3.0', status: 'at-risk', owner: 'Rad K.' }
      ],
      timesheets: [
        { id: 'TS-1', resourceId: 'res-1', taskId: 'TSK-101', status: 'Approved', hours: [8, 8, 7, 8, 6, 0, 0] },
        { id: 'TS-2', resourceId: 'res-2', taskId: 'TSK-104', status: 'Submitted', hours: [6, 6, 6, 5, 5, 0, 0] },
        { id: 'TS-3', resourceId: 'res-2', taskId: 'TSK-105', status: 'Draft', hours: [4, 4, 3, 3, 3, 0, 0] },
        { id: 'TS-4', resourceId: 'res-3', taskId: 'TSK-106', status: 'Approved', hours: [7, 7, 7, 7, 7, 0, 0] },
        { id: 'TS-5', resourceId: 'res-4', taskId: 'TSK-107', status: 'Submitted', hours: [6, 6, 6, 6, 4, 0, 0] },
        { id: 'TS-6', resourceId: 'res-5', taskId: 'TSK-102', status: 'Approved', hours: [7, 7, 7, 7, 6, 0, 0] }
      ],
      wikiPages: [
        {
          id: 'wiki-1',
          title: '1. Project Charter & Engineering Standards',
          updatedBy: 'Andrey V.',
          updatedAt: 'Today at 09:15',
          version: 'v1.4',
          history: [
            { version: 'v1.4', date: 'Today 09:15', author: 'Andrey V.', note: 'Clarified FS/SS scheduling rules' },
            { version: 'v1.3', date: 'Oct 30', author: 'Rad K.', note: 'Aligned milestone M2 deliverable specs' }
          ],
          content: '# Enterprise Project Charter\n\n## Strategic Objective\nDeliver a resilient, real-time Agile Project Planning workspace suite built directly on QuantalFlow canvas primitives.\n\n## Core Principles\n- **Zero Clutter**: Prioritize clean whitespace, subtle borders, and solid neutral surfaces.\n- **Spatial Clarity**: Hide visual line noise by default. Connective dependency paths appear only on task hover/focus.\n- **Instant State Synchronization**: Updates in WBS or Kanban instantly cascade across Gantt, timesheets, and reporting.'
        },
        {
          id: 'wiki-2',
          title: '2. WBS Decomposition & Delivery Guidelines',
          updatedBy: 'Rad K.',
          updatedAt: 'Yesterday',
          version: 'v2.1',
          history: [
            { version: 'v2.1', date: 'Yesterday', author: 'Rad K.', note: 'Updated story point velocity guidelines' }
          ],
          content: '# WBS Decomposition & Guidelines\n\n## Numbering Scheme\n- **Phase (Level 1)**: `1.0`, `2.0`, `3.0`\n- **Work Package (Level 2)**: `1.1`, `2.1`\n- **Work Item (Level 3)**: `1.1.1`, `1.1.2`\n\nAll tasks must carry a single assignee, story points, and a validated predecessor.'
        }
      ],
      sharedFiles: [
        { id: 'FILE-01', name: 'Enterprise_Architecture_Spec_v2.pdf', size: '4.2 MB', version: 'v2.0', uploadedBy: 'Andrey V.', date: 'Nov 1, 2026', tag: 'Architecture' },
        { id: 'FILE-02', name: 'Design_System_Tokens_Specification.fig', size: '18.7 MB', version: 'v1.3', uploadedBy: 'Brie S.', date: 'Oct 28, 2026', tag: 'Design Tokens' },
        { id: 'FILE-03', name: 'SOC2_Type_II_PreAudit_Checklist.xlsx', size: '820 KB', version: 'v1.0', uploadedBy: 'Devon L.', date: 'Oct 29, 2026', tag: 'Compliance' }
      ],
      raidItems: [
        { id: 'RAID-01', type: 'Risk', title: 'Cross-team API schema drift during Q4 load testing', probability: 3, severity: 4, ownerId: 'res-3', linkedTaskId: 'TSK-106', status: 'Open', mitigation: 'Enforce automated contract test gate in CI pipeline before merge.' },
        { id: 'RAID-02', type: 'Assumption', title: 'Convex websocket tier sustains 10,000 concurrent state deltas with <40ms latency', probability: 2, severity: 4, ownerId: 'res-1', linkedTaskId: 'TSK-101', status: 'Open', mitigation: 'Synthetic bench test scheduled for Friday on staging rig.' },
        { id: 'RAID-03', type: 'Issue', title: 'Overlapping schedule on WBS 2.1.2 creates Finish-to-Start dependency collision with TSK-104', probability: 4, severity: 3, ownerId: 'res-2', linkedTaskId: 'TSK-105', status: 'Open', mitigation: 'Run Auto-Resolve Conflicts engine to cascade startDay to day 16.' },
        { id: 'RAID-04', type: 'Dependency', title: 'SOC2 Type II sign-off required prior to GA production traffic routing', probability: 2, severity: 5, ownerId: 'res-6', linkedTaskId: 'TSK-109', status: 'Open', mitigation: 'Weekly audit checkpoint with CyberGuard security leads.' }
      ],
      changeRequests: [
        { id: 'CR-101', title: 'Add Multi-Tier Gantt Quarter View & Export API', requestedBy: 'Rad K. (PMO)', submittedAt: 'Oct 30, 2026', scopeImpact: 'Extends timeline scaling from days/weeks to FY quarters and adds PDF digest export', scheduleDeltaDays: 3, budgetDelta: 14500, stakeholder: 'Devon L. (VP Engineering)', status: 'Approved' },
        { id: 'CR-102', title: 'Accelerate Mobile Canvas Touch Hand-Off', requestedBy: 'Elena R. (Frontend)', submittedAt: 'Nov 1, 2026', scopeImpact: 'Includes pinch-to-zoom timeline physics for tablet viewports', scheduleDeltaDays: 2, budgetDelta: 9200, stakeholder: 'Rad K. (Product Lead)', status: 'Pending Review' }
      ]
    };
  }

  var state = null;
  var currentBoardId = 'default-project-workspace';
  var shellEl = null;
  var drawerEl = null;
  var backdropEl = null;
  var activeDrawerTaskId = null;
  var ganttDrag = null;
  var wikiEditMode = false;

  /* Stored workspaces are normalised, never re-seeded. An existing plan the
     user emptied out must stay empty - the old `!state.tasks.length` guard was
     what silently re-injected the demo template on every visit. */
  function normalizeState(raw, projectTitle) {
    var next = createEmptyState(projectTitle);
    if (!raw || typeof raw !== 'object') return next;
    Object.keys(raw).forEach(function (key) {
      if (raw[key] !== undefined && raw[key] !== null) next[key] = raw[key];
    });
    LIST_KEYS.forEach(function (key) {
      if (!Array.isArray(next[key])) next[key] = [];
    });
    if (!next.collapsedWbs || typeof next.collapsedWbs !== 'object' || Array.isArray(next.collapsedWbs)) {
      next.collapsedWbs = {};
    }
    next.stateVersion = STATE_VERSION;
    return next;
  }

  /* Seeded sample plans carry these fingerprints. The old build wrote the
     sample template into localStorage for the shared `project-planning-workspace`
     key, which is why the sidebar shortcut used to open with borrowed demo data. */
  function isSeededDemoPlan(plan) {
    if (!plan || typeof plan !== 'object') return false;
    if (String(plan.projectCode || '') === 'PRJ-2026-Q4') return true;
    if (/Enterprise Release/.test(String(plan.projectName || ''))) return true;
    var tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
    return tasks.some(function (task) {
      return task && /^TSK-10\d$/.test(String(task.id || ''));
    });
  }

  /* Either shipped demo template: the release sample above, or the Data Quantals
     master WBS tree. Only consulted for the blank workspace, which must never
     open with borrowed content. */
  function isDemoFingerprint(plan) {
    if (isSeededDemoPlan(plan)) return true;
    if (!plan || typeof plan !== 'object') return false;
    if (String(plan.projectCode || '') === 'WBS-2026') return true;
    return /Construction of a House/i.test(String(plan.projectName || ''));
  }

  /* One-time wash of the demo template. Only plans that still match the seeded
     sample are removed - a genuinely edited plan is left exactly as it is. */
  function purgeSeededDemoPlansOnce() {
    try {
      if (localStorage.getItem(LEGACY_DEMO_CLEANUP_KEY)) return;
      var doomed = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf(STORAGE_PREFIX) !== 0) continue;
        try {
          if (isSeededDemoPlan(JSON.parse(localStorage.getItem(key) || 'null'))) doomed.push(key);
        } catch (e) { /* leave corrupt values alone */ }
      }
      doomed.forEach(function (key) { localStorage.removeItem(key); });
      localStorage.setItem(LEGACY_DEMO_CLEANUP_KEY, '1');
    } catch (e) {}
  }

  /* Mirror the canvas router (app.js) so a workspace always loads under the
     board id it was opened with. The previous version only read segments[1],
     which collapsed `/app/project-planning-workspace/05f235/project-planning`
     into the shared `project-planning-workspace` key and showed its demo data. */
  function resolveBoardIdFromLocation() {
    var params = new URLSearchParams(window.location.search || '');
    var queryBoard = params.get('board');
    if (queryBoard) return queryBoard;

    var segments = String(window.location.pathname || '/app/')
      .replace(/^\/+|\/+$/g, '')
      .split('/')
      .filter(Boolean);
    var rest = segments.slice(1).map(function (segment) {
      try { return decodeURIComponent(segment); } catch (e) { return segment; }
    });
    if (!rest.length) return 'new-collaborative-board';
    if (rest[0] === 'board' && rest.length >= 2) return rest[1];
    if (rest.length >= 3) return rest[0] + '-' + rest[1];
    if (rest.length === 2) {
      if (KNOWN_TEMPLATES.indexOf(rest[1].toLowerCase()) !== -1) return rest[0] === 'new-project-planning-workspace' ? BLANK_WORKSPACE_ID : rest[0];
      return rest[0] + '-' + rest[1];
    }
    return rest[0] === 'new-project-planning-workspace' ? BLANK_WORKSPACE_ID : rest[0];
  }

  /* ---------- Durable plan sync (SQLite + Convex) ----------
     localStorage stays the instant-paint cache; every edit is also PUT to
     /api/projects/:boardId, which stores the plan in SQLite and mirrors it into
     Convex ("projectPlans" plus one row per section: projectTasks,
     projectPhases, projectResources, projectMilestones, projectTimesheets,
     projectWikiPages, projectFiles, projectRaidItems, projectChangeRequests).
     Without this the plan never left the browser, so Convex only ever saw the
     empty {workspaceMode} board marker. */
  function writeLocalState() {
    if (!state) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + currentBoardId, JSON.stringify(state));
    } catch (e) {}
  }

  var PLAN_SYNC_DELAY = 900;
  var planSyncTimer = null;
  var planSyncInFlight = false;
  var planSyncQueued = false;
  var planSyncStatus = 'idle'; // idle | saving | saved | local-only | error

  function planApiUrl() {
    return '/api/projects/' + encodeURIComponent(currentBoardId);
  }

  /* A plan counts as "real work" once it has a project code or at least one
     entity row. Used to decide whether a server copy may replace the local one. */
  function hasPlanContent(plan) {
    if (!plan || typeof plan !== 'object') return false;
    if (String(plan.projectCode || '').trim()) return true;
    return LIST_KEYS.some(function (key) {
      return Array.isArray(plan[key]) && plan[key].length > 0;
    });
  }

  /* Saving is debounced because every edit funnels through persistState(). */
  function schedulePlanSync() {
    if (planSyncTimer) clearTimeout(planSyncTimer);
    planSyncTimer = setTimeout(flushPlanToServer, PLAN_SYNC_DELAY);
  }

  /* PUT the whole plan. SQLite stores the snapshot; the server mirrors it into
     Convex. "convexSynced: false" means the local write succeeded but the mirror
     did not, so the next edit retries. */
  function flushPlanToServer() {
    planSyncTimer = null;
    if (!state || !currentBoardId || typeof fetch !== 'function') return;
    /* Never persist a demo template under the canonical blank workspace id:
       that is what kept resurrecting the sample plan on the server. */
    if (currentBoardId === BLANK_WORKSPACE_ID && isDemoFingerprint(state)) {
      planSyncStatus = 'local-only';
      return;
    }
    if (planSyncInFlight) {
      planSyncQueued = true;
      return;
    }

    planSyncInFlight = true;
    planSyncStatus = 'saving';
    var boardIdAtSend = currentBoardId;

    fetch(planApiUrl(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: state, stateVersion: STATE_VERSION })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        planSyncStatus = data && data.convexSynced ? 'saved' : 'local-only';
      })
      .catch(function (err) {
        planSyncStatus = 'error';
        console.warn('[project-planning] plan save failed:', err && err.message);
      })
      .then(function () {
        planSyncInFlight = false;
        if (currentBoardId !== boardIdAtSend) planSyncQueued = false;
        if (planSyncQueued) {
          planSyncQueued = false;
          schedulePlanSync();
        }
      });
  }

  /* Push a still-debounced edit right away (board switch, tab close). */
  function flushPendingPlan() {
    if (!planSyncTimer) return;
    clearTimeout(planSyncTimer);
    planSyncTimer = null;
    flushPlanToServer();
  }

  /* Last-chance save when the tab goes away. keepalive bodies are capped at
     ~64KB by browsers, so a very large plan waits for the next edit; the
     localStorage copy already has it. */
  function flushPlanOnUnload() {
    flushPendingPlan();
    if (!state || !currentBoardId || typeof fetch !== 'function') return;
    if (currentBoardId === BLANK_WORKSPACE_ID && isDemoFingerprint(state)) return;
    try {
      var body = JSON.stringify({ plan: state, stateVersion: STATE_VERSION });
      if (body.length > 60000) return;
      fetch(planApiUrl(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true
      });
    } catch (e) {}
  }

  /* Cold browser: adopt the durable plan instead of starting empty. Skipped when
     the user already has real work locally (or the plan is empty everywhere). */
  function hydratePlanFromServer(projectTitle) {
    if (!currentBoardId || typeof fetch !== 'function') return;
    var boardIdAtRequest = currentBoardId;

    fetch(planApiUrl(), { headers: { Accept: 'application/json' } })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        if (!data || !data.plan) return;
        if (currentBoardId !== boardIdAtRequest) return;
        if (hasPlanContent(state)) return;
        /* An older client may have left the demo snapshot on the server under
           the blank id; restoring it would just re-seed the sample plan. */
        if (boardIdAtRequest === BLANK_WORKSPACE_ID && isDemoFingerprint(data.plan)) return;
        if (!hasPlanContent(data.plan) && !Array.isArray(data.plan.wbsPhases)) return;

        state = normalizeState(data.plan, projectTitle);
        if (projectTitle) state.projectName = projectTitle;
        if (state.wikiPages.length && !state.wikiPages.some(function (w) { return w.id === state.activeWikiId; })) {
          state.activeWikiId = state.wikiPages[0].id;
        }
        writeLocalState();
        renderAll();
        notify('Plan restored from the cloud');
      })
      .catch(function () { /* offline: the local cache stays authoritative */ });
  }

  function loadState(boardId, projectTitle) {
    currentBoardId = boardId || 'default-project-workspace';
    state = null;
    var isQuantals = (currentBoardId === 'data-quantals-plan');
    try {
      var raw = localStorage.getItem(STORAGE_PREFIX + currentBoardId);
      if (raw) state = normalizeState(JSON.parse(raw), projectTitle);
    } catch (e) {
      state = null;
    }

    /* The canonical blank workspace is allowed to be blank. A browser that
       visited an older build can still hold either demo template under this
       key, so drop those fingerprints here - otherwise "New Project Planning
       Workspace" opens with borrowed deliverables. Real work is untouched. */
    if (state && currentBoardId === BLANK_WORKSPACE_ID && isDemoFingerprint(state)) {
      state = null;
    }

    if (!state || (isQuantals && (!state.tasks || !state.tasks.length))) {
      if (isQuantals) {
        state = createDataQuantalsPlanState(projectTitle || 'Construction of a House');
      } else {
        state = createEmptyState(projectTitle);
      }
      writeLocalState();
      hydratePlanFromServer(projectTitle);
    }

    if (state.wikiPages.length && !state.wikiPages.some(function (w) { return w.id === state.activeWikiId; })) {
      state.activeWikiId = state.wikiPages[0].id;
    }

    if (projectTitle) state.projectName = projectTitle;
  }

  function persistState() {
    if (!state) return;
    state.updatedAt = Date.now();
    writeLocalState();
    schedulePlanSync();
  }

  function persistAndRender(msg) {
    persistState();
    renderAll();
    if (msg) notify(msg);
  }

  function notify(msg) {
    var toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText =
      'position:fixed;bottom:24px;right:24px;background:#0f172a;color:#ffffff;' +
      'padding:10px 16px;border-radius:6px;font-size:12.5px;font-weight:500;' +
      'box-shadow:0 4px 14px rgba(0,0,0,0.18);z-index:250;pointer-events:none;' +
      'transition:opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);' +
      'transform:translateY(6px);opacity:0;';
    document.body.appendChild(toast);
    requestAnimationFrame(function () {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
      setTimeout(function () { toast.remove(); }, 220);
    }, 2400);
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getResource(id) {
    return state.resources.find(function (r) { return r.id === id; }) || {
      id: id, name: 'Unassigned', role: 'Team Member', avatar: '?', color: '#94a3b8'
    };
  }

  function getTask(id) {
    return state.tasks.find(function (t) { return t.id === id; });
  }

  function dayToDateStr(dayNum) {
    var base = new Date(2026, 10, 1);
    var d = new Date(base.getTime() + (dayNum - 1) * 86400000);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatCurrency(val) {
    return '$' + (Number(val) || 0).toLocaleString('en-US');
  }

  /* ---------- Empty base-layout scaffolding ---------- */
  function emptyStateHtml(opts) {
    var actions = (opts.actions || []).map(function (a) {
      return '<button class="pp-btn' + (a.variant === 'primary' ? ' pp-btn--primary' : '') + '" data-pp-empty-action="' + a.action + '" type="button">' + escapeHtml(a.label) + '</button>';
    }).join('');
    return '<div class="pp-empty-state">' +
      '<div class="pp-empty-state__mark" aria-hidden="true">' + (opts.icon || '&#43;') + '</div>' +
      '<h3>' + escapeHtml(opts.title) + '</h3>' +
      '<p>' + escapeHtml(opts.description) + '</p>' +
      (actions ? '<div class="pp-empty-state__actions">' + actions + '</div>' : '') +
    '</div>';
  }

  function bindEmptyActions(root) {
    root.querySelectorAll('[data-pp-empty-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.dataset.ppEmptyAction;
        if (action === 'new-task') promptNewTask();
        else if (action === 'sample') loadSampleProject();
        else if (action === 'new-wiki') createWikiPage();
        else if (action === 'new-raid') addRaidItem();
        else if (action === 'new-resource') addResource();
      });
    });
  }

  /* Sample content is opt-in only, never a default. */
  function loadSampleProject() {
    var sample = createSampleState(state.projectName);
    sample.projectName = state.projectName;
    sample.activeModule = state.activeModule;
    sample.ganttScale = state.ganttScale;
    sample.taskSubView = state.taskSubView;
    state = sample;
    persistAndRender('Sample project loaded');
  }

  function createWikiPage() {
    var n = 1;
    while (state.wikiPages.some(function (w) { return w.id === 'wiki-' + n; })) n++;
    var page = {
      id: 'wiki-' + n,
      title: 'Untitled page',
      updatedBy: 'You',
      updatedAt: 'Just now',
      version: 'v1.0',
      history: [],
      content: ''
    };
    state.wikiPages.push(page);
    state.activeWikiId = page.id;
    state.activeModule = 'collab';
    persistAndRender('Created wiki page');
  }

  function addRaidItem() {
    var n = 1;
    while (state.raidItems.some(function (r) { return r.id === 'RAID-' + (n < 10 ? '0' + n : n); })) n++;
    state.raidItems.push({
      id: 'RAID-' + (n < 10 ? '0' + n : n),
      type: 'Risk',
      title: '',
      probability: 2,
      severity: 2,
      ownerId: null,
      linkedTaskId: null,
      status: 'Open',
      mitigation: ''
    });
    state.raidFilter = 'ALL';
    persistAndRender('Logged a new RAID item — describe it inline');
  }

  function addResource() {
    var max = 0;
    state.resources.forEach(function (r) {
      var match = /^res-(\d+)$/.exec(r.id || '');
      if (match) max = Math.max(max, Number(match[1]));
    });
    var n = max + 1;
    var name = 'Teammate ' + n;
    state.resources.push({
      id: 'res-' + n,
      name: name,
      role: 'Team Member',
      category: 'Personnel - Delivery',
      maxHours: 40,
      rate: 0,
      availability: 'Available',
      avatar: 'T' + n
    });
    state.activeModule = 'resources';
    persistAndRender('Added ' + name);
  }

  function detectSchedulingConflicts() {
    var conflicts = [];
    state.tasks.forEach(function (task) {
      (task.dependencies || []).forEach(function (dep) {
        var fromTask = getTask(dep.fromTaskId);
        if (!fromTask) return;
        if (dep.type === 'FS') {
          var fromEnd = fromTask.startDay + fromTask.durationDays;
          if (task.startDay < fromEnd) {
            conflicts.push({
              toTask: task,
              fromTask: fromTask,
              type: 'FS',
              overlapDays: fromEnd - task.startDay,
              message: task.id + ' (' + task.title.slice(0, 24) + '…) starts on Day ' + task.startDay + ', but predecessor ' + fromTask.id + ' finishes on Day ' + fromEnd + ' (' + (fromEnd - task.startDay) + 'd overlap).'
            });
          }
        } else if (dep.type === 'SS') {
          if (task.startDay < fromTask.startDay) {
            conflicts.push({
              toTask: task,
              fromTask: fromTask,
              type: 'SS',
              overlapDays: fromTask.startDay - task.startDay,
              message: task.id + ' starts on Day ' + task.startDay + ', but SS predecessor ' + fromTask.id + ' does not start until Day ' + fromTask.startDay + '.'
            });
          }
        }
      });
    });
    return conflicts;
  }

  function autoResolveConflicts() {
    var conflicts = detectSchedulingConflicts();
    if (!conflicts.length) {
      notify('All dependencies already satisfied! No scheduling conflicts.');
      return;
    }
    conflicts.forEach(function (c) {
      if (c.type === 'FS') {
        var neededStart = c.fromTask.startDay + c.fromTask.durationDays;
        c.toTask.startDay = neededStart;
      } else if (c.type === 'SS') {
        c.toTask.startDay = c.fromTask.startDay;
      }
    });
    persistAndRender('Auto-resolved ' + conflicts.length + ' scheduling conflicts on Gantt chart');
  }

  function computeMetrics() {
    var totalTasks = state.tasks.length;
    var doneTasks = state.tasks.filter(function (t) { return t.status === 'done'; }).length;
    var inProgTasks = state.tasks.filter(function (t) { return t.status === 'in-progress' || t.status === 'review'; }).length;
    var totalPoints = state.tasks.reduce(function (a, t) { return a + (Number(t.storyPoints) || 0); }, 0);
    var completedPoints = state.tasks
      .filter(function (t) { return t.status === 'done'; })
      .reduce(function (a, t) { return a + (Number(t.storyPoints) || 0); }, 0);
    var overallProgress = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;
    var committedBudget = state.tasks.reduce(function (a, t) { return a + (Number(t.budget) || 0); }, 0);
    var conflicts = detectSchedulingConflicts();
    return {
      totalTasks: totalTasks,
      doneTasks: doneTasks,
      inProgTasks: inProgTasks,
      totalPoints: totalPoints,
      completedPoints: completedPoints,
      overallProgress: overallProgress,
      committedBudget: committedBudget,
      conflictsCount: conflicts.length
    };
  }

  /* ---------- Shell Initialization ---------- */
  function ensureShellMounted() {
    if (document.getElementById('project-planning-workspace')) return;

    var wrapper = document.createElement('div');
    wrapper.id = 'project-planning-workspace';
    wrapper.className = 'pp-workspace';
    wrapper.hidden = true;

    var backLabel = (document.referrer && !document.referrer.includes('/app/')) ? 'Back to previous page' : 'Back to Dashboard';

    wrapper.innerHTML =
      '<!-- Left Navigation Sidebar -->' +
      '<aside class="pp-sidebar">' +
        '<div class="pp-sidebar__brand">' +
          '<div class="pp-sidebar__logo">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M3 9h18"/></svg>' +
            '<span>Project Suite</span>' +
          '</div>' +
          '<span class="pp-sidebar__suite-tag">Agile</span>' +
        '</div>' +

        '<div class="pp-sidebar__back-wrap">' +
          '<button class="pp-sidebar__back-btn" id="pp-switch-to-canvas" type="button" title="' + backLabel + '">' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>' +
            '<span id="pp-back-label">' + backLabel + '</span>' +
          '</button>' +
        '</div>' +

        '<button class="pp-sidebar__quick-create" id="pp-btn-quick-task" type="button">' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>' +
          '<span>New Deliverable</span>' +
        '</button>' +

        '<div class="pp-sidebar__section-title">Navigation</div>' +
        '<nav class="pp-nav" role="tablist">' +
          '<button class="pp-nav__btn is-active" data-pp-nav="gantt" type="button" role="tab">' +
            '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="6" y1="18" x2="14" y2="18"/></svg>' +
            '<span>Gantt &amp; Timelines</span>' +
          '</button>' +
          '<button class="pp-nav__btn" data-pp-nav="tasks" type="button" role="tab">' +
            '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>' +
            '<span>WBS &amp; Kanban</span>' +
            '<span class="pp-nav__badge" id="pp-nav-count-tasks" hidden></span>' +
          '</button>' +
          '<button class="pp-nav__btn" data-pp-nav="resources" type="button" role="tab">' +
            '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>' +
            '<span>Resource Capacity</span>' +
          '</button>' +
          '<button class="pp-nav__btn" data-pp-nav="collab" type="button" role="tab">' +
            '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
            '<span>Collaboration &amp; Wiki</span>' +
          '</button>' +
          '<button class="pp-nav__btn" data-pp-nav="reporting" type="button" role="tab">' +
            '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>' +
            '<span>Executive Digest</span>' +
          '</button>' +
          '<button class="pp-nav__btn" data-pp-nav="risk" type="button" role="tab">' +
            '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
            '<span>RAID &amp; Change Control</span>' +
            '<span class="pp-nav__badge" id="pp-nav-count-risk" hidden></span>' +
          '</button>' +
        '</nav>' +

        '<div class="pp-sidebar__danger">' +
          '<button class="pp-sidebar__delete" id="pp-btn-delete-plan" type="button">Delete plan</button>' +
        '</div>' +
      '</aside>' +

      '<!-- Right Main Area -->' +
      '<div class="pp-main">' +
        '<header class="pp-topbar">' +
          '<div class="pp-topbar__title-group">' +
            '<div class="pp-topbar__title" id="pp-header-title">Project Planning</div>' +
          '</div>' +
          '<div class="pp-topbar__actions">' +
            '<button class="pp-btn pp-btn--sm" id="pp-btn-export-report" type="button">Export Digest</button>' +
            '<button class="pp-btn pp-btn--sm pp-btn--primary" id="pp-btn-top-new-task" type="button">+ Add Deliverable</button>' +
          '</div>' +
        '</header>' +

        '<main class="pp-viewport">' +
          '<section class="pp-pane is-active" id="pp-pane-gantt" data-pane="gantt"></section>' +
          '<section class="pp-pane" id="pp-pane-tasks" data-pane="tasks"></section>' +
          '<section class="pp-pane" id="pp-pane-resources" data-pane="resources"></section>' +
          '<section class="pp-pane" id="pp-pane-collab" data-pane="collab"></section>' +
          '<section class="pp-pane" id="pp-pane-reporting" data-pane="reporting"></section>' +
          '<section class="pp-pane" id="pp-pane-risk" data-pane="risk"></section>' +
        '</main>' +

        '<!-- Edit with AI: one instruction, applied to the shared plan -->' +
        '<form class="pp-ai-bar" id="pp-ai-form" autocomplete="off">' +
          '<label class="pp-ai-bar__label" for="pp-ai-input">Edit with AI</label>' +
          '<input class="pp-ai-bar__input" id="pp-ai-input" type="text" placeholder="Tell the copilot what to change — “move Paint to Done”, “add a phase for Handover”…" />' +
          '<button class="pp-ai-bar__send" id="pp-ai-send" type="submit">Apply</button>' +
          '<p class="pp-ai-bar__status" id="pp-ai-status" role="status" aria-live="polite"></p>' +
        '</form>' +
      '</div>' +

      '<!-- Backdrop overlay for slide-over drawer -->' +
      '<div class="pp-drawer-backdrop" id="pp-drawer-backdrop"></div>' +

      '<!-- Flyout Action Drawer (Contextual feeds, chats, wiki specs & files) -->' +
      '<aside class="pp-drawer" id="pp-task-drawer" aria-label="Task Detail Drawer">' +
        '<div class="pp-drawer__header">' +
          '<h3 id="pp-drawer-heading">Deliverable Details</h3>' +
          '<button class="pp-drawer__close" id="pp-drawer-close" type="button" aria-label="Close drawer">&times;</button>' +
        '</div>' +
        '<div class="pp-drawer__nav">' +
          '<button class="pp-drawer__tab is-active" data-drawer-tab="details" type="button">Details &amp; Fields</button>' +
          '<button class="pp-drawer__tab" data-drawer-tab="comments" type="button">Discussion (<span id="pp-drawer-comment-count">0</span>)</button>' +
          '<button class="pp-drawer__tab" data-drawer-tab="wiki" type="button">Wiki Spec</button>' +
          '<button class="pp-drawer__tab" data-drawer-tab="files" type="button">Artifacts</button>' +
        '</div>' +
        '<div class="pp-drawer__body" id="pp-drawer-body"></div>' +
      '</aside>';

    document.body.appendChild(wrapper);
    shellEl = document.getElementById('project-planning-workspace');
    drawerEl = document.getElementById('pp-task-drawer');
    backdropEl = document.getElementById('pp-drawer-backdrop');
    bindGlobalShellEvents();
  }

  function bindGlobalShellEvents() {
    bindAiEditBar();

    shellEl.querySelectorAll('[data-pp-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setActiveModule(btn.dataset.ppNav);
      });
    });

    document.getElementById('pp-btn-quick-task')?.addEventListener('click', promptNewTask);
    document.getElementById('pp-btn-top-new-task')?.addEventListener('click', promptNewTask);

    document.getElementById('pp-btn-export-report')?.addEventListener('click', function () {
      exportExecutiveReport();
    });

    document.getElementById('pp-switch-to-canvas')?.addEventListener('click', function (e) {
      if (e) e.preventDefault();
      closeWorkspace();
    });

    document.getElementById('pp-btn-delete-plan')?.addEventListener('click', deletePlan);

    document.getElementById('pp-drawer-close')?.addEventListener('click', closeTaskDrawer);
    backdropEl?.addEventListener('click', closeTaskDrawer);

    // Global Gantt Bar Dragging Listeners
    window.addEventListener('mousemove', function (e) {
      if (!ganttDrag) return;
      var dx = e.clientX - ganttDrag.startX;
      var deltaDays = Math.round(dx / ganttDrag.pxPerDay);
      var task = getTask(ganttDrag.taskId);
      if (!task) return;

      if (ganttDrag.mode === 'move') {
        var nextStart = Math.max(1, Math.min(34, ganttDrag.origStart + deltaDays));
        if (nextStart !== task.startDay) {
          task.startDay = nextStart;
          renderGanttPane();
          renderTopHeaderAndRibbon();
        }
      } else if (ganttDrag.mode === 'resize') {
        var nextDur = Math.max(1, Math.min(25, ganttDrag.origDuration + deltaDays));
        if (nextDur !== task.durationDays) {
          task.durationDays = nextDur;
          renderGanttPane();
          renderTopHeaderAndRibbon();
        }
      }
    });

    window.addEventListener('mouseup', function () {
      if (ganttDrag) {
        var t = getTask(ganttDrag.taskId);
        ganttDrag = null;
        persistState();
        if (t) {
          notify('Updated ' + t.id + ': ' + dayToDateStr(t.startDay) + ' – ' + dayToDateStr(t.startDay + t.durationDays));
        }
      }
    });
  }

  function nextTaskId() {
    var max = 100;
    state.tasks.forEach(function (t) {
      var match = /^TSK-(\d+)$/.exec(t.id || '');
      if (match) max = Math.max(max, Number(match[1]));
    });
    return 'TSK-' + (max + 1);
  }

  /* Growing a plan from zero has to work: the first deliverable creates the
     minimal WBS containers it needs rather than depending on seeded phases. */
  function ensureWorkPackage() {
    if (!state.wbsPhases.length) {
      state.wbsPhases.push({
        wbs: '1.0',
        title: 'Phase 1',
        packages: [{ wbs: '1.1', title: 'Work Package 1.1' }]
      });
    }

    var phase = state.wbsPhases[0];
    if (!Array.isArray(phase.packages) || !phase.packages.length) {
      var phaseCode = String(phase.wbs || '1.0').replace(/\.0$/, '');
      phase.packages = [{ wbs: phaseCode + '.1', title: 'Work Package ' + phaseCode + '.1' }];
    }

    return { phase: phase, pkg: phase.packages[0] };
  }

  /* Phases are the top level of the plan. They are stored once in
     `state.wbsPhases`, so the WBS diagram, the outline, the Gantt and the
     kanban all read the same record. */
  function nextPhaseNumber() {
    var max = 0;
    state.wbsPhases.forEach(function (phase) {
      var match = /^(\d+)\.0$/.exec(String(phase.wbs || ''));
      if (match) max = Math.max(max, Number(match[1]));
    });
    return max + 1;
  }

  function addPhase(title) {
    var n = nextPhaseNumber();
    var phaseWbs = n + '.0';
    var name = String(title || '').trim() || ('Phase ' + n);

    state.wbsPhases.push({
      wbs: phaseWbs,
      title: name,
      packages: [{ wbs: n + '.1', title: 'Work Package ' + n + '.1' }]
    });

    persistAndRender('Added ' + name + ' (' + phaseWbs + ')');
    return phaseWbs;
  }

  /* Double-clicking a phase title swaps it for an input in place. Enter or blur
     commits, Escape restores. The write goes through persistAndRender(), which
     stores the plan locally and pushes it to /api/projects so it survives a
     different browser. */
  function renamePhaseInline(phaseWbs, hostEl) {
    var phase = state.wbsPhases.find(function (p) { return p.wbs === phaseWbs; });
    if (!phase || !hostEl || hostEl.querySelector('.pp-inline-input')) return;

    var original = phase.title;
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'pp-inline-input';
    input.value = original;
    input.maxLength = 120;
    input.setAttribute('aria-label', 'Phase name');

    hostEl.textContent = '';
    hostEl.appendChild(input);
    input.focus();
    input.select();

    var settled = false;
    function settle(save) {
      if (settled) return;
      settled = true;
      var next = String(input.value || '').trim();
      if (save && next && next !== original) {
        phase.title = next;
        persistAndRender('Renamed ' + phase.wbs + ' to ' + next);
      } else {
        renderTasksPane();
      }
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); settle(true); }
      else if (e.key === 'Escape') { e.preventDefault(); settle(false); }
    });
    input.addEventListener('blur', function () { settle(true); });
    input.addEventListener('click', function (e) { e.stopPropagation(); });
    input.addEventListener('dblclick', function (e) { e.stopPropagation(); });
  }

  /* ==========================================================================
     DELETION — every destructive action confirms, mutates the single plan
     state, then persists. Because the save is a whole-snapshot PUT, the server
     mirror prunes the removed rows from Convex (projectTasks, projectPhases,
     projectRaidItems, …) on the same write.
     ========================================================================== */
  function dropReferencesToTask(taskId) {
    state.tasks.forEach(function (t) {
      if (Array.isArray(t.dependencies)) {
        t.dependencies = t.dependencies.filter(function (dep) { return dep.fromTaskId !== taskId; });
      }
    });
    state.raidItems.forEach(function (item) {
      if (item.linkedTaskId === taskId) item.linkedTaskId = null;
    });
    state.timesheets = state.timesheets.filter(function (row) { return row.taskId !== taskId; });
  }

  function deleteTask(taskId) {
    var task = getTask(taskId);
    if (!task) return false;
    if (!window.confirm('Delete ' + task.id + ' — “' + task.title + '”?\n\nIt disappears from the WBS, Kanban, Gantt, timesheets and reports.')) {
      return false;
    }
    state.tasks = state.tasks.filter(function (t) { return t.id !== taskId; });
    dropReferencesToTask(taskId);
    if (activeDrawerTaskId === taskId) closeTaskDrawer();
    persistAndRender('Deleted ' + task.id);
    return true;
  }

  function deletePhase(phaseWbs) {
    var phase = state.wbsPhases.find(function (p) { return p.wbs === phaseWbs; });
    if (!phase) return false;

    var doomed = state.tasks.filter(function (t) { return t.phaseWbs === phaseWbs; });
    var detail = doomed.length
      ? ' and its ' + doomed.length + ' deliverable' + (doomed.length === 1 ? '' : 's')
      : '';

    if (!window.confirm('Delete ' + phase.title + ' (' + phaseWbs + ')' + detail + '?\n\nThis cannot be undone.')) {
      return false;
    }

    doomed.forEach(function (t) { dropReferencesToTask(t.id); });
    state.tasks = state.tasks.filter(function (t) { return t.phaseWbs !== phaseWbs; });
    state.wbsPhases = state.wbsPhases.filter(function (p) { return p.wbs !== phaseWbs; });
    delete state.collapsedWbs[phaseWbs];
    persistAndRender('Deleted ' + phase.title);
    return true;
  }

  function deleteRaidItem(itemId) {
    var item = state.raidItems.find(function (r) { return r.id === itemId; });
    if (!item) return false;
    if (!window.confirm('Delete ' + item.id + ' — “' + item.title + '”?')) return false;
    state.raidItems = state.raidItems.filter(function (r) { return r.id !== itemId; });
    persistAndRender('Deleted ' + item.id);
    return true;
  }

  function deleteChangeRequest(crId) {
    var cr = state.changeRequests.find(function (c) { return c.id === crId; });
    if (!cr) return false;
    if (!window.confirm('Delete change request ' + cr.id + ' — “' + cr.title + '”?')) return false;
    state.changeRequests = state.changeRequests.filter(function (c) { return c.id !== crId; });
    persistAndRender('Deleted ' + cr.id);
    return true;
  }

  function deleteWikiPage(pageId) {
    var page = state.wikiPages.find(function (w) { return w.id === pageId; });
    if (!page) return false;
    if (!window.confirm('Delete the wiki page “' + page.title + '”?')) return false;

    state.wikiPages = state.wikiPages.filter(function (w) { return w.id !== pageId; });
    if (state.activeWikiId === pageId) {
      state.activeWikiId = state.wikiPages.length ? state.wikiPages[0].id : null;
    }
    wikiEditMode = false;
    persistAndRender('Deleted wiki page');
    return true;
  }

  function deleteResource(resourceId) {
    var res = state.resources.find(function (r) { return r.id === resourceId; });
    if (!res) return false;
    if (!window.confirm('Remove ' + res.name + ' from the plan?\n\nTheir timesheet rows go too; deliverables become unassigned.')) {
      return false;
    }

    state.resources = state.resources.filter(function (r) { return r.id !== resourceId; });
    state.tasks.forEach(function (t) { if (t.assigneeId === resourceId) t.assigneeId = null; });
    state.timesheets = state.timesheets.filter(function (row) { return row.resourceId !== resourceId; });
    persistAndRender('Removed ' + res.name);
    return true;
  }

  /* Wipes the whole plan from SQLite and Convex, then leaves a fresh empty plan
     on screen. Deliberately skips schedulePlanSync so the delete is not undone
     by the next autosave. */
  function deletePlan() {
    if (!state) return;
    var name = state.projectName || 'this plan';
    if (!window.confirm('Delete “' + name + '” and everything in it?\n\nThis removes the plan from the database and cannot be undone.')) {
      return;
    }

    var projectName = state.projectName || 'Untitled Project';
    fetch(planApiUrl(), { method: 'DELETE' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        try { localStorage.removeItem(STORAGE_PREFIX + currentBoardId); } catch (e) {}
        state = createEmptyState(projectName);
        closeTaskDrawer();
        renderAll();
        notify(data && data.convexSynced ? 'Plan deleted from the database' : 'Plan deleted locally');
      })
      .catch(function (err) {
        console.warn('[project-planning] plan delete failed:', err && err.message);
        notify('Could not delete the plan. Please try again.');
      });
  }

  /* ==========================================================================
     EDIT WITH AI — one instruction, translated into plan operations and applied
     to the same `state` every view renders from. Nothing here bypasses the
     normal save path: the result goes through persistAndRender().
     ========================================================================== */
  var TASK_STATUSES = ['backlog', 'todo', 'in-progress', 'review', 'done'];

  function clampInt(value, min, max, fallback) {
    var n = Number(value);
    if (!isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  function normalizeStatus(value) {
    var s = String(value || '').toLowerCase();
    return TASK_STATUSES.indexOf(s) !== -1 ? s : null;
  }

  /* Compact, token-friendly view of the plan. Ids and wbs codes are what the
     model needs to target existing rows. */
  function buildPlanSnapshot() {
    return {
      projectName: state.projectName,
      activeModule: state.activeModule,
      phases: (state.wbsPhases || []).map(function (phase) {
        return {
          wbs: phase.wbs,
          title: phase.title,
          packages: (phase.packages || []).map(function (pkg) { return { wbs: pkg.wbs, title: pkg.title }; })
        };
      }),
      tasks: (state.tasks || []).slice(0, 120).map(function (task) {
        return {
          id: task.id,
          wbs: task.wbs,
          phaseWbs: task.phaseWbs,
          parentWbs: task.parentWbs,
          title: task.title,
          status: task.status,
          startDay: task.startDay,
          durationDays: task.durationDays,
          progress: task.progress
        };
      })
    };
  }

  function createAiPhase(title) {
    var n = nextPhaseNumber();
    var phase = {
      wbs: n + '.0',
      title: title,
      packages: [{ wbs: n + '.1', title: 'Work Package ' + n + '.1' }]
    };
    state.wbsPhases.push(phase);
    return phase;
  }

  /* Applies the model's operations. Unknown ops, missing ids and out-of-range
     numbers are skipped rather than guessed at. Returns how many landed. */
  function applyAiOperations(operations) {
    var applied = 0;
    var MAX_OPS = 25;

    (Array.isArray(operations) ? operations : []).slice(0, MAX_OPS).forEach(function (op) {
      if (!op || typeof op !== 'object') return;
      var kind = String(op.op || '').trim();

      if (kind === 'rename_project') {
        var projectTitle = String(op.title || '').trim();
        if (!projectTitle) return;
        state.projectName = projectTitle.slice(0, 120);
        applied++;
        return;
      }

      if (kind === 'add_phase') {
        var phaseTitle = String(op.title || '').trim();
        if (!phaseTitle) return;
        createAiPhase(phaseTitle.slice(0, 120));
        applied++;
        return;
      }

      if (kind === 'rename_phase') {
        var targetWbs = String(op.wbs || '');
        var nextTitle = String(op.title || '').trim();
        var phase = state.wbsPhases.find(function (p) { return p.wbs === targetWbs; });
        if (!phase || !nextTitle) return;
        phase.title = nextTitle.slice(0, 120);
        applied++;
        return;
      }

      if (kind === 'add_task') {
        var taskTitle = String(op.title || '').trim();
        if (!taskTitle) return;

        var wantedPhase = String(op.phaseWbs || '');
        var hostPhase = state.wbsPhases.find(function (p) { return p.wbs === wantedPhase; }) || state.wbsPhases[0];
        if (!hostPhase) hostPhase = createAiPhase('Phase 1');
        if (!hostPhase.packages || !hostPhase.packages.length) {
          var code = String(hostPhase.wbs || '1.0').replace(/\.0$/, '');
          hostPhase.packages = [{ wbs: code + '.1', title: 'Work Package ' + code + '.1' }];
        }

        var pkg = hostPhase.packages[0];
        var siblings = state.tasks.filter(function (t) { return t.parentWbs === pkg.wbs; }).length;
        var status = normalizeStatus(op.status) || 'todo';

        state.tasks.push({
          id: nextTaskId(),
          wbs: pkg.wbs + '.' + (siblings + 1),
          parentWbs: pkg.wbs,
          phaseWbs: hostPhase.wbs,
          title: taskTitle.slice(0, 160),
          status: status,
          priority: 'medium',
          assigneeId: null,
          sprint: state.activeSprint || '',
          storyPoints: 5,
          startDay: clampInt(op.startDay, 1, 34, 1),
          durationDays: clampInt(op.durationDays, 1, 25, 5),
          progress: status === 'done' ? 100 : 0,
          budget: 0,
          dependencies: [],
          comments: []
        });
        applied++;
        return;
      }

      if (kind === 'update_task') {
        var task = getTask(String(op.id || ''));
        if (!task) return;
        var changed = false;

        if (op.title !== undefined && String(op.title).trim()) {
          task.title = String(op.title).trim().slice(0, 160);
          changed = true;
        }
        var nextStatus = normalizeStatus(op.status);
        if (nextStatus && nextStatus !== task.status) {
          task.status = nextStatus;
          if (nextStatus === 'done') task.progress = 100;
          changed = true;
        }
        if (op.startDay !== undefined) {
          var nextStart = clampInt(op.startDay, 1, 34, task.startDay);
          if (nextStart !== task.startDay) { task.startDay = nextStart; changed = true; }
        }
        if (op.durationDays !== undefined) {
          var nextDuration = clampInt(op.durationDays, 1, 25, task.durationDays);
          if (nextDuration !== task.durationDays) { task.durationDays = nextDuration; changed = true; }
        }
        if (op.progress !== undefined) {
          var nextProgress = clampInt(op.progress, 0, 100, task.progress);
          if (nextProgress !== task.progress) { task.progress = nextProgress; changed = true; }
        }
        if (changed) applied++;
        return;
      }

      if (kind === 'delete_task') {
        var deleteId = String(op.id || '');
        var before = state.tasks.length;
        state.tasks = state.tasks.filter(function (t) { return t.id !== deleteId; });
        if (state.tasks.length !== before) applied++;
      }
    });

    return applied;
  }

  function bindAiEditBar() {
    var form = document.getElementById('pp-ai-form');
    var input = document.getElementById('pp-ai-input');
    var send = document.getElementById('pp-ai-send');
    var statusEl = document.getElementById('pp-ai-status');
    if (!form || !input) return;

    function setStatus(text, tone) {
      if (!statusEl) return;
      statusEl.textContent = text || '';
      statusEl.className = 'pp-ai-bar__status' + (tone ? ' is-' + tone : '');
    }

    function setBusy(busy) {
      form.classList.toggle('is-busy', busy);
      if (send) {
        send.disabled = busy;
        send.textContent = busy ? 'Applying…' : 'Apply';
      }
      if (input) input.readOnly = busy;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var prompt = String(input.value || '').trim();
      if (!prompt) { input.focus(); return; }

      setBusy(true);
      setStatus('Reading the plan…', 'busy');

      fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ mode: 'plan-edit', prompt: prompt, plan: buildPlanSnapshot() })
      })
        .catch(function () {
          // Offline, DNS failure, CORS, aborted request.
          throw aiUnavailableError();
        })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) throw aiUnavailableError();

          var structured = result.data && result.data.structured;
          var operations = structured && Array.isArray(structured.operations) ? structured.operations : [];
          var summary = (structured && structured.summary) || '';

          if (!operations.length) {
            setStatus(summary || 'Nothing in the plan needed to change for that instruction.', 'muted');
            return;
          }

          var applied = applyAiOperations(operations);
          if (!applied) {
            setStatus(summary || 'That change could not be matched to the current plan.', 'error');
            return;
          }

          persistAndRender(summary || ('Applied ' + applied + ' change' + (applied === 1 ? '' : 's')));
          setStatus((summary || 'Applied ' + applied + ' change' + (applied === 1 ? '' : 's')) + ' · saved', 'ok');
          input.value = '';
        })
        .catch(function (err) {
          if (err && err.aiUnavailable) {
            setStatus(AI_UNAVAILABLE_MESSAGE, 'error');
            return;
          }
          setStatus(err && err.message ? err.message : 'Could not reach the copilot.', 'error');
        })
        .then(function () { setBusy(false); });
    });
  }

  function getEffectivePhases() {
    if (state.wbsPhases && state.wbsPhases.length) return state.wbsPhases;
    var phaseMap = {};
    (state.tasks || []).forEach(function (t) {
      var pCode = t.phaseWbs || (t.wbs ? t.wbs.split('.')[0] + '.0' : '1.0');
      if (!phaseMap[pCode]) {
        phaseMap[pCode] = { wbs: pCode, title: 'Phase ' + pCode, packages: {} };
      }
      var pkgCode = t.parentWbs || (t.wbs ? t.wbs.split('.').slice(0, 2).join('.') : pCode.replace('.0', '.1'));
      if (!phaseMap[pCode].packages[pkgCode]) {
        phaseMap[pCode].packages[pkgCode] = { wbs: pkgCode, title: 'Work Package ' + pkgCode };
      }
    });
    return Object.keys(phaseMap).sort().map(function (pCode) {
      var p = phaseMap[pCode];
      return {
        wbs: p.wbs,
        title: p.title,
        packages: Object.keys(p.packages).sort().map(function (k) { return p.packages[k]; })
      };
    });
  }

  function promptNewTask(status, targetPkgWbs, targetPhaseWbs) {
    var slot;
    if (targetPkgWbs) {
      var phase = state.wbsPhases.find(function (p) {
        return p.wbs === targetPhaseWbs || (p.packages && p.packages.some(function (k) { return k.wbs === targetPkgWbs; }));
      }) || state.wbsPhases[0];
      var pkg = phase && phase.packages && phase.packages.find(function (k) { return k.wbs === targetPkgWbs; });
      if (phase && pkg) slot = { phase: phase, pkg: pkg };
    } else if (targetPhaseWbs) {
      var ph = state.wbsPhases.find(function (p) { return p.wbs === targetPhaseWbs; });
      if (ph && ph.packages && ph.packages.length) {
        slot = { phase: ph, pkg: ph.packages[0] };
      } else if (ph) {
        var newPkg = { wbs: ph.wbs.replace('.0', '.1'), title: ph.title + ' Deliverables' };
        if (!ph.packages) ph.packages = [];
        ph.packages.push(newPkg);
        slot = { phase: ph, pkg: newPkg };
      }
    }
    if (!slot) slot = ensureWorkPackage();
    var siblings = state.tasks.filter(function (t) { return t.parentWbs === slot.pkg.wbs; }).length;
    var newWbs = slot.pkg.wbs + '.' + (siblings + 1);
    var owner = state.resources.find(function (r) {
      return typeof r.category === 'string' && r.category.indexOf('Personnel') === 0;
    });
    var nextStart = state.tasks.reduce(function (max, t) {
      return Math.max(max, (Number(t.startDay) || 1) + (Number(t.durationDays) || 0));
    }, 1);
    var newId = nextTaskId();
    var columnStatus = status || 'todo';
    var newTask = {
      id: newId,
      wbs: newWbs,
      parentWbs: slot.pkg.wbs,
      phaseWbs: slot.phase.wbs,
      title: 'New Deliverable (' + newWbs + ')',
      status: columnStatus,
      priority: 'medium',
      assigneeId: owner ? owner.id : null,
      sprint: state.activeSprint || '',
      storyPoints: 5,
      startDay: nextStart,
      durationDays: 5,
      progress: columnStatus === 'done' ? 100 : 0,
      budget: 0,
      dependencies: [],
      comments: []
    };
    state.tasks.push(newTask);
    persistAndRender('Created ' + newId + ' (' + newWbs + ')');
    openTaskDrawer(newId, 'details', true);
  }

  function setActiveModule(modName) {
    state.activeModule = modName || 'gantt';
    shellEl.querySelectorAll('[data-pp-nav]').forEach(function (btn) {
      var active = btn.dataset.ppNav === state.activeModule;
      btn.classList.toggle('is-active', active);
    });
    shellEl.querySelectorAll('.pp-pane').forEach(function (pane) {
      var active = pane.dataset.pane === state.activeModule;
      pane.classList.toggle('is-active', active);
    });
    persistState();
    renderAll();
  }

  function filterTasks(tasksList) {
    return tasksList.filter(function (t) {
      if (state.assigneeFilter !== 'ALL' && t.assigneeId !== state.assigneeFilter) return false;
      if (state.searchQuery) {
        var q = state.searchQuery;
        var matchTitle = (t.title || '').toLowerCase().indexOf(q) !== -1;
        var matchId = (t.id || '').toLowerCase().indexOf(q) !== -1;
        var matchWbs = (t.wbs || '').toLowerCase().indexOf(q) !== -1;
        if (!matchTitle && !matchId && !matchWbs) return false;
      }
      return true;
    });
  }

  function renderTopHeaderAndRibbon() {
    var m = computeMetrics();
    var sideTitle = document.getElementById('pp-sidebar-proj-name');
    if (sideTitle) sideTitle.textContent = state.projectName;

    var headerTitle = document.getElementById('pp-header-title');
    if (headerTitle) headerTitle.textContent = state.projectName;

    // Sidebar counters reflect the live plan instead of the old hard-coded demo numbers.
    var navTaskCount = document.getElementById('pp-nav-count-tasks');
    if (navTaskCount) {
      navTaskCount.textContent = String(m.totalTasks);
      navTaskCount.hidden = m.totalTasks === 0;
    }
    var navRiskCount = document.getElementById('pp-nav-count-risk');
    if (navRiskCount) {
      navRiskCount.textContent = String(state.raidItems.length);
      navRiskCount.hidden = state.raidItems.length === 0;
    }
  }

  /* ==========================================================================
     MODULE A: GANTT CHART & ROADMAP (Spatial clarity, hover dependencies)
     ========================================================================== */
  function bindGanttScaleButtons(root) {
    root.querySelectorAll('[data-gantt-scale]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.ganttScale = btn.dataset.ganttScale;
        renderGanttPane();
      });
    });
  }

  function renderGanttPane() {
    var pane = document.getElementById('pp-pane-gantt');
    if (!pane) return;

    var scale = state.ganttScale || 'days';
    var pxPerDay = scale === 'days' ? 32 : scale === 'weeks' ? 24 : scale === 'months' ? 18 : 14;
    var totalDays = 36;
    var stageWidth = totalDays * pxPerDay;
    var conflicts = detectSchedulingConflicts();
    var conflictTaskIds = {};
    conflicts.forEach(function (c) { conflictTaskIds[c.toTask.id] = c; });

    var conflictBannerHtml = conflicts.length > 0
      ? '<div class="pp-conflict-banner">' +
          '<div><strong>Dependency Collision (' + conflicts.length + '):</strong> ' + escapeHtml(conflicts[0].message) + '</div>' +
          '<button class="pp-btn pp-btn--sm pp-btn--primary" id="pp-btn-resolve-conflicts" type="button">Auto-Resolve &rarr;</button>' +
        '</div>'
      : '<div class="pp-conflict-banner pp-conflict-banner--ok">' +
          '<div><strong>All Finish-to-Start &amp; Start-to-Start Dependencies Validated:</strong> Critical path clear across ' + state.tasks.length + ' deliverables. Hover any task bar to inspect connecting lines.</div>' +
          '<span class="pp-badge pp-badge--minimal">Clear</span>' +
        '</div>';

    var topTimeHtml = '';
    var bottomTimeHtml = '';

    if (scale === 'days') {
      for (var w = 0; w < 5; w++) {
        topTimeHtml += '<div style="width:' + (7 * pxPerDay) + 'px;">Week ' + (w + 1) + ' (Nov ' + (w * 7 + 1) + '–' + Math.min(30, (w + 1) * 7) + ')</div>';
      }
      for (var d = 1; d <= totalDays; d++) {
        var isWknd = (d % 7 === 0 || d % 7 === 6);
        bottomTimeHtml += '<div class="pp-gantt-time-cell ' + (isWknd ? 'is-weekend' : '') + '" style="width:' + pxPerDay + 'px;">' + d + '</div>';
      }
    } else if (scale === 'weeks') {
      var sprintName = String(state.activeSprint || '').split('(')[0].trim() || 'Current sprint';
      topTimeHtml = '<div style="width:' + (15 * pxPerDay) + 'px;">' + escapeHtml(sprintName) + '</div><div style="width:' + (21 * pxPerDay) + 'px;">Following sprints</div>';
      for (var w2 = 1; w2 <= 6; w2++) {
        bottomTimeHtml += '<div class="pp-gantt-time-cell" style="width:' + (6 * pxPerDay) + 'px;">W' + w2 + '</div>';
      }
    } else {
      topTimeHtml = '<div style="width:' + stageWidth + 'px;">Strategic Timeline (Q4 2026 – Q1 2027)</div>';
      bottomTimeHtml =
        '<div class="pp-gantt-time-cell" style="width:' + (12 * pxPerDay) + 'px;">October</div>' +
        '<div class="pp-gantt-time-cell" style="width:' + (12 * pxPerDay) + 'px;">November</div>' +
        '<div class="pp-gantt-time-cell" style="width:' + (12 * pxPerDay) + 'px;">December</div>';
    }

    var leftRowsHtml = '';
    var rightRowsHtml = '';
    var rowPositions = {};
    var currentRowIdx = 0;
    var filtered = filterTasks(state.tasks);

    state.wbsPhases.forEach(function (phase) {
      var phaseTasks = filtered.filter(function (t) { return t.phaseWbs === phase.wbs; });
      var hasTasks = phaseTasks.length > 0;

      var minDay = hasTasks ? Math.min.apply(null, phaseTasks.map(function (t) { return t.startDay; })) : 1;
      var maxEnd = hasTasks ? Math.max.apply(null, phaseTasks.map(function (t) { return t.startDay + t.durationDays; })) : 1;
      var phaseLeft = (minDay - 1) * pxPerDay;
      var phaseW = Math.max(pxPerDay, (maxEnd - minDay) * pxPerDay);

      leftRowsHtml +=
        '<div class="pp-gantt-left__row pp-gantt-left__row--phase' + (hasTasks ? '' : ' is-empty') + '">' +
          '<span class="pp-wbs-code">' + phase.wbs + '</span>' +
          '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(phase.title) + '</span>' +
          '<span></span>' +
          '<span style="font-size:11px;color:var(--pp-muted);">' + (hasTasks ? phaseTasks.length + ' items' : 'No deliverables yet') + '</span>' +
        '</div>';

      rightRowsHtml +=
        '<div class="pp-gantt-row-track" style="width:' + stageWidth + 'px;">' +
          (hasTasks
            ? '<div class="pp-gantt-bar pp-gantt-bar--phase" style="left:' + phaseLeft + 'px; width:' + phaseW + 'px;"></div>'
            : '<div class="pp-gantt-bar pp-gantt-bar--phase pp-gantt-bar--empty" style="left:0; width:' + stageWidth + 'px;"></div>') +
        '</div>';
      currentRowIdx++;

      phaseTasks.forEach(function (task) {
        var res = getResource(task.assigneeId);
        var leftPx = (task.startDay - 1) * pxPerDay;
        var widthPx = Math.max(pxPerDay, task.durationDays * pxPerDay);
        var hasConflict = Boolean(conflictTaskIds[task.id]);
        var barClass = 'pp-gantt-bar' + (task.status === 'done' ? ' pp-gantt-bar--done' : '');

        rowPositions[task.id] = {
          rowIndex: currentRowIdx,
          startX: leftPx,
          endX: leftPx + widthPx,
          yCenter: currentRowIdx * 40 + 20
        };

        leftRowsHtml +=
          '<div class="pp-gantt-left__row" data-open-task="' + task.id + '" data-hover-task="' + task.id + '">' +
            '<span class="pp-wbs-code">' + escapeHtml(task.wbs) + '</span>' +
            '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(task.title) + '</span>' +
            '<span><span class="pp-avatar-xs" title="' + escapeHtml(res.name) + '">' + res.avatar + '</span></span>' +
            '<span style="font-size:11.5px;color:var(--pp-muted);">' + task.durationDays + 'd</span>' +
          '</div>';

        rightRowsHtml +=
          '<div class="pp-gantt-row-track" style="width:' + stageWidth + 'px;">' +
            '<div class="' + barClass + '" data-gantt-task="' + task.id + '" data-hover-task="' + task.id + '" style="left:' + leftPx + 'px; width:' + widthPx + 'px;" title="' + escapeHtml(task.title) + ' (Drag to reschedule)">' +
              '<div class="pp-gantt-bar__progress" style="width:' + task.progress + '%;"></div>' +
              '<span class="pp-gantt-bar__label">' + escapeHtml(task.id) + '</span>' +
              '<span class="pp-gantt-bar__resize" data-gantt-resize="' + task.id + '"></span>' +
            '</div>' +
          '</div>';
        currentRowIdx++;
      });

      // Sharp monochrome diamond milestone directly on the track
      var ms = state.milestones.find(function (m) { return m.phaseWbs === phase.wbs; });
      if (ms) {
        var msLeft = (ms.day - 1) * pxPerDay;
        leftRowsHtml +=
          '<div class="pp-gantt-left__row" style="background:#fcfcfd;">' +
            '<span class="pp-wbs-code" style="color:#0f172a;">&#9670; MS</span>' +
            '<span style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(ms.title) + '</span>' +
            '<span></span>' +
            '<span style="font-size:11px;color:var(--pp-muted);">' + dayToDateStr(ms.day) + '</span>' +
          '</div>';

        rightRowsHtml +=
          '<div class="pp-gantt-row-track" style="width:' + stageWidth + 'px;">' +
            '<div class="pp-gantt-milestone" data-ms-id="' + ms.id + '" style="left:' + msLeft + 'px;" title="' + escapeHtml(ms.title) + '"></div>' +
            '<span class="pp-gantt-milestone__tag" style="left:' + msLeft + 'px;">' + escapeHtml(ms.title) + '</span>' +
          '</div>';
        currentRowIdx++;
      }
    });

    // Build SVG Dependencies (Hidden by default; reveal on hover)
    var totalHeight = Math.max(280, currentRowIdx * 40);
    var svgPathsHtml = '';
    state.tasks.forEach(function (task) {
      var toPos = rowPositions[task.id];
      if (!toPos) return;
      (task.dependencies || []).forEach(function (dep) {
        var fromPos = rowPositions[dep.fromTaskId];
        if (!fromPos) return;
        var startX = dep.type === 'SS' ? fromPos.startX : fromPos.endX;
        var startY = fromPos.yCenter;
        var endX = toPos.startX;
        var endY = toPos.yCenter;
        var d = 'M ' + startX + ' ' + startY +
                ' C ' + (startX + 20) + ' ' + startY + ', ' + (endX - 20) + ' ' + endY + ', ' + endX + ' ' + endY;
        svgPathsHtml +=
          '<path class="pp-gantt-dep-path" data-from="' + dep.fromTaskId + '" data-to="' + task.id + '" d="' + d + '" fill="none" marker-end="url(#pp-marker-arrow)" />';
      });
    });

    var sectionBarHtml =
      '<div class="pp-section-bar">' +
        '<div class="pp-section-bar__title">' +
          '<h2>Roadmap Timeline &amp; Milestones</h2>' +
          '<p>Crisp horizontal schedules with spatial clarity. Dependency vectors are hidden until hovered.</p>' +
        '</div>' +
        '<div style="display:flex; gap:8px;">' +
          '<div class="pp-segmented">' +
            '<button class="pp-seg-btn ' + (scale === 'days' ? 'is-active' : '') + '" data-gantt-scale="days" type="button">Days</button>' +
            '<button class="pp-seg-btn ' + (scale === 'weeks' ? 'is-active' : '') + '" data-gantt-scale="weeks" type="button">Weeks</button>' +
            '<button class="pp-seg-btn ' + (scale === 'months' ? 'is-active' : '') + '" data-gantt-scale="months" type="button">Months</button>' +
          '</div>' +
          '<button class="pp-btn pp-btn--sm" id="pp-btn-auto-schedule" type="button">Validate Dependencies</button>' +
        '</div>' +
      '</div>';

    if (!state.tasks.length) {
      pane.innerHTML = sectionBarHtml + emptyStateHtml({
        icon: '&#9776;',
        title: 'Your timeline starts empty',
        description: 'Add the first deliverable and the schedule, rollups and milestones build themselves around it.',
        actions: [
          { label: '+ Add first deliverable', action: 'new-task', variant: 'primary' },
          { label: 'Load sample project', action: 'sample' }
        ]
      });
      bindGanttScaleButtons(pane);
      bindEmptyActions(pane);
      return;
    }

    pane.innerHTML = sectionBarHtml +

      conflictBannerHtml +

      '<div class="pp-gantt-container">' +
        '<div class="pp-gantt-left">' +
          '<div class="pp-gantt-left__header">WBS Deliverable &amp; Assignee</div>' +
          '<div class="pp-gantt-left__body">' + leftRowsHtml + '</div>' +
        '</div>' +

        '<div class="pp-gantt-right" id="pp-gantt-scrollable">' +
          '<div class="pp-gantt-timeline-head" style="width:' + stageWidth + 'px;">' +
            '<div class="pp-gantt-timeline-top">' + topTimeHtml + '</div>' +
            '<div class="pp-gantt-timeline-bot">' + bottomTimeHtml + '</div>' +
          '</div>' +
          '<div class="pp-gantt-body" style="width:' + stageWidth + 'px; height:' + totalHeight + 'px;">' +
            '<svg class="pp-gantt-dep-svg" width="' + stageWidth + '" height="' + totalHeight + '">' +
              '<defs>' +
                '<marker id="pp-marker-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
                  '<path d="M 0 1 L 9 5 L 0 9 z" fill="#2563eb" />' +
                '</marker>' +
              '</defs>' +
              svgPathsHtml +
            '</svg>' +
            rightRowsHtml +
          '</div>' +
        '</div>' +
      '</div>';

    // Scale Switcher
    bindGanttScaleButtons(pane);

    document.getElementById('pp-btn-resolve-conflicts')?.addEventListener('click', autoResolveConflicts);
    document.getElementById('pp-btn-auto-schedule')?.addEventListener('click', autoResolveConflicts);

    // Interactive Hover: Reveal connecting dependencies for this task only
    pane.querySelectorAll('[data-hover-task]').forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        var taskId = el.dataset.hoverTask;
        pane.querySelectorAll('.pp-gantt-dep-path').forEach(function (p) {
          if (p.dataset.from === taskId || p.dataset.to === taskId) {
            p.classList.add('is-active-dep');
          } else {
            p.classList.remove('is-active-dep');
          }
        });
      });
      el.addEventListener('mouseleave', function () {
        pane.querySelectorAll('.pp-gantt-dep-path').forEach(function (p) {
          p.classList.remove('is-active-dep');
        });
      });
    });

    // Click row or bar -> Open contextual slide-over drawer
    pane.querySelectorAll('[data-open-task]').forEach(function (row) {
      row.addEventListener('click', function () {
        openTaskDrawer(row.dataset.openTask);
      });
    });

    // Drag-to-reschedule & duration resizing
    pane.querySelectorAll('[data-gantt-task]').forEach(function (bar) {
      bar.addEventListener('mousedown', function (e) {
        if (e.target.dataset.ganttResize) {
          ganttDrag = {
            mode: 'resize',
            taskId: bar.dataset.ganttTask,
            startX: e.clientX,
            origDuration: getTask(bar.dataset.ganttTask).durationDays,
            pxPerDay: pxPerDay
          };
        } else {
          ganttDrag = {
            mode: 'move',
            taskId: bar.dataset.ganttTask,
            startX: e.clientX,
            origStart: getTask(bar.dataset.ganttTask).startDay,
            pxPerDay: pxPerDay
          };
        }
        e.preventDefault();
      });
    });
  }

  function renderWBSDiagramHtml() {
    var phases = getEffectivePhases();
    var pillars = phases.map(function (p) {
      var pTasks = state.tasks.filter(function (t) {
        return t.phaseWbs === p.wbs || (t.wbs && t.wbs.indexOf(p.wbs.replace('.0', '')) === 0);
      });
      if (!pTasks.length && p.packages && p.packages.length) {
        var pkgList = p.packages.map(function (k) { return k.wbs; });
        pTasks = state.tasks.filter(function (t) { return pkgList.indexOf(t.parentWbs) !== -1; });
      }
      return {
        id: p.wbs,
        title: p.title.replace(/^Phase\s*[\d.]*:\s*/i, ''),
        wbs: p.wbs,
        items: pTasks
      };
    });

    var treeData = {
      projectName: state.projectName || 'Construction of a House',
      pillars: pillars
    };

    var toolbarHtml =
      '<div class="pp-tree-toolbar">' +
        '<div class="pp-tree-toolbar__legend">' +
          '<span><span class="pp-tree-legend-dot" style="background:#0d529a; border:1px solid #ffffff;"></span>Project Root Capsule</span>' +
          '<span><span class="pp-tree-legend-dot" style="background:#ffffff; border:1.5px solid #0f172a;"></span>Level-1 Category Header</span>' +
          '<span><span class="pp-tree-legend-dot" style="background:#b6cde6; border:1px solid #9cbcd8;"></span>Level-2 Light Deliverable</span>' +
          '<span><span class="pp-tree-legend-dot" style="background:#092143; border:1px solid #05152c;"></span>Level-2 Navy Deliverable</span>' +
        '</div>' +
        '<div style="display:flex; align-items:center; gap:8px;">' +
          '<button class="pp-btn pp-btn--sm" id="pp-btn-wbs-sample" type="button" title="Reload Master Reference Plan">Reload Reference Plan</button>' +
          '<button class="pp-btn pp-btn--sm" id="pp-btn-tree-add-phase" data-add-phase type="button">+ Add Phase</button>' +
          '<button class="pp-btn pp-btn--sm pp-btn--primary" id="pp-btn-tree-add-task" type="button">+ Add Deliverable</button>' +
        '</div>' +
      '</div>';

    var diagramContent = (window.WbsTreeDiagram && typeof window.WbsTreeDiagram.getHtml === 'function')
      ? window.WbsTreeDiagram.getHtml(treeData, { showQuickAdd: true })
      : '<div class="wbs-tree-canvas">WBS Tree loading...</div>';

    return '<div class="pp-wbs-diagram-wrap">' + toolbarHtml + diagramContent + '</div>';
  }

  function renderWBSOutlineHtml() {
    var phases = getEffectivePhases();
    var html = '<div class="pp-wbs-tree">';
    phases.forEach(function (phase) {
      var phaseTasks = state.tasks.filter(function (t) { return t.phaseWbs === phase.wbs; });
      var phaseProg = phaseTasks.length ? Math.round(phaseTasks.reduce(function (a, t) { return a + t.progress; }, 0) / phaseTasks.length) : 0;
      var isCollapsed = Boolean(state.collapsedWbs[phase.wbs]);

      html +=
        '<div class="pp-wbs-tree__row pp-wbs-tree__row--lvl1">' +
          '<div class="pp-wbs-tree__left">' +
            '<button class="pp-wbs-tree__chevron" data-toggle-wbs="' + phase.wbs + '" type="button" aria-label="Toggle phase">' +
              (isCollapsed ? '&#9656;' : '&#9662;') +
            '</button>' +
            '<span class="pp-wbs-code">' + phase.wbs + '</span>' +
            '<strong class="pp-wbs-tree__title pp-wbs-tree__title--editable" data-edit-phase="' + phase.wbs + '" title="Double-click to rename this phase">' + escapeHtml(phase.title) + '</strong>' +
          '</div>' +
          '<div style="display:flex; align-items:center; gap:16px;">' +
            '<span class="pp-badge pp-badge--minimal">' + phaseTasks.length + ' deliverables</span>' +
            '<span style="font-size:12.5px; font-weight:600; color:var(--pp-ink);">' + phaseProg + '% Rollup</span>' +
            '<button class="pp-icon-btn" data-delete-phase="' + phase.wbs + '" type="button" title="Delete phase" aria-label="Delete ' + escapeHtml(phase.title) + '">' +
              '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>';

      if (!isCollapsed && phase.packages) {
        phase.packages.forEach(function (pkg) {
          var pkgTasks = state.tasks.filter(function (t) { return t.parentWbs === pkg.wbs; });
          var isPkgCollapsed = Boolean(state.collapsedWbs[pkg.wbs]);

          html +=
            '<div class="pp-wbs-tree__row pp-wbs-tree__row--lvl2">' +
              '<div class="pp-wbs-tree__left">' +
                '<button class="pp-wbs-tree__chevron" data-toggle-wbs="' + pkg.wbs + '" type="button" aria-label="Toggle package">' +
                  (isPkgCollapsed ? '&#9656;' : '&#9662;') +
                '</button>' +
                '<span class="pp-wbs-code">' + pkg.wbs + '</span>' +
                '<span class="pp-wbs-tree__title">' + escapeHtml(pkg.title) + '</span>' +
              '</div>' +
              '<div><span class="pp-badge pp-badge--minimal">' + pkgTasks.length + ' items</span></div>' +
            '</div>';

          if (!isPkgCollapsed) {
            pkgTasks.forEach(function (t) {
              var res = getResource(t.assigneeId);
              var stBadge = t.status === 'done' ? 'pp-badge--green' : t.status === 'in-progress' ? 'pp-badge--blue' : 'pp-badge--minimal';
              html +=
                '<div class="pp-wbs-tree__row pp-wbs-tree__row--lvl3">' +
                  '<div class="pp-wbs-tree__left">' +
                    '<span class="pp-wbs-code">' + t.wbs + '</span>' +
                    '<span class="pp-wbs-tree__title pp-wbs-tree__title--clickable" data-open-task="' + t.id + '">' + escapeHtml(t.title) + '</span>' +
                  '</div>' +
                  '<div style="display:flex; align-items:center; gap:12px;">' +
                    '<span class="pp-avatar-xs" title="' + escapeHtml(res.name) + '">' + res.avatar + '</span>' +
                    '<span style="font-size:12px; color:var(--pp-muted);">' + t.durationDays + 'd</span>' +
                    '<span class="pp-badge ' + stBadge + '">' + escapeHtml(t.status) + '</span>' +
                  '</div>' +
                '</div>';
            });
          }
        });
      }
    });
    html += '</div>';
    html += '<div class="pp-wbs-tree__footer">' +
      '<button class="pp-btn pp-btn--sm" data-add-phase type="button">+ Add Phase</button>' +
    '</div>';
    return html;
  }

  /* ==========================================================================
     MODULE B: TASK MANAGEMENT (Nested WBS Outline Tree & Calm Kanban)
     ========================================================================== */
  function renderTasksPane() {
    var pane = document.getElementById('pp-pane-tasks');
    if (!pane) return;

    var sub = state.taskSubView || 'wbs';
    var wbsView = state.wbsView || 'diagram';
    var filtered = filterTasks(state.tasks);

    var headerHtml =
      '<div class="pp-section-bar">' +
        '<div class="pp-section-bar__title">' +
          '<h2>Deliverable Management</h2>' +
          '<p>Interactive hierarchical Work Breakdown Structure (WBS) and distraction-free Kanban board.</p>' +
        '</div>' +
        '<div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">' +
          '<div class="pp-segmented">' +
            '<button class="pp-seg-btn ' + (sub === 'wbs' ? 'is-active' : '') + '" data-task-sub="wbs" type="button">WBS Tree</button>' +
            '<button class="pp-seg-btn ' + (sub === 'kanban' ? 'is-active' : '') + '" data-task-sub="kanban" type="button">Kanban Board</button>' +
            '<button class="pp-seg-btn ' + (sub === 'backlog' ? 'is-active' : '') + '" data-task-sub="backlog" type="button">Sprint Table</button>' +
          '</div>' +
          (sub === 'wbs'
            ? '<div class="pp-segmented pp-segmented--sm" id="pp-wbs-view-switcher">' +
                '<button class="pp-seg-btn ' + (wbsView !== 'outline' ? 'is-active' : '') + '" data-wbs-view="diagram" type="button" title="Hierarchical Visual Diagram">' +
                  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><rect x="9" y="3" width="6" height="4" rx="1"/><rect x="3" y="15" width="6" height="4" rx="1"/><rect x="15" y="15" width="6" height="4" rx="1"/><path d="M12 7v5M6 15v-3h12v3"/></svg>' +
                  'Diagram' +
                '</button>' +
                '<button class="pp-seg-btn ' + (wbsView === 'outline' ? 'is-active' : '') + '" data-wbs-view="outline" type="button" title="Compact Outline List">' +
                  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>' +
                  'Outline' +
                '</button>' +
              '</div>'
            : '') +
        '</div>' +
      '</div>';

    var bodyHtml = '';

    if (!state.tasks.length && sub !== 'kanban') {
      bodyHtml = emptyStateHtml({
        icon: '&#9634;',
        title: 'No deliverables yet',
        description: 'This board is brand new. Create your first deliverable and it appears here as a WBS item, a Kanban card and a timeline bar at once.',
        actions: [
          { label: '+ Add first deliverable', action: 'new-task', variant: 'primary' },
          { label: 'Load sample project', action: 'sample' }
        ]
      });
    } else if (sub === 'wbs') {
      bodyHtml += (wbsView === 'outline') ? renderWBSOutlineHtml() : renderWBSDiagramHtml();
    } else if (sub === 'kanban') {
      // Spacious, minimal Kanban board: title + tiny initial only
      var columns = [
        { key: 'backlog', label: 'Backlog' },
        { key: 'todo', label: 'To Do' },
        { key: 'in-progress', label: 'In Progress' },
        { key: 'review', label: 'In Review' },
        { key: 'done', label: 'Done' }
      ];

      bodyHtml += '<div class="pp-kanban-grid">';
      columns.forEach(function (col) {
        var colTasks = filtered.filter(function (t) { return t.status === col.key; });
        bodyHtml +=
          '<div class="pp-kanban-col" data-kanban-col="' + col.key + '">' +
            '<div class="pp-kanban-col__head">' +
              '<span class="pp-kanban-col__title">' + col.label + '</span>' +
              '<span class="pp-badge pp-badge--minimal">' + colTasks.length + '</span>' +
            '</div>' +
            '<div class="pp-kanban-cards">';

        colTasks.forEach(function (task) {
          var res = getResource(task.assigneeId);
          bodyHtml +=
            '<article class="pp-task-card" draggable="true" data-card-task="' + task.id + '">' +
              '<div class="pp-task-card__title">' + escapeHtml(task.title) + '</div>' +
              '<div class="pp-task-card__footer">' +
                '<span class="pp-task-card__id">' + escapeHtml(task.id) + '</span>' +
                '<span class="pp-avatar-xs" title="' + escapeHtml(res.name) + '">' + res.avatar + '</span>' +
              '</div>' +
            '</article>';
        });

        bodyHtml +=
            '</div>' +
            '<button class="pp-kanban-add" type="button" data-kanban-add="' + col.key + '" aria-label="Add deliverable to ' + col.label + '">' +
              '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>' +
              'Add deliverable' +
            '</button>' +
          '</div>';
      });
      bodyHtml += '</div>';
    } else {
      // Sprint Backlog Table
      bodyHtml +=
        '<div class="pp-table-card">' +
          '<table class="pp-table">' +
            '<thead><tr>' +
              '<th>ID</th><th>WBS</th><th>Deliverable Title</th><th>Sprint</th><th>Assignee</th><th>Duration</th><th>Status</th>' +
            '</tr></thead><tbody>';

      filtered.forEach(function (t) {
        var res = getResource(t.assigneeId);
        bodyHtml +=
          '<tr data-open-task="' + t.id + '" style="cursor:pointer;">' +
            '<td><span class="pp-wbs-code">' + escapeHtml(t.id) + '</span></td>' +
            '<td><span class="pp-wbs-code">' + escapeHtml(t.wbs) + '</span></td>' +
            '<td><strong>' + escapeHtml(t.title) + '</strong></td>' +
            '<td>' + escapeHtml(t.sprint) + '</td>' +
            '<td><span style="display:inline-flex;align-items:center;gap:6px;"><span class="pp-avatar-xs">' + res.avatar + '</span>' + escapeHtml(res.name) + '</span></td>' +
            '<td>' + t.durationDays + ' days</td>' +
            '<td><span class="pp-badge pp-badge--minimal">' + escapeHtml(t.status) + '</span></td>' +
          '</tr>';
      });
      bodyHtml += '</tbody></table></div>';
    }

    pane.innerHTML = headerHtml + bodyHtml;

    pane.querySelectorAll('[data-task-sub]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.taskSubView = btn.dataset.taskSub;
        renderTasksPane();
      });
    });

    pane.querySelectorAll('[data-wbs-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.wbsView = btn.dataset.wbsView;
        persistState();
        renderTasksPane();
      });
    });

    pane.querySelector('#pp-btn-wbs-expand-all')?.addEventListener('click', function () {
      state.collapsedWbs = {};
      persistState();
      renderTasksPane();
    });

    pane.querySelector('#pp-btn-wbs-collapse-all')?.addEventListener('click', function () {
      var c = {};
      var phases = getEffectivePhases();
      phases.forEach(function (p) {
        c[p.wbs] = true;
        if (p.packages) p.packages.forEach(function (k) { c[k.wbs] = true; });
      });
      state.collapsedWbs = c;
      persistState();
      renderTasksPane();
    });

    pane.querySelector('#pp-btn-tree-add-task')?.addEventListener('click', function () {
      promptNewTask();
    });

    pane.querySelectorAll('[data-add-phase]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var suggested = 'Phase ' + nextPhaseNumber();
        var name = window.prompt('Name this phase', suggested);
        if (name === null) return; // cancelled
        addPhase(name);
      });
    });

    // Double-click a phase title to rename it in place (outline levels).
    pane.querySelectorAll('[data-edit-phase]').forEach(function (el) {
      el.addEventListener('dblclick', function (e) {
        e.preventDefault();
        e.stopPropagation();
        renamePhaseInline(el.dataset.editPhase, el);
      });
    });

    // ...and the same on the WBS diagram's Level-1 pillar headers.
    pane.querySelectorAll('[data-pillar-header]').forEach(function (header) {
      header.addEventListener('dblclick', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var host = header.querySelector('.wbs-pillar-title') || header;
        renamePhaseInline(header.dataset.pillarHeader, host);
      });
    });

    // Delete phase (outline row and diagram pillar header).
    pane.querySelectorAll('[data-delete-phase], [data-delete-pillar]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        deletePhase(btn.dataset.deletePhase || btn.dataset.deletePillar);
      });
      btn.addEventListener('dblclick', function (e) { e.stopPropagation(); });
    });

    pane.querySelector('#pp-btn-wbs-sample')?.addEventListener('click', function () {
      state = createDataQuantalsPlanState(state.projectName || 'Construction of a House');
      persistAndRender('Reloaded master reference WBS plan');
    });

    pane.querySelector('#wbs-root-node')?.addEventListener('click', function () {
      var next = prompt('Project Plan / WBS Tree Title:', state.projectName);
      if (next && next.trim()) {
        state.projectName = next.trim();
        persistAndRender('Updated project title');
      }
    });

    pane.querySelectorAll('[data-add-pillar-item]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var phaseWbs = btn.dataset.addPillarItem;
        promptNewTask('todo', null, phaseWbs);
      });
    });

    pane.querySelectorAll('[data-quick-add-pkg]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        promptNewTask('todo', btn.dataset.quickAddPkg, btn.dataset.quickAddPhase);
      });
    });

    pane.querySelectorAll('[data-toggle-wbs]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var code = btn.dataset.toggleWbs;
        state.collapsedWbs[code] = !state.collapsedWbs[code];
        persistState();
        renderTasksPane();
      });
    });

    pane.querySelectorAll('[data-open-task]').forEach(function (el) {
      el.addEventListener('click', function () {
        openTaskDrawer(el.dataset.openTask);
      });
    });

    // Kanban drag and drop mechanics
    pane.querySelectorAll('[data-card-task]').forEach(function (card) {
      card.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', card.dataset.cardTask);
      });
      card.addEventListener('click', function () {
        openTaskDrawer(card.dataset.cardTask);
      });
    });

    pane.querySelectorAll('[data-kanban-add]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        promptNewTask(btn.dataset.kanbanAdd);
      });
    });

    pane.querySelectorAll('[data-kanban-col]').forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        var taskId = e.dataTransfer.getData('text/plain');
        var task = getTask(taskId);
        var targetCol = col.dataset.kanbanCol;
        if (task && task.status !== targetCol) {
          task.status = targetCol;
          if (targetCol === 'done') task.progress = 100;
          persistAndRender('Moved ' + task.id + ' to ' + targetCol);
        }
      });
    });

    bindEmptyActions(pane);
  }

  /* ==========================================================================
     MODULE C: RESOURCE & TIME TRACKING (Ultra-thin capacity bars)
     ========================================================================== */
  function renderResourcesPane() {
    var pane = document.getElementById('pp-pane-resources');
    if (!pane) return;

    var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var tsRowsHtml = '';
    var colTotals = [0, 0, 0, 0, 0, 0, 0];

    state.timesheets.forEach(function (row) {
      var res = getResource(row.resourceId);
      var task = getTask(row.taskId) || state.tasks[0];
      if (!task) return;
      var rowSum = 0;
      var dayInputs = '';
      for (var i = 0; i < 7; i++) {
        var val = Number(row.hours[i]) || 0;
        rowSum += val;
        colTotals[i] += val;
        dayInputs += '<td class="pp-hour-cell"><input type="number" min="0" max="16" step="0.5" class="pp-hour-input" data-ts-id="' + row.id + '" data-ts-day="' + i + '" value="' + val + '" /></td>';
      }
      tsRowsHtml +=
        '<tr>' +
          '<td><span style="display:inline-flex;align-items:center;gap:6px;"><span class="pp-avatar-xs">' + res.avatar + '</span><strong>' + escapeHtml(res.name) + '</strong></span></td>' +
          '<td><span class="pp-wbs-code">' + escapeHtml(task.id) + '</span> ' + escapeHtml(task.title.slice(0, 30)) + '…</td>' +
          dayInputs +
          '<td><strong>' + rowSum + 'h</strong></td>' +
          '<td><span class="pp-badge pp-badge--minimal">' + escapeHtml(row.status) + '</span></td>' +
        '</tr>';
    });

    var grandTotal = colTotals.reduce(function (a, b) { return a + b; }, 0);

    if (!tsRowsHtml) {
      tsRowsHtml = '<tr><td colspan="11" class="pp-empty-cell">No time logged yet. Hours entered against deliverables show up here.</td></tr>';
    }

    // Ultra-thin capacity utilization bars
    var personnel = state.resources.filter(function (r) { return typeof r.category === 'string' && r.category.indexOf('Personnel') === 0; });
    var capacityHtml = '<div class="pp-capacity-list">';
    if (!personnel.length) {
      capacityHtml += '<div class="pp-empty-inline">No people on this project yet. Team members and their capacity bars appear here once they are added.</div>';
    }
    personnel.forEach(function (res) {
      var logged = state.timesheets
        .filter(function (r) { return r.resourceId === res.id; })
        .reduce(function (acc, r) {
          return acc + (r.hours || []).reduce(function (a, b) { return a + (Number(b) || 0); }, 0);
        }, 0);
      var pct = Math.round((logged / res.maxHours) * 100);
      var isOver = pct > 100;

      capacityHtml +=
        '<div class="pp-capacity-item">' +
          '<div class="pp-capacity-meta">' +
            '<div><span class="pp-capacity-meta__name">' + escapeHtml(res.name) + '</span><span class="pp-capacity-meta__role">' + escapeHtml(res.role) + '</span></div>' +
            '<div style="display:flex; align-items:center; gap:8px;">' +
              '<span style="font-size:12px; color:var(--pp-muted);">' + logged + 'h / ' + res.maxHours + 'h (' + pct + '%)</span>' +
              '<button class="pp-icon-btn" data-delete-resource="' + escapeHtml(res.id) + '" type="button" title="Remove teammate" aria-label="Remove ' + escapeHtml(res.name) + '">' +
                '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="pp-capacity-bar">' +
            '<div class="pp-capacity-bar__fill ' + (isOver ? 'pp-capacity-bar__fill--over' : '') + '" style="width:' + Math.min(100, pct) + '%;"></div>' +
          '</div>' +
        '</div>';
    });
    capacityHtml += '</div>';

    var sectionBarHtml =
      '<div class="pp-section-bar">' +
        '<div class="pp-section-bar__title">' +
          '<h2>Resource Capacity, Timesheets &amp; Resource Breakdown Structure (RBS)</h2>' +
          '<p>Monitor weekly engineer workload against max caps, inspect the Resource Breakdown Structure (RBS), and log timesheet hours.</p>' +
        '</div>' +
        '<div style="display:flex; gap:8px;">' +
          '<button class="pp-btn pp-btn--sm" id="pp-btn-rebalance" type="button">Rebalance Overallocated</button>' +
          '<button class="pp-btn pp-btn--sm pp-btn--primary" id="pp-btn-approve-ts" type="button">Approve Timesheets &#10003;</button>' +
        '</div>' +
      '</div>';

    if (!state.resources.length && !state.timesheets.length) {
      pane.innerHTML = sectionBarHtml + emptyStateHtml({
        icon: '&#9671;',
        title: 'No capacity data yet',
        description: 'Capacity and timesheets fill in once deliverables are assigned to people. Start with the plan, then bring the team in.',
        actions: [
          { label: '+ Add first deliverable', action: 'new-task', variant: 'primary' },
          { label: '+ Add teammate', action: 'new-resource' },
          { label: 'Load sample project', action: 'sample' }
        ]
      });
      bindEmptyActions(pane);
      return;
    }

    pane.innerHTML = sectionBarHtml +

      '<div style="display:grid; grid-template-columns: 340px 1fr; gap:24px; align-items:start;">' +
        '<div style="border:1px solid var(--pp-border); border-radius:8px; padding:20px; background:#ffffff;">' +
          '<h3 style="font-size:14.5px; font-weight:600; margin:0 0 16px; color:var(--pp-ink);">Team Workload Allocation</h3>' +
          capacityHtml +
        '</div>' +

        '<div class="pp-table-card">' +
          '<table class="pp-table">' +
            '<thead><tr>' +
              '<th>Member</th><th>Task</th>' +
              days.map(function (d) { return '<th>' + d + '</th>'; }).join('') +
              '<th>Total</th><th>Status</th>' +
            '</tr></thead>' +
            '<tbody>' + tsRowsHtml + '</tbody>' +
            '<tfoot><tr style="background:#f8fafc; font-weight:600;">' +
              '<td colspan="2">Week Total</td>' +
              colTotals.map(function (c) { return '<td>' + c + 'h</td>'; }).join('') +
              '<td>' + grandTotal + 'h</td><td></td>' +
            '</tr></tfoot>' +
          '</table>' +
        '</div>' +
      '</div>';

    pane.querySelectorAll('[data-ts-id]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var row = state.timesheets.find(function (r) { return r.id === inp.dataset.tsId; });
        var dayIdx = Number(inp.dataset.tsDay);
        if (row && dayIdx >= 0 && dayIdx < 7) {
          row.hours[dayIdx] = Math.max(0, Math.min(16, Number(inp.value) || 0));
          persistAndRender('Updated timesheet & recalculated workload');
        }
      });
    });

    pane.querySelectorAll('[data-delete-resource]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteResource(btn.dataset.deleteResource);
      });
    });

    document.getElementById('pp-btn-rebalance')?.addEventListener('click', function () {
      var changed = 0;
      state.timesheets.forEach(function (r) {
        if (!Array.isArray(r.hours)) return;
        var total = r.hours.reduce(function (a, b) { return a + (Number(b) || 0); }, 0);
        if (total > 40) {
          var factor = 40 / total;
          r.hours = r.hours.map(function (h) { return Math.round((Number(h) || 0) * factor); });
          changed++;
        }
      });
      persistAndRender(changed
        ? 'Rebalanced ' + changed + ' workload row' + (changed === 1 ? '' : 's') + ' down to 40h'
        : 'Every workload row is already within capacity');
    });

    document.getElementById('pp-btn-approve-ts')?.addEventListener('click', function () {
      state.timesheets.forEach(function (r) { r.status = 'Approved'; });
      persistAndRender('All timesheets approved');
    });

    bindEmptyActions(pane);
  }

  /* ==========================================================================
     MODULE D: COLLABORATION (Flyout slide-over drawer context)
     ========================================================================== */
  function renderCollabPane() {
    var pane = document.getElementById('pp-pane-collab');
    if (!pane) return;

    var activeWiki = state.wikiPages.find(function (w) { return w.id === state.activeWikiId; }) || state.wikiPages[0];

    var sectionBarHtml =
      '<div class="pp-section-bar">' +
        '<div class="pp-section-bar__title">' +
          '<h2>Workspace Documentation &amp; Wiki Specs</h2>' +
          '<p>Clean, distraction-free Markdown repository. Discussions and threaded comments trigger in the slide-over action drawer.</p>' +
        '</div>' +
        '<div style="display:flex; gap:8px;">' +
          (activeWiki && !wikiEditMode ? '<button class="pp-btn pp-btn--sm" id="pp-btn-collab-new-wiki" type="button">New Page</button>' : '') +
          '<button class="pp-btn pp-btn--sm" id="pp-btn-collab-open-drawer" type="button">Open Discussion Feed</button>' +
        '</div>' +
      '</div>';

    if (!activeWiki) {
      pane.innerHTML = sectionBarHtml + emptyStateHtml({
        icon: '&#9993;',
        title: 'No wiki pages yet',
        description: 'Write the first page to capture the charter, specs or decisions. Pages are versioned and sit right next to the plan.',
        actions: [{ label: '+ Create wiki page', action: 'new-wiki', variant: 'primary' }]
      });
      bindCollabActions(pane);
      return;
    }

    if (wikiEditMode) {
      pane.innerHTML = sectionBarHtml +
        '<div style="border:1px solid var(--pp-border); border-radius:8px; padding:24px; background:#ffffff; max-width:820px;">' +
          '<div style="display:flex; gap:8px; align-items:center; margin-bottom:16px;">' +
            '<input type="text" id="pp-wiki-title-input" value="' + escapeHtml(activeWiki.title) + '" placeholder="Page title" style="flex:1; padding:9px 12px; border:1px solid var(--pp-border); border-radius:6px; font-size:15px; font-weight:600; color:var(--pp-ink);" />' +
            '<button class="pp-btn pp-btn--sm pp-btn--primary" id="pp-wiki-save" type="button">Save page</button>' +
            '<button class="pp-btn pp-btn--sm" id="pp-wiki-cancel" type="button">Cancel</button>' +
          '</div>' +
          '<textarea id="pp-wiki-content-input" placeholder="Write in Markdown&hellip;" style="width:100%; min-height:320px; padding:14px; border:1px solid var(--pp-border); border-radius:6px; font-size:13px; font-family:ui-monospace, SFMono-Regular, Menlo, monospace; line-height:1.6; resize:vertical;">' + escapeHtml(activeWiki.content) + '</textarea>' +
        '</div>';

      document.getElementById('pp-wiki-save')?.addEventListener('click', function () {
        var titleInput = document.getElementById('pp-wiki-title-input');
        var contentInput = document.getElementById('pp-wiki-content-input');
        activeWiki.title = (titleInput ? titleInput.value : '').trim() || activeWiki.title;
        activeWiki.content = contentInput ? contentInput.value : activeWiki.content;
        activeWiki.updatedBy = 'You';
        activeWiki.updatedAt = 'Just now';
        var parts = String(activeWiki.version || 'v1.0').replace(/^v/i, '').split('.');
        activeWiki.version = 'v' + (parts[0] || '1') + '.' + ((Number(parts[1]) || 0) + 1);
        wikiEditMode = false;
        persistAndRender('Saved wiki page');
      });

      document.getElementById('pp-wiki-cancel')?.addEventListener('click', function () {
        wikiEditMode = false;
        renderCollabPane();
      });

      bindCollabActions(pane);
      return;
    }

    var contentHtml = activeWiki.content
      ? '<div style="line-height:1.6; font-size:13.5px; color:var(--pp-ink-muted); white-space:pre-wrap;">' + escapeHtml(activeWiki.content) + '</div>'
      : '<div class="pp-empty-inline">This page is empty. Open the editor to start writing.</div>';

    pane.innerHTML = sectionBarHtml +
      '<div style="border:1px solid var(--pp-border); border-radius:8px; padding:24px; background:#ffffff; max-width:820px;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">' +
          '<div>' +
            '<h3 style="font-size:16px; font-weight:600; margin:0 0 4px; color:var(--pp-ink);">' + escapeHtml(activeWiki.title) + '</h3>' +
            '<div style="font-size:12px; color:var(--pp-muted);">' + escapeHtml(activeWiki.version) + ' &bull; Last updated by ' + escapeHtml(activeWiki.updatedBy) + '</div>' +
          '</div>' +
          '<button class="pp-btn pp-btn--sm" id="pp-btn-collab-edit-wiki" type="button">Edit page</button>' +
          '<button class="pp-btn pp-btn--sm pp-btn--danger" id="pp-btn-collab-delete-wiki" type="button">Delete page</button>' +
        '</div>' +
        contentHtml +
      '</div>';

    bindCollabActions(pane);
  }

  function bindCollabActions(pane) {
    document.getElementById('pp-btn-collab-new-wiki')?.addEventListener('click', createWikiPage);

    document.getElementById('pp-btn-collab-open-drawer')?.addEventListener('click', function () {
      if (!state.tasks.length) {
        notify('Add a deliverable first - discussions stay attached to deliverables');
        return;
      }
      var target = state.tasks[Math.min(3, state.tasks.length - 1)];
      openTaskDrawer(target.id, 'comments');
    });

    document.getElementById('pp-btn-collab-edit-wiki')?.addEventListener('click', function () {
      var page = state.wikiPages.find(function (w) { return w.id === state.activeWikiId; }) || state.wikiPages[0];
      if (!page) return;
      state.activeWikiId = page.id;
      wikiEditMode = true;
      renderCollabPane();
    });

    document.getElementById('pp-btn-collab-delete-wiki')?.addEventListener('click', function () {
      var page = state.wikiPages.find(function (w) { return w.id === state.activeWikiId; }) || state.wikiPages[0];
      if (page) deleteWikiPage(page.id);
    });

    bindEmptyActions(pane);
  }

  /* ==========================================================================
     MODULE E: REPORTING & EXECUTIVE DIGEST (Single High-Fidelity Area Chart)
     ========================================================================== */
  function renderReportingPane() {
    var pane = document.getElementById('pp-pane-reporting');
    if (!pane) return;

    var m = computeMetrics();

    var sectionBarHtml =
      '<div class="pp-section-bar">' +
        '<div class="pp-section-bar__title">' +
          '<h2>Executive Delivery Digest &amp; Cumulative Flow Diagram (CFD)</h2>' +
          '<p>High-fidelity velocity forecast and Cumulative Flow Diagram (CFD) delivery trajectory without dashboard clutter.</p>' +
        '</div>' +
        '<div style="display:flex; gap:8px;">' +
          '<button class="pp-btn pp-btn--sm pp-btn--primary" id="pp-btn-export-digest" type="button">Export PDF Digest</button>' +
        '</div>' +
      '</div>';

    if (!state.tasks.length) {
      pane.innerHTML = sectionBarHtml + emptyStateHtml({
        icon: '&#9650;',
        title: 'Nothing to report yet',
        description: 'The digest, velocity chart and health summary are generated from your deliverables, budget and logged time.',
        actions: [
          { label: '+ Add first deliverable', action: 'new-task', variant: 'primary' },
          { label: '+ Add teammate', action: 'new-resource' },
          { label: 'Load sample project', action: 'sample' }
        ]
      });
      bindEmptyActions(pane);
      return;
    }

    var chartW = 720;
    var chartH = 200;
    var stepX = 126;
    var weeks = 6;

    // Weekly cumulative delivery derived from the real plan - never a fixed demo curve.
    var weekly = [];
    for (var w = 0; w < weeks; w++) weekly.push(0);
    state.tasks.forEach(function (t) {
      if (t.status !== 'done') return;
      var endDay = Math.max(1, (Number(t.startDay) || 1) + (Number(t.durationDays) || 0) - 1);
      var index = Math.min(weeks - 1, Math.floor((endDay - 1) / 6));
      weekly[index] += Number(t.storyPoints) || 0;
    });

    var points = [];
    var running = 0;
    for (var i = 0; i < weeks; i++) {
      running += weekly[i];
      points.push({
        label: 'Week ' + (i + 1),
        actual: running,
        target: Math.round((m.totalPoints * (i + 1)) / weeks)
      });
    }

    var maxVal = Math.max(10, m.totalPoints, running) * 1.15;

    function pointX(idx) { return 50 + idx * stepX; }
    function pointY(value) { return chartH - 30 - Math.round((value / maxVal) * (chartH - 60)); }

    var actualPoly = points.map(function (p, idx) {
      return pointX(idx) + ',' + pointY(p.actual);
    }).join(' ');

    var areaPoly = '50,' + (chartH - 30) + ' ' + actualPoly + ' ' + pointX(points.length - 1) + ',' + (chartH - 30);

    var targetPoly = points.map(function (p, idx) {
      return pointX(idx) + ',' + pointY(p.target);
    }).join(' ');

    var dotsHtml = points.map(function (p, idx) {
      var x = pointX(idx);
      var y = pointY(p.actual);
      return '<circle cx="' + x + '" cy="' + y + '" r="4" fill="#2563eb" stroke="#ffffff" stroke-width="2" />' +
             '<text x="' + x + '" y="' + (y - 10) + '" font-size="10.5" font-weight="600" text-anchor="middle" fill="#0f172a">' + p.actual + ' pts</text>' +
             '<text x="' + x + '" y="' + (chartH - 12) + '" font-size="11" text-anchor="middle" fill="#64748b">' + p.label + '</text>';
    }).join('');

    var chartSvg =
      '<svg viewBox="0 0 ' + chartW + ' ' + chartH + '" width="100%" height="' + chartH + '">' +
        '<line x1="50" y1="' + (chartH - 30) + '" x2="680" y2="' + (chartH - 30) + '" stroke="#e2e8f0" stroke-width="1"/>' +
        '<polygon points="' + areaPoly + '" fill="rgba(37, 99, 235, 0.06)" />' +
        '<polyline fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4 4" points="' + targetPoly + '" />' +
        '<polyline fill="none" stroke="#2563eb" stroke-width="2.5" points="' + actualPoly + '" />' +
        dotsHtml +
      '</svg>';

    // Digest bullets are computed from the board, never hard-coded prose.
    var activePhase = null;
    state.wbsPhases.forEach(function (phase) {
      if (activePhase) return;
      var phaseTasks = state.tasks.filter(function (t) { return t.phaseWbs === phase.wbs; });
      if (phaseTasks.some(function (t) { return t.status !== 'done'; })) {
        activePhase = { phase: phase, tasks: phaseTasks };
      }
    });

    var scheduleText;
    if (!state.wbsPhases.length) {
      scheduleText = 'No phases defined yet - add deliverables to build the critical path.';
    } else if (activePhase) {
      var doneCount = activePhase.tasks.filter(function (t) { return t.status === 'done'; }).length;
      scheduleText = 'Phase ' + escapeHtml(activePhase.phase.wbs) + ' (' + escapeHtml(activePhase.phase.title) + ') is in flight with ' +
        doneCount + ' of ' + activePhase.tasks.length + ' deliverables complete and ' +
        m.conflictsCount + ' scheduling conflict' + (m.conflictsCount === 1 ? '' : 's') + '.';
    } else {
      scheduleText = 'Every phase is complete - this plan is ready to close out.';
    }

    var personnel = state.resources.filter(function (r) {
      return typeof r.category === 'string' && r.category.indexOf('Personnel') === 0;
    });
    var loggedHours = state.timesheets.reduce(function (acc, r) {
      return acc + (r.hours || []).reduce(function (a, b) { return a + (Number(b) || 0); }, 0);
    }, 0);
    var capacityTotal = personnel.reduce(function (acc, r) { return acc + (Number(r.maxHours) || 0); }, 0);
    var utilPct = capacityTotal > 0 ? Math.round((loggedHours / capacityTotal) * 100) : 0;
    var workloadText = personnel.length
      ? personnel.length + ' people with ' + loggedHours + 'h logged against a ' + capacityTotal + 'h weekly cap (' + utilPct + '% utilisation).'
      : 'No team capacity tracked yet - assign deliverables to people to see utilisation.';

    var budgetText = state.baseBudget > 0
      ? 'Total committed deliverable spend is <strong>' + formatCurrency(m.committedBudget) + '</strong> against a baseline authorisation of ' + formatCurrency(state.baseBudget) + ' (' + Math.round((m.committedBudget / state.baseBudget) * 100) + '% consumed).'
      : 'Total committed deliverable spend is <strong>' + formatCurrency(m.committedBudget) + '</strong> with no baseline authorisation set yet.';

    var deliveryText = 'Team has completed <strong>' + m.completedPoints + ' of ' + m.totalPoints + ' story points</strong> (' + m.overallProgress + '% WBS progress rollup) across ' + m.totalTasks + ' deliverables, with ' + m.inProgTasks + ' in flight.';

    pane.innerHTML = sectionBarHtml +

      '<div class="pp-report-canvas">' +
        '<div class="pp-report-chart-box">' +
          '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">' +
            '<strong style="font-size:13.5px; color:var(--pp-ink);">Story Point Delivery Trajectory</strong>' +
            '<span style="font-size:11.5px; color:var(--pp-muted);">&bull; Solid Blue: Actual Delivery &nbsp;&nbsp;&bull; Dashed: Target Baseline</span>' +
          '</div>' +
          chartSvg +
        '</div>' +

        '<div class="pp-digest-card">' +
          '<h3>Project Health &amp; Operational Digest</h3>' +
          '<div class="pp-digest-points">' +
            '<div class="pp-digest-point">' +
              '<div class="pp-digest-bullet"></div>' +
              '<div><strong>Delivery Trajectory:</strong> ' + deliveryText + '</div>' +
            '</div>' +
            '<div class="pp-digest-point">' +
              '<div class="pp-digest-bullet"></div>' +
              '<div><strong>Schedule &amp; Critical Path:</strong> ' + scheduleText + '</div>' +
            '</div>' +
            '<div class="pp-digest-point">' +
              '<div class="pp-digest-bullet"></div>' +
              '<div><strong>Workload &amp; Capacity:</strong> ' + workloadText + '</div>' +
            '</div>' +
            '<div class="pp-digest-point">' +
              '<div class="pp-digest-bullet"></div>' +
              '<div><strong>Budget Consumption:</strong> ' + budgetText + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.getElementById('pp-btn-export-digest')?.addEventListener('click', exportExecutiveReport);
  }

  /* ==========================================================================
     MODULE F: RISK & CHANGE CONTROL (Flat RAID & Single-Column Timeline)
     ========================================================================== */
  function renderRiskPane() {
    var pane = document.getElementById('pp-pane-risk');
    if (!pane) return;

    var rf = state.raidFilter || 'ALL';
    var raidFiltered = state.raidItems.filter(function (item) {
      return rf === 'ALL' || item.type === rf;
    });

    var sectionBarHtml =
      '<div class="pp-section-bar">' +
        '<div class="pp-section-bar__title">' +
          '<h2>RAID Log &amp; Change Management</h2>' +
          '<p>Symmetrical risk registers and single-column change control review pipeline.</p>' +
        '</div>' +
        '<div style="display:flex; gap:8px; align-items:center;">' +
          '<div class="pp-segmented">' +
            ['ALL', 'Risk', 'Assumption', 'Issue', 'Dependency'].map(function (tab) {
              return '<button class="pp-seg-btn ' + (rf === tab ? 'is-active' : '') + '" data-raid-filter="' + tab + '" type="button">' + tab + '</button>';
            }).join('') +
          '</div>' +
          '<button class="pp-btn pp-btn--primary" id="pp-btn-risk-new" type="button">+ Log RAID item</button>' +
        '</div>' +
      '</div>';

    if (!state.raidItems.length && !state.changeRequests.length) {
      pane.innerHTML = sectionBarHtml + emptyStateHtml({
        icon: '&#9888;',
        title: 'No risks logged yet',
        description: 'Risks, assumptions, issues and dependencies stay empty until you log them. Score each one on probability and impact and it feeds straight into the health badge.',
        actions: [
          { label: '+ Log first RAID item', action: 'new-raid', variant: 'primary' },
          { label: 'Load sample project', action: 'sample' }
        ]
      });
      bindRiskActions(pane);
      return;
    }

    var raidRowsHtml = raidFiltered.map(function (item) {
      var score = (Number(item.probability) || 1) * (Number(item.severity) || 1);
      return '<tr>' +
        '<td><span class="pp-wbs-code">' + escapeHtml(item.id) + '</span></td>' +
        '<td><span class="pp-badge pp-badge--minimal">' + escapeHtml(item.type) + '</span></td>' +
        '<td><strong>' + escapeHtml(item.title) + '</strong></td>' +
        '<td>' + item.probability + ' / 5</td>' +
        '<td>' + item.severity + ' / 5</td>' +
        '<td><strong>' + score + '</strong></td>' +
        '<td><input type="text" value="' + escapeHtml(item.mitigation) + '" data-raid-mit="' + item.id + '" style="width:100%; min-width:240px; padding:4px 8px; border:1px solid var(--pp-border); border-radius:4px; font-size:12.5px;" /></td>' +
        '<td><span class="pp-badge pp-badge--minimal">' + escapeHtml(item.status) + '</span></td>' +
        '<td><button class="pp-icon-btn" data-delete-raid="' + escapeHtml(item.id) + '" type="button" title="Delete RAID item" aria-label="Delete ' + escapeHtml(item.id) + '">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/></svg>' +
        '</button></td>' +
      '</tr>';
    }).join('');

    if (!raidRowsHtml) {
      raidRowsHtml = '<tr><td colspan="9" class="pp-empty-cell">No ' + escapeHtml(rf === 'ALL' ? 'RAID items' : rf.toLowerCase() + ' items') + ' logged yet. Use &ldquo;+ Log RAID item&rdquo; to add one.</td></tr>';
    }

    var crTimelineHtml = state.changeRequests.map(function (cr) {
      var isApproved = cr.status === 'Approved';
      return '<div class="pp-cr-node">' +
        '<div class="pp-cr-node__main">' +
          '<div class="pp-cr-node__title">' + escapeHtml(cr.id) + ': ' + escapeHtml(cr.title) + '</div>' +
          '<div class="pp-cr-node__sub">' + escapeHtml(cr.scopeImpact) + ' &bull; <strong>+' + cr.scheduleDeltaDays + 'd / ' + formatCurrency(cr.budgetDelta) + '</strong> &bull; Requested by ' + escapeHtml(cr.requestedBy) + '</div>' +
        '</div>' +
        '<div style="display:flex; align-items:center; gap:8px;">' +
          '<span class="pp-badge ' + (isApproved ? 'pp-badge--green' : 'pp-badge--minimal') + '">' + escapeHtml(cr.status) + '</span>' +
          '<button class="pp-btn pp-btn--sm" data-cr-toggle="' + cr.id + '" type="button">' + (isApproved ? 'Mark Pending' : 'Approve') + '</button>' +
          '<button class="pp-icon-btn" data-delete-cr="' + escapeHtml(cr.id) + '" type="button" title="Delete change request" aria-label="Delete ' + escapeHtml(cr.id) + '">' +
            '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');

    if (!crTimelineHtml) {
      crTimelineHtml = '<div class="pp-empty-inline">No change requests raised yet. Scope changes you log will appear here for approval.</div>';
    }

    pane.innerHTML =
      sectionBarHtml +
      '<div class="pp-table-card">' +
        '<table class="pp-table">' +
          '<thead><tr>' +
            '<th>ID</th><th>Type</th><th>Description</th><th>Prob</th><th>Impact</th><th>Score</th><th>Mitigation Strategy</th><th>Status</th><th></th>' +
          '</tr></thead>' +
          '<tbody>' + raidRowsHtml + '</tbody>' +
        '</table>' +
      '</div>' +

      '<div style="margin-top:28px;">' +
        '<h3 style="font-size:15px; font-weight:600; margin:0 0 16px; color:var(--pp-ink);">Change Management Request Pipeline</h3>' +
        '<div class="pp-cr-timeline">' + crTimelineHtml + '</div>' +
      '</div>';

    bindRiskActions(pane);
  }

  function bindRiskActions(pane) {
    var newBtn = document.getElementById('pp-btn-risk-new');
    if (newBtn) newBtn.addEventListener('click', addRaidItem);

    pane.querySelectorAll('[data-raid-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.raidFilter = btn.dataset.raidFilter;
        renderRiskPane();
      });
    });

    pane.querySelectorAll('[data-raid-mit]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var item = state.raidItems.find(function (r) { return r.id === inp.dataset.raidMit; });
        if (item) {
          item.mitigation = inp.value;
          persistState();
          notify('Saved mitigation for ' + item.id);
        }
      });
    });

    pane.querySelectorAll('[data-cr-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cr = state.changeRequests.find(function (c) { return c.id === btn.dataset.crToggle; });
        if (cr) {
          cr.status = cr.status === 'Approved' ? 'Pending Review' : 'Approved';
          persistAndRender('Updated ' + cr.id + ' status: ' + cr.status);
        }
      });
    });

    pane.querySelectorAll('[data-delete-raid]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteRaidItem(btn.dataset.deleteRaid);
      });
    });

    pane.querySelectorAll('[data-delete-cr]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteChangeRequest(btn.dataset.deleteCr);
      });
    });

    bindEmptyActions(pane);
  }

  /* ==========================================================================
     FLYOUT ACTION DRAWER (Off-dashboard discussions, wiki specs & files)
     ========================================================================== */
  function openTaskDrawer(taskId, initialTab) {
    var task = getTask(taskId);
    if (!task) return;
    activeDrawerTaskId = taskId;
    if (initialTab) state.activeDrawerTab = initialTab;

    drawerEl.classList.add('is-open');
    backdropEl.classList.add('is-open');

    var heading = document.getElementById('pp-drawer-heading');
    if (heading) heading.textContent = task.id + ' — ' + task.wbs;

    var commentCountEl = document.getElementById('pp-drawer-comment-count');
    if (commentCountEl) commentCountEl.textContent = (task.comments ? task.comments.length : 0);

    renderDrawerBody(task);
  }

  function renderDrawerBody(task) {
    var body = document.getElementById('pp-drawer-body');
    if (!body) return;

    var tab = state.activeDrawerTab || 'details';
    drawerEl.querySelectorAll('[data-drawer-tab]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.drawerTab === tab);
    });

    if (tab === 'details') {
      body.innerHTML =
        '<div style="display:flex; flex-direction:column; gap:16px;">' +
          '<div>' +
            '<label style="font-size:11px; font-weight:600; text-transform:uppercase; color:var(--pp-muted); display:block; margin-bottom:6px;">Deliverable Title</label>' +
            '<input type="text" id="pp-drw-title" value="' + escapeHtml(task.title) + '" style="width:100%; padding:8px 10px; border:1px solid var(--pp-border); border-radius:6px; font-size:13.5px;" />' +
          '</div>' +

          '<div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">' +
            '<div>' +
              '<label style="font-size:11px; font-weight:600; text-transform:uppercase; color:var(--pp-muted); display:block; margin-bottom:6px;">Status</label>' +
              '<select id="pp-drw-status" style="width:100%; padding:7px 10px; border:1px solid var(--pp-border); border-radius:6px; font-size:13px;">' +
                '<option value="backlog" ' + (task.status === 'backlog' ? 'selected' : '') + '>Backlog</option>' +
                '<option value="todo" ' + (task.status === 'todo' ? 'selected' : '') + '>To Do</option>' +
                '<option value="in-progress" ' + (task.status === 'in-progress' ? 'selected' : '') + '>In Progress</option>' +
                '<option value="review" ' + (task.status === 'review' ? 'selected' : '') + '>In Review</option>' +
                '<option value="done" ' + (task.status === 'done' ? 'selected' : '') + '>Done</option>' +
              '</select>' +
            '</div>' +
            '<div>' +
              '<label style="font-size:11px; font-weight:600; text-transform:uppercase; color:var(--pp-muted); display:block; margin-bottom:6px;">Assignee</label>' +
              '<select id="pp-drw-assignee" style="width:100%; padding:7px 10px; border:1px solid var(--pp-border); border-radius:6px; font-size:13px;">' +
                (function () {
                  var people = state.resources.filter(function (r) { return typeof r.category === 'string' && r.category.indexOf('Personnel') === 0; });
                  if (!people.length) return '<option value="">Unassigned</option>';
                  return '<option value="">Unassigned</option>' + people.map(function (r) {
                    return '<option value="' + r.id + '" ' + (task.assigneeId === r.id ? 'selected' : '') + '>' + escapeHtml(r.name) + '</option>';
                  }).join('');
                })() +
              '</select>' +
            '</div>' +
          '</div>' +

          '<div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">' +
            '<div>' +
              '<label style="font-size:11px; font-weight:600; text-transform:uppercase; color:var(--pp-muted); display:block; margin-bottom:6px;">Start Day</label>' +
              '<input type="number" id="pp-drw-start" min="1" max="34" value="' + task.startDay + '" style="width:100%; padding:7px 10px; border:1px solid var(--pp-border); border-radius:6px; font-size:13px;" />' +
            '</div>' +
            '<div>' +
              '<label style="font-size:11px; font-weight:600; text-transform:uppercase; color:var(--pp-muted); display:block; margin-bottom:6px;">Duration (Days)</label>' +
              '<input type="number" id="pp-drw-dur" min="1" max="25" value="' + task.durationDays + '" style="width:100%; padding:7px 10px; border:1px solid var(--pp-border); border-radius:6px; font-size:13px;" />' +
            '</div>' +
          '</div>' +

          '<div style="margin-top:4px; padding-top:16px; border-top:1px solid var(--pp-border); display:flex; justify-content:flex-end;">' +
            '<button class="pp-btn pp-btn--sm pp-btn--danger" id="pp-drw-delete" type="button">Delete deliverable</button>' +
          '</div>' +
        '</div>';

      document.getElementById('pp-drw-delete')?.addEventListener('click', function () {
        deleteTask(task.id);
      });

      ['pp-drw-title', 'pp-drw-status', 'pp-drw-assignee', 'pp-drw-start', 'pp-drw-dur'].forEach(function (id) {
        document.getElementById(id)?.addEventListener('change', function () {
          task.title = document.getElementById('pp-drw-title').value.trim() || task.title;
          task.status = document.getElementById('pp-drw-status').value;
          task.assigneeId = document.getElementById('pp-drw-assignee').value;
          task.startDay = Math.max(1, Math.min(34, Number(document.getElementById('pp-drw-start').value) || 1));
          task.durationDays = Math.max(1, Math.min(25, Number(document.getElementById('pp-drw-dur').value) || 1));
          persistAndRender('Synced ' + task.id);
        });
      });
    } else if (tab === 'comments') {
      var commentsListHtml = (task.comments || []).map(function (c) {
        return '<div class="pp-comment-item">' +
          '<div class="pp-comment-item__head">' +
            '<strong>' + escapeHtml(c.author) + '</strong>' +
            '<span>' + escapeHtml(c.time) + '</span>' +
          '</div>' +
          '<div class="pp-comment-item__text">' + escapeHtml(c.text) + '</div>' +
        '</div>';
      }).join('');

      body.innerHTML =
        '<div style="display:flex; flex-direction:column; height:100%;">' +
          '<div class="pp-comment-list" style="flex:1;">' + (commentsListHtml || '<div style="color:var(--pp-muted); font-size:12.5px;">No comments yet.</div>') + '</div>' +
          '<div style="margin-top:auto; border-top:1px solid var(--pp-border); padding-top:12px;">' +
            '<textarea id="pp-drw-new-comment" placeholder="Add a comment… mention a teammate with @" style="width:100%; padding:8px 10px; border:1px solid var(--pp-border); border-radius:6px; font-size:13px; min-height:64px; margin-bottom:8px;"></textarea>' +
            '<div style="display:flex; justify-content:flex-end;">' +
              '<button class="pp-btn pp-btn--sm pp-btn--primary" id="pp-drw-send-comment" type="button">Post</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      document.getElementById('pp-drw-send-comment')?.addEventListener('click', function () {
        var inp = document.getElementById('pp-drw-new-comment');
        var txt = (inp ? inp.value : '').trim();
        if (!txt) return;
        if (!task.comments) task.comments = [];
        task.comments.push({ id: 'c-' + Date.now(), author: 'You', time: 'Just now', text: txt });
        inp.value = '';
        persistAndRender('Posted comment on ' + task.id);
        renderDrawerBody(task);
      });
    } else if (tab === 'wiki') {
      var wiki = state.wikiPages.find(function (w) { return w.id === state.activeWikiId; }) || state.wikiPages[0];

      if (!wiki) {
        body.innerHTML =
          '<div class="pp-empty-state">' +
            '<div class="pp-empty-state__mark" aria-hidden="true">&#9993;</div>' +
            '<h3>No wiki pages yet</h3>' +
            '<p>Deliverable specifications, decisions and meeting notes live in the wiki. Create the first page to start documenting.</p>' +
            '<div class="pp-empty-state__actions">' +
              '<button class="pp-btn pp-btn--primary" id="pp-drw-new-wiki" type="button">+ Create wiki page</button>' +
            '</div>' +
          '</div>';

        document.getElementById('pp-drw-new-wiki')?.addEventListener('click', function () {
          createWikiPage();
          renderDrawerBody(task);
        });

        bindDrawerTabs(task);
        return;
      }

      body.innerHTML =
        '<div>' +
          '<h4 style="font-size:13.5px; font-weight:600; margin:0 0 8px; color:var(--pp-ink);">' + escapeHtml(wiki.title) + '</h4>' +
          '<textarea id="pp-drw-wiki-edit" style="width:100%; height:260px; padding:10px; border:1px solid var(--pp-border); border-radius:6px; font-size:12.5px; font-family:monospace; line-height:1.5;">' + escapeHtml(wiki.content) + '</textarea>' +
          '<div style="display:flex; justify-content:flex-end; margin-top:8px;">' +
            '<button class="pp-btn pp-btn--sm pp-btn--primary" id="pp-drw-save-wiki" type="button">Save Wiki Spec</button>' +
          '</div>' +
        '</div>';

      document.getElementById('pp-drw-save-wiki')?.addEventListener('click', function () {
        var txt = document.getElementById('pp-drw-wiki-edit').value;
        wiki.content = txt;
        persistAndRender('Saved wiki specification');
      });
    } else {

      // files
      var filesHtml = state.sharedFiles.map(function (f) {
        return '<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border:1px solid var(--pp-border); border-radius:6px; margin-bottom:8px;">' +
          '<div><strong>' + escapeHtml(f.name) + '</strong><div style="font-size:11px; color:var(--pp-muted);">' + escapeHtml(f.size) + ' &bull; ' + escapeHtml(f.uploadedBy) + '</div></div>' +
          '<span class="pp-badge pp-badge--minimal">' + escapeHtml(f.tag) + '</span>' +
        '</div>';
      }).join('');

      body.innerHTML =
        '<div>' +
          '<div style="margin-bottom:12px; font-size:12.5px; color:var(--pp-muted);">Shared architecture artifacts for deliverable execution:</div>' +
          (filesHtml || '<div class="pp-empty-inline">No shared files yet. Attach specs or diagrams to this deliverable to keep the context in one place.</div>') +
        '</div>';
    }

    bindDrawerTabs(task);
  }

  function bindDrawerTabs(task) {
    if (!drawerEl) return;
    drawerEl.querySelectorAll('[data-drawer-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.activeDrawerTab = btn.dataset.drawerTab;
        renderDrawerBody(task);
      });
    });
  }

  function closeTaskDrawer() {
    if (drawerEl) drawerEl.classList.remove('is-open');
    if (backdropEl) backdropEl.classList.remove('is-open');
    activeDrawerTaskId = null;
  }

  function exportExecutiveReport() {
    var m = computeMetrics();
    var report =
      '# ' + state.projectName + '\n' +
      'Generated: ' + new Date().toLocaleString() + '\n\n' +
      '## Executive Summary\n' +
      '- Total Deliverables: ' + m.totalTasks + '\n' +
      '- Overall Progress: ' + m.overallProgress + '%\n' +
      '- Committed Spend: ' + formatCurrency(m.committedBudget) + ' of ' + formatCurrency(state.baseBudget) + '\n' +
      '- Critical Path Conflicts: ' + m.conflictsCount + '\n\n' +
      '## WBS Deliverables Rollup\n' +
      state.tasks.map(function (t) {
        return '- [' + t.status.toUpperCase() + '] ' + t.id + ' (' + t.wbs + '): ' + t.title + ' — ' + t.durationDays + 'd';
      }).join('\n');

    var blob = new Blob([report], { type: 'text/markdown;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'Project_Planning_Executive_Digest.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    notify('Exported Executive Digest Markdown Report');
  }

  /* ---------- Render All Active Modules ---------- */
  function renderAll() {
    if (!shellEl || shellEl.hidden) return;
    renderTopHeaderAndRibbon();
    renderGanttPane();
    renderTasksPane();
    renderResourcesPane();
    renderCollabPane();
    renderReportingPane();
    renderRiskPane();
  }

  /* ---------- Open / Close Workspace API ---------- */
  function openWorkspace(boardId, projectTitle, initialModule) {
    // Another board may still have a debounced save in flight; send it before
    // `loadState` swaps the in-memory plan for the one being opened.
    if (boardId && String(boardId) !== String(currentBoardId)) flushPendingPlan();
    try {
      if (document.referrer && !document.referrer.includes('/app/')) {
        sessionStorage.setItem('quantalflow_pp_prior_page', document.referrer);
      }
    } catch (e) {}
    ensureShellMounted();
    var labelEl = document.getElementById('pp-back-label');
    if (labelEl) {
      var targetLabel = (document.referrer && !document.referrer.includes('/app/')) ? 'Back to previous page' : 'Back to Dashboard';
      labelEl.textContent = targetLabel;
    }
    loadState(boardId || currentBoardId, projectTitle);
    if (projectTitle) state.projectName = projectTitle;
    if (initialModule) state.activeModule = initialModule;
    shellEl.hidden = false;
    setActiveModule(state.activeModule || 'gantt');
  }

  function closeWorkspace() {
    if (shellEl) {
      shellEl.hidden = true;
      shellEl.style.display = 'none';
      shellEl.classList.remove('is-open');
    }
    closeTaskDrawer();
  }

  window.ProjectPlanningSuite = {
    open: openWorkspace,
    close: closeWorkspace,
    openTaskDrawer: openTaskDrawer,
    getState: function () { return state; },
    resolveConflicts: autoResolveConflicts
  };

  /* ---------- Auto-Detect Route or Trigger Buttons ---------- */
  var MODULE_NAMES = ['gantt', 'tasks', 'resources', 'collab', 'reporting', 'risk'];

  function initTriggers() {
    purgeSeededDemoPlansOnce();
    /* A debounced save would otherwise be lost when the tab closes mid-timer. */
    window.addEventListener('pagehide', flushPlanOnUnload);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushPlanOnUnload();
    });
    ensureShellMounted();

    document.querySelectorAll('[data-open-project-planning]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var title = btn.dataset.projectTitle || 'Project Planning Workspace';
        var mod = btn.dataset.projectModule || 'gantt';
        openWorkspace(currentBoardId, title, mod);
      });
    });

    // Deep link into the suite: /app/project-planning-workspace (blank),
    // /app/<board>/project-planning, /app/<board>/<code>/project-planning, or
    // /app/?board=<id>&template=project-planning. The sidebar shortcut uses the
    // first form, so it always lands on a clean workspace.
    var path = window.location.pathname || '';
    var search = window.location.search || '';
    var hash = window.location.hash || '';
    var params = new URLSearchParams(search);
    var isQuantalsRoute = path.indexOf('/data-quantals-plan') !== -1;
    var wantsSuite =
      params.get('template') === 'project-planning' ||
      path.indexOf('project-planning') !== -1 ||
      isQuantalsRoute ||
      hash === '#project-planning' ||
      hash === '#wbs';

    if (wantsSuite) {
      var boardIdFromUrl = resolveBoardIdFromLocation();
      var titleFromUrl = document.getElementById('board-title-input');
      var moduleFromUrl = params.get('module') || (isQuantalsRoute ? 'tasks' : 'gantt');
      if (MODULE_NAMES.indexOf(moduleFromUrl) === -1) moduleFromUrl = 'gantt';
      var defaultTitle = isQuantalsRoute ? 'Construction of a House' : 'Project Planning Workspace';
      openWorkspace(
        boardIdFromUrl,
        (titleFromUrl && titleFromUrl.value) || defaultTitle,
        moduleFromUrl
      );
      if (isQuantalsRoute) {
        state.taskSubView = 'wbs';
        state.wbsView = 'diagram';
        renderTasksPane();
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTriggers);
  } else {
    initTriggers();
  }
})();
