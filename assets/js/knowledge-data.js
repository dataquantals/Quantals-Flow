/* ==========================================================================
   QuantalFlow Knowledge Hub — Unified Knowledge Model & Organisational Seed
   ========================================================================== */
(function (global) {
  'use strict';

  var OBJECT_TYPES = [
    'Document', 'Project', 'Task', 'Meeting', 'Decision', 'Research Paper',
    'Policy', 'SOP', 'Training Material', 'Client', 'Department', 'Product',
    'Workflow', 'Template'
  ];

  var RELATIONSHIP_TYPES = [
    'Depends On', 'References', 'Originated From', 'Related To',
    'Supports', 'Used By', 'Created By', 'Linked To'
  ];

  var PERMISSION_LEVELS = [
    { level: 'Public', scope: 'Entire organisation', inheritance: 'Inherits to child pages & linked attachments unless overridden', viewers: 'All members', editors: 'Department leads & Authors', approvers: 'Knowledge Admins' },
    { level: 'Department', scope: 'Owning department & stakeholders', inheritance: 'Child SOPs and Wiki pages inherit department ACL', viewers: 'Department members', editors: 'Department contributors', approvers: 'Department Head' },
    { level: 'Project', scope: 'Active project team & sponsors', inheritance: 'Auto-synced with QuantalFlow Project Planning & Board members', viewers: 'Project members', editors: 'Project editors', approvers: 'Project Manager' },
    { level: 'Private', scope: 'Author & explicit invitees only', inheritance: 'No automatic inheritance; explicit share required', viewers: 'Author only', editors: 'Author only', approvers: 'Author' },
    { level: 'Executive', scope: 'Leadership & Governance Committee', inheritance: 'Locked to Executive group; audit-logged on access', viewers: 'Executives', editors: 'Executives & Legal', approvers: 'CEO / CTO' },
    { level: 'Confidential', scope: 'Restricted compliance / payment keys', inheritance: 'Zero inheritance; watermarked preview & export disabled', viewers: 'Named security roles', editors: 'Security Lead', approvers: 'CISO / Compliance' }
  ];

  function createInitialState() {
    return {
      version: 1,
      objects: [
        {
          id: 'KO-PRJ-01',
          type: 'Project',
          title: 'Nursing Student Attendance Project',
          summary: 'Biometric & QR clinical rotation attendance tracking system for nursing schools, built on QuantalFlow + Convex with offline-first mobile sync.',
          content: 'End-to-end attendance automation platform replacing paper clinical sign-in sheets across 14 hospital wards. Integrates QR geofencing, supervisor sign-off, automated absence alerts, and compliance reporting for the Nursing Council.',
          department: 'Product Engineering',
          project: 'Nursing Student Attendance Project',
          author: 'Richard Mumba',
          updatedAt: '2026-03-19',
          createdAt: '2026-01-12',
          permission: 'Project',
          status: 'Active',
          views: 342,
          source: 'Project Planning',
          tags: ['attendance', 'nursing', 'convex', 'offline-sync', 'biometric'],
          versions: [
            { v: 'v2.4', date: '2026-03-19', by: 'Richard Mumba', note: 'Added ward geofence tolerance & offline queue spec' },
            { v: 'v2.0', date: '2026-02-28', by: 'Grace Phiri', note: 'Pilot rollout metrics across 3 teaching hospitals' }
          ],
          comments: [
            { author: 'Grace Phiri', date: '2026-03-18', text: 'Ward 4B supervisors confirmed check-in time dropped from 18 mins to 90 seconds.' }
          ]
        },
        {
          id: 'KO-PRJ-02',
          type: 'Project',
          title: 'Airtel Money Payment Integration',
          summary: 'Real-time mobile money collections, webhook reconciliation, and instant receipting via Airtel Money Open API.',
          content: 'Connects QuantalFlow invoicing and student tuition portals to Airtel Money Zambia/East Africa rails. Includes idempotent transaction keys, callback signature verification, automated retry queues, and daily ledger reconciliation.',
          department: 'Payments & FinTech',
          project: 'Airtel Money Payment Integration',
          author: 'David Banda',
          updatedAt: '2026-03-18',
          createdAt: '2026-01-25',
          permission: 'Confidential',
          status: 'Active',
          views: 289,
          source: 'Project Planning',
          tags: ['airtel-money', 'payments', 'webhooks', 'fintech', 'reconciliation'],
          versions: [
            { v: 'v1.8', date: '2026-03-18', by: 'David Banda', note: 'Added HMAC callback verification & sandbox test matrix' }
          ],
          comments: []
        },
        {
          id: 'KO-DEC-01',
          type: 'Decision',
          title: 'Use Convex Instead of Firebase',
          summary: 'Architectural decision to adopt Convex as the real-time reactive backend over Firebase and Supabase for QuantalFlow and Attendance modules.',
          content: 'Convex provides end-to-end TypeScript reactivity, transactional mutations, and seamless integration with QuantalFlow application architecture without Firestore composite-index bottlenecks.',
          department: 'Architecture',
          project: 'Nursing Student Attendance Project',
          author: 'Richard Mumba',
          updatedAt: '2026-03-15',
          createdAt: '2026-03-15',
          permission: 'Public',
          status: 'Approved',
          views: 418,
          source: 'Decision Centre',
          tags: ['convex', 'firebase', 'architecture', 'database', 'attendance'],
          versions: [{ v: 'v1.0', date: '2026-03-15', by: 'Richard Mumba', note: 'Approved by Architecture Review Board' }],
          comments: []
        },
        {
          id: 'KO-DOC-01',
          type: 'Document',
          title: 'Airtel Money Webhook & Reconciliation Spec (PDF)',
          summary: 'Complete API payload contract, timeout handling, USSD push flows, and settlement reconciliation rules for Airtel Money.',
          content: 'Covers OAuth2 token caching, X-Signature verification, idempotency keys, handling pending USSD states after 90s, and nightly CSV reconciliation against Airtel Merchant Portal.',
          department: 'Payments & FinTech',
          project: 'Airtel Money Payment Integration',
          author: 'David Banda',
          updatedAt: '2026-03-17',
          createdAt: '2026-02-10',
          permission: 'Confidential',
          status: 'Approved',
          views: 264,
          source: 'Document Vault',
          tags: ['airtel-money', 'payments', 'api', 'webhook', 'pdf'],
          versions: [
            { v: 'v3.1', date: '2026-03-17', by: 'David Banda', note: 'Updated retry backoff schedule for USSD timeouts' },
            { v: 'v3.0', date: '2026-03-02', by: 'David Banda', note: 'Production merchant callback endpoints' }
          ],
          comments: [{ author: 'Mwila Chanda', date: '2026-03-17', text: 'Verified against production sandbox logs.' }]
        },
        {
          id: 'KO-SOP-01',
          type: 'SOP',
          title: 'SOP-014: Employee & Clinical Coordinator Onboarding',
          summary: 'Step-by-step onboarding procedure covering workspace provisioning, RBAC access, Knowledge Hub orientation, and security checklist.',
          content: '1. Provision QuantalFlow SSO & role assignment.\n2. Assign Department Wiki reading path.\n3. Complete Security & Data Privacy quiz (85% pass).\n4. Pair with Knowledge Mentor for first 14 days.\n5. Sign off compliance acknowledgment.',
          department: 'People & Operations',
          project: 'Organisational Excellence',
          author: 'Chileshe Mulenga',
          updatedAt: '2026-03-14',
          createdAt: '2025-11-04',
          permission: 'Public',
          status: 'Approved',
          views: 512,
          source: 'SOP Management',
          tags: ['onboarding', 'sop', 'hr', 'procedures', 'compliance'],
          versions: [
            { v: 'v2.2', date: '2026-03-14', by: 'Chileshe Mulenga', note: 'Added Knowledge Hub Learning Path requirement' }
          ],
          comments: []
        },
        {
          id: 'KO-SOP-02',
          type: 'SOP',
          title: 'SOP-021: Nursing Attendance Offline Sync Recovery',
          summary: 'Operational procedure for resolving delayed biometric/QR attendance batches when hospital Wi-Fi drops.',
          content: '1. Verify device local IndexedDB queue count.\n2. Reconnect to hospital LTE fallback.\n3. Trigger idempotent batch replay.\n4. Confirm Convex sync badge turns green.\n5. Escalate duplicate hash conflicts to Tier-2.',
          department: 'Clinical Operations',
          project: 'Nursing Student Attendance Project',
          author: 'Grace Phiri',
          updatedAt: '2026-03-16',
          createdAt: '2026-02-20',
          permission: 'Department',
          status: 'Approved',
          views: 198,
          source: 'SOP Management',
          tags: ['attendance', 'nursing', 'sop', 'offline-sync', 'operations'],
          versions: [{ v: 'v1.3', date: '2026-03-16', by: 'Grace Phiri', note: 'Added LTE fallback step' }],
          comments: []
        },
        {
          id: 'KO-MTG-01',
          type: 'Meeting',
          title: 'Nursing Attendance Architecture & Rollout Review',
          summary: 'Weekly technical review covering Convex schema migration, offline QR verification, and clinical supervisor feedback.',
          content: 'Agreed to ship Convex reactive attendance ledger, reduce QR refresh interval to 30 seconds, and publish SOP-021 before expanding to 6 additional nursing colleges.',
          department: 'Product Engineering',
          project: 'Nursing Student Attendance Project',
          author: 'Richard Mumba',
          updatedAt: '2026-03-15',
          createdAt: '2026-03-15',
          permission: 'Project',
          status: 'Archived',
          views: 156,
          source: 'Meeting Knowledge',
          tags: ['attendance', 'nursing', 'meeting', 'convex', 'architecture'],
          versions: [{ v: 'v1.0', date: '2026-03-15', by: 'AI Meeting Capture', note: 'Auto-generated from meeting transcript' }],
          comments: []
        },
        {
          id: 'KO-TSK-01',
          type: 'Task',
          title: 'Implement Idempotent Airtel Money Callback Handler',
          summary: 'Build signature verification, duplicate transaction guard, and automated ledger posting for Airtel Money webhooks.',
          content: 'Verify HMAC-SHA256 header, check transaction reference in SQLite/Convex, update invoice status to Paid, and emit Knowledge Hub audit event.',
          department: 'Payments & FinTech',
          project: 'Airtel Money Payment Integration',
          author: 'David Banda',
          updatedAt: '2026-03-18',
          createdAt: '2026-03-04',
          permission: 'Project',
          status: 'In Progress',
          views: 112,
          source: 'Project Planning',
          tags: ['airtel-money', 'payments', 'webhooks', 'task'],
          versions: [{ v: 'v1.0', date: '2026-03-18', by: 'David Banda', note: 'Unit tests passing' }],
          comments: []
        },
        {
          id: 'KO-RES-01',
          type: 'Research Paper',
          title: 'Customer Support Root-Cause Analysis Q1 2026',
          summary: 'Synthesis of 412 customer support tickets identifying top friction points: payment callback delays (34%), passwordless SSO confusion (22%), and offline sync alerts (19%).',
          content: 'Analysis of Q1 support queue reveals 75% of escalations stem from three solvable workflows: unclear Airtel Money pending status messaging, missing self-service onboarding videos, and hospital ward connectivity drops.',
          department: 'Customer Success',
          project: 'Customer Support Transformation',
          author: 'Thandiwe Zulu',
          updatedAt: '2026-03-17',
          createdAt: '2026-03-10',
          permission: 'Public',
          status: 'Published',
          views: 305,
          source: 'Research',
          tags: ['customer-support', 'research', 'airtel-money', 'onboarding', 'ux'],
          versions: [{ v: 'v1.1', date: '2026-03-17', by: 'Thandiwe Zulu', note: 'Added March ticket cohort' }],
          comments: []
        },
        {
          id: 'KO-POL-01',
          type: 'Policy',
          title: 'Data Classification & Knowledge Governance Policy',
          summary: 'Enterprise rules defining Public, Department, Project, Private, Executive, and Confidential knowledge tiers and retention cycles.',
          content: 'Mandates 90-day review cycles for Confidential payment specs, 180-day freshness audits for SOPs, and strict RBAC inheritance across QuantalFlow spaces.',
          department: 'Security & Compliance',
          project: 'Organisational Excellence',
          author: 'Mwila Chanda',
          updatedAt: '2026-02-12',
          createdAt: '2025-09-01',
          permission: 'Executive',
          status: 'Approved',
          views: 229,
          source: 'Wiki',
          tags: ['policy', 'governance', 'permissions', 'security'],
          versions: [{ v: 'v2.0', date: '2026-02-12', by: 'Mwila Chanda', note: 'Annual compliance update' }],
          comments: []
        },
        {
          id: 'KO-TRN-01',
          type: 'Training Material',
          title: 'Nursing Attendance Supervisor Quickstart & Certification',
          summary: 'Interactive training module for clinical ward supervisors covering QR check-in, exception approvals, and offline recovery.',
          content: 'Includes 4 micro-lessons, a 5-minute interactive quiz, and digital Supervisor Certification badge.',
          department: 'Clinical Operations',
          project: 'Nursing Student Attendance Project',
          author: 'Grace Phiri',
          updatedAt: '2026-03-16',
          createdAt: '2026-03-01',
          permission: 'Public',
          status: 'Published',
          views: 274,
          source: 'Learning Centre',
          tags: ['training', 'nursing', 'attendance', 'onboarding', 'certification'],
          versions: [{ v: 'v1.2', date: '2026-03-16', by: 'Grace Phiri', note: 'Added offline sync quiz question' }],
          comments: []
        },
        {
          id: 'KO-CLI-01',
          type: 'Client',
          title: 'Lusaka College of Nursing & Midwifery',
          summary: 'Anchor institutional client piloting the Nursing Student Attendance Project across 1,200 students and 14 clinical wards.',
          content: 'Key contacts: Dean of Clinical Studies, IT Director. Active modules: Attendance Automation, Airtel Money Tuition Collections, Supervisor Training.',
          department: 'Customer Success',
          project: 'Nursing Student Attendance Project',
          author: 'Thandiwe Zulu',
          updatedAt: '2026-03-12',
          createdAt: '2025-12-02',
          permission: 'Department',
          status: 'Active',
          views: 168,
          source: 'CRM & Wiki',
          tags: ['client', 'nursing', 'attendance', 'airtel-money'],
          versions: [{ v: 'v1.0', date: '2026-03-12', by: 'Thandiwe Zulu', note: 'Updated ward rollout schedule' }],
          comments: []
        },
        {
          id: 'KO-DEP-01',
          type: 'Department',
          title: 'Payments & FinTech Engineering',
          summary: 'Owns mobile money rails (Airtel Money, MTN MoMo), billing ledger integrity, and PCI-aligned webhook architecture.',
          content: 'Core responsibilities: Payment gateway integrations, reconciliation automation, fraud alerting, and merchant onboarding SOPs.',
          department: 'Payments & FinTech',
          project: 'Airtel Money Payment Integration',
          author: 'David Banda',
          updatedAt: '2026-03-10',
          createdAt: '2025-06-15',
          permission: 'Public',
          status: 'Active',
          views: 144,
          source: 'Organisational Brain',
          tags: ['department', 'payments', 'airtel-money', 'fintech'],
          versions: [{ v: 'v1.0', date: '2026-03-10', by: 'David Banda', note: 'Added Q2 roadmap owners' }],
          comments: []
        },
        {
          id: 'KO-PRD-01',
          type: 'Product',
          title: 'QuantalFlow Visual & Knowledge Suite',
          summary: 'Unified collaborative platform combining Whiteboards, Mind Maps, Project Planning, Note Pad, and the Organisational Brain.',
          content: 'Every board, task, plan, and note automatically emits structured metadata into the Knowledge Graph.',
          department: 'Product Engineering',
          project: 'QuantalFlow Core',
          author: 'Richard Mumba',
          updatedAt: '2026-03-19',
          createdAt: '2025-05-01',
          permission: 'Public',
          status: 'Active',
          views: 488,
          source: 'Product',
          tags: ['quantalflow', 'product', 'mindmap', 'whiteboard', 'knowledge-graph'],
          versions: [{ v: 'v4.0', date: '2026-03-19', by: 'Richard Mumba', note: 'Knowledge Hub module launch' }],
          comments: []
        },
        {
          id: 'KO-WFL-01',
          type: 'Workflow',
          title: 'Customer Support Escalation & Payment Dispute Flow',
          summary: 'Automated triage workflow routing Airtel Money timeout disputes from Tier-1 support to FinTech Engineering within 15 minutes.',
          content: 'Trigger: Support ticket tagged payment-pending > 5 mins -> Query Airtel transaction reference -> Auto-attach ledger log -> Notify Payments on-call if unresolved.',
          department: 'Customer Success',
          project: 'Customer Support Transformation',
          author: 'Thandiwe Zulu',
          updatedAt: '2026-03-16',
          createdAt: '2026-02-14',
          permission: 'Department',
          status: 'Active',
          views: 215,
          source: 'Whiteboard',
          tags: ['workflow', 'customer-support', 'airtel-money', 'payments'],
          versions: [{ v: 'v1.4', date: '2026-03-16', by: 'Thandiwe Zulu', note: 'Reduced SLA breach window to 15 mins' }],
          comments: []
        },
        {
          id: 'KO-TPL-01',
          type: 'Template',
          title: 'Architecture Decision Record (ADR) & Risk Matrix Template',
          summary: 'Standardised template for capturing architectural decisions, alternatives evaluated, approvers, and expected outcomes.',
          content: 'Includes sections for Context, Decision, Alternatives Considered, Risks, Expected Outcomes, and Supporting Evidence.',
          department: 'Architecture',
          project: 'Organisational Excellence',
          author: 'Richard Mumba',
          updatedAt: '2026-03-08',
          createdAt: '2025-10-12',
          permission: 'Public',
          status: 'Approved',
          views: 319,
          source: 'Template Library',
          tags: ['template', 'decision', 'architecture', 'governance'],
          versions: [{ v: 'v2.1', date: '2026-03-08', by: 'Richard Mumba', note: 'Added Supporting Evidence checklist' }],
          comments: []
        },
        {
          id: 'KO-WB-01',
          type: 'Workflow',
          title: 'Nursing Clinical Attendance Architecture Whiteboard',
          summary: 'Visual whiteboard & mind map showing ward geofence zones, QR rotation flow, and Convex real-time sync topology.',
          content: 'Created in QuantalFlow Whiteboarding & Mind Map studio; linked directly to Nursing Student Attendance Project and Decision KO-DEC-01.',
          department: 'Product Engineering',
          project: 'Nursing Student Attendance Project',
          author: 'Richard Mumba',
          updatedAt: '2026-03-14',
          createdAt: '2026-02-02',
          permission: 'Project',
          status: 'Active',
          views: 241,
          source: 'Mind Map & Whiteboard',
          tags: ['whiteboard', 'mindmap', 'attendance', 'nursing', 'architecture'],
          versions: [{ v: 'v1.5', date: '2026-03-14', by: 'Richard Mumba', note: 'Synced from QuantalFlow Canvas' }],
          comments: []
        }
      ],
      relationships: [
        { id: 'REL-1', source: 'KO-DOC-01', target: 'KO-PRJ-02', type: 'Supports' },
        { id: 'REL-2', source: 'KO-TSK-01', target: 'KO-PRJ-02', type: 'Originated From' },
        { id: 'REL-3', source: 'KO-TSK-01', target: 'KO-DOC-01', type: 'References' },
        { id: 'REL-4', source: 'KO-MTG-01', target: 'KO-PRJ-01', type: 'Linked To' },
        { id: 'REL-5', source: 'KO-DEC-01', target: 'KO-MTG-01', type: 'Originated From' },
        { id: 'REL-6', source: 'KO-PRJ-01', target: 'KO-DEC-01', type: 'Depends On' },
        { id: 'REL-7', source: 'KO-SOP-02', target: 'KO-PRJ-01', type: 'Supports' },
        { id: 'REL-8', source: 'KO-TRN-01', target: 'KO-SOP-02', type: 'References' },
        { id: 'REL-9', source: 'KO-CLI-01', target: 'KO-PRJ-01', type: 'Used By' },
        { id: 'REL-10', source: 'KO-WB-01', target: 'KO-PRJ-01', type: 'Related To' },
        { id: 'REL-11', source: 'KO-WFL-01', target: 'KO-PRJ-02', type: 'Depends On' },
        { id: 'REL-12', source: 'KO-RES-01', target: 'KO-WFL-01', type: 'Supports' },
        { id: 'REL-13', source: 'KO-SOP-01', target: 'KO-POL-01', type: 'References' },
        { id: 'REL-14', source: 'KO-DEC-01', target: 'KO-TPL-01', type: 'Created By' },
        { id: 'REL-15', source: 'KO-DEP-01', target: 'KO-PRJ-02', type: 'Linked To' }
      ],
      decisions: [
        {
          id: 'DEC-2026-01',
          title: 'Use Convex Instead of Firebase',
          project: 'Nursing Student Attendance Project',
          description: 'Adopt Convex as the primary reactive backend and document projection store for real-time attendance, project plans, and collaborative workspace syncing.',
          reason: 'Better integration with application architecture, end-to-end transactional consistency, and zero composite-index configuration overhead.',
          alternatives: ['Firebase', 'Supabase'],
          approver: 'Richard Mumba (CTO)',
          approvers: ['Richard Mumba', 'Mwila Chanda', 'David Banda'],
          approvalDate: '15 March 2026',
          status: 'Approved',
          risks: 'Team ramp-up on Convex schema conventions; mitigated via internal SOP and SQLite local fallback.',
          outcomes: '40% faster real-time sync implementation, unified TypeScript/JS data layer, and deterministic offline reconciliation.',
          evidence: 'Benchmark latency report (p95 42ms vs 118ms) & Architecture Review Board minutes (KO-MTG-01).',
          attachments: ['convex-vs-firebase-benchmark.pdf', 'schema-projection-diagram.png']
        },
        {
          id: 'DEC-2026-02',
          title: 'Adopt Idempotent Webhook Queue for Airtel Money Collections',
          project: 'Airtel Money Payment Integration',
          description: 'Route all Airtel Money USSD payment callbacks through a signed, idempotent verification queue before updating invoice and student fee ledgers.',
          reason: 'Prevents duplicate ledger postings during mobile network retries and guarantees audit-grade financial reconciliation.',
          alternatives: ['Direct Synchronous API Polling', 'Manual End-of-Day CSV Import'],
          approver: 'David Banda (Payments Lead)',
          approvers: ['David Banda', 'Thandiwe Zulu'],
          approvalDate: '04 March 2026',
          status: 'Approved',
          risks: 'Delayed settlement notifications if webhook endpoint experiences downtime; mitigated with 5-step exponential retry.',
          outcomes: 'Zero duplicate payment postings across 4,800 test transactions and 62% reduction in support dispute tickets.',
          evidence: 'Airtel Money Webhook Spec v3.1 (KO-DOC-01) & Q1 Support Root-Cause Analysis (KO-RES-01).',
          attachments: ['airtel-webhook-sequence.pdf']
        }
      ],
      meetings: [
        {
          id: 'MTG-2026-14',
          title: 'Nursing Attendance Architecture & Rollout Review',
          date: '15 March 2026',
          project: 'Nursing Student Attendance Project',
          participants: ['Richard Mumba', 'Grace Phiri', 'Mwila Chanda', 'Dean M. Kunda'],
          summary: 'Reviewed pilot performance across 3 teaching hospitals (98.4% attendance capture accuracy). Ratified Convex backend decision and finalised offline sync recovery SOP.',
          decisions: ['Use Convex Instead of Firebase (DEC-2026-01)', 'Set dynamic QR code rotation window to 30 seconds'],
          actionItems: [
            { text: 'Publish SOP-021 Offline Sync Recovery to Clinical Operations Wiki', owner: 'Grace Phiri', done: true },
            { text: 'Deploy geofence radius calibration for Ward 4B', owner: 'Richard Mumba', done: false }
          ],
          risks: ['Hospital basement wards experience intermittent Wi-Fi drops during shift handover'],
          attachments: ['ward-pilot-telemetry.xlsx', 'attendance-mindmap-export.png']
        },
        {
          id: 'MTG-2026-11',
          title: 'Airtel Money Merchant Sandbox & Support Triage Sync',
          date: '11 March 2026',
          project: 'Airtel Money Payment Integration',
          participants: ['David Banda', 'Thandiwe Zulu', 'Mwila Chanda'],
          summary: 'Aligned Payments Engineering and Customer Support on handling 90-second USSD prompt timeouts and automated ticket enrichment with merchant transaction references.',
          decisions: ['Adopt Idempotent Webhook Queue (DEC-2026-02)', 'Expose real-time pending status tracker in Support Console'],
          actionItems: [
            { text: 'Complete HMAC signature verification tests', owner: 'David Banda', done: true },
            { text: 'Train Tier-1 agents on Payment Dispute Workflow (KO-WFL-01)', owner: 'Thandiwe Zulu', done: false }
          ],
          risks: ['Peak end-of-month tuition deadlines may spike USSD gateway latency'],
          attachments: ['airtel-sandbox-logs.pdf']
        }
      ],
      lessons: [
        {
          id: 'LL-2026-01',
          project: 'Nursing Student Attendance Project',
          date: '18 March 2026',
          author: 'Grace Phiri',
          whatWorked: 'Dynamic 30-second QR codes paired with supervisor one-tap approval reduced morning roll-call from 18 minutes to 90 seconds and eliminated proxy sign-ins.',
          whatFailed: 'Initial assumption that hospital wards had continuous Wi-Fi caused 14% of first-week check-ins to stall before offline IndexedDB queueing was added.',
          challenges: 'Night-shift handover overlaps created duplicate attendance timestamps across midnight boundaries.',
          recommendations: 'Always design field/clinical apps offline-first from Sprint 1 and test shift-boundary timestamps explicitly.',
          bestPractices: 'Pair every clinical deployment with a 5-minute interactive Supervisor Quickstart course and laminated ward QR recovery card.',
          successFactors: 'Early involvement of nursing ward supervisors in whiteboard workflow design and weekly telemetry reviews.'
        },
        {
          id: 'LL-2026-02',
          project: 'Airtel Money Payment Integration',
          date: '12 March 2026',
          author: 'David Banda',
          whatWorked: 'Idempotent transaction keys and automated nightly reconciliation eliminated manual finance spreadsheet matching.',
          whatFailed: 'Generic "Payment Failed" UI messages when users took >60s on USSD caused repeated payment attempts and support spikes.',
          challenges: 'Sandbox latency profiles differed significantly from live mobile carrier peak hours.',
          recommendations: 'Display explicit "Awaiting USSD PIN confirmation" progress states and auto-reconcile pending callbacks before allowing retries.',
          bestPractices: 'Maintain a versioned Webhook Contract PDF (KO-DOC-01) shared across Engineering, Finance, and Customer Support.',
          successFactors: 'Joint triage between Payments Engineering and Customer Success cut dispute resolution time by 62%.'
        }
      ],
      sops: [
        {
          id: 'SOP-014',
          title: 'Employee & Clinical Coordinator Onboarding',
          department: 'People & Operations',
          version: 'v2.2',
          status: 'Approved',
          owner: 'Chileshe Mulenga',
          nextReview: '2026-09-14',
          steps: [
            'Provision QuantalFlow account, SSO, and department role permissions.',
            'Assign mandatory Company & Department Wiki reading path.',
            'Complete Security, Data Privacy & Knowledge Governance quiz (85% minimum).',
            'Schedule 30-minute Organisational Brain walkthrough with assigned mentor.',
            'Log completion in Learning Centre and issue Onboarding Certification.'
          ]
        },
        {
          id: 'SOP-021',
          title: 'Nursing Attendance Offline Sync Recovery',
          department: 'Clinical Operations',
          version: 'v1.3',
          status: 'Approved',
          owner: 'Grace Phiri',
          nextReview: '2026-06-16',
          steps: [
            'Open Attendance Supervisor dashboard and inspect pending offline queue badge.',
            'Switch tablet/device to LTE fallback or hospital admin Wi-Fi.',
            'Tap "Replay Offline Batch" to submit idempotent attendance records to Convex.',
            'Verify ward count matches physical shift roster.',
            'Escalate any hash collision alerts to Product Engineering via QuantalFlow ticket.'
          ]
        },
        {
          id: 'SOP-029',
          title: 'Airtel Money Payment Dispute & Callback Reconciliation',
          department: 'Payments & FinTech',
          version: 'v1.1',
          status: 'In Review',
          owner: 'David Banda',
          nextReview: '2026-05-01',
          steps: [
            'Collect student/customer MSISDN and Airtel Money transaction reference.',
            'Lookup reference in QuantalFlow Payment Ledger & Webhook Audit Log.',
            'If status is PENDING_CALLBACK > 5 mins, trigger manual status inquiry API.',
            'Post verified settlement to invoice and notify customer automatically.',
            'Log recurring carrier timeouts in Customer Support Root-Cause tracker.'
          ]
        }
      ],
      wiki: [
        {
          id: 'WIKI-01', section: 'Company', title: 'QuantalFlow Organisational Operating System',
          updatedAt: '2026-03-19', author: 'Richard Mumba',
          body: 'QuantalFlow connects visual thinking with institutional memory. Every project starts in [[Nursing Student Attendance Project]] or [[Airtel Money Payment Integration]], records architectural choices in [[Use Convex Instead of Firebase]], and codifies repeatable execution in [[SOP-014: Employee & Clinical Coordinator Onboarding]].'
        },
        {
          id: 'WIKI-02', section: 'Departments', title: 'Payments & FinTech Engineering Playbook',
          updatedAt: '2026-03-18', author: 'David Banda',
          body: 'Our FinTech group maintains mobile money integrations including [[Airtel Money Payment Integration]] and [[Airtel Money Webhook & Reconciliation Spec (PDF)]]. All production changes require peer review and adherence to [[Data Classification & Knowledge Governance Policy]].'
        },
        {
          id: 'WIKI-03', section: 'Products', title: 'QuantalFlow Knowledge Graph & AI Architecture',
          updatedAt: '2026-03-19', author: 'Richard Mumba',
          body: 'Replaces static folders with typed Knowledge Objects linked by 8 semantic relationship edges. Feeds directly from Whiteboards, Mind Maps, Project Planning, Note Pad, and Files.'
        },
        {
          id: 'WIKI-04', section: 'Clients', title: 'Lusaka College of Nursing & Midwifery — Account Dossier',
          updatedAt: '2026-03-15', author: 'Thandiwe Zulu',
          body: 'Pilot partner for [[Nursing Student Attendance Project]]. 1,200 enrolled nursing students across 14 hospital wards. Supervisors certified via [[Nursing Attendance Supervisor Quickstart & Certification]].'
        },
        {
          id: 'WIKI-05', section: 'Projects', title: 'Nursing Student Attendance Project — Living Charter',
          updatedAt: '2026-03-19', author: 'Grace Phiri',
          body: 'Built on Convex per [[Use Convex Instead of Firebase]]. Offline recovery documented in [[SOP-021: Nursing Attendance Offline Sync Recovery]]. Visual topology maintained on the QuantalFlow Whiteboard.'
        },
        {
          id: 'WIKI-06', section: 'Policies', title: 'Data Classification & Access Inheritance Rules',
          updatedAt: '2026-02-12', author: 'Mwila Chanda',
          body: 'Defines Public, Department, Project, Private, Executive, and Confidential tiers. Confidential payment documents inherit strict view-only watermarking and 90-day compliance review schedules.'
        },
        {
          id: 'WIKI-07', section: 'Training', title: 'New Hire & Clinical Supervisor Onboarding Guide',
          updatedAt: '2026-03-14', author: 'Chileshe Mulenga',
          body: 'Follow [[SOP-014: Employee & Clinical Coordinator Onboarding]] for Day-1 provisioning, then complete the interactive quizzes inside the Learning Centre.'
        },
        {
          id: 'WIKI-08', section: 'Operations', title: 'Customer Support Triage & SLA Escalation Matrix',
          updatedAt: '2026-03-17', author: 'Thandiwe Zulu',
          body: 'Summarises Q1 support patterns from [[Customer Support Root-Cause Analysis Q1 2026]]. Payment timeout disputes follow [[Customer Support Escalation & Payment Dispute Flow]] with a 15-minute escalation SLA.'
        }
      ],
      documents: [
        { id: 'DOC-1', name: 'Airtel Money Webhook & Reconciliation Spec.pdf', format: 'PDF', size: '2.4 MB', version: 'v3.1', status: 'Approved', permission: 'Confidential', author: 'David Banda', updatedAt: '2026-03-17', project: 'Airtel Money Payment Integration', summary: 'Full OAuth2, HMAC signature, USSD push timeout, and settlement reconciliation contract.', changes: ['v3.1: Updated exponential retry backoff', 'v3.0: Production merchant endpoints'], comments: ['Mwila Chanda: Verified against sandbox logs.'] },
        { id: 'DOC-2', name: 'Nursing Attendance Clinical Pilot Report.docx', format: 'Word', size: '1.8 MB', version: 'v2.0', status: 'Approved', permission: 'Project', author: 'Grace Phiri', updatedAt: '2026-03-16', project: 'Nursing Student Attendance Project', summary: 'Comprehensive evaluation across 14 hospital wards showing 98.4% capture accuracy and 90-second check-in.', changes: ['v2.0: Added Ward 4B supervisor quotes', 'v1.0: Initial February pilot findings'], comments: ['Richard Mumba: Great data for Nursing Council briefing.'] },
        { id: 'DOC-3', name: 'Q1 Payment & Attendance Telemetry Ledger.xlsx', format: 'Excel', size: '940 KB', version: 'v1.4', status: 'Approved', permission: 'Department', author: 'David Banda', updatedAt: '2026-03-18', project: 'Airtel Money Payment Integration', summary: 'Transaction volume, callback latency percentiles, and reconciliation match rates (99.94%).', changes: ['v1.4: Added March cohort pivot'], comments: [] },
        { id: 'DOC-4', name: 'Organisational Brain Executive Briefing.pptx', format: 'PowerPoint', size: '4.6 MB', version: 'v1.2', status: 'In Review', permission: 'Executive', author: 'Richard Mumba', updatedAt: '2026-03-19', project: 'QuantalFlow Core', summary: 'Board deck illustrating Knowledge Graph adoption, health score gains, and AI search ROI.', changes: ['v1.2: Updated Q1 reuse metrics'], comments: [] },
        { id: 'DOC-5', name: 'Ward Geofence & Convex Sync Topology.png', format: 'Image', size: '680 KB', version: 'v1.5', status: 'Approved', permission: 'Project', author: 'Richard Mumba', updatedAt: '2026-03-14', project: 'Nursing Student Attendance Project', summary: 'High-resolution export of the QuantalFlow Whiteboard architecture diagram.', changes: ['v1.5: Added LTE fallback path'], comments: [] },
        { id: 'DOC-6', name: 'Supervisor QR Check-In Walkthrough.mp4', format: 'Video', size: '18.2 MB', version: 'v1.0', status: 'Approved', permission: 'Public', author: 'Grace Phiri', updatedAt: '2026-03-12', project: 'Nursing Student Attendance Project', summary: '3-minute narrated training video demonstrating mobile check-in and offline batch replay.', changes: ['v1.0: Initial recording'], comments: [] },
        { id: 'DOC-7', name: 'Architecture Review Board — Convex Decision Recording.mp3', format: 'Audio', size: '9.1 MB', version: 'v1.0', status: 'Archived', permission: 'Project', author: 'Richard Mumba', updatedAt: '2026-03-15', project: 'Nursing Student Attendance Project', summary: 'Audio archive of the 15 March 2026 decision session comparing Convex, Firebase, and Supabase.', changes: ['v1.0: Auto-transcribed to MTG-2026-14'], comments: [] }
      ],
      timelines: {
        'Nursing Student Attendance Project': [
          { date: '12 Jan 2026', stage: 'Project Start', title: 'Project Kickoff & Clinical Discovery', desc: 'Mapped paper attendance bottlenecks across 14 hospital wards on a QuantalFlow Mind Map.' },
          { date: '02 Feb 2026', stage: 'Architecture Change', title: 'Offline-First IndexedDB Queue Introduced', desc: 'Added local device queueing after basement ward Wi-Fi drop testing.' },
          { date: '28 Feb 2026', stage: 'Process Improvement', title: '3-Hospital Pilot Launch & SOP-021 Draft', desc: 'Roll-call duration dropped from 18 minutes to 90 seconds across 1,200 students.' },
          { date: '15 Mar 2026', stage: 'Major Decision', title: 'Approved: Use Convex Instead of Firebase', desc: 'Architecture Review Board ratified Convex (DEC-2026-01) for reactive ledger sync.' },
          { date: '18 Mar 2026', stage: 'Project Closure / Scale', title: 'Lessons Learned & Supervisor Certification Live', desc: 'Captured LL-2026-01 and launched Learning Centre certification for 6 expansion colleges.' }
        ],
        'Airtel Money Payment Integration': [
          { date: '25 Jan 2026', stage: 'Project Start', title: 'Airtel Money Open API Scoping', desc: 'Defined merchant OAuth2, USSD collection flow, and tuition portal touchpoints.' },
          { date: '14 Feb 2026', stage: 'Process Improvement', title: 'Support Dispute Escalation Workflow', desc: 'Created KO-WFL-01 cutting payment dispute triage SLA to 15 minutes.' },
          { date: '04 Mar 2026', stage: 'Major Decision', title: 'Idempotent Webhook Queue Approved', desc: 'Ratified DEC-2026-02 with HMAC verification and 5-step retry backoff.' },
          { date: '17 Mar 2026', stage: 'Architecture Change', title: 'Webhook Contract v3.1 & Nightly Reconciliation', desc: 'Achieved 99.94% automated ledger match rate across sandbox & pilot.' }
        ]
      },
      experts: [
        { id: 'EXP-1', name: 'David Banda', role: 'Payment Integration Expert', department: 'Payments & FinTech', projects: 12, documents: 45, decisions: 7, score: 96, areas: ['Airtel Money', 'Mobile Money Rails', 'Webhooks', 'Ledger Reconciliation'] },
        { id: 'EXP-2', name: 'Richard Mumba', role: 'Principal Systems Architect', department: 'Product Engineering', projects: 15, documents: 52, decisions: 14, score: 98, areas: ['Convex Architecture', 'QuantalFlow Core', 'Knowledge Graphs', 'Offline Sync'] },
        { id: 'EXP-3', name: 'Grace Phiri', role: 'Clinical Operations Lead', department: 'Clinical Operations', projects: 8, documents: 31, decisions: 5, score: 91, areas: ['Nursing Attendance', 'Clinical SOPs', 'Supervisor Training', 'Field Rollouts'] },
        { id: 'EXP-4', name: 'Thandiwe Zulu', role: 'Customer Intelligence Lead', department: 'Customer Success', projects: 9, documents: 28, decisions: 4, score: 89, areas: ['Customer Support', 'Root-Cause Analysis', 'Client Onboarding', 'SLA Workflows'] },
        { id: 'EXP-5', name: 'Chileshe Mulenga', role: 'People & Enablement Lead', department: 'People & Operations', projects: 6, documents: 24, decisions: 3, score: 86, areas: ['Onboarding Procedures', 'Learning Paths', 'SOP Governance', 'Compliance'] },
        { id: 'EXP-6', name: 'Mwila Chanda', role: 'Security & Governance Lead', department: 'Security & Compliance', projects: 10, documents: 34, decisions: 9, score: 93, areas: ['RBAC & Permissions', 'Data Classification', 'Audit Trails', 'API Security'] }
      ],
      courses: [
        {
          id: 'CRS-1',
          title: 'Nursing Attendance Supervisor Certification',
          category: 'Onboarding Program',
          duration: '25 mins',
          modules: 4,
          enrolled: 48,
          completion: 88,
          certification: 'Certified Clinical Attendance Supervisor',
          sourceKnowledge: 'SOP-021 + Nursing Student Attendance Project',
          quiz: [
            { q: 'What is the first step when hospital Wi-Fi drops during ward check-in?', options: ['Ask students to re-register manually on paper', 'Verify the local offline IndexedDB queue badge and switch to LTE fallback', 'Delete the browser cache immediately'], answer: 1 },
            { q: 'Why did QuantalFlow choose Convex over Firebase for the Attendance Project?', options: ['Better integration with application architecture & reactive transactions', 'Firebase does not support web browsers', 'Convex requires no internet ever'], answer: 0 }
          ]
        },
        {
          id: 'CRS-2',
          title: 'Airtel Money Payment Integration & Dispute Mastery',
          category: 'Learning Path',
          duration: '40 mins',
          modules: 6,
          enrolled: 22,
          completion: 74,
          certification: 'QuantalFlow FinTech Specialist',
          sourceKnowledge: 'KO-DOC-01 + DEC-2026-02 + SOP-029',
          quiz: [
            { q: 'How does QuantalFlow prevent duplicate ledger entries from Airtel Money callback retries?', options: ['Ignoring all callbacks after 5pm', 'Using idempotent transaction keys & HMAC signature verification', 'Manual CSV deletion'], answer: 1 },
            { q: 'What is the escalation SLA for unresolved payment-pending support disputes?', options: ['15 minutes', '48 hours', '7 business days'], answer: 0 }
          ]
        },
        {
          id: 'CRS-3',
          title: 'QuantalFlow Employee Onboarding & Knowledge Governance',
          category: 'Onboarding Program',
          duration: '30 mins',
          modules: 5,
          enrolled: 64,
          completion: 94,
          certification: 'QuantalFlow Certified Contributor',
          sourceKnowledge: 'SOP-014 + KO-POL-01',
          quiz: [
            { q: 'Which permission tier enforces zero inheritance and watermarked viewing?', options: ['Public', 'Department', 'Confidential'], answer: 2 }
          ]
        }
      ],
      templates: [
        { id: 'TPL-1', category: 'SOP', title: 'Standard Operating Procedure (SOP) Blueprint', desc: 'Versioned SOP structure with Purpose, Scope, Owner, Review Cadence, and numbered operational steps.', uses: 42 },
        { id: 'TPL-2', category: 'Policy', title: 'Enterprise Security & Governance Policy', desc: 'Structured policy framework covering classification tiers, RBAC inheritance, and audit obligations.', uses: 19 },
        { id: 'TPL-3', category: 'Project Framework', title: 'Project Charter & Knowledge Lineage Pack', desc: 'Connects project goals, milestones, linked boards, RAID log, and post-project Lessons Learned.', uses: 37 },
        { id: 'TPL-4', category: 'Research Template', title: 'Customer Support & UX Root-Cause Synthesis', desc: 'Quantitative ticket clustering, user quotes, friction impact matrix, and actionable recommendations.', uses: 28 },
        { id: 'TPL-5', category: 'Meeting Template', title: 'Decision-First Meeting Knowledge Capture', desc: 'Auto-extracts Summary, Decisions, Action Items, Risks, Participants, and linked Project IDs.', uses: 65 },
        { id: 'TPL-6', category: 'Training Content', title: 'Micro-Learning Course & Certification Kit', desc: 'Converts existing SOPs and project docs into a 4-module course with graded assessment quiz.', uses: 24 }
      ],
      automations: [
        { id: 'AUTO-1', name: 'Project Completed → Lessons Learned Record', trigger: 'When Project Completed', action: 'Create Lessons Learned Record & notify Project Lead', enabled: true, runs: 14, lastRun: '18 Mar 2026' },
        { id: 'AUTO-2', name: 'New Workflow Created → AI SOP Draft', trigger: 'When New Workflow Created', action: 'Generate SOP Draft with numbered steps & review date', enabled: true, runs: 23, lastRun: '16 Mar 2026' },
        { id: 'AUTO-3', name: 'Meeting Ends → Permanent Knowledge Entry', trigger: 'When Meeting Ends', action: 'Extract Summary, Decisions, Action Items & link to Project', enabled: true, runs: 61, lastRun: '15 Mar 2026' },
        { id: 'AUTO-4', name: 'Decision Approved → Archive Into Repository', trigger: 'When Decision Approved', action: 'Archive immutable ADR record & update Knowledge Graph', enabled: true, runs: 19, lastRun: '15 Mar 2026' }
      ],
      gaps: [
        { id: 'GAP-1', title: 'Missing SOP: MTN MoMo Fallback Settlement', severity: 'High', dept: 'Payments & FinTech', action: 'Generate SOP' },
        { id: 'GAP-2', title: 'Outdated Document: 2025 Legacy Attendance CSV Guide', severity: 'Medium', dept: 'Clinical Operations', action: 'Archive / Refresh' },
        { id: 'GAP-3', title: 'Duplicate Content: Two SSO Login Troubleshooting Pages', severity: 'Low', dept: 'Customer Success', action: 'Merge Articles' }
      ],
      analytics: {
        growth: [
          { month: 'Oct', count: 48 },
          { month: 'Nov', count: 64 },
          { month: 'Dec', count: 82 },
          { month: 'Jan', count: 109 },
          { month: 'Feb', count: 138 },
          { month: 'Mar', count: 174 }
        ],
        departments: [
          { name: 'Product Engineering', count: 54 },
          { name: 'Payments & FinTech', count: 38 },
          { name: 'Clinical Operations', count: 31 },
          { name: 'Customer Success', count: 27 },
          { name: 'People & Operations', count: 15 },
          { name: 'Security & Compliance', count: 9 }
        ],
        topSearches: [
          { term: 'Nursing Student Attendance Project', count: 84 },
          { term: 'Airtel Money webhook timeout', count: 67 },
          { term: 'onboarding procedures', count: 59 },
          { term: 'Use Convex Instead of Firebase', count: 46 },
          { term: 'customer support issues', count: 41 }
        ],
        reuseRate: 78,
        avgLearningCompletion: 85
      }
    };
  }

  global.QFKnowledgeSeed = {
    OBJECT_TYPES: OBJECT_TYPES,
    RELATIONSHIP_TYPES: RELATIONSHIP_TYPES,
    PERMISSION_LEVELS: PERMISSION_LEVELS,
    createInitialState: createInitialState
  };
})(window);
