import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pagesDir = path.join(root, 'src', 'pages');

const productPages = [
  {
    slug: 'intelligent-canvas',
    title: 'Intelligent Canvas™ | QuantalFlow',
    eyebrow: 'Intelligent Canvas',
    h1: 'One shared visual canvas for humans and AI',
    sub: 'Bring research, strategy, architecture, and sprint delivery onto an intelligent surface where teams and autonomous agents work from shared context.',
    cards: [
      { title: 'Unified Context', desc: 'No more fragmented docs or silos. AI agents and team members see the exact same live canvas.' },
      { title: 'Living Artifacts', desc: 'Transform rough brainstorming sticky notes into production-ready specifications, code diagrams, and epics.' },
      { title: 'Multi-Agent Collaboration', desc: 'Agents can read the board state, ask clarifying questions, and update diagrams via MCP.' }
    ],
    items: ['Single source of truth for planning and delivery', 'Live two-way synchronization with code and issues', 'Native Model Context Protocol (MCP) integration']
  },
  {
    slug: 'flows',
    title: 'QuantalFlow Flows | Process & Workflow Diagrams',
    eyebrow: 'QuantalFlow Flows',
    h1: 'Map workflows and processes the whole team can follow',
    sub: 'Design end-to-end business logic, user journeys, and systems architectures with intelligent auto-routing connectors and smart shapes.',
    cards: [
      { title: 'Smart Snap Connectors', desc: 'Lines automatically route around obstacles and maintain connections as you move objects.' },
      { title: 'Process Logic & BPMN', desc: 'Standardized swimlanes, gateway nodes, and decision points for enterprise modeling.' },
      { title: 'AI Flow Generation', desc: 'Type a process description or paste API specs to instantly generate an interactive flowchart.' }
    ],
    items: ['BPMN 2.0 compliant shapes and notation', 'Auto-formatting that prevents messy spaghetti diagrams', 'Export as vector SVG, PNG, or PDF for documentation']
  },
  {
    slug: 'prototypes',
    title: 'Prototypes & Wireframes | QuantalFlow',
    eyebrow: 'Prototypes & Wireframes',
    h1: 'From rough sketch to interactive prototype in minutes',
    sub: 'Create low-fidelity wireframes, interactive user flows, and click-through mockups right beside your user research and sprint backlog.',
    cards: [
      { title: 'UI Component Library', desc: 'Pre-built buttons, inputs, modals, navigation bars, and mobile frames ready to drop.' },
      { title: 'Clickable Hotspots', desc: 'Link frames together to simulate real user click journeys before writing a line of code.' },
      { title: 'Instant Stakeholder Feedback', desc: 'Gather pinned comments and video TalkTrack reactions directly on the mockup.' }
    ],
    items: ['Extensive device frames for iOS, Android, and Desktop', 'Figma two-way sync to bring high-res mockups onto canvas', 'Rapid usability testing with live team participation']
  },
  {
    slug: 'diagrams',
    title: 'Diagrams & Mermaid | QuantalFlow',
    eyebrow: 'Technical Diagramming',
    h1: 'Architecture diagrams and Mermaid code on one canvas',
    sub: 'Create cloud infrastructure diagrams (AWS, Azure, GCP, Kubernetes) and generate Mermaid diagrams directly from Markdown or code.',
    cards: [
      { title: 'Mermaid Code-to-Diagram', desc: 'Write or paste Mermaid syntax and watch it render into interactive, editable nodes.' },
      { title: 'Official Cloud Icon Sets', desc: 'Certified architecture packs for AWS, Google Cloud, Microsoft Azure, and Cisco.' },
      { title: 'Architecture RFCs', desc: 'Place architecture diagrams right next to your engineering design documents.' }
    ],
    items: ['Full support for sequence, class, state, and ER diagrams', 'Import existing diagrams from Lucidchart or Visio', 'Embed live diagrams directly into Notion, Confluence, and GitHub']
  },
  {
    slug: 'engage',
    title: 'QuantalFlow Engage | Interactive Meetings & Polling',
    eyebrow: 'QuantalFlow Engage',
    h1: 'Turn passive presentations into active collaboration',
    sub: 'Run engaging all-hands, agile ceremonies, and client workshops with built-in timers, voting sessions, and private breakout boards.',
    cards: [
      { title: 'Anonymous Voting', desc: 'Collect unbiased team feedback and prioritize features without groupthink.' },
      { title: 'Smart Timers & Music', desc: 'Keep sprints and brainstorms on track with customizable timers and focus music.' },
      { title: 'Interactive Reactions', desc: 'Keep energy high with emojis, applause, and live reaction bursts across the board.' }
    ],
    items: ['Private breakout frames for sub-teams', 'Audience engagement stats and summary exports', 'Seamless integration with Zoom, Teams, and Google Meet']
  },
  {
    slug: 'ai',
    title: 'QuantalFlow AI | Generative Workspace Intelligence',
    eyebrow: 'QuantalFlow AI',
    h1: 'Human collaboration at the speed of visual AI',
    sub: 'Context-aware visual intelligence that understands the spatial relationship of notes, diagrams, and strategy on your board.',
    cards: [
      { title: 'Semantic Clustering', desc: 'Instantly organize hundreds of brainstorm sticky notes by sentiment, theme, or team.' },
      { title: 'Prompt to Artifact', desc: 'Turn text briefs into user story maps, Kanban boards, or system sequence diagrams.' },
      { title: 'Executive Summaries', desc: 'Condense dense boards into concise markdown summaries ready for leadership reviews.' }
    ],
    items: ['Enterprise privacy: your board data is never used to train public models', 'Direct support for custom prompts and prompt playbooks', 'Understands images, text documents, and diagram structures']
  },
  {
    slug: 'ai-workflows',
    title: 'AI Workflows | Automated Canvas Pipelines',
    eyebrow: 'AI Workflows',
    h1: 'Automate repetitive product and strategy workflows',
    sub: 'Set up multi-step AI pipelines that take raw user research, extract key insights, generate personas, and draft initial user stories.',
    cards: [
      { title: 'Research to Epics', desc: 'Extract pain points from customer interviews and turn them into Jira backlog items.' },
      { title: 'Automated Retrospectives', desc: 'Cluster retro notes into root causes and generate prioritized action plans.' },
      { title: 'Strategy Roadmaps', desc: 'Input quarterly objectives and let AI lay out phased Gantt milestones and dependencies.' }
    ],
    items: ['Trigger workflows with a single click or schedule', 'Standardize best practices across entire departments', 'Connect AI outputs directly to Jira, Linear, and Asana']
  },
  {
    slug: 'connectors',
    title: 'Connectors | Two-Way Sync Across Tools',
    eyebrow: 'Connectors',
    h1: 'Live context flowing between QuantalFlow and your tech stack',
    sub: 'Eliminate manual copy-pasting. Keep boards synchronized with Jira epics, GitHub issues, Figma components, and Salesforce accounts.',
    cards: [
      { title: 'Two-Way Live Cards', desc: 'Edit a card in QuantalFlow and see changes update in Jira instantly, and vice versa.' },
      { title: 'Figma Live Embeds', desc: 'View always-current design artboards right beside product requirements.' },
      { title: 'Automated Status Alerts', desc: 'Sync board milestones with Slack and Microsoft Teams notification channels.' }
    ],
    items: ['Native Jira, Azure DevOps, and GitHub integrations', 'Conflict-free synchronization with offline resilience', 'Granular field mapping and access permission controls']
  },
  {
    slug: 'mcp',
    title: 'QuantalFlow MCP Server | Model Context Protocol',
    eyebrow: 'Model Context Protocol',
    h1: 'Connect autonomous AI agents to your QuantalFlow canvas',
    sub: 'Empower Claude, Cursor, and custom autonomous agents to read board structure, place diagrams, and execute workflows via the open MCP standard.',
    cards: [
      { title: 'Full Canvas Read/Write', desc: 'Agents can read shapes, sticky text, frames, and connections with millimeter precision.' },
      { title: 'Spatial Reasoning', desc: 'Agents understand clusters, layouts, and hierarchical group relationships on canvas.' },
      { title: 'Zero Friction Setup', desc: 'Standard MCP server compatible with any MCP client or custom agent harness.' }
    ],
    items: ['Open source MCP specification compliant', 'Secure token-based authentication and role-based board scoping', 'Complete JSON Schema docs for tools and resources']
  },
  {
    slug: 'blueprints',
    title: 'QuantalFlow Blueprints | Standardized Workspaces',
    eyebrow: 'QuantalFlow Blueprints',
    h1: 'Proven team workspaces and enterprise operating models',
    sub: 'Deploy ready-to-run blueprints for Product Operating Models, Agile Transformations, Design Systems, and Cloud Migrations.',
    cards: [
      { title: 'Repeatable Excellence', desc: 'Give every squad a running start with standardized boards and governance.' },
      { title: 'Custom Organization Kits', desc: 'Package your company’s internal frameworks into one-click reusable workspaces.' },
      { title: 'Governance Built-in', desc: 'Ensure consistent taxonomy, tagging, and documentation across all business units.' }
    ],
    items: ['Created in partnership with leading global product organizations', 'Automated workspace provisioning for new teams', 'Centralized template updates and deprecation management']
  },
  {
    slug: 'integrations',
    title: 'Integrations | Connect with 250+ Apps',
    eyebrow: 'Integrations',
    h1: 'Connect QuantalFlow with the tools your team relies on daily',
    sub: 'From developer tools like Jira and GitHub to communication staples like Slack and Zoom, QuantalFlow plugs into your existing tech stack seamlessly.',
    cards: [
      { title: 'Development & DevOps', desc: 'Jira, Azure DevOps, GitHub, GitLab, and Linear live cards.' },
      { title: 'Product & Design', desc: 'Figma, Adobe XD, InVision, and Sketch bidirectional sync.' },
      { title: 'Collaboration & Content', desc: 'Slack, Microsoft Teams, Google Workspace, Notion, and Confluence.' }
    ],
    items: ['Over 250 enterprise-grade apps in the QuantalFlow Marketplace', 'REST API and Webhooks to build bespoke internal tools', 'SSO, SCIM, and automated team provisioning']
  },
  {
    slug: 'whiteboard',
    title: 'Online Whiteboard | Freeform Collaboration',
    eyebrow: 'Online Whiteboard',
    h1: 'The infinite canvas for freeform visual thinking',
    sub: 'Experience the magic of an unbounded whiteboard with digital sticky notes, freehand drawing, shapes, and multiplayer cursors.',
    cards: [
      { title: 'Zero Constraints', desc: 'No limits on canvas size. Zoom out for the big picture or zoom in to fine details.' },
      { title: 'Multi-device Drawing', desc: 'Use stylus, Apple Pencil, touch, or mouse with natural pressure sensitivity.' },
      { title: 'Multiplayer Magic', desc: 'See hundreds of team cursors collaborating simultaneously without lag.' }
    ],
    items: ['Digital sticky notes in 16 colors with instant text formatting', 'Infinite canvas navigation with intuitive pan, zoom, and minimap', 'Smart drawing recognition that converts rough doodles into clean shapes']
  },
  {
    slug: 'kanban',
    title: 'Kanban Boards | Agile Task Management',
    eyebrow: 'Kanban Boards',
    h1: 'Track work in flight with visual, flexible Kanban boards',
    sub: 'Manage sprints, backlog grooming, and team capacity on a board that links directly to Jira, Azure DevOps, and engineering delivery tools.',
    cards: [
      { title: 'WIP Limits & Swimlanes', desc: 'Prevent bottlenecks and organize tasks by assignee, epic, or priority level.' },
      { title: 'Two-Way Sync', desc: 'Moving a card across columns updates sprint status in Jira automatically.' },
      { title: 'Custom Card Fields', desc: 'Add story points, tags, due dates, assignees, and custom metadata.' }
    ],
    items: ['Swimlanes by squad, release, or severity', 'Card search and filtering for high-speed standups', 'Burndown and velocity tracking directly on the canvas']
  },
  {
    slug: 'timelines',
    title: 'Timelines & Roadmaps | Visual Project Planning',
    eyebrow: 'Timelines & Roadmaps',
    h1: 'Plan across quarters and align around key milestones',
    sub: 'Build interactive Gantt charts, product release roadmaps, and dependency matrices that stakeholders can actually understand.',
    cards: [
      { title: 'Dependency Mapping', desc: 'Draw lines between milestones to visualize critical paths and blockers.' },
      { title: 'Multiple Time Scales', desc: 'Switch effortlessly between days, weeks, sprints, months, and quarters.' },
      { title: 'Live Progress Tracking', desc: 'Color-code milestones and link tasks directly to development tickets.' }
    ],
    items: ['Drag-and-drop timeline bars with automated date recalculation', 'Milestone badges with ownership and risk flags', 'Export timeline views for board decks and steering committees']
  },
  {
    slug: 'talktrack',
    title: 'TalkTrack | Async Video & Audio Walkthroughs',
    eyebrow: 'TalkTrack',
    h1: 'Record interactive walkthroughs directly on the canvas',
    sub: 'Explain your ideas, walk through diagrams, and lead asynchronous reviews without having to schedule yet another meeting.',
    cards: [
      { title: 'Interactive Playback', desc: 'Viewers don’t just watch a flat video; they can interact with the board as you speak.' },
      { title: 'Camera & Screen Pinned', desc: 'Your face and voice follow the exact viewport navigation as you present.' },
      { title: 'Async Review Cycles', desc: 'Teammates can pause, leave comments, and add stickies right at the timestamp.' }
    ],
    items: ['Record webcam and audio with zero extra plugins required', 'Embed TalkTrack recordings inside Jira or Confluence tickets', 'Drastically cut down on synchronous review meetings']
  },
  {
    slug: 'tables',
    title: 'Tables & Structured Grids | QuantalFlow',
    eyebrow: 'Structured Tables',
    h1: 'Data matrices and planning tables beside your diagrams',
    sub: 'Combine the rigor of structured rows and columns with the flexibility of visual whiteboarding. Perfect for feature matrices and scoring.',
    cards: [
      { title: 'Visual Data Cells', desc: 'Nest sticky notes, cards, tags, and icons inside table cells.' },
      { title: 'Flexible Resizing', desc: 'Drag rows and columns with smart auto-spacing and alignment.' },
      { title: 'RICE & MoSCoW Scoring', desc: 'Prioritize feature backlogs with formula columns and visual weightings.' }
    ],
    items: ['Import tabular data from Excel, Google Sheets, or CSV files', 'Color-coded status pills and user assignment tags', 'Freely place tables alongside journey maps and flowcharts']
  },
  {
    slug: 'docs',
    title: 'QuantalFlow Docs | Visual Document Collaboration',
    eyebrow: 'QuantalFlow Docs',
    h1: 'Write specifications and RFCs right beside the diagrams',
    sub: 'Bridge the gap between text and visuals. Write collaborative docs with rich text, headers, checklists, and embedded board frames.',
    cards: [
      { title: 'Side-by-Side Context', desc: 'Read product specs while looking at the exact architecture diagram referenced.' },
      { title: 'Real-time Co-authoring', desc: 'Collaborate with multiplayer cursors, inline comments, and edit tracking.' },
      { title: 'Markdown Support', desc: 'Full keyboard shortcut and markdown formatting for fast, focused writing.' }
    ],
    items: ['Embed live diagrams directly into your documentation', 'Export docs as clean Markdown, HTML, or PDF files', 'Slash commands (/) for fast formatting and widget insertion']
  },
  {
    slug: 'slides',
    title: 'QuantalFlow Slides | Presentation Mode',
    eyebrow: 'QuantalFlow Slides',
    h1: 'Turn your board frames into presentation decks in one click',
    sub: 'Skip spending hours copying screenshots into PowerPoint. Organize frames into an interactive slide deck and present directly from QuantalFlow.',
    cards: [
      { title: 'Auto-Slide Framing', desc: 'Frames automatically format as slides in standard 16:9 widescreen ratio.' },
      { title: 'Interactive Presenting', desc: 'Zoom into details or pan to adjacent diagrams mid-presentation smoothly.' },
      { title: 'Export to PDF & PPTX', desc: 'Download clean vector presentation decks to share with external clients.' }
    ],
    items: ['Presenter view with notes and upcoming slide preview', 'Audience engagement tools: live polling and reaction emojis', 'No separate presentation software required']
  }
];

const solutionPages = [
  {
    slug: 'diagramming',
    title: 'Diagramming | QuantalFlow Solutions',
    eyebrow: 'Solutions: Diagramming',
    h1: 'Technical diagramming and system architecture',
    sub: 'Empower engineering and product teams to map complex systems, cloud architectures, and data flows with precision.',
    cards: [
      { title: 'Cloud Architecture Sets', desc: 'Official icons for AWS, GCP, Azure, Kubernetes, and Cisco networks.' },
      { title: 'Mermaid Code Diagrams', desc: 'Generate sequence, class, and entity relationship diagrams from plain code.' },
      { title: 'Living System Specs', desc: 'Link diagram nodes directly to GitHub code repos and API schemas.' }
    ],
    items: ['BPMN 2.0, UML, and flowchart standard shape packs', 'Interactive drill-down navigation for layered architecture', 'Embed in developer documentation portals and wikis']
  },
  {
    slug: 'workshops',
    title: 'Workshops & Facilitation | QuantalFlow Solutions',
    eyebrow: 'Solutions: Workshops',
    h1: 'Facilitate productive remote and hybrid workshops',
    sub: 'Keep distributed teams energized and engaged with structured agendas, timers, private breakout frames, and voting sessions.',
    cards: [
      { title: 'Facilitator Controls', desc: 'Bring all participants to your view, lock objects, and set timers.' },
      { title: 'Private Mode', desc: 'Participants can draft ideas privately before revealing them to the room.' },
      { title: 'Breakout Spaces', desc: 'Divide larger groups into sub-teams with dedicated workspace areas.' }
    ],
    items: ['Built-in focus music and countdown timer with chime', 'Reaction bursts and sound effects for celebratory energy', 'Export post-workshop summaries and action lists instantly']
  },
  {
    slug: 'brainstorming',
    title: 'Brainstorming & Ideation | QuantalFlow Solutions',
    eyebrow: 'Solutions: Brainstorming',
    h1: 'Capture ideas rapidly, cluster insights, and prioritize together',
    sub: 'Give everyone a voice. Go from a chaotic cloud of sticky notes to an actionable prioritized strategy in a single session.',
    cards: [
      { title: 'Sticky Note Clusters', desc: 'Use AI to group hundreds of stickies by topic, sentiment, or priority in seconds.' },
      { title: '2x2 Prioritization', desc: 'Drop ideas into Impact vs. Effort matrices to pinpoint quick wins.' },
      { title: 'Dot Voting Sessions', desc: 'Run democratized voting rounds so the most impactful concepts rise to the top.' }
    ],
    items: ['Unlimited collaborators on the canvas simultaneously', 'Color-coded stickies for individual or team attribution', 'Turn sticky clusters into Jira backlog tickets with one click']
  },
  {
    slug: 'mind-maps',
    title: 'Mind Maps | QuantalFlow Solutions',
    eyebrow: 'Solutions: Mind Maps',
    h1: 'Expand ideas into structured visual hierarchies',
    sub: 'Brainstorm concepts, explore product taxonomies, and map organizational knowledge with fast, intuitive keyboard-driven mind mapping.',
    cards: [
      { title: 'Keyboard-Driven Speed', desc: 'Hit Tab to create sibling nodes, Enter for child branches. Fast flow state.' },
      { title: 'Auto-Balanced Layout', desc: 'Branches rearrange themselves cleanly to maintain optimal readability.' },
      { title: 'Multi-Media Nodes', desc: 'Attach links, documents, images, and sticky notes directly to any branch.' }
    ],
    items: ['Collapsible branches to navigate massive concept maps easily', 'Custom line styles, node colors, and icon badges', 'Export mind maps as structured text outlines or vector images']
  },
  {
    slug: 'concept-maps',
    title: 'Concept Maps | QuantalFlow Solutions',
    eyebrow: 'Solutions: Concept Maps',
    h1: 'Map complex relationships and knowledge networks',
    sub: 'Visualize how concepts, entities, and business domains relate to each other with labeled cross-links and semantic networks.',
    cards: [
      { title: 'Labeled Relationships', desc: 'Add descriptive verbs and phrases to linking arrows between concept nodes.' },
      { title: 'Domain Knowledge Models', desc: 'Document system boundaries, entity lifecycles, and cross-functional dependencies.' },
      { title: 'Ontology Mapping', desc: 'Build taxonomy trees that align data science, product, and engineering.' }
    ],
    items: ['Flexible node topologies that support circular and network graphs', 'Deep linking to board anchors and external documentation', 'Templates for biology, system thinking, and educational curriculums']
  },
  {
    slug: 'flowcharts',
    title: 'Flowcharts | QuantalFlow Solutions',
    eyebrow: 'Solutions: Flowcharts',
    h1: 'Turn complex logic into decision-ready flowcharts',
    sub: 'Build clear process flowcharts, customer journeys, and automated decision trees that eliminate ambiguity across teams.',
    cards: [
      { title: 'Smart Snap Alignment', desc: 'Shapes automatically snap into uniform grid alignment with equal spacing.' },
      { title: 'Decision Branching', desc: 'Clear true/false and condition branch lines that adapt as logic shifts.' },
      { title: 'AI Flow Drafting', desc: 'Paste user stories or business rules to generate an initial flowchart.' }
    ],
    items: ['Standard flowchart shape library: process, decision, input/output, terminator', 'Color-coded pathway highlighting for golden flows vs. edge cases', 'Embeddable in company intranets, wikis, and design systems']
  },
  {
    slug: 'roadmapping',
    title: 'Roadmapping | QuantalFlow Solutions',
    eyebrow: 'Solutions: Roadmapping',
    h1: 'Shape product vision with live, editable roadmaps',
    sub: 'Align cross-functional teams around goals, strategic themes, and deliverable milestones across quarters.',
    cards: [
      { title: 'Theme-Based Roadmaps', desc: 'Organize priorities by outcome and customer value rather than rigid feature lists.' },
      { title: 'Live Progress Sync', desc: 'Milestone bars reflect real development status pulled from Jira or Linear.' },
      { title: 'Multi-Audience Views', desc: 'Show executive high-level summaries or zoom into granular sprint timelines.' }
    ],
    items: ['Visual dependency arrows that flag schedule risks early', 'Custom color-coding by product pillar, squad, or confidence level', 'Shareable presentation mode for board meetings and customer webinars']
  },
  {
    slug: 'process-mapping',
    title: 'Process Mapping | QuantalFlow Solutions',
    eyebrow: 'Solutions: Process Mapping',
    h1: 'Uncover friction and optimize operational processes',
    sub: 'Map existing enterprise processes, identify operational bottlenecks, and design streamlined future-state workflows.',
    cards: [
      { title: 'Swimlane Organization', desc: 'Clarify cross-department handoffs between Marketing, Sales, Product, and Support.' },
      { title: 'Bottleneck Audits', desc: 'Highlight cycle times, wait stages, and failure points with visual badges.' },
      { title: 'Standard Operating Procedures', desc: 'Link step-by-step SOP guides and training videos to individual steps.' }
    ],
    items: ['Value Stream Mapping (VSM) templates and metric calculators', 'Collaborative commenting to gather front-line employee input', 'Version history to track process improvements over time']
  },
  {
    slug: 'technical-design',
    title: 'Technical Design & RFCs | QuantalFlow Solutions',
    eyebrow: 'Solutions: Technical Design',
    h1: 'Keep engineering specs beside the diagrams they describe',
    sub: 'Author Request for Comments (RFCs), architecture decision records (ADRs), and API designs alongside interactive visual schematics.',
    cards: [
      { title: 'Code Beside Diagrams', desc: 'Embed syntax-highlighted code snippets right next to database schema diagrams.' },
      { title: 'Peer Review & Critiques', desc: 'Engineers can leave pinned feedback on specific microservice boundaries.' },
      { title: 'Architecture Evolution', desc: 'Compare current architecture vs. proposed target states on adjacent frames.' }
    ],
    items: ['Mermaid, PlantUML, and Cloud provider native iconography', 'GitHub PR linking to verify architectural alignment before code merges', 'Permanent record of architecture decision history for auditing']
  },
  {
    slug: 'customer-journeys',
    title: 'Customer Journey Mapping | QuantalFlow Solutions',
    eyebrow: 'Solutions: Customer Journeys',
    h1: 'Map every customer touchpoint across stages and teams',
    sub: 'Visualize user experiences from initial awareness through onboarding, daily usage, and renewal, pinpointing moments of delight and frustration.',
    cards: [
      { title: 'Multi-Tier Lanes', desc: 'Map user feelings, actions, touchpoints, pain points, and internal systems.' },
      { title: 'Persona Integration', desc: 'Anchor journeys around rich user personas complete with quotes and demographics.' },
      { title: 'Opportunity Scoring', desc: 'Score each journey stage to identify where product enhancements yield maximum ROI.' }
    ],
    items: ['Templates for B2B SaaS, e-commerce, mobile onboarding, and omnichannel', 'Attach real user interview clips, quotes, and survey charts', 'Bridge the gap between UX research and engineering roadmaps']
  },
  {
    slug: 'research-synthesis',
    title: 'Research Synthesis | QuantalFlow Solutions',
    eyebrow: 'Solutions: Research Synthesis',
    h1: 'Turn mountains of qualitative research into actionable insights',
    sub: 'Import interview transcripts, customer support tickets, and survey verbatims. Cluster findings and extract clear product opportunities.',
    cards: [
      { title: 'Affinity Diagramming', desc: 'Group observations into insight themes with AI-assisted clustering.' },
      { title: 'Quote Wall', desc: 'Keep raw customer voices front and center to build team-wide empathy.' },
      { title: 'Evidence-Backed Roadmaps', desc: 'Link roadmap feature proposals directly back to original research stickies.' }
    ],
    items: ['Import tabular CSV research notes directly onto color-coded stickies', 'Tagging system to track frequency of customer complaints', 'Create executive research summaries with one-click presentation frames']
  },
  {
    slug: 'design-workshops',
    title: 'Design Workshops & Sprints | QuantalFlow Solutions',
    eyebrow: 'Solutions: Design Workshops',
    h1: 'Run Google Ventures-style Design Sprints that end in decisions',
    sub: 'Guide teams through 5-day design sprints: understand, diverge, decide, prototype, and test with pre-built time-boxed exercises.',
    cards: [
      { title: 'Crazy Eights & Sketching', desc: 'Draw rapid UI concepts with digital pens and upload smartphone sketches.' },
      { title: 'Heatmap Voting', desc: 'Place unlimited voting dots on promising UI elements to highlight consensus.' },
      { title: 'Sprint Retrospectives', desc: 'Capture what worked, what failed, and key learnings at the end of each sprint.' }
    ],
    items: ['Official Design Sprint 2.0 template and facilitator guidelines', 'Integrated timers and background music to keep pace lively', 'Export prototype frames to Figma or InVision for testing']
  },
  {
    slug: 'planning-delivery',
    title: 'Planning & Delivery | QuantalFlow Solutions',
    eyebrow: 'Solutions: Planning & Delivery',
    h1: 'Connect high-level strategy to everyday sprint execution',
    sub: 'Run Big Room Planning, PI Planning (SAFe), and quarterly sprint kickoff sessions where business and technical teams align on priorities.',
    cards: [
      { title: 'PI Planning Boards', desc: 'Cross-team dependency boards that highlight blockers between squads.' },
      { title: 'Capacity Planning', desc: 'Calculate squad velocity and story point allocation across sprints.' },
      { title: 'Jira Integration', desc: 'Bulk import backlog items and publish finalized sprint boards back to Jira.' }
    ],
    items: ['Visual confidence voting for sprint commitment validation', 'Real-time multi-squad synchronization for hundreds of engineers', 'Standardized templates for Scrum, Kanban, and SAFe methodologies']
  },
  {
    slug: 'goals',
    title: 'Goal Planning & OKRs | QuantalFlow Solutions',
    eyebrow: 'Solutions: Goals & OKRs',
    h1: 'Set strategic objectives your entire team can actually see',
    sub: 'Cascade company goals down to department OKRs and squad deliverables on a visual hierarchy that ensures everyone knows how their work matters.',
    cards: [
      { title: 'Visual Goal Hierarchy', desc: 'Connect top-level annual goals to quarterly objectives and measurable key results.' },
      { title: 'Progress Indicators', desc: 'Color-code key result statuses: On Track, At Risk, or Behind.' },
      { title: 'Initiative Ownership', desc: 'Assign executive sponsors and squad leads directly to goal cards.' }
    ],
    items: ['Weekly and monthly check-in review frames', 'Align cross-functional goals between Product, Engineering, and Go-To-Market', 'Transparent alignment that prevents duplicate or conflicting initiatives']
  },
  {
    slug: 'org-design',
    title: 'Org Design & Team Structure | QuantalFlow Solutions',
    eyebrow: 'Solutions: Org Design',
    h1: 'Visualize organizational structure, roles, and reporting lines',
    sub: 'Model team topologies, pod structures, and reporting hierarchies to support headcount planning and agile reorganization.',
    cards: [
      { title: 'Dynamic Org Charts', desc: 'Add leaders, direct reports, and team members with auto-arranging connectors.' },
      { title: 'Team Topologies', desc: 'Model Stream-aligned, Enabling, Complicated-subsystem, and Platform teams.' },
      { title: 'Scenario Modeling', desc: 'Compare prospective reorganization structures side-by-side before rollout.' }
    ],
    items: ['Role tags, skill badges, and location indicators on member cards', 'Secure workspace permissions to keep sensitive HR restructuring confidential', 'Export to PDF for leadership and board presentations']
  },
  // By Segment
  {
    slug: 'smb',
    title: 'QuantalFlow for Small Businesses | QuantalFlow Solutions',
    eyebrow: 'Solutions: Small Business',
    h1: 'Empower growing teams to punch above their weight',
    sub: 'Everything small and medium businesses need to brainstorm, plan projects, run client presentations, and ship faster with less overhead.',
    cards: [
      { title: 'All-In-One Workspace', desc: 'Replace disjointed whiteboards, diagram tools, and slide apps with one platform.' },
      { title: 'Fast Client Collaboration', desc: 'Invite external clients to review boards with free guest access and no setup friction.' },
      { title: 'Cost-Effective Scaling', desc: 'Start with affordable plans and expand as your team headcount grows.' }
    ],
    items: ['6,000+ ready-to-use templates for sales, product, and operations', 'Simple onboarding that takes minutes, not weeks', 'Integrates with Google Workspace, Slack, and Zoom']
  },
  {
    slug: 'startups',
    title: 'QuantalFlow for Startups | QuantalFlow Solutions',
    eyebrow: 'Solutions: Startups',
    h1: 'From pitch deck to product launch on one canvas',
    sub: 'Accelerate your runway with up to $1,000 in QuantalFlow credits, curated startup templates, and the tools to map your MVP fast.',
    cards: [
      { title: 'Startup Program Credits', desc: 'Eligible early-stage startups get up to 12 months of QuantalFlow credits free.' },
      { title: 'Pitch Deck & Lean Canvas', desc: 'Draft pitch decks, business model canvases, and investor updates collaboratively.' },
      { title: 'Speed of Execution', desc: 'Move from user interviews directly into wireframes and developer sprint tickets.' }
    ],
    items: ['Curated founder templates from top accelerators like Y Combinator and Techstars', 'Unlimited boards to map every pivot and product experiment', 'Direct connections to developer tools like Linear, GitHub, and Slack']
  },
  // By Industry
  {
    slug: 'saas',
    title: 'QuantalFlow for Digital & SaaS | QuantalFlow Solutions',
    eyebrow: 'Industry: SaaS & Digital',
    h1: 'Accelerate the entire digital product development lifecycle',
    sub: 'Leading SaaS companies use QuantalFlow to connect product discovery, technical architecture, and customer success in a single continuous loop.',
    cards: [
      { title: 'Continuous Discovery', desc: 'Map customer feedback directly into quarterly roadmap prioritization.' },
      { title: 'DevOps Alignment', desc: 'Keep product managers, designers, and software engineers aligned on release scope.' },
      { title: 'Product-Led Growth', desc: 'Diagram user onboarding funnels and test activation experiment ideas.' }
    ],
    items: ['Proven by 99% of Fortune 100 technology companies', 'Bidirectional sync with modern software tools like Jira, GitHub, and Figma', 'Enterprise security controls for SOC2 and ISO27001 compliance']
  },
  {
    slug: 'professional-services',
    title: 'QuantalFlow for Professional Services | QuantalFlow Solutions',
    eyebrow: 'Industry: Professional Services',
    h1: 'Deliver world-class client engagements and deliverables',
    sub: 'Consulting firms, digital agencies, and systems integrators use QuantalFlow to co-create with clients, run discoveries, and present deliverables.',
    cards: [
      { title: 'Interactive Client Co-Creation', desc: 'Host high-impact workshops where clients participate actively rather than reading slides.' },
      { title: 'White-Label Decks', desc: 'Export executive-ready presentations, journey maps, and strategic blueprints.' },
      { title: 'Reusable Engagement Kits', desc: 'Standardize client onboarding and diagnostic frameworks across your practice.' }
    ],
    items: ['Guest and visitor access controls for seamless client reviews', 'Password-protected board sharing and custom NDAs', 'Used by the world’s top management consultancies']
  },
  {
    slug: 'manufacturing',
    title: 'QuantalFlow for Manufacturing & Engineering | QuantalFlow Solutions',
    eyebrow: 'Industry: Manufacturing',
    h1: 'Visualize complex supply chains, factories, and operations',
    sub: 'Connect global engineering, operations, and shop-floor teams around visual blueprints, value stream maps, and lean kaizen initiatives.',
    cards: [
      { title: 'Value Stream Mapping', desc: 'Identify manufacturing bottlenecks, inventory pileups, and cycle time delays.' },
      { title: 'Shop-Floor Kaizen', desc: 'Run continuous improvement workshops with digital problem-solving boards.' },
      { title: 'Cross-Site Collaboration', desc: 'Connect factory engineers with corporate product teams across time zones.' }
    ],
    items: ['BPMN and industrial engineering symbol sets', 'High-res image and CAD schematic embed support', 'Mobile tablet access for on-site floor walkthroughs']
  },
  {
    slug: 'retail',
    title: 'QuantalFlow for Retail & Consumer Goods | QuantalFlow Solutions',
    eyebrow: 'Industry: Retail & CPG',
    h1: 'Design omnichannel customer experiences and brand campaigns',
    sub: 'Align merchandising, marketing, store design, and e-commerce teams on seasonal campaigns, customer journeys, and retail space layouts.',
    cards: [
      { title: 'Omnichannel Mapping', desc: 'Connect digital storefront journeys with physical in-store retail experiences.' },
      { title: 'Visual Campaign Moodboards', desc: 'Collect visual inspiration, packaging designs, and ad assets on one surface.' },
      { title: 'Seasonal Product Launches', desc: 'Manage go-to-market launch timelines across regional marketing teams.' }
    ],
    items: ['Rich media collage capabilities for high-resolution imagery and video', 'Collaborate directly with external agency partners and creative vendors', 'Templates for buyer personas, merchandising grids, and promotion schedules']
  },
  {
    slug: 'financial-services',
    title: 'QuantalFlow for Financial Services | QuantalFlow Solutions',
    eyebrow: 'Industry: Financial Services',
    h1: 'Modernize banking, fintech, and insurance with confidence',
    sub: 'Deliver innovative financial services products while meeting the highest regulatory, security, and governance standards in the industry.',
    cards: [
      { title: 'Fintech Innovation', desc: 'Design frictionless digital banking flows, KYC onboarding, and loan applications.' },
      { title: 'Regulatory Compliance', desc: 'Document compliance procedures, audit trails, and data governance workflows.' },
      { title: 'Banking-Grade Security', desc: 'Enterprise Guard, customer-managed encryption keys (CMEK), and SOC2 Type II.' }
    ],
    items: ['Data residency in US, EU, and APAC regions', 'FINRA, HIPAA, and GDPR compliance validation', 'Adopted by 8 of the top 10 global investment banks']
  },
  {
    slug: 'pharma',
    title: 'QuantalFlow for Life Sciences & Pharma | QuantalFlow Solutions',
    eyebrow: 'Industry: Life Sciences & Pharma',
    h1: 'Accelerate drug development and clinical trial workflows',
    sub: 'Bring medical researchers, clinical operations teams, and regulatory experts together onto a compliant visual workspace.',
    cards: [
      { title: 'Clinical Trial Mapping', desc: 'Plan trial phases, patient recruitment funnels, and regulatory submission milestones.' },
      { title: 'Cross-Disciplinary Research', desc: 'Synthesize scientific literature, lab data, and clinical trial results visually.' },
      { title: 'HIPAA & GxP Compliance', desc: 'Strict data segregation and audit controls designed for healthcare data.' }
    ],
    items: ['Validated for Life Sciences security and privacy standards', 'Deep-linking to research papers and internal laboratory systems', 'Used by 10 of the top 10 global pharmaceutical organizations']
  },
  {
    slug: 'education',
    title: 'QuantalFlow for Education & Academia | QuantalFlow Solutions',
    eyebrow: 'Industry: Education',
    h1: 'Transform remote and in-person learning environments',
    sub: 'Free accounts for accredited universities, educators, and students to foster active visual learning, student projects, and faculty research.',
    cards: [
      { title: 'Free for Educators & Students', desc: 'Full-featured educational workspaces at no cost for verified academic institutions.' },
      { title: 'Active Classroom Learning', desc: 'Engage students with interactive group exercises, concept maps, and live quizzes.' },
      { title: 'Student Team Projects', desc: 'Provide an infinite sandbox for design thinking, engineering capstones, and debates.' }
    ],
    items: ['COPPA and FERPA compliant educational data safety', 'Integrates with Canvas, Blackboard, and Google Classroom', 'Over 1 million students and professors worldwide']
  },
  {
    slug: 'government',
    title: 'QuantalFlow for Government & Public Sector | QuantalFlow Solutions',
    eyebrow: 'Industry: Government',
    h1: 'Modernize citizen services with secure visual collaboration',
    sub: 'Federal, state, and local agencies use QuantalFlow to map public services, streamline citizen applications, and align agency stakeholders.',
    cards: [
      { title: 'Citizen Service Design', desc: 'Map end-to-end citizen journeys to remove bureaucracy and friction.' },
      { title: 'GovCloud & FedRAMP Ready', desc: 'Dedicated government-grade infrastructure adhering to stringent federal security controls.' },
      { title: 'Cross-Agency Taskforces', desc: 'Coordinate multi-department initiatives on shared, secure boards.' }
    ],
    items: ['Section 508 accessibility compliance built into canvas interactions', 'Strict US-based data hosting and government support tiers', 'Proven across defense, transport, and civilian public agencies']
  },
  // By Team
  {
    slug: 'product-management',
    title: 'QuantalFlow for Product Managers | QuantalFlow Solutions',
    eyebrow: 'Teams: Product Management',
    h1: 'The modern Product Operating System for PMs',
    sub: 'From customer discovery and prioritization to roadmaps and sprint delivery, run your entire product lifecycle without leaving the canvas.',
    cards: [
      { title: 'Opportunity Solution Trees', desc: 'Connect customer pain points directly to solution bets and release experiments.' },
      { title: 'PRDs & User Stories', desc: 'Draft interactive specifications that sit beside UX flows and technical designs.' },
      { title: 'Backlog Prioritization', desc: 'Prioritize feature ideas with RICE scoring matrices and 2x2 value charts.' }
    ],
    items: ['Two-way synchronization with Jira, Linear, and Azure DevOps', 'User story mapping templates that export directly into sprint backlogs', 'Executive roadmap presentation views that keep stakeholders informed']
  },
  {
    slug: 'design',
    title: 'QuantalFlow for Product Designers & UX | QuantalFlow Solutions',
    eyebrow: 'Teams: Design & UX',
    h1: 'The collaborative hub for user research, wireframing, and critique',
    sub: 'Bridge the gap between design vision and product reality. Collect user research, build low-fi wireframes, and run critique sessions.',
    cards: [
      { title: 'Design Critiques', desc: 'Pin comments, sticky notes, and video walkthroughs directly on artboards.' },
      { title: 'User Research Hub', desc: 'Synthesize hours of interview recordings, quotes, and survey charts into insights.' },
      { title: 'Figma Live Sync', desc: 'Embed live Figma frames so your engineering and product partners always see current work.' }
    ],
    items: ['Pre-built UI component kits for rapid wireframing and prototyping', 'Crazy Eights and design sprint facilitation boards', 'Moodboards, color palettes, and brand asset libraries']
  },
  {
    slug: 'engineering',
    title: 'QuantalFlow for Engineering Teams | QuantalFlow Solutions',
    eyebrow: 'Teams: Engineering',
    h1: 'Architect scalable systems and streamline technical delivery',
    sub: 'Empower software architects, tech leads, and developers to map microservices, write RFCs, and run smooth agile sprint ceremonies.',
    cards: [
      { title: 'Cloud System Architecture', desc: 'Official icons for AWS, GCP, Azure, and Kubernetes to diagram distributed systems.' },
      { title: 'Mermaid Diagrams as Code', desc: 'Generate sequence, class, and entity relationship diagrams from plain markdown text.' },
      { title: 'Sprint Retrospectives', desc: 'Run engaging sprint retros with voting, timers, and automated action item tracking.' }
    ],
    items: ['Embed code snippets with syntax highlighting directly beside architecture flows', 'Two-way integration with GitHub and Jira for issue and PR traceability', 'Model Context Protocol (MCP) server for direct AI agent collaboration']
  },
  {
    slug: 'product-leadership',
    title: 'QuantalFlow for Product Leadership & Ops | QuantalFlow Solutions',
    eyebrow: 'Teams: Product Leadership & Ops',
    h1: 'Scale product operating models across hundreds of squads',
    sub: 'CPOs, VPs of Product, and Product Ops leaders use QuantalFlow to standardize processes, track portfolio roadmaps, and align company goals.',
    cards: [
      { title: 'Portfolio Management', desc: 'Bird’s-eye visibility across all active product squads, epics, and launch dates.' },
      { title: 'Standardized Blueprints', desc: 'Deploy standardized discovery, PRD, and retro templates to every new squad.' },
      { title: 'Strategic OKR Cascading', desc: 'Align executive company targets with quarterly squad key results visually.' }
    ],
    items: ['Executive presentation views for board and stakeholder updates', 'Usage analytics to measure template adoption across business units', 'Enterprise governance and access control across teams']
  },
  {
    slug: 'business-operations',
    title: 'QuantalFlow for Operations & Strategy | QuantalFlow Solutions',
    eyebrow: 'Teams: Operations',
    h1: 'Streamline business operations and drive strategic initiatives',
    sub: 'BizOps and strategy leaders map end-to-end organizational workflows, eliminate operational friction, and execute business transformations.',
    cards: [
      { title: 'Process Optimization', desc: 'Identify bottlenecks and redundancies across cross-functional operations.' },
      { title: 'Quarterly Planning', desc: 'Facilitate executive planning offsites with structured agendas and decision matrices.' },
      { title: 'Change Management', desc: 'Document new operating models and train teams with visual standard operating procedures.' }
    ],
    items: ['Swimlane process flowcharts for cross-department handoffs', 'Visual RACI matrices to clarify project roles and accountability', 'Export executive summaries and decision decks in seconds']
  },
  {
    slug: 'marketing',
    title: 'QuantalFlow for Marketing Teams | QuantalFlow Solutions',
    eyebrow: 'Teams: Marketing',
    h1: 'Plan integrated campaigns and orchestrate go-to-market launches',
    sub: 'Bring product marketing, brand, content, and creative agencies together to map marketing funnels, build moodboards, and hit launch dates.',
    cards: [
      { title: 'GTM Launch Plans', desc: 'Coordinate messaging, channel deliverables, and launch timelines in one view.' },
      { title: 'Creative Moodboards', desc: 'Curate design references, copy drafts, and video storyboards collaboratively.' },
      { title: 'Customer Funnel Mapping', desc: 'Visualize acquisition channels, conversion funnels, and email nurture tracks.' }
    ],
    items: ['Collaborate seamlessly with external advertising agencies and contractors', 'Content calendar and social media campaign planning boards', 'Direct integrations with Google Drive, Adobe Creative Cloud, and Slack']
  },
  {
    slug: 'it',
    title: 'QuantalFlow for IT & Systems Leaders | QuantalFlow Solutions',
    eyebrow: 'Teams: IT & Security',
    h1: 'Centralize enterprise collaboration with total administrative control',
    sub: 'IT directors and system administrators trust QuantalFlow for automated provisioning, centralized security controls, and effortless consolidation.',
    cards: [
      { title: 'Tool Consolidation', desc: 'Replace multiple single-purpose diagram and whiteboard tools with one enterprise suite.' },
      { title: 'Automated Lifecycle (SCIM)', desc: 'Automatically provision and deprovision users through Okta, Azure AD, or Ping.' },
      { title: 'Enterprise Guard', desc: 'Automated content classification, DLP scanning, and audit log exports for compliance.' }
    ],
    items: ['SSO with SAML 2.0 and multifactor authentication enforcement', 'Domain control and verified domain claim workflows', 'Dedicated enterprise support and 99.9% uptime SLA guarantee']
  },
  // By Strategic Initiative
  {
    slug: 'product-operating-system',
    title: 'Product Operating System | QuantalFlow Solutions',
    eyebrow: 'Initiative: Product OS',
    h1: 'Transform how your enterprise conceives and ships products',
    sub: 'Build a repeatable, scalable Product Operating System that unites strategy, research, architecture, and sprint delivery into one shared canvas.',
    cards: [
      { title: 'Continuous Feedback Loops', desc: 'Connect frontline customer feedback directly to product backlog prioritization.' },
      { title: 'Cross-Squad Standardization', desc: 'Deploy standardized discovery and delivery frameworks across all product lines.' },
      { title: 'Accelerated Time-to-Market', desc: 'Cut down on alignment meetings and ship customer value weeks earlier.' }
    ],
    items: ['Proven methodology used by high-velocity product organizations worldwide', 'Deep integrations with development, design, and analytics platforms', 'Measure and optimize team collaboration velocity']
  },
  {
    slug: 'ai-transformation',
    title: 'AI Transformation | QuantalFlow Solutions',
    eyebrow: 'Initiative: AI Transformation',
    h1: 'Scale AI across your workforce and team workflows',
    sub: 'Move beyond individual chatbot productivity to true team and cross-functional AI collaboration powered by shared visual context.',
    cards: [
      { title: 'Shared Human-AI Context', desc: 'AI agents and teammates interact on the exact same editable artifacts.' },
      { title: 'Agent Integration via MCP', desc: 'Deploy autonomous agents that create diagrams, synthesize research, and update tasks.' },
      { title: 'Enterprise Data Privacy', desc: 'Zero data leakage: enterprise board data is never used to train public foundation models.' }
    ],
    items: ['Ready-to-use AI prompts for research, sprint planning, and architecture', 'Model Context Protocol (MCP) server support out-of-the-box', 'Dedicated AI governance, guardrails, and compliance oversight']
  },
  {
    slug: 'agile',
    title: 'Ways of Working Transformation | QuantalFlow Solutions',
    eyebrow: 'Initiative: Agile Ways of Working',
    h1: 'Modernize ways of working for hybrid and distributed teams',
    sub: 'Transform legacy waterfall processes into dynamic, visual agile collaboration that fosters team autonomy, transparency, and rapid delivery.',
    cards: [
      { title: 'Agile at Scale', desc: 'Run SAFe PI Planning, Scrum of Scrums, and Big Room Planning with hundreds of participants.' },
      { title: 'Continuous Improvement', desc: 'Action-oriented sprint retrospectives that drive measurable velocity gains.' },
      { title: 'Transparent Delivery', desc: 'Live Kanban boards and roadmaps that replace status reports with real-time reality.' }
    ],
    items: ['Certified agile templates designed with leading Scrum and Kanban trainers', 'Seamless two-way sync with Jira and Azure DevOps backlog boards', 'Empower remote and hybrid teams with zero collaboration friction']
  },
  {
    slug: 'digital-employee-experience',
    title: 'Digital Employee Experience | QuantalFlow Solutions',
    eyebrow: 'Initiative: DEX',
    h1: 'Create an engaging, inclusive digital workplace',
    sub: 'Provide hybrid and distributed employees with an intuitive visual environment where meetings are productive, ideas flow freely, and people feel connected.',
    cards: [
      { title: 'Inclusive Collaboration', desc: 'Ensure every team member has an equal voice through anonymous voting and sticky notes.' },
      { title: 'Interactive Onboarding', desc: 'Welcome new hires with interactive workspace hubs, team org charts, and intro boards.' },
      { title: 'Meeting Fatigue Reduction', desc: 'Replace synchronous status calls with asynchronous video TalkTrack walkthroughs.' }
    ],
    items: ['Accessible UI with screen reader optimization and high contrast modes', 'Zero installation needed: runs lightning fast on any modern browser', 'Fun, social team-building boards that keep company culture thriving']
  },
  {
    slug: 'customer-experience',
    title: 'Customer Experience Transformation | QuantalFlow Solutions',
    eyebrow: 'Initiative: CX & Service Design',
    h1: 'Deliver human-centered customer experiences across every touchpoint',
    sub: 'Break down departmental silos between Product, Marketing, Sales, and Support to design unified, delightful customer journeys.',
    cards: [
      { title: 'Service Blueprints', desc: 'Map frontstage customer experiences alongside backstage technological systems.' },
      { title: 'Voice of Customer (VoC)', desc: 'Aggregate customer quotes, pain points, and NPS feedback directly into journey maps.' },
      { title: 'Cross-Functional Ownership', desc: 'Assign customer journey milestones to specific cross-department owners.' }
    ],
    items: ['Customer journey map templates for B2B, retail, financial services, and healthcare', 'Fast sharing with executive leadership and board stakeholders', 'Measure impact of CX improvements on retention and customer lifetime value']
  },
  {
    slug: 'cloud-transformation',
    title: 'Cloud & Software Transformation | QuantalFlow Solutions',
    eyebrow: 'Initiative: Cloud Transformation',
    h1: 'Plan and execute large-scale cloud migration with visual clarity',
    sub: 'Map legacy monoliths, architect target cloud microservices, and manage multi-year infrastructure modernization programs without chaos.',
    cards: [
      { title: 'Legacy to Cloud Mapping', desc: 'Document current on-premise infrastructure alongside future cloud architectures.' },
      { title: 'Certified Cloud Packs', desc: 'Official architecture icons for AWS, Google Cloud, Microsoft Azure, and CNCF Kubernetes.' },
      { title: 'Migration Phase Tracking', desc: 'Track migration readiness, wave schedules, and risk factors visually.' }
    ],
    items: ['Mermaid code integration to document network topology directly from configuration', 'Collaborate directly with external cloud system integrators and partners', 'Detailed architecture RFC documentation next to system schematics']
  }
];

const resourcePages = [
  {
    slug: 'customers',
    title: 'Customer Stories & Case Studies | QuantalFlow Resources',
    eyebrow: 'Resources: Customer Stories',
    h1: 'How world-leading teams innovate faster with QuantalFlow',
    sub: 'Explore real-world case studies and impact metrics from companies like Cisco, DocuSign, HP, VMware, and Okta.',
    cards: [
      { title: 'Cisco Webex', desc: 'Accelerated cross-team agile planning by 30% while reducing alignment meetings.' },
      { title: 'DocuSign', desc: 'Unified global product teams across time zones with standard QuantalFlow discovery blueprints.' },
      { title: 'HP Inc.', desc: 'Scaled customer journey mapping across 50,000+ employees worldwide.' }
    ],
    items: ['Detailed breakdown of ROI, speed-to-market, and meeting reduction metrics', 'Downloadable case study PDFs and video interviews with product executives', 'Filter stories by team, company size, and industry']
  },
  {
    slug: 'academy',
    title: 'QuantalFlow Academy | Free Courses & Certifications',
    eyebrow: 'Resources: Academy',
    h1: 'Master visual collaboration and earn industry certifications',
    sub: 'Free, on-demand courses created by collaboration experts. Learn diagramming, agile facilitation, design thinking, and advanced QuantalFlow AI.',
    cards: [
      { title: 'QuantalFlow Essentials', desc: 'Get comfortable with canvas navigation, sticky notes, shapes, and sharing.' },
      { title: 'Agile Facilitation Badge', desc: 'Learn to run high-energy workshops, retrospectives, and PI planning sessions.' },
      { title: 'Advanced Architecture', desc: 'Master technical diagramming, Mermaid syntax, and live Jira two-way sync.' }
    ],
    items: ['Official verified digital badges to showcase on LinkedIn and resumes', 'Bite-sized video lessons with hands-on practice canvas exercises', '100% free for all registered QuantalFlow community members']
  },
  {
    slug: 'webinars',
    title: 'Webinars & Virtual Masterclasses | QuantalFlow Resources',
    eyebrow: 'Resources: Webinars',
    h1: 'Live webinars and on-demand masterclasses with experts',
    sub: 'Join product leaders, UX visionaries, and agile coaches as they share proven frameworks and hands-on demonstrations.',
    cards: [
      { title: 'AI in Product Discovery', desc: 'Learn how modern PMs use QuantalFlow AI and MCP agents to draft roadmaps in minutes.' },
      { title: 'Scaling SAFe & Agile', desc: 'Best practices for running remote Big Room and PI Planning with 500+ participants.' },
      { title: 'Design Thinking 2.0', desc: 'Facilitating high-impact remote design sprints that result in actionable prototypes.' }
    ],
    items: ['Live Q&A with QuantalFlow product managers and guest industry leaders', 'Access on-demand recordings and downloadable presentation decks anytime', 'Interactive webinar boards where attendees practice concepts live']
  },
  {
    slug: 'reforge',
    title: 'Reforge Learning & Strategy | QuantalFlow Resources',
    eyebrow: 'Resources: Reforge Partnership',
    h1: 'Executive product frameworks created with Reforge',
    sub: 'Access world-class product management, growth, and strategy frameworks developed in partnership with Reforge instructors.',
    cards: [
      { title: 'Product Strategy Stack', desc: 'Align mission, product vision, strategic pillars, and execution roadmap.' },
      { title: 'Growth Loop Mapping', desc: 'Diagram viral, paid, and content growth loops to identify compounding channels.' },
      { title: 'Retention Lifecycle Analysis', desc: 'Map new, current, and resurrected user flows to boost long-term retention.' }
    ],
    items: ['Curated templates designed by Silicon Valley’s top tech executives', 'Exclusive companion guides detailing how to facilitate strategic alignment', 'Turn high-level strategic theory into actionable canvas roadmaps']
  },
  {
    slug: 'help',
    title: 'Help Center & Documentation | QuantalFlow Resources',
    eyebrow: 'Resources: Help Center',
    h1: 'Everything you need to know about using QuantalFlow',
    sub: 'Browse comprehensive setup guides, troubleshooting articles, keyboard shortcut cheatsheets, and billing management documentation.',
    cards: [
      { title: 'Getting Started Guide', desc: 'Step-by-step walkthrough of creating boards, inviting teammates, and using tools.' },
      { title: 'Integrations Setup', desc: 'Detailed configuration guides for Jira, Slack, Microsoft Teams, and Figma.' },
      { title: 'Account & Billing', desc: 'Manage enterprise licenses, team subscriptions, invoices, and SSO settings.' }
    ],
    items: ['24/7 global customer support with priority response for enterprise plans', 'Searchable knowledge base covering every feature and shortcut', 'System status page and scheduled maintenance updates']
  },
  {
    slug: 'events',
    title: 'Events & QuantalFlow Live | QuantalFlow Resources',
    eyebrow: 'Resources: Events',
    h1: 'Connect with visual thinkers at QuantalFlow Live and user groups',
    sub: 'Discover upcoming user conferences, local community meetups, and global innovation summits featuring industry pioneers.',
    cards: [
      { title: 'QuantalFlow Live Global Summit', desc: 'Our flagship annual virtual conference announcing major product innovations.' },
      { title: 'Local User Groups', desc: 'Meet fellow visual collaboration practitioners in cities across the globe.' },
      { title: 'Product Jam Sessions', desc: 'Hands-on co-working sessions testing beta features with QuantalFlow engineers.' }
    ],
    items: ['Keynotes from world-renowned designers, engineers, and product leaders', 'Interactive networking lounges and community template showcases', 'Free virtual attendance with instant access to all session recordings']
  },
  {
    slug: 'community',
    title: 'QuantalFlow Community & Forum | QuantalFlow Resources',
    eyebrow: 'Resources: Community',
    h1: 'Join over 100,000 creators, facilitators, and experts',
    sub: 'Ask questions, share creative board designs, participate in beta programs, and vote on upcoming QuantalFlow product features.',
    cards: [
      { title: 'Discussion Forums', desc: 'Get advice on tricky facilitation challenges from certified QuantalFlow experts.' },
      { title: 'Feature Wishlist', desc: 'Suggest new product ideas and vote on features you want built next.' },
      { title: 'QuantalFlow Creator Hub', desc: 'Publish your own custom templates to the global QuantalFlow marketplace.' }
    ],
    items: ['Community-led webinars, workshops, and AMAs with product leads', 'Leaderboards and recognition badges for top contributors', 'Direct access to the QuantalFlow product team for feedback']
  },
  {
    slug: 'blog',
    title: 'QuantalFlow Blog | Innovation & Modern Work Insights',
    eyebrow: 'Resources: Blog',
    h1: 'Fresh perspectives on product, AI, design, and work',
    sub: 'Read in-depth articles on artificial intelligence, agile transformation, remote work psychology, and modern product management.',
    cards: [
      { title: 'The Future of AI on Canvas', desc: 'How visual models and autonomous agents are reshaping creative problem solving.' },
      { title: 'Stop Boring Meetings', desc: '5 facilitation techniques to transform passive attendees into active collaborators.' },
      { title: 'From Monolith to Cloud', desc: 'Lessons learned architecting distributed systems on an infinite visual surface.' }
    ],
    items: ['New articles published weekly by industry practitioners and guest authors', 'Deep dives into engineering architecture and product design philosophy', 'Practical tips and shortcuts to level up your everyday board workflow']
  },
  {
    slug: 'playbooks',
    title: 'AI Playbooks & Guides | QuantalFlow Resources',
    eyebrow: 'Resources: AI Playbooks',
    h1: 'Actionable playbooks to scale AI across your teams',
    sub: 'Step-by-step operating playbooks on how to introduce AI into your research synthesis, sprint planning, and architecture documentation.',
    cards: [
      { title: 'AI for Product Managers', desc: 'Prompt patterns to draft PRDs, summarize user feedback, and create user stories.' },
      { title: 'AI for Software Architects', desc: 'Generate system diagrams, analyze edge cases, and evaluate architecture RFCs.' },
      { title: 'AI for Agile Coaches', desc: 'Cluster retro feedback and automate post-session action item follow-ups.' }
    ],
    items: ['Copy-and-paste prompt recipes optimized for the QuantalFlow Intelligent Canvas', 'Downloadable team workshop templates pre-loaded with playbook exercises', 'Real case studies from companies implementing AI collaboration']
  },
  {
    slug: 'templates',
    title: 'Template Library | 6,000+ Ready Templates | QuantalFlow',
    eyebrow: 'Resources: Templates',
    h1: '6,000+ free templates to start working in seconds',
    sub: 'Never start from a blank canvas. Discover templates for mind mapping, retrospectives, flowcharts, user journeys, Kanban, and roadmaps.',
    cards: [
      { title: 'Agile & Scrum', desc: 'Sprint Retrospectives, Daily Standups, Backlog Refinement, and PI Planning.' },
      { title: 'Strategy & Planning', desc: 'OKRs, SWOT Analysis, Business Model Canvas, and Product Roadmaps.' },
      { title: 'UX & Design Thinking', desc: 'Customer Journey Maps, User Personas, Empathy Maps, and Wireframes.' }
    ],
    items: ['Community-created templates from the global QuantalFlow creator community', 'One-click insertion onto any existing or new board', 'Customizable layouts that adapt to your team’s specific terminology']
  },
  {
    slug: 'developers',
    title: 'Developer Platform & APIs | QuantalFlow Resources',
    eyebrow: 'Resources: Developer Platform',
    h1: 'Build custom apps and automate boards with QuantalFlow APIs',
    sub: 'Supercharge your workflows with our REST API, Webhooks, Web SDK, and native Model Context Protocol (MCP) server.',
    cards: [
      { title: 'REST API & Webhooks', desc: 'Programmatically create boards, manage users, export data, and sync cards.' },
      { title: 'Web SDK for Canvas Apps', desc: 'Build interactive in-canvas applications, custom side panels, and toolbars.' },
      { title: 'Model Context Protocol (MCP)', desc: 'Connect LLMs and agent harnesses directly to the QuantalFlow canvas via MCP.' }
    ],
    items: ['Interactive API reference documentation with instant curl/fetch testing', 'Client libraries available for Node.js, Python, and TypeScript', 'Publish enterprise apps to the QuantalFlow Marketplace or keep them internal']
  },
  {
    slug: 'apps',
    title: 'Download QuantalFlow Apps | Mac, Windows, iOS & Android',
    eyebrow: 'Resources: Download Apps',
    h1: 'QuantalFlow on every device, wherever your ideas strike',
    sub: 'Get the native QuantalFlow app for macOS, Windows, iPad, iPhone, and Android for peak performance, offline caching, and stylus support.',
    cards: [
      { title: 'Desktop Apps (Mac & Windows)', desc: 'Lightning-fast native performance with dedicated keyboard shortcut support.' },
      { title: 'iPad & Tablet with Apple Pencil', desc: 'Natural pressure-sensitive stylus sketching and palm rejection for drawing.' },
      { title: 'Mobile Apps (iOS & Android)', desc: 'Review boards, leave comments, and snap photos of physical stickies on the go.' }
    ],
    items: ['Auto-updating desktop builds with multi-window board support', 'Physical sticky note scanner that converts real paper notes into digital stickies', 'Instant cross-device cloud synchronization in real time']
  },
  {
    slug: 'partners',
    title: 'Solution Partners & Consultants | QuantalFlow Resources',
    eyebrow: 'Resources: Solution Partners',
    h1: 'Certified partners to accelerate your digital transformation',
    sub: 'Collaborate with verified QuantalFlow consulting partners for customized agile coaching, enterprise onboarding, and bespoke API integrations.',
    cards: [
      { title: 'Agile Transformation Partners', desc: 'Certified Scrum and SAFe experts to train your squads and optimize workflows.' },
      { title: 'System Integrators', desc: 'Technical partners to connect QuantalFlow with proprietary enterprise databases and tools.' },
      { title: 'Design & Innovation Agencies', desc: 'World-class design sprint facilitators to co-create breakthrough product concepts.' }
    ],
    items: ['Global network of certified partners across North America, Europe, and APAC', 'Vetted for deep technical capability and proven enterprise track records', 'Apply to become a certified QuantalFlow Solution Partner and expand your business']
  }
];

const enterprisePages = [
  {
    slug: 'security',
    title: 'Enterprise Security, Privacy & Trust | QuantalFlow',
    eyebrow: 'Enterprise: Security',
    h1: 'Enterprise-grade security, data privacy, and governance',
    sub: 'Protect your organization’s intellectual property with end-to-end encryption, continuous compliance, and centralized administrative controls.',
    cards: [
      { title: 'Certifications & Audits', desc: 'SOC2 Type II, SOC3, ISO/IEC 27001, ISO 27701, and HIPAA compliance.' },
      { title: 'Data Encryption', desc: 'AES-256 at rest, TLS 1.3 in transit, plus Customer-Managed Encryption Keys (CMEK).' },
      { title: 'Data Residency', desc: 'Store production customer content in designated geographic regions (US, EU, or APAC).' }
    ],
    items: ['Single Sign-On (SAML 2.0, Okta, Azure AD, Google Workspace)', 'Granular role-based access control (RBAC) and IP allowlisting', 'Comprehensive audit logs and SIEM integration with Splunk and Datadog']
  },
  {
    slug: 'guard',
    title: 'QuantalFlow Enterprise Guard | Advanced Compliance',
    eyebrow: 'Enterprise: Enterprise Guard',
    h1: 'Automate content lifecycle, compliance, and data protection',
    sub: 'Keep your enterprise safe from data leaks. Automatically scan boards for confidential data, enforce retention policies, and satisfy legal hold requests.',
    cards: [
      { title: 'Data Loss Prevention (DLP)', desc: 'Automatically scan boards for credit cards, PII, API keys, and sensitive tokens.' },
      { title: 'Retention & Legal Hold', desc: 'Set automated board retention schedules and freeze content for legal discovery.' },
      { title: 'Content Lifecycle Rules', desc: 'Archive or purge inactive boards across your entire organization automatically.' }
    ],
    items: ['Built-in regex and machine learning classifiers for sensitive data types', 'Automated alerts to security teams when confidential info is pasted', 'Export audit logs directly to your enterprise SIEM and compliance tooling']
  },
  {
    slug: 'professional-services',
    title: 'QuantalFlow Professional Services | Enterprise Advisory',
    eyebrow: 'Enterprise: Advisory Services',
    h1: 'Accelerate adoption with expert advisory and custom training',
    sub: 'Partner directly with QuantalFlow’s internal consultants for enterprise-wide change management, custom blueprint creation, and leadership coaching.',
    cards: [
      { title: 'Enterprise Onboarding', desc: 'Tailored onboarding programs that get thousands of employees productive quickly.' },
      { title: 'Custom Blueprints', desc: 'Codify your company’s internal frameworks into standardized board templates.' },
      { title: 'Executive Coaching', desc: 'Train managers and facilitators to lead high-velocity visual meetings and reviews.' }
    ],
    items: ['Dedicated customer success manager (CSM) and enterprise solution architect', 'Regular business reviews measuring collaboration health and productivity gains', 'Direct input into the QuantalFlow product roadmap and early access to beta features']
  },
  {
    slug: 'contact',
    title: 'Contact Sales & Request a Demo | QuantalFlow Enterprise',
    eyebrow: 'Enterprise: Contact Sales',
    h1: 'Talk to an enterprise collaboration expert',
    sub: 'Schedule a tailored demo to discover how QuantalFlow can transform your product development, improve security, and lower total software costs.',
    cards: [
      { title: 'Tailored Live Demo', desc: 'See QuantalFlow configured for your specific industry, team size, and workflows.' },
      { title: 'Enterprise Pricing & ROI', desc: 'Custom volume licensing, consolidating multiple tools into one contract.' },
      { title: 'Security & Compliance Review', desc: 'Review security questionnaires, SOC2 reports, and data residency setups.' }
    ],
    items: ['99% of Fortune 100 trust QuantalFlow for enterprise collaboration', 'Flexible enterprise licensing with true-up options', 'Dedicated customer success and 24/7 priority enterprise support'],
    isForm: true
  }
];

function generatePageHtml(p, folder, nav) {
  const route = `/${folder}/${p.slug}/`;
  const breadcrumbSection = folder.charAt(0).toUpperCase() + folder.slice(1);
  
  let formHtml = '';
  if (p.isForm) {
    formHtml = `
      <!-- ============ CONTACT FORM ============ -->
      <section class="section section--warm" id="contact-form">
        <div class="container">
          <div class="split split--form">
            <div class="split__copy reveal">
              <p class="eyebrow">Enterprise Consultation</p>
              <h2>Let's talk about what your team needs</h2>
              <p class="lead">Tell us about your team size, current tool stack, and what you are looking to achieve. Our enterprise team will get in touch within 24 hours.</p>
              
              <ul class="checklist checklist--lg">
                <li>Dedicated Customer Success &amp; Architecture team</li>
                <li>Custom enterprise pricing and consolidation savings</li>
                <li>SOC2, ISO27001, and HIPAA compliance validation</li>
                <li>Single Sign-On (SSO) and automated SCIM provisioning</li>
              </ul>
              
              <div class="stats-row stats-row--compact" style="margin-top: 36px;">
                <div class="stats-row__item"><p class="stats-row__num">100M+</p><p>users worldwide</p></div>
                <div class="stats-row__item"><p class="stats-row__num">99%</p><p>of Fortune 100</p></div>
              </div>
            </div>
            
            <div class="split__art reveal">
              <form class="form-card" id="enterprise-contact-form" style="width: 100%; max-width: 520px;" onsubmit="event.preventDefault(); document.getElementById('contact-status').textContent='Thank you! Our enterprise sales team will reach out shortly.'; document.getElementById('contact-status').className='form-msg is-ok';">
                <h3 class="form-card__title">Request a tailored demo</h3>
                <p class="form-card__sub">Connect with a product specialist</p>

                <div class="field">
                  <label for="c-name">Full name</label>
                  <input id="c-name" name="name" type="text" placeholder="Alex Morgan" required />
                </div>
                
                <div class="field">
                  <label for="c-email">Work email</label>
                  <input id="c-email" name="email" type="email" placeholder="alex@company.com" required />
                </div>

                <div class="field">
                  <label for="c-company">Company name</label>
                  <input id="c-company" name="company" type="text" placeholder="Acme Inc." required />
                </div>

                <div class="field">
                  <label for="c-size">Company size</label>
                  <select id="c-size" name="size" required>
                    <option value="">Select team size</option>
                    <option value="1-50">1 - 50 employees</option>
                    <option value="51-250">51 - 250 employees</option>
                    <option value="251-1000">251 - 1,000 employees</option>
                    <option value="1000+">1,000+ employees</option>
                  </select>
                </div>

                <div class="field">
                  <label for="c-notes">How can we help?</label>
                  <textarea id="c-notes" name="notes" placeholder="Tell us about your team's use cases, current challenges, or tool consolidation goals..."></textarea>
                </div>

                <p class="form-msg" id="contact-status"></p>

                <button class="btn btn--blue form-card__submit" type="submit">Submit Request</button>
                <p class="form-card__note">By submitting, you agree to our <a href="/resources/help/">Privacy Policy</a>.</p>
              </form>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  return `---
title: ${p.title}
description: ${p.sub.replace(/\r?\n/g, ' ')}
route: ${route}
nav: ${nav}
---
    <!-- ============ PAGE HERO ============ -->
    <section class="page-hero">
      <div class="container page-hero__inner">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="/">Home</a><span aria-hidden="true">/</span><a href="/${folder}/">${breadcrumbSection}</a><span aria-hidden="true">/</span><span>${p.eyebrow.split(':').pop().trim()}</span>
        </nav>
        <p class="pill"><span class="pill__spark" aria-hidden="true">&#10022;</span> ${p.eyebrow}</p>
        <h1 class="page-hero__title">${p.h1}</h1>
        <p class="page-hero__sub">${p.sub}</p>
        <div class="page-hero__actions">
          <a class="btn btn--blue" href="/get-started/">Get started free</a>
          <a class="btn btn--ghost" href="/app/">Try on canvas</a>
          <a class="btn btn--ghost" href="/enterprise/contact/">Contact sales</a>
        </div>
      </div>
    </section>

    <!-- ============ SUB NAV ============ -->
    <nav class="subnav" aria-label="Page navigation">
      <div class="container subnav__inner">
        <a href="#overview">Overview</a>
        <a href="#capabilities">Capabilities</a>
        <a href="#features">Key Features</a>
        <a href="#integration">Integrations</a>
        <a href="#cta">Get Started</a>
      </div>
    </nav>

    <!-- ============ OVERVIEW SECTION ============ -->
    <section class="section" id="overview">
      <div class="container">
        <div class="split">
          <div class="split__copy reveal">
            <p class="eyebrow">${p.eyebrow}</p>
            <h2>Built for modern high-velocity teams</h2>
            <p class="lead">${p.sub}</p>
            <ul class="checklist">
              ${p.items.map(i => `<li>${i}</li>`).join('\n              ')}
            </ul>
            <div style="margin-top: 28px; display:flex; gap:14px; flex-wrap:wrap;">
              <a class="link-arrow" href="/app/">Launch interactive board <span aria-hidden="true">&rarr;</span></a>
              <a class="link-arrow" href="/resources/templates/">Browse related templates <span aria-hidden="true">&rarr;</span></a>
            </div>
          </div>
          <div class="split__art reveal">
            <div class="board board--static" style="min-height: 320px;">
              <div class="board__grid"></div>
              <div class="sticky sticky--yellow" style="top:16%;left:8%;transform:rotate(-3deg)">${p.cards[0].title}</div>
              <div class="sticky sticky--mint" style="top:54%;left:10%;transform:rotate(2deg)">Live Context</div>
              <div class="sticky sticky--violet" style="top:20%;right:12%;transform:rotate(4deg)">${p.cards[1].title}</div>
              <div class="sticky sticky--blue" style="top:60%;right:14%;transform:rotate(-2deg)">Milestone Met</div>
              <div class="node node--start" style="top:34%;left:14%">Discover</div>
              <div class="node node--mid" style="top:44%;left:44%">Align</div>
              <div class="node node--end" style="top:34%;right:16%">Deliver</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ KEY FEATURES ============ -->
    <section class="section section--warm" id="features">
      <div class="container">
        <div class="section__head">
          <p class="eyebrow">Key Capabilities</p>
          <h2 class="section__title">Designed for clarity and momentum</h2>
          <p class="section__sub">Explore how this service integrates into your everyday workflows.</p>
        </div>

        <div class="cards cards--3">
          ${p.cards.map((c, idx) => {
            const icons = ['&#10022;', '&#8644;', '&#9635;', '&#10003;'];
            const colors = ['blue', 'mint', 'violet', 'pink'];
            return `
          <article class="feature reveal">
            <div class="feature__icon feature__icon--${colors[idx % colors.length]}" aria-hidden="true">${icons[idx % icons.length]}</div>
            <h3>${c.title}</h3>
            <p>${c.desc}</p>
            <a class="link-arrow" href="/app/">Try in QuantalFlow App <span aria-hidden="true">&rarr;</span></a>
          </article>`;
          }).join('\n')}
        </div>
      </div>
    </section>

    <!-- ============ RELATED LINKS & CHIPS ============ -->
    <section class="section" id="capabilities">
      <div class="container">
        <div class="section__head">
          <p class="eyebrow">Connected Services</p>
          <h2 class="section__title">Everything works together on QuantalFlow</h2>
        </div>
        <div class="chip-grid">
          <a class="chip-card" href="/product/intelligent-canvas/">Intelligent Canvas</a>
          <a class="chip-card" href="/solutions/diagramming/">Diagramming</a>
          <a class="chip-card" href="/product/ai/">QuantalFlow AI</a>
          <a class="chip-card" href="/solutions/roadmapping/">Roadmaps</a>
          <a class="chip-card" href="/product/flows/">Flows</a>
          <a class="chip-card" href="/resources/templates/">Templates</a>
          <a class="chip-card" href="/product/integrations/">Integrations</a>
          <a class="chip-card" href="/enterprise/security/">Security</a>
        </div>
      </div>
    </section>

    ${formHtml}

    <!-- ============ CTA BAND ============ -->
    <section class="section" id="cta">
      <div class="container">
        <div class="cta-band reveal">
          <div>
            <h2>Ready to see it on your own canvas?</h2>
            <p>Free forever. Unlimited team members on your first boards.</p>
          </div>
          <div class="cta-band__actions">
            <a class="btn btn--yellow" href="/get-started/">Get started free</a>
            <a class="btn btn--ghost-light" href="/app/">Open Canvas App</a>
            <a class="btn btn--ghost-light" href="/pricing/">Compare plans</a>
          </div>
        </div>
      </div>
    </section>
`;
}

// Generate all pages!
let count = 0;

for (const p of productPages) {
  const dir = path.join(pagesDir, 'product');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${p.slug}.html`), generatePageHtml(p, 'product', 'product'), 'utf8');
  count++;
}

for (const p of solutionPages) {
  const dir = path.join(pagesDir, 'solutions');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${p.slug}.html`), generatePageHtml(p, 'solutions', 'solutions'), 'utf8');
  count++;
}

for (const p of resourcePages) {
  const dir = path.join(pagesDir, 'resources');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${p.slug}.html`), generatePageHtml(p, 'resources', 'resources'), 'utf8');
  count++;
}

for (const p of enterprisePages) {
  const dir = path.join(pagesDir, 'enterprise');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${p.slug}.html`), generatePageHtml(p, 'enterprise', 'enterprise'), 'utf8');
  count++;
}

console.log(`Generated ${count} dedicated subpages successfully.`);
