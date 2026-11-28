/* ==========================================================================
   QuantalFlow Unified Templates Gallery (`/assets/js/templates.js`)
   - Replaces the legacy /resources/templates/ page with the unified gallery
   - Uses QuantalFlow's shared `.dash-top` + `.dash-sidebar` workspace shell
   - Connects "Use template" and "Start from scratch" directly to `/api/boards`,
     `/api/projects/:id`, `/api/os` (Document Generation), and `/app/`
   - Supports client-side SPA swaps via `window.initTemplatesGallery()`
   ========================================================================== */
(function () {
  'use strict';

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };

  var num = function (n) {
    return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '') + 'k' : String(n);
  };

  /* ---------- Thumbnail Generators (SVG, 240 x 170) ---------- */
  var R = function (x, y, w, h, f, s, rx) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (rx == null ? 4 : rx) + '" fill="' + f + '"' + (s ? ' stroke="' + s + '" stroke-width="1.4"' : '') + '/>';
  };
  var L = function (x1, y1, x2, y2, c, w) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + (c || '#9aa6bf') + '" stroke-width="' + (w || 1.4) + '" stroke-linecap="round"/>';
  };
  var T = function (x, y, w, c) {
    return R(x, y, w, 4, c || '#d5dbe8', null, 2);
  };
  var wrap = function (b) {
    return '<svg viewBox="0 0 240 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true"><rect width="240" height="170" fill="#fff"/>' + b + '</svg>';
  };

  var KIND = {
    flow: function (c) { return wrap(R(94,10,52,20,c,null,10)+L(120,30,120,44)+'<polygon points="120,44 152,64 120,84 88,64" fill="#fff" stroke="'+c+'" stroke-width="1.6"/>'+L(88,64,58,64)+L(58,64,58,98)+R(32,98,52,22,'#fff',c)+L(152,64,182,64)+L(182,64,182,98)+R(156,98,52,22,'#fff',c)+L(58,120,58,138)+L(58,138,120,138)+L(182,120,182,138)+L(182,138,120,138)+L(120,138,120,146)+R(94,146,52,16,c,null,8)+T(100,104,40,c+'55').replace('x="100"','x="38"')); },
    mind: function (c) { var n=[[40,30],[40,82],[40,134],[200,30],[200,82],[200,134]]; return wrap(n.map(function(p){return '<path d="M120 86 C '+((120+p[0])/2)+' 86 '+((120+p[0])/2)+' '+(p[1]+8)+' '+(p[0]+(p[0]<120?24:-24))+' '+(p[1]+8)+'" fill="none" stroke="'+c+'" stroke-opacity=".5" stroke-width="2"/>';}).join('')+n.map(function(p,i){return R(p[0]-24,p[1],48,16,i%2?c+'30':'#fff',c,8);}).join('')+'<ellipse cx="120" cy="86" rx="36" ry="18" fill="'+c+'"/>'+R(100,83,40,6,'#ffffff88',null,3)); },
    org: function (c) { return wrap(R(92,10,56,22,c,null,5)+L(120,32,120,46)+L(40,46,200,46)+[40,120,200].map(function(x){return L(x,46,x,58)+R(x-28,58,56,20,'#fff',c,5);}).join('')+[18,62,98,142,178,222].map(function(x,i){var p=[40,40,120,120,200,200][i];return L(p,78,x,98)+R(x-18,98,36,18,i%2?c+'33':'#fff',c,4);}).join('')+[18,62,98,142,178,222].map(function(x){return L(x,116,x,128)+R(x-14,128,28,14,'#f3f5fa','#cdd5e5',3);}).join('')); },
    kanban: function (c) { return wrap([0,1,2].map(function(i){var x=12+i*74;return R(x,12,68,146,'#f3f5fa',null,6)+R(x+6,18,40,6,[c,c+'aa',c+'66'][i],null,3)+[0,1,2].slice(0,3-i%2).map(function(j){return R(x+6,32+j*40,56,34,'#fff','#dfe4ee',4)+T(x+11,38+j*40,36)+T(x+11,48+j*40,26,[c,'#f0b429','#2fb47c'][(i+j)%3]+'99');}).join('');}).join('')); },
    swim: function (c) { return wrap([0,1,2].map(function(i){return R(10,10+i*50,220,46,i%2?'#f8f9fc':'#fff','#dfe4ee',0)+R(10,10+i*50,22,46,c+(i===0?'':'99'),null,0);}).join('')+R(44,22,40,22,'#fff',c)+L(84,33,106,33)+R(106,72,40,22,'#fff',c)+L(64,44,64,52)+L(64,52,106,52)+L(106,52,106,72)+L(146,83,168,83)+R(168,122,50,22,'#fff',c)+L(193,94,193,122)+R(150,22,50,22,c+'33',c)); },
    gantt: function (c) { return wrap(Array.from({length:8},function(_,i){return L(48+i*24,12,48+i*24,158,'#eef1f6',1);}).join('')+[[0,3],[2,4],[4,5],[5,3],[6,3],[8,2]].map(function(a,i){return T(10,24+i*22,28,'#cfd6e5')+R(48+a[0]*12,20+i*22,a[1]*20,12,i%2?c+'99':c,null,3);}).join('')+L(48,160,230,160,'#cdd5e5',1)); },
    timeline: function (c) { return wrap(L(14,85,226,85,c,3)+[0,1,2,3,4].map(function(i){var x=34+i*43,up=i%2===0;return '<circle cx="'+x+'" cy="85" r="7" fill="#fff" stroke="'+c+'" stroke-width="3"/>'+L(x,up?78:92,x,up?58:112,'#aab4cc',1.2)+R(x-20,up?36:112,40,22,i%2?c+'22':'#fff',c,4)+T(x-14,(up?36:112)+6,28)+T(x-14,(up?36:112)+13,18);}).join('')); },
    swot: function (c) { return wrap([[12,12,'#2fb47c'],[122,12,'#f0b429'],[12,89,c],[122,89,'#e5484d']].map(function(a){return R(a[0],a[1],106,70,a[2]+'1c',a[2]+'88',6)+R(a[0]+8,a[1]+8,42,7,a[2],null,3)+T(a[0]+8,a[1]+26,80,'#c9d1e2')+T(a[0]+8,a[1]+38,64,'#c9d1e2')+T(a[0]+8,a[1]+50,74,'#c9d1e2');}).join('')); },
    doc: function (c) { return wrap(R(30,8,180,154,'#fff','#dfe4ee',4)+R(44,20,70,10,c,null,3)+T(44,40,150)+T(44,50,140)+T(44,60,146)+R(44,76,60,7,c+'88',null,3)+T(44,92,150)+T(44,102,120)+T(44,112,146)+R(44,128,70,24,c+'1f',c+'66',4)+T(52,136,50,c+'88')); },
    matrix: function (c) { return wrap(R(12,14,216,142,'#fff','#dfe4ee',4)+R(12,14,216,24,c,null,4)+[0,1,2,3].map(function(i){return L(66+i*40,14,66+i*40,156,'#e6e9f0',1);}).join('')+[0,1,2,3].map(function(i){return L(12,62+i*28,228,62+i*28,'#e6e9f0',1);}).join('')+[[1,1],[2,0],[2,2],[3,3],[0,3],[1,3]].map(function(a){return R(70+a[1]*40,44+a[0]*28,32,18,c+'33',null,3);}).join('')+[0,1,2,3].map(function(i){return T(18,52+i*28,32);}).join('')); },
    fish: function (c) { return wrap(L(14,85,196,85,c,3)+R(196,70,32,30,c,null,6)+[0,1,2].map(function(i){return L(40+i*56,35,64+i*56,85,'#9aa6bf',2)+L(40+i*56,135,64+i*56,85,'#9aa6bf',2)+R(22+i*56,18,40,14,'#fff',c,4)+R(22+i*56,138,40,14,'#fff',c,4);}).join('')); },
    funnel: function (c) { return wrap([[20,200,c],[40,160,c+'cc'],[60,120,c+'99'],[80,80,c+'66']].map(function(a,i){return '<polygon points="'+(a[0]+10)+','+(14+i*36)+' '+(230-a[0])+','+(14+i*36)+' '+(230-a[0]-14)+','+(46+i*36)+' '+(a[0]+24)+','+(46+i*36)+'" fill="'+a[2]+'"/>'+R(104,24+i*36,32,6,'#ffffffaa',null,3);}).join('')+R(94,152,52,10,'#e8ecf5',null,5)); },
    wire: function (c) { return wrap(R(10,10,220,150,'#fff','#d7dde9',6)+R(10,10,220,18,'#eef1f7',null,6)+[0,1,2].map(function(i){return '<circle cx="'+(22+i*10)+'" cy="19" r="2.6" fill="'+['#e5484d','#f0b429','#2fb47c'][i]+'"/>';}).join('')+R(16,34,44,120,'#f3f5fa',null,3)+[0,1,2,3].map(function(i){return T(22,42+i*14,30,i===0?c:'#cfd6e5');}).join('')+[0,1,2].map(function(i){return R(68+i*53,34,48,38,c+(i?'33':''),null,4);}).join('')+R(68,80,158,74,'#f8f9fc','#e3e7f0',4)+[0,1,2,3].map(function(i){return T(76,90+i*14,i%2?110:140);}).join('')); },
    cal: function (c) { return wrap(R(10,10,220,150,'#fff','#dfe4ee',5)+R(10,10,220,22,c,null,5)+Array.from({length:35},function(_,i){var x=14+(i%7)*31,y=38+Math.floor(i/7)*24;return R(x,y,28,21,[3,9,16,22,29].indexOf(i)!==-1?c+'33':'#f8f9fc',null,3)+([3,16,29].indexOf(i)!==-1?R(x+4,y+13,20,4,c,null,2):'');}).join('')); },
    chart: function (c) { return wrap(L(24,14,24,150,'#9aa6bf',1.4)+L(24,150,226,150,'#9aa6bf',1.4)+[60,95,75,120,100,135].map(function(h,i){return R(36+i*32,150-h,20,h,i%2?c+'99':c,null,3);}).join('')+'<polyline points="46,100 78,70 110,84 142,40 174,56 206,26" fill="none" stroke="#f0b429" stroke-width="2.4" stroke-linejoin="round"/>'); },
    venn: function (c) { return wrap('<circle cx="95" cy="72" r="46" fill="'+c+'" fill-opacity=".3" stroke="'+c+'" stroke-width="1.4"/><circle cx="145" cy="72" r="46" fill="#f0b429" fill-opacity=".3" stroke="#f0b429" stroke-width="1.4"/><circle cx="120" cy="112" r="46" fill="#2fb47c" fill-opacity=".3" stroke="#2fb47c" stroke-width="1.4"/>'+T(70,58,32,'#ffffffcc')+T(138,58,32,'#ffffffcc')+T(104,128,32,'#ffffffcc')+R(106,84,28,6,'#ffffffdd',null,3)); },
    pyramid: function (c) { return wrap([0,1,2,3].map(function(i){var y=18+i*36,w1=40+i*44,w2=40+(i+1)*44;return '<polygon points="'+(120-w1/2)+','+y+' '+(120+w1/2)+','+y+' '+(120+w2/2)+','+(y+32)+' '+(120-w2/2)+','+(y+32)+'" fill="'+c+['','cc','99','66'][i]+'"/>'+R(104,y+13,32,5,'#ffffffaa',null,2);}).join('')); },
    cycle: function (c) { return wrap('<path d="M120 33 A52 52 0 0 1 172 85" fill="none" stroke="'+c+'" stroke-width="2.4"/><path d="M172 85 A52 52 0 0 1 120 137" fill="none" stroke="'+c+'" stroke-width="2.4"/><path d="M120 137 A52 52 0 0 1 68 85" fill="none" stroke="'+c+'" stroke-width="2.4"/><path d="M68 85 A52 52 0 0 1 120 33" fill="none" stroke="'+c+'" stroke-width="2.4"/>'+[[120,33],[172,85],[120,137],[68,85]].map(function(p,i){return R(p[0]-26,p[1]-11,52,22,i%2?'#fff':c,c,11)+T(p[0]-14,p[1]-2,28,i%2?c+'88':'#ffffffaa');}).join('')+'<circle cx="120" cy="85" r="14" fill="'+c+'" fill-opacity=".15" stroke="'+c+'"/>'); },
    table: function (c) { return wrap(R(10,12,220,146,'#fff','#dfe4ee',4)+R(10,12,220,22,c,null,4)+[0,1,2,3,4].map(function(i){return L(10,34+i*21,230,34+i*21,'#e6e9f0',1);}).join('')+[0,1,2,3].map(function(i){return L(66+i*54,12,66+i*54,158,'#e6e9f0',1);}).join('')+[0,1,2,3,4].map(function(i){return T(16,42+i*21,34);}).join('')+[0,1,2,3,4].map(function(r){return [0,1,2].map(function(k){return T(72+k*54,42+r*21,r%2?30:22,k===2?c+'88':'#cfd6e5');}).join('');}).join('')); },
    check: function (c) { return wrap(R(30,8,180,154,'#fff','#dfe4ee',4)+[0,1,2,3,4,5].map(function(i){return R(44,22+i*22,12,12,i<3?c:'#fff',c,3)+T(64,26+i*22,i%2?100:124)+(i<3?'<path d="M46 '+(28+i*22)+' l3 3 l5 -6" fill="none" stroke="#fff" stroke-width="1.8"/>':'');}).join('')); },
    network: function (c) { var p=[[50,40],[190,40],[50,130],[190,130],[120,22],[120,150]]; return wrap(p.map(function(q){return L(120,85,q[0],q[1],c+'88',1.6);}).join('')+p.map(function(q){return R(q[0]-20,q[1]-10,40,20,'#fff',c,5)+T(q[0]-11,q[1]-2,22);}).join('')+'<circle cx="120" cy="85" r="17" fill="'+c+'"/>'+R(110,83,20,4,'#ffffffaa',null,2)); },
    erd: function (c) { return wrap(L(90,44,150,44,c,1.6)+L(52,76,52,122,c,1.6)+L(52,122,82,122,c,1.6)+L(188,76,188,122,c,1.6)+L(188,122,158,122,c,1.6)+[[14,16],[150,16],[82,92]].map(function(p){return R(p[0],p[1],76,60,'#fff','#c9d1e2',4)+R(p[0],p[1],76,14,c,null,4)+[0,1,2].map(function(i){return T(p[0]+8,p[1]+22+i*12,i===0?36:52)+R(p[0]+60,p[1]+21+i*12,8,6,c+'55',null,2);}).join('');}).join('')); },
    floor: function (c) { return wrap(R(12,12,216,146,'#fff','#8a96b0',2)+L(100,12,100,90,'#8a96b0',2)+L(12,90,228,90,'#8a96b0',2)+L(160,90,160,158,'#8a96b0',2)+R(96,40,8,20,'#fff',null,0)+R(40,86,24,8,'#fff',null,0)+R(180,86,24,8,'#fff',null,0)+R(24,24,30,18,c+'44',c,3)+R(60,24,30,18,c+'44',c,3)+R(112,24,40,22,c+'22',c,3)+R(24,104,40,26,c+'33',c,3)+R(76,108,60,22,c+'22',c,3)+R(172,104,44,34,c+'44',c,3)+R(170,28,46,40,c+'1a',c,3)); },
    persona: function (c) { return wrap(R(12,12,216,146,'#fff','#dfe4ee',8)+'<circle cx="52" cy="52" r="22" fill="'+c+'" fill-opacity=".22" stroke="'+c+'"/><circle cx="52" cy="46" r="8" fill="'+c+'"/><path d="M36 68 q16 -16 32 0" fill="'+c+'"/>'+T(88,36,90,c)+T(88,48,60)+T(88,60,76)+R(24,92,92,56,c+'14',null,6)+T(32,100,60,c)+T(32,112,74)+T(32,122,66)+R(124,92,92,56,'#f3f5fa',null,6)+T(132,100,56)+T(132,112,70)+T(132,122,60)); },
    uml: function (c) { return wrap([[14,14,70],[156,14,70],[85,98,70]].map(function(p){return R(p[0],p[1],p[2],56,'#fff','#c9d1e2',3)+R(p[0],p[1],p[2],14,c,null,3)+T(p[0]+8,p[1]+22,40)+L(p[0],p[1]+34,p[0]+p[2],p[1]+34,'#dfe4ee',1)+T(p[0]+8,p[1]+42,50);}).join('')+L(84,40,156,40,c,1.6)+L(49,70,100,98,c,1.6)+L(190,70,140,98,c,1.6)); },
    seq: function (c) { return wrap([36,92,148,204].map(function(x){return R(x-22,10,44,16,c,null,4)+L(x,26,x,160,'#cdd5e5',1.2);}).join('')+R(88,50,8,30,c+'55',c,2)+L(36,52,92,52,c,1.6)+L(92,70,148,70,c,1.6)+L(148,92,204,92,c,1.6)+L(204,114,36,114,'#9aa6bf',1.4)+R(144,88,8,26,c+'55',c,2)+L(148,136,92,136,'#9aa6bf',1.4)); },
    radar: function (c) { var a=function(i){return i*Math.PI/3-Math.PI/2;},p=function(r,k){return [0,1,2,3,4,5].map(function(i){return (120+r*(k?k[i]:1)*Math.cos(a(i)))+','+(85+r*(k?k[i]:1)*Math.sin(a(i)));}).join(' ');}; return wrap([25,50,75].map(function(r){return '<polygon points="'+p(r)+'" fill="none" stroke="#dfe4ee"/>';}).join('')+[0,1,2,3,4,5].map(function(i){return L(120,85,120+75*Math.cos(a(i)),85+75*Math.sin(a(i)),'#dfe4ee',1);}).join('')+'<polygon points="'+p(75,[0.8,0.5,0.9,0.6,0.7,0.4])+'" fill="'+c+'" fill-opacity=".3" stroke="'+c+'" stroke-width="2"/>'); }
  };

  var KINDNAMES = {
    flow: 'Flowchart', mind: 'Mind map', org: 'Org chart', kanban: 'Kanban', swim: 'Swimlane',
    gantt: 'Gantt', timeline: 'Timeline', swot: 'SWOT grid', doc: 'Document', matrix: 'Matrix',
    fish: 'Fishbone', funnel: 'Funnel', wire: 'Wireframe', cal: 'Calendar', chart: 'Chart',
    venn: 'Venn diagram', pyramid: 'Pyramid', cycle: 'Cycle', table: 'Table', check: 'Checklist',
    network: 'Network', erd: 'Database diagram', floor: 'Floor plan', persona: 'Profile card',
    seq: 'Sequence diagram', uml: 'Class diagram', radar: 'Radar chart'
  };

  /* ---------- Catalogue ---------- */
  var CATS = [
    ['Business', '#2563eb'],
    ['Project management', '#0d9488'],
    ['Strategy', '#7c3aed'],
    ['Flowcharts and processes', '#d97706'],
    ['Mind maps', '#db2777'],
    ['Organisation and HR', '#0891b2'],
    ['Marketing and sales', '#e5484d'],
    ['Education', '#16a34a'],
    ['Meetings', '#4f46e5'],
    ['Software and IT', '#475569'],
    ['Finance and accounting', '#15803d'],
    ['Healthcare and NGO', '#0e7490'],
    ['Operations and supply chain', '#a16207'],
    ['Design and creative', '#be185d'],
    ['Personal and planning', '#4338ca'],
    ['Legal and compliance', '#57534e']
  ];

  var FIX = ['Whiteboard', 'Mind map', 'Project plan', 'Kanban', 'Perspective', 'Brainstorm', 'Document'];
  var BY = ['QuantalFlow Team', 'Data Quantals', 'QuantalFlow Team', 'Community', 'QuantalFlow Team'];

  var D = [
    ['business-plan','Business plan on one page','Business','Document','doc','#2563eb',18400,0,0,'A single page that covers the problem, customers, offer, finances and next steps.'],
    ['lean-canvas','Lean canvas','Business','Whiteboard','matrix','#2563eb',15200,0,0,'Nine blocks for testing a business idea before building anything.'],
    ['business-model','Business model canvas','Business','Whiteboard','matrix','#0d9488',13900,0,0,'Customer segments, value proposition, channels, revenue and costs in one view.'],
    ['quarterly-review','Quarterly business review','Business','Document','doc','#4f46e5',6100,1,1,'A report layout for results, lessons and priorities for the next quarter.'],
    ['proposal','Client proposal','Business','Document','doc','#0891b2',9800,0,0,'Scope, timeline, fees and terms in a layout ready to send.'],
    ['project-plan','Project plan with milestones','Project management','Project plan','gantt','#0d9488',21300,0,0,'Phases, tasks, owners and milestones laid out on a timeline.'],
    ['sprint-board','Sprint board','Project management','Kanban','kanban','#2563eb',17600,0,0,'To do, in progress and done columns with room for estimates and owners.'],
    ['roadmap','Product roadmap','Project management','Project plan','timeline','#7c3aed',12400,0,1,'Quarter-by-quarter view of themes, releases and dependencies.'],
    ['raci','RACI responsibility matrix','Project management','Whiteboard','matrix','#d97706',8700,0,0,'Who is responsible, accountable, consulted and informed for each task.'],
    ['risk-register','Risk register','Project management','Document','matrix','#e5484d',7300,0,0,'Risks with likelihood, impact, owner and mitigation.'],
    ['project-charter','Project charter','Project management','Document','doc','#0d9488',11100,0,0,'Purpose, scope, stakeholders, budget and approval in one document.'],
    ['swot','SWOT analysis','Strategy','Whiteboard','swot','#7c3aed',19900,0,0,'Strengths, weaknesses, opportunities and threats on a four-part grid.'],
    ['okr','OKR planning board','Strategy','Whiteboard','kanban','#7c3aed',9400,0,1,'Objectives and key results by quarter, with progress tracking.'],
    ['pestel','PESTEL analysis','Strategy','Whiteboard','matrix','#475569',6600,1,0,'Political, economic, social, technological, environmental and legal factors.'],
    ['decision-matrix','Decision matrix','Strategy','Whiteboard','matrix','#2563eb',8100,0,0,'Score options against weighted criteria to reach a clear choice.'],
    ['strategy-map','Strategy map','Strategy','Whiteboard','org','#7c3aed',5200,1,0,'Link objectives across finance, customers, processes and learning.'],
    ['process-flow','Process flowchart','Flowcharts and processes','Whiteboard','flow','#d97706',22800,0,0,'Steps, decisions and outcomes drawn as a standard flowchart.'],
    ['swimlane','Swimlane process map','Flowcharts and processes','Whiteboard','swim','#d97706',14200,0,0,'Show who does each step and where handovers happen.'],
    ['sop','Standard operating procedure','Flowcharts and processes','Document','doc','#d97706',12700,0,0,'Purpose, scope, roles, steps and records for a repeatable process.'],
    ['approval-flow','Approval workflow','Flowcharts and processes','Whiteboard','flow','#0d9488',7900,0,1,'Request, review, approve or reject, and notify, with clear owners.'],
    ['fishbone','Cause and effect (fishbone)','Flowcharts and processes','Whiteboard','fish','#475569',9100,0,0,'Trace a problem back to people, process, tools and environment.'],
    ['brainstorm','Brainstorm mind map','Mind maps','Mind map','mind','#db2777',20400,0,0,'A central idea with branches for themes, options and next steps.'],
    ['study-map','Study notes mind map','Mind maps','Mind map','mind','#16a34a',11800,0,0,'Break a topic into branches and add examples and questions.'],
    ['knowledge-map','Knowledge map','Mind maps','Mind map','mind','#2563eb',6900,0,1,'Connect topics, documents and experts across the organisation.'],
    ['goal-map','Goal setting map','Mind maps','Mind map','mind','#7c3aed',8300,0,0,'Turn one goal into projects, tasks and measures.'],
    ['org-chart','Organisation chart','Organisation and HR','Whiteboard','org','#0891b2',16700,0,0,'Teams, roles and reporting lines for a department or company.'],
    ['onboarding','Employee onboarding plan','Organisation and HR','Project plan','gantt','#0891b2',10500,0,0,'First day, first week and first month tasks for a new starter.'],
    ['role-matrix','Role and skills matrix','Organisation and HR','Document','matrix','#16a34a',5800,0,0,'Match people to skills and spot gaps in coverage.'],
    ['performance','Performance review form','Organisation and HR','Document','doc','#0891b2',7600,1,0,'Goals, ratings, feedback and development actions.'],
    ['sales-funnel','Sales funnel','Marketing and sales','Whiteboard','funnel','#e5484d',13600,0,0,'Awareness to purchase, with the drop-off at each stage.'],
    ['content-calendar','Content calendar','Marketing and sales','Project plan','cal','#e5484d',12100,0,0,'Plan posts, campaigns and launches by day and channel.'],
    ['campaign-plan','Campaign plan','Marketing and sales','Document','doc','#db2777',8900,0,0,'Audience, message, channels, budget and measures.'],
    ['customer-journey','Customer journey map','Marketing and sales','Whiteboard','timeline','#e5484d',10200,0,1,'Stages, touchpoints, feelings and opportunities along the journey.'],
    ['lesson-plan','Lesson plan','Education','Document','doc','#16a34a',14800,0,0,'Objectives, activities, resources and assessment for one lesson.'],
    ['course-outline','Course outline','Education','Mind map','mind','#16a34a',9700,0,0,'Modules, topics and learning outcomes at a glance.'],
    ['timetable','Weekly timetable','Education','Project plan','cal','#0d9488',9200,0,0,'Classes, rooms and teachers across the week.'],
    ['research-plan','Research proposal outline','Education','Document','doc','#4f46e5',7400,0,0,'Background, objectives, methods, timeline and expected outcomes.'],
    ['meeting-agenda','Meeting agenda and minutes','Meetings','Document','doc','#4f46e5',17300,0,0,'Agenda, decisions, actions and owners in one place.'],
    ['retro','Sprint retrospective','Meetings','Whiteboard','kanban','#4f46e5',11400,0,0,'What went well, what did not and what to change.'],
    ['standup','Daily standup board','Meetings','Kanban','kanban','#0d9488',6200,0,0,'Yesterday, today and blockers for each team member.'],
    ['workshop','Workshop planner','Meetings','Whiteboard','timeline','#d97706',5600,1,1,'Sessions, timings, materials and facilitators.'],
    ['system-arch','System architecture diagram','Software and IT','Whiteboard','flow','#475569',9500,0,0,'Services, databases and integrations and how they connect.'],
    ['wireframe','App wireframe','Software and IT','Whiteboard','wire','#2563eb',13200,0,0,'Screens, navigation and key components for a new app.'],
    ['user-flow','User flow','Software and IT','Whiteboard','flow','#7c3aed',10800,0,0,'Follow a user through screens, choices and outcomes.'],
    ['release-plan','Release checklist','Software and IT','Kanban','kanban','#475569',6400,0,0,'Tests, approvals and deployment steps before a release.'],
    ['incident','Incident review','Software and IT','Document','fish','#e5484d',4900,1,0,'Timeline, root cause and follow-up actions after an outage.'],
    ['value-proposition','Value proposition canvas','Business','Whiteboard','matrix','#2563eb',11200,0,0,'Match customer jobs, pains and gains with what you offer.'],
    ['executive-summary','Executive summary','Business','Document','doc','#0d9488',9300,0,0,'Key message, evidence and recommendation on one page.'],
    ['pitch-outline','Investor pitch outline','Business','Document','pyramid','#7c3aed',8400,1,0,'Problem, solution, market, traction, team and funding ask.'],
    ['competitor-compare','Competitor comparison','Business','Whiteboard','table','#e5484d',10100,0,0,'Compare features, price and positioning side by side.'],
    ['stakeholder-map','Stakeholder map','Business','Whiteboard','matrix','#0891b2',9000,0,0,'Plot stakeholders by influence and interest.'],
    ['business-case','Business case','Business','Document','doc','#4f46e5',7800,0,0,'Costs, benefits, risks and options behind a decision.'],
    ['kpi-dashboard','KPI dashboard','Business','Whiteboard','chart','#2563eb',12900,0,1,'Key measures with targets, trends and owners.'],
    ['five-forces','Porter five forces','Business','Whiteboard','network','#7c3aed',8800,0,0,'Rivalry, new entrants, substitutes, buyers and suppliers.'],
    ['ansoff','Ansoff growth matrix','Business','Whiteboard','matrix','#d97706',5400,0,0,'Choose between penetration, development and diversification.'],
    ['bcg-matrix','Growth-share matrix','Business','Whiteboard','matrix','#16a34a',6700,0,0,'Classify products as stars, cash cows, question marks or dogs.'],
    ['sipoc','SIPOC process overview','Business','Whiteboard','flow','#0d9488',5900,0,0,'Suppliers, inputs, process, outputs and customers.'],
    ['annual-report','Annual report','Business','Document','doc','#475569',6200,1,0,'Performance, finances and outlook for the year.'],
    ['wbs','Work breakdown structure','Project management','Whiteboard','org','#0d9488',12600,0,0,'Split a project into deliverables and work packages.'],
    ['status-report','Project status report','Project management','Document','doc','#2563eb',13800,0,0,'Progress, risks, issues and next steps for sponsors.'],
    ['comms-plan','Communication plan','Project management','Document','table','#0891b2',7100,0,0,'Who needs what information, how often and from whom.'],
    ['change-request','Change request form','Project management','Document','doc','#d97706',6400,0,0,'Describe a change, its impact and the approval decision.'],
    ['lessons-log','Lessons learned log','Project management','Document','table','#7c3aed',6900,0,0,'Record what worked, what did not and what to change.'],
    ['resource-plan','Resource allocation plan','Project management','Project plan','gantt','#16a34a',8200,0,0,'Assign people to tasks and avoid overload.'],
    ['budget-tracker','Project budget tracker','Project management','Project plan','table','#0d9488',9600,0,0,'Planned and actual cost by work package.'],
    ['issue-tracker','Issue tracker','Project management','Kanban','kanban','#e5484d',8800,0,0,'Log issues, owners, priority and resolution.'],
    ['dependency-map','Dependency map','Project management','Whiteboard','network','#4f46e5',5700,0,1,'Show which tasks and teams depend on each other.'],
    ['kickoff-agenda','Project kick-off agenda','Project management','Document','doc','#2563eb',7300,0,0,'Goals, scope, roles, timeline and ways of working.'],
    ['closure-report','Project closure report','Project management','Document','doc','#475569',6000,0,0,'Results against plan, lessons and handover.'],
    ['agile-roadmap','Agile release roadmap','Project management','Project plan','timeline','#7c3aed',8500,0,0,'Releases and themes across sprints.'],
    ['burndown','Sprint burndown review','Project management','Whiteboard','chart','#d97706',5200,0,0,'Track remaining work against the sprint plan.'],
    ['backlog','Product backlog board','Project management','Kanban','kanban','#0891b2',9900,0,0,'Prioritised stories ready for planning.'],
    ['critical-path','Critical path diagram','Project management','Whiteboard','flow','#e5484d',5600,1,0,'Find the tasks that decide the finish date.'],
    ['handover-checklist','Project handover checklist','Project management','Document','check','#16a34a',6100,0,0,'Documents, access and training before handover.'],
    ['vision-board','Vision board','Strategy','Mind map','mind','#db2777',7000,0,0,'Goals, values and priorities around one vision.'],
    ['balanced-scorecard','Balanced scorecard','Strategy','Whiteboard','matrix','#7c3aed',7600,0,0,'Finance, customer, process and learning measures.'],
    ['scenario-planning','Scenario planning grid','Strategy','Whiteboard','matrix','#475569',4800,1,0,'Compare futures along two uncertain factors.'],
    ['value-chain','Value chain analysis','Strategy','Whiteboard','flow','#2563eb',5100,0,0,'Primary and support activities that create value.'],
    ['three-horizons','Three horizons of growth','Strategy','Whiteboard','timeline','#0d9488',4500,0,1,'Balance core business, emerging and future options.'],
    ['goal-cascade','Goal cascade','Strategy','Whiteboard','org','#d97706',6300,0,0,'Cascade company goals to teams and people.'],
    ['advantage-map','Competitive advantage map','Strategy','Whiteboard','venn','#7c3aed',4700,0,0,'Where your strengths overlap with customer needs.'],
    ['strategic-plan','Five-year strategic plan','Strategy','Document','doc','#4f46e5',8900,0,0,'Vision, objectives, initiatives and measures.'],
    ['blue-ocean','Blue ocean strategy canvas','Strategy','Whiteboard','chart','#0891b2',4300,1,0,'Compare value curves to find uncontested space.'],
    ['risk-heatmap','Risk heat map','Strategy','Whiteboard','matrix','#e5484d',8100,0,0,'Plot risks by likelihood and impact.'],
    ['north-star','North star framework','Strategy','Whiteboard','pyramid','#2563eb',4900,0,0,'One key measure supported by inputs and actions.'],
    ['mission-statement','Mission and values statement','Strategy','Document','doc','#16a34a',5300,0,0,'Purpose, values and commitments in plain language.'],
    ['data-flow','Data flow diagram','Flowcharts and processes','Whiteboard','flow','#475569',9800,0,0,'Processes, data stores and external parties.'],
    ['decision-tree','Decision tree','Flowcharts and processes','Whiteboard','org','#d97706',10400,0,0,'Branch choices to outcomes with probabilities.'],
    ['pdca','PDCA improvement cycle','Flowcharts and processes','Whiteboard','cycle','#0d9488',8600,0,0,'Plan, do, check and act on a change.'],
    ['dmaic','DMAIC problem solving','Flowcharts and processes','Whiteboard','cycle','#2563eb',5800,0,0,'Define, measure, analyse, improve and control.'],
    ['value-stream','Value stream map','Flowcharts and processes','Whiteboard','flow','#16a34a',5400,1,0,'Follow work from request to delivery and find waste.'],
    ['escalation','Escalation procedure','Flowcharts and processes','Whiteboard','flow','#e5484d',6600,0,0,'Who to contact and when, level by level.'],
    ['support-flow','Customer support flow','Flowcharts and processes','Whiteboard','swim','#0891b2',8300,0,0,'From ticket to resolution across support tiers.'],
    ['procurement','Procurement process','Flowcharts and processes','Whiteboard','swim','#7c3aed',7000,0,0,'Request, quote, approval, order and payment.'],
    ['complaint-flow','Complaint handling process','Flowcharts and processes','Whiteboard','flow','#d97706',5900,0,0,'Receive, investigate, respond and learn.'],
    ['incident-response','Incident response plan','Flowcharts and processes','Whiteboard','flow','#e5484d',7700,0,1,'Detect, contain, recover and review.'],
    ['five-whys','Five whys analysis','Flowcharts and processes','Whiteboard','flow','#475569',6800,0,0,'Ask why repeatedly to reach the root cause.'],
    ['order-fulfilment','Order fulfilment flow','Flowcharts and processes','Whiteboard','swim','#2563eb',6200,0,0,'Order, pick, pack, ship and confirm.'],
    ['recruitment-flow','Recruitment process','Flowcharts and processes','Whiteboard','swim','#db2777',7500,0,0,'Advert, screening, interview, offer and start date.'],
    ['refund-flow','Refund process','Flowcharts and processes','Whiteboard','flow','#0d9488',4600,0,0,'Request, check, approve and pay back.'],
    ['sop-checklist','SOP checklist','Flowcharts and processes','Document','check','#16a34a',9200,0,0,'Steps with sign-off for a repeatable task.'],
    ['iso-process','ISO process map','Flowcharts and processes','Whiteboard','swim','#475569',4400,1,0,'Inputs, controls, outputs and responsible roles.'],
    ['project-mindmap','Project planning mind map','Mind maps','Mind map','mind','#0d9488',12100,0,0,'Scope, tasks, risks and resources on one map.'],
    ['marketing-mindmap','Marketing ideas mind map','Mind maps','Mind map','mind','#e5484d',8700,0,0,'Channels, audiences and campaign ideas.'],
    ['book-notes','Book notes mind map','Mind maps','Mind map','mind','#16a34a',7300,0,0,'Chapters, key ideas and quotes to remember.'],
    ['weekly-map','Weekly plan mind map','Mind maps','Mind map','mind','#2563eb',6500,0,0,'Tasks and priorities for each day.'],
    ['problem-solving','Problem solving map','Mind maps','Mind map','mind','#d97706',7900,0,0,'Problem, causes, options and chosen action.'],
    ['content-ideas','Content ideas map','Mind maps','Mind map','mind','#db2777',6100,0,0,'Topics, formats and publishing plan.'],
    ['feature-map','Product feature map','Mind maps','Mind map','mind','#7c3aed',7100,0,1,'Group features by user need and release.'],
    ['decision-map','Decision mind map','Mind maps','Mind map','mind','#475569',5200,0,0,'Options, criteria and trade-offs.'],
    ['learning-map','Learning plan map','Mind maps','Mind map','mind','#0891b2',6700,0,0,'Skills to learn, resources and milestones.'],
    ['family-tree','Family tree','Mind maps','Mind map','org','#16a34a',9400,0,0,'Generations and relationships at a glance.'],
    ['team-structure','Team structure chart','Organisation and HR','Whiteboard','org','#0891b2',9100,0,0,'Roles, teams and who reports to whom.'],
    ['job-description','Job description','Organisation and HR','Document','doc','#4f46e5',11900,0,0,'Purpose, duties, skills and reporting line.'],
    ['interview-scorecard','Interview scorecard','Organisation and HR','Document','table','#db2777',8000,0,0,'Score candidates on the same criteria.'],
    ['leave-tracker','Leave tracker','Organisation and HR','Project plan','cal','#16a34a',8800,0,0,'Staff leave by day with cover arrangements.'],
    ['training-plan','Staff training plan','Organisation and HR','Project plan','gantt','#d97706',7200,0,0,'Courses, dates and attendees across the year.'],
    ['succession-plan','Succession plan','Organisation and HR','Whiteboard','org','#7c3aed',4900,1,0,'Ready-now and future successors for key roles.'],
    ['recruit-pipeline','Recruitment pipeline','Organisation and HR','Kanban','funnel','#0d9488',6600,0,0,'Candidates from application to hire.'],
    ['exit-interview','Exit interview form','Organisation and HR','Document','doc','#475569',4800,0,0,'Reasons for leaving and suggestions to improve.'],
    ['staff-handbook','Staff handbook outline','Organisation and HR','Document','doc','#2563eb',7400,0,0,'Policies, benefits and expectations in one guide.'],
    ['one-on-one','One-to-one meeting notes','Organisation and HR','Document','doc','#0891b2',9700,0,1,'Check-ins, goals, feedback and actions.'],
    ['shift-roster','Shift roster','Organisation and HR','Project plan','cal','#e5484d',10300,0,0,'Weekly shifts by person and location.'],
    ['competency-framework','Competency framework','Organisation and HR','Whiteboard','pyramid','#16a34a',5100,0,0,'Skill levels from foundation to expert.'],
    ['team-charter','Team charter','Organisation and HR','Document','doc','#d97706',6000,0,0,'Purpose, roles, norms and decision rules.'],
    ['marketing-plan','Marketing plan','Marketing and sales','Document','doc','#e5484d',14500,0,0,'Goals, audience, channels, budget and measures.'],
    ['audience-persona','Customer persona','Marketing and sales','Whiteboard','persona','#db2777',13100,0,0,'Goals, frustrations and habits of a typical customer.'],
    ['brand-guide','Brand guidelines','Marketing and sales','Document','doc','#7c3aed',8200,0,0,'Logo use, colours, fonts and tone of voice.'],
    ['social-calendar','Social media calendar','Marketing and sales','Project plan','cal','#0891b2',11700,0,0,'Posts by day, channel and owner.'],
    ['email-sequence','Email sequence flow','Marketing and sales','Whiteboard','flow','#2563eb',7400,0,0,'Timed emails with branches by reader action.'],
    ['lead-scoring','Lead scoring sheet','Marketing and sales','Document','table','#d97706',5700,0,0,'Points for actions and fit to rank leads.'],
    ['sales-pipeline','Sales pipeline board','Marketing and sales','Kanban','kanban','#16a34a',12400,0,0,'Deals from new lead to closed.'],
    ['sales-playbook','Sales playbook','Marketing and sales','Document','doc','#0d9488',6900,0,0,'Process, scripts and answers to common objections.'],
    ['marketing-swot','Marketing SWOT','Marketing and sales','Whiteboard','swot','#e5484d',6100,0,0,'Strengths and gaps in your marketing position.'],
    ['seo-plan','SEO checklist','Marketing and sales','Document','check','#2563eb',9300,0,0,'Keywords, pages, links and technical fixes.'],
    ['launch-checklist','Product launch checklist','Marketing and sales','Document','check','#7c3aed',10800,0,1,'Tasks before, on and after launch day.'],
    ['ab-test','A/B test report','Marketing and sales','Document','chart','#0891b2',4900,0,0,'Hypothesis, results and decision for a test.'],
    ['pricing-table','Pricing comparison table','Marketing and sales','Whiteboard','table','#d97706',8500,0,0,'Plans, features and prices side by side.'],
    ['case-study','Customer case study','Marketing and sales','Document','doc','#16a34a',7200,0,0,'Challenge, solution and results in the customer voice.'],
    ['marketing-funnel','Marketing funnel','Marketing and sales','Whiteboard','funnel','#db2777',9000,0,0,'Awareness to loyalty with measures at each step.'],
    ['channel-mix','Channel mix report','Marketing and sales','Document','chart','#475569',5400,1,0,'Spend and results by marketing channel.'],
    ['campaign-brief','Campaign brief','Marketing and sales','Document','doc','#e5484d',9600,0,0,'Objective, audience, message and deliverables.'],
    ['referral-program','Referral programme plan','Marketing and sales','Whiteboard','cycle','#0d9488',4200,0,0,'How customers invite others and get rewarded.'],
    ['assessment-rubric','Assessment rubric','Education','Document','table','#16a34a',12300,0,0,'Criteria and performance levels for marking.'],
    ['syllabus','Course syllabus','Education','Document','doc','#2563eb',10600,0,0,'Aims, schedule, assessment and policies.'],
    ['seating-plan','Classroom seating plan','Education','Whiteboard','floor','#0891b2',8100,0,0,'Desks and groups for a class.'],
    ['exam-schedule','Exam timetable','Education','Project plan','cal','#e5484d',9400,0,0,'Papers, rooms, dates and invigilators.'],
    ['concept-map','Concept map','Education','Mind map','mind','#7c3aed',11300,0,0,'Link concepts with labelled relationships.'],
    ['progress-chart','Student progress report','Education','Document','chart','#0d9488',7600,0,0,'Marks over time with teacher comments.'],
    ['scheme-of-work','Scheme of work','Education','Document','table','#d97706',9100,0,0,'Topics, weeks, objectives and resources.'],
    ['revision-planner','Revision planner','Education','Project plan','cal','#db2777',10900,0,0,'Study sessions by subject before exams.'],
    ['thesis-outline','Thesis outline','Education','Document','doc','#4f46e5',8800,0,1,'Chapters and sections from introduction to conclusion.'],
    ['literature-matrix','Literature review matrix','Education','Document','table','#475569',7900,0,0,'Compare sources by method, findings and gaps.'],
    ['research-timeline','Research timeline','Education','Project plan','gantt','#16a34a',6800,0,0,'Proposal, data collection, analysis and writing.'],
    ['nursing-care-plan','Nursing care plan','Education','Document','table','#0891b2',9500,0,0,'Assessment, diagnosis, goals, actions and evaluation.'],
    ['clinical-logbook','Clinical practice logbook','Education','Document','table','#0d9488',6300,0,0,'Procedures observed, assisted and performed.'],
    ['case-analysis','Case study analysis','Education','Document','doc','#7c3aed',5800,0,0,'Background, issues, options and recommendation.'],
    ['peer-review','Peer review form','Education','Document','check','#2563eb',4700,0,0,'Structured feedback on a classmate paper.'],
    ['quiz-planner','Quiz planner','Education','Document','check','#d97706',5200,0,0,'Questions, marks and answer key.'],
    ['blooms','Bloom taxonomy levels','Education','Whiteboard','pyramid','#16a34a',8600,0,0,'Learning outcomes from remembering to creating.'],
    ['learning-journal','Learning journal','Education','Document','doc','#db2777',4900,0,0,'Reflect on what was learned and what to practise.'],
    ['board-meeting','Board meeting pack','Meetings','Document','doc','#475569',6900,1,0,'Agenda, reports and resolutions for directors.'],
    ['client-notes','Client meeting notes','Meetings','Document','doc','#2563eb',11500,0,0,'Needs, agreements and follow-ups with a client.'],
    ['decision-log','Decision log','Meetings','Document','table','#7c3aed',8300,0,0,'Decision, reason, owner and date in one table.'],
    ['action-tracker','Action tracker','Meetings','Document','table','#0d9488',10200,0,0,'Actions with owner, due date and status.'],
    ['weekly-sync','Weekly team sync','Meetings','Kanban','kanban','#0891b2',8700,0,0,'Updates, blockers and priorities for the week.'],
    ['town-hall','Town hall plan','Meetings','Project plan','timeline','#d97706',4300,0,0,'Speakers, timings and questions.'],
    ['rose-bud-thorn','Rose, bud, thorn','Meetings','Whiteboard','matrix','#db2777',5100,0,0,'Positives, opportunities and problems.'],
    ['start-stop-continue','Start, stop, continue','Meetings','Whiteboard','kanban','#16a34a',9000,0,0,'Team feedback in three columns.'],
    ['four-ls','4Ls retrospective','Meetings','Whiteboard','matrix','#e5484d',4600,0,0,'Liked, learned, lacked and longed for.'],
    ['conference-plan','Conference plan','Meetings','Project plan','gantt','#4f46e5',5900,0,0,'Venue, speakers, sponsors and schedule.'],
    ['brainstorm-board','Brainstorm board','Meetings','Whiteboard','mind','#2563eb',12700,0,0,'Capture ideas, group them and vote.'],
    ['erd','Entity relationship diagram','Software and IT','Whiteboard','erd','#475569',13400,0,0,'Tables, keys and relationships for a database.'],
    ['api-flow','API request flow','Software and IT','Whiteboard','flow','#2563eb',8100,0,0,'Client, gateway, service and database calls.'],
    ['network-diagram','Network diagram','Software and IT','Whiteboard','network','#0891b2',11000,0,0,'Routers, switches, servers and devices.'],
    ['sitemap','Website sitemap','Software and IT','Whiteboard','org','#16a34a',9700,0,0,'Pages and how they link together.'],
    ['sprint-planning','Sprint planning board','Software and IT','Kanban','kanban','#7c3aed',8800,0,0,'Stories, estimates and sprint goal.'],
    ['bug-report','Bug report','Software and IT','Document','doc','#e5484d',7500,0,0,'Steps to reproduce, expected and actual result.'],
    ['test-plan','Test plan','Software and IT','Document','table','#0d9488',6700,0,0,'Scope, cases, environments and sign-off.'],
    ['deploy-flow','Deployment pipeline','Software and IT','Whiteboard','flow','#d97706',7200,0,0,'Build, test, stage and release steps.'],
    ['security-checklist','Security checklist','Software and IT','Document','check','#475569',8900,0,1,'Access, backups, updates and monitoring.'],
    ['tech-roadmap','Technology roadmap','Software and IT','Project plan','timeline','#4f46e5',5600,0,0,'Upgrades and migrations over time.'],
    ['db-schema','Database schema design','Software and IT','Whiteboard','erd','#2563eb',7000,1,0,'Tables, columns and indexes.'],
    ['story-map','User story map','Software and IT','Whiteboard','kanban','#db2777',6600,0,0,'Journey steps with stories beneath each.'],
    ['cloud-architecture','Cloud architecture','Software and IT','Whiteboard','network','#0891b2',9300,0,0,'Services, networks and storage in the cloud.'],
    ['adr','Architecture decision record','Software and IT','Document','doc','#7c3aed',4800,0,0,'Context, decision and consequences.'],
    ['dev-onboarding','Developer onboarding checklist','Software and IT','Document','check','#16a34a',5400,0,0,'Accounts, tools and first tasks for new developers.'],
    ['ux-research','UX research plan','Software and IT','Document','doc','#e5484d',4700,0,0,'Questions, participants, method and timeline.'],
    ['design-system','Design system overview','Software and IT','Whiteboard','wire','#0d9488',6200,0,0,'Colours, type and components in one place.'],
    ['budget-plan','Annual budget plan','Finance and accounting','Document','table','#16a34a',14100,0,0,'Income and spending by month and category.'],
    ['cash-flow','Cash flow forecast','Finance and accounting','Document','chart','#0d9488',11400,0,0,'Money in and out over the coming months.'],
    ['profit-loss','Profit and loss statement','Finance and accounting','Document','table','#2563eb',9200,0,0,'Revenue, costs and profit for a period.'],
    ['expense-report','Expense report','Finance and accounting','Document','table','#d97706',10500,0,0,'Claims with dates, categories and receipts.'],
    ['invoice-process','Invoice approval process','Finance and accounting','Whiteboard','swim','#7c3aed',6100,0,0,'Receive, check, approve and pay invoices.'],
    ['financial-forecast','Financial forecast','Finance and accounting','Document','chart','#4f46e5',7700,1,0,'Three-year projections with assumptions.'],
    ['break-even','Break-even analysis','Finance and accounting','Whiteboard','chart','#e5484d',6500,0,0,'Sales needed to cover fixed and variable costs.'],
    ['audit-checklist','Internal audit checklist','Finance and accounting','Document','check','#475569',7100,0,0,'Controls to test and evidence to collect.'],
    ['grant-budget','Grant budget','Finance and accounting','Document','table','#0891b2',8300,0,1,'Costs by activity for a funder.'],
    ['fundraising-plan','Fundraising plan','Finance and accounting','Whiteboard','funnel','#db2777',5900,0,0,'Prospects, asks and targets by source.'],
    ['payroll-process','Payroll process','Finance and accounting','Whiteboard','flow','#16a34a',5000,0,0,'Collect hours, calculate, approve and pay.'],
    ['patient-flow','Patient flow chart','Healthcare and NGO','Whiteboard','flow','#0891b2',8800,0,0,'Arrival, triage, treatment and discharge.'],
    ['care-pathway','Clinical care pathway','Healthcare and NGO','Whiteboard','flow','#0d9488',6400,1,0,'Standard steps of care for a condition.'],
    ['ward-roster','Ward duty roster','Healthcare and NGO','Project plan','cal','#2563eb',9300,0,0,'Nurses by shift and ward.'],
    ['health-education','Health education plan','Healthcare and NGO','Document','doc','#16a34a',7100,0,0,'Topic, audience, methods and evaluation.'],
    ['logframe','Logical framework (logframe)','Healthcare and NGO','Document','table','#7c3aed',9900,0,0,'Goal, outcomes, outputs, indicators and assumptions.'],
    ['theory-of-change','Theory of change','Healthcare and NGO','Whiteboard','flow','#d97706',8500,0,1,'How activities lead to outcomes and impact.'],
    ['me-plan','Monitoring and evaluation plan','Healthcare and NGO','Document','table','#0891b2',10700,0,0,'Indicators, sources, frequency and responsibility.'],
    ['community-outreach','Community outreach plan','Healthcare and NGO','Project plan','timeline','#e5484d',5600,0,0,'Visits, partners and messages by month.'],
    ['donor-report','Donor progress report','Healthcare and NGO','Document','doc','#4f46e5',8400,0,0,'Results, spending and lessons for a funder.'],
    ['immunisation','Immunisation schedule','Healthcare and NGO','Project plan','cal','#16a34a',6800,0,0,'Doses by age and clinic date.'],
    ['clinical-incident','Clinical incident report','Healthcare and NGO','Document','doc','#e5484d',5300,0,0,'What happened, harm, actions and follow-up.'],
    ['infection-control','Infection control checklist','Healthcare and NGO','Document','check','#0d9488',7400,0,0,'Hand hygiene, cleaning and equipment checks.'],
    ['ngo-stakeholders','NGO stakeholder analysis','Healthcare and NGO','Whiteboard','matrix','#475569',4900,0,0,'Partners, funders and communities by influence.'],
    ['needs-assessment','Community needs assessment','Healthcare and NGO','Document','doc','#db2777',6200,0,0,'Findings on needs, gaps and priorities.'],
    ['programme-timeline','Programme implementation timeline','Healthcare and NGO','Project plan','gantt','#2563eb',7700,0,0,'Activities and milestones across the funding period.'],
    ['results-chain','Results chain','Healthcare and NGO','Whiteboard','flow','#7c3aed',5500,0,0,'Inputs, activities, outputs and outcomes.'],
    ['indicator-tracker','Indicator tracker','Healthcare and NGO','Document','table','#0891b2',8200,0,0,'Targets and actuals by quarter.'],
    ['problem-tree','Problem tree analysis','Healthcare and NGO','Whiteboard','org','#d97706',9000,0,0,'Core problem with causes below and effects above.'],
    ['ward-layout','Ward floor plan','Healthcare and NGO','Whiteboard','floor','#16a34a',4400,0,0,'Beds, nurse station and access routes.'],
    ['supply-chain','Supply chain map','Operations and supply chain','Whiteboard','network','#475569',7800,0,0,'Suppliers, plants, warehouses and customers.'],
    ['inventory-checklist','Inventory check','Operations and supply chain','Document','check','#d97706',6200,0,0,'Counts, variances and corrective actions.'],
    ['warehouse-layout','Warehouse layout','Operations and supply chain','Whiteboard','floor','#2563eb',5700,0,0,'Zones, aisles and loading bays.'],
    ['quality-control','Quality control process','Operations and supply chain','Whiteboard','flow','#16a34a',7000,0,0,'Inspect, record, correct and release.'],
    ['maintenance-schedule','Maintenance schedule','Operations and supply chain','Project plan','cal','#0891b2',8100,0,0,'Equipment servicing by date and technician.'],
    ['fleet-plan','Fleet management sheet','Operations and supply chain','Document','table','#7c3aed',5300,0,0,'Vehicles, drivers, service and fuel.'],
    ['order-swimlane','Order to delivery swimlane','Operations and supply chain','Whiteboard','swim','#e5484d',6400,0,0,'Sales, warehouse, transport and customer steps.'],
    ['vendor-scorecard','Vendor scorecard','Operations and supply chain','Document','table','#0d9488',5800,0,0,'Rate suppliers on quality, price and delivery.'],
    ['capacity-plan','Capacity plan','Operations and supply chain','Whiteboard','chart','#4f46e5',4600,1,0,'Demand against available capacity.'],
    ['lean-5s','5S workplace audit','Operations and supply chain','Document','check','#d97706',6700,0,0,'Sort, set in order, shine, standardise and sustain.'],
    ['kaizen','Kaizen improvement cycle','Operations and supply chain','Whiteboard','cycle','#16a34a',4900,0,0,'Small repeated improvements with measured results.'],
    ['logistics-timeline','Logistics timeline','Operations and supply chain','Whiteboard','timeline','#2563eb',5000,0,0,'Shipment stages from dispatch to delivery.'],
    ['mood-board','Mood board','Design and creative','Whiteboard','wire','#db2777',13800,0,0,'Images, colours and type for a creative direction.'],
    ['design-persona','User persona profile','Design and creative','Whiteboard','persona','#7c3aed',9900,0,0,'Needs, goals and behaviour of a design user.'],
    ['storyboard','Storyboard','Design and creative','Whiteboard','kanban','#e5484d',8700,0,0,'Frames in order with notes for each scene.'],
    ['brand-identity','Brand identity brief','Design and creative','Document','doc','#0891b2',7100,0,0,'Personality, audience and visual direction.'],
    ['creative-brief','Creative brief','Design and creative','Document','doc','#d97706',9200,0,0,'Goal, audience, message, tone and deadline.'],
    ['content-pillars','Content pillars','Design and creative','Whiteboard','pyramid','#16a34a',6000,0,0,'Core themes that guide all content.'],
    ['design-sprint','Design sprint plan','Design and creative','Project plan','timeline','#2563eb',5400,0,1,'Five days from problem to tested prototype.'],
    ['empathy-map','Empathy map','Design and creative','Whiteboard','matrix','#0d9488',10500,0,0,'What users say, think, do and feel.'],
    ['poster-layout','Poster layout','Design and creative','Whiteboard','wire','#4f46e5',7600,0,0,'Grid for headline, image and details.'],
    ['logo-concepts','Logo concept map','Design and creative','Mind map','mind','#475569',4300,0,0,'Keywords, shapes and directions to explore.'],
    ['weekly-planner','Weekly planner','Personal and planning','Project plan','cal','#2563eb',16200,0,0,'Tasks and appointments across the week.'],
    ['habit-tracker','Habit tracker','Personal and planning','Document','table','#16a34a',12800,0,0,'Daily habits with a monthly streak view.'],
    ['goal-ladder','Goal ladder','Personal and planning','Whiteboard','pyramid','#7c3aed',7700,0,0,'Break a long-term goal into steps.'],
    ['personal-budget','Personal budget','Personal and planning','Document','table','#0d9488',13600,0,0,'Income, bills and savings each month.'],
    ['travel-itinerary','Travel itinerary','Personal and planning','Project plan','timeline','#d97706',9600,0,0,'Flights, stays and activities by day.'],
    ['event-plan','Event plan','Personal and planning','Project plan','gantt','#db2777',10700,0,0,'Tasks and deadlines leading to the event.'],
    ['wedding-checklist','Wedding checklist','Personal and planning','Document','check','#e5484d',8400,0,0,'Venue, guests, catering and timeline.'],
    ['moving-checklist','Moving checklist','Personal and planning','Document','check','#0891b2',6900,0,0,'Packing, address changes and the moving day.'],
    ['meal-planner','Meal planner','Personal and planning','Document','table','#16a34a',7800,0,0,'Meals and shopping list for the week.'],
    ['life-wheel','Wheel of life','Personal and planning','Whiteboard','cycle','#4f46e5',6100,0,0,'Rate areas of life and choose what to improve.'],
    ['eisenhower','Eisenhower matrix','Personal and planning','Whiteboard','matrix','#2563eb',14900,0,0,'Sort tasks by urgency and importance.'],
    ['reading-list','Reading list','Personal and planning','Document','check','#475569',5200,0,0,'Books to read, in progress and finished.'],
    ['compliance-checklist','Compliance checklist','Legal and compliance','Document','check','#475569',8900,0,0,'Requirements, evidence and review dates.'],
    ['policy-template','Policy template','Legal and compliance','Document','doc','#2563eb',10300,0,0,'Purpose, scope, rules and review cycle.'],
    ['contract-lifecycle','Contract lifecycle flow','Legal and compliance','Whiteboard','flow','#7c3aed',5600,0,0,'Draft, review, sign, renew and close.'],
    ['nda','Non-disclosure agreement outline','Legal and compliance','Document','doc','#0d9488',7600,1,0,'Parties, confidential information and term.'],
    ['data-protection','Data protection flow','Legal and compliance','Whiteboard','flow','#e5484d',5900,0,1,'How personal data is collected, used and deleted.'],
    ['risk-assessment','Risk assessment matrix','Legal and compliance','Document','matrix','#d97706',9400,0,0,'Hazards, likelihood, severity and controls.'],
    ['audit-trail','Audit findings tracker','Legal and compliance','Document','table','#4f46e5',5300,0,0,'Findings, owners, actions and closure dates.'],
    ['data-map','Data mapping diagram','Legal and compliance','Whiteboard','network','#0891b2',4700,0,0,'Where personal data sits and who can see it.'],
    ['terms-of-service','Terms of service outline','Legal and compliance','Document','doc','#16a34a',6000,0,0,'Use, payment, liability and termination.'],
    ['complaints-policy','Complaints policy','Legal and compliance','Document','doc','#db2777',4500,0,0,'How complaints are received, handled and escalated.']
  ];

  var TN = { W: 'Whiteboard', M: 'Mind map', P: 'Project plan', K: 'Kanban', V: 'Perspective', B: 'Brainstorm', D: 'Document' };
  var PAL = ['#2563eb', '#0d9488', '#7c3aed', '#d97706', '#db2777', '#e5484d', '#16a34a', '#0891b2', '#4f46e5'];

  var X = [
    ['Customer touchpoint map',6,'W','network','Plot every point where customers meet your brand.'],
    ['Service blueprint',12,'W','swim','Front-stage actions, back-stage work and support systems.'],
    ['Impact and effort grid',2,'W','matrix','Rank ideas by the effort needed and the impact gained.'],
    ['Team working agreement',8,'W','kanban','Agree how the team communicates and decides.'],
    ['Jobs to be done map',13,'W','flow','Capture what customers hire your product to do.'],
    ['Event floor layout',14,'W','floor','Tables, stage and entrances for an event.'],
    ['Classroom group planner',7,'W','org','Group learners by skill and task.'],
    ['Hospital bed allocation',11,'W','floor','Assign beds and rooms across a ward.'],
    ['Data pipeline diagram',9,'W','flow','Sources, transforms and destinations of your data.'],
    ['Change impact map',5,'W','network','Show which teams a change will affect.'],
    ['Spending approval chain',10,'W','flow','Spending limits and who signs off at each level.'],
    ['Compliance obligations map',15,'W','network','Laws, owners and controls linked together.'],
    ['Production line layout',12,'W','floor','Stations, flow and buffers on the shop floor.'],
    ['Retail store layout',13,'W','floor','Shelves, tills and customer paths.'],
    ['Construction schedule',1,'P','gantt','Trades, inspections and handover dates.'],
    ['Product launch timeline',6,'P','timeline','Teasers, launch day and follow-up in order.'],
    ['Website redesign plan',9,'P','gantt','Research, design, build and go-live.'],
    ['Hiring plan by quarter',5,'P','gantt','Roles to fill, owners and target start dates.'],
    ['Event run sheet',8,'P','timeline','Minute-by-minute schedule for the day.'],
    ['Grant application timeline',11,'P','gantt','Draft, review, budget and submission deadlines.'],
    ['Audit calendar',15,'P','cal','Planned audits, owners and report dates.'],
    ['Production schedule',12,'P','gantt','Batches, machines and delivery dates.'],
    ['Semester planner',7,'P','cal','Lectures, deadlines and exams in one view.'],
    ['Campaign rollout schedule',6,'P','gantt','Channels and activities week by week.'],
    ['Migration cutover plan',9,'P','timeline','Steps, rollback points and sign-offs.'],
    ['Home renovation plan',14,'P','gantt','Jobs, contractors and costs in sequence.'],
    ['Year-end close calendar',10,'P','cal','Reconciliations, reviews and filing dates.'],
    ['Phase gate plan',1,'P','timeline','Stages with go or no-go decisions.'],
    ['Customer problems map',0,'M','mind','Group the problems customers tell you about.'],
    ['Learning outcomes map',7,'M','mind','Link outcomes to topics and assessments.'],
    ['Market research map',6,'M','mind','Segments, competitors, trends and questions.'],
    ['Career path map',14,'M','mind','Skills, roles and steps toward a career goal.'],
    ['Risk categories map',15,'M','mind','Group risks by type and owner.'],
    ['Team skills map',5,'M','mind','Who knows what, and where the gaps are.'],
    ['Product vision map',2,'M','mind','Users, needs, features and success measures.'],
    ['Tech stack map',9,'M','mind','Languages, tools and services in use.'],
    ['Health promotion map',11,'M','mind','Messages, audiences and channels for a campaign.'],
    ['Supplier options map',12,'M','mind','Candidate suppliers with pros and cons.'],
    ['Budget priorities map',10,'M','mind','Spending areas ranked by need.'],
    ['Brand story map',13,'M','mind','Origin, values, audience and voice.'],
    ['Meeting topics map',8,'M','mind','Topics and questions to cover in a meeting.'],
    ['Process improvement map',3,'M','mind','Pain points, causes and fixes by step.'],
    ['Content production board',6,'K','kanban','Ideas to drafts, review and published.'],
    ['Onboarding tasks board',5,'K','kanban','New starter tasks by stage.'],
    ['Bug triage board',9,'K','kanban','Reported, confirmed, fixing and verified.'],
    ['Invoice status board',10,'K','kanban','Draft, sent, overdue and paid.'],
    ['Research tasks board',7,'K','kanban','Reading, data, analysis and writing.'],
    ['Patient referral board',11,'K','kanban','Referrals from received to seen.'],
    ['Order status board',12,'K','kanban','New, picking, packed and shipped.'],
    ['Design review board',13,'K','kanban','Concepts in draft, review and approved.'],
    ['Contract review board',15,'K','kanban','Contracts through legal review and signing.'],
    ['Personal tasks board',14,'K','kanban','To do, doing and done for daily life.'],
    ['Client projects board',0,'K','kanban','All client work by status.'],
    ['Strategy initiatives board',2,'K','kanban','Initiatives from idea to delivered.'],
    ['Action items board',8,'K','kanban','Actions from meetings with owners.'],
    ['Change request board',1,'K','kanban','Requests from submitted to decided.'],
    ['Six thinking hats',2,'V','network','Look at one decision through six styles of thinking.'],
    ['Stakeholder viewpoints',0,'V','network','Capture what each stakeholder wants and fears.'],
    ['Customer and company view',6,'V','venn','Where customer needs and business goals meet.'],
    ['Before and after view',14,'V','matrix','Compare how things look now and after a change.'],
    ['Pros and cons table',0,'V','table','Weigh benefits against drawbacks.'],
    ['360 degree feedback',5,'V','network','Views from manager, peers, reports and self.'],
    ['Student, teacher and parent views',7,'V','venn','Three views of the same school issue.'],
    ['Patient and provider views',11,'V','venn','Compare what patients and staff experience.'],
    ['User, developer and business views',9,'V','venn','Balance what each side needs from a feature.'],
    ['Risk from three sides',15,'V','venn','Legal, operational and reputational views.'],
    ['Supplier and customer views',12,'V','venn','Both ends of the supply chain side by side.'],
    ['Audience perspective card',13,'V','persona','See the work through one audience member.'],
    ['Past, present and future view',2,'V','timeline','Look back, look around and look ahead.'],
    ['Cost and benefit views',10,'V','matrix','Short- and long-term costs against benefits.'],
    ['Conflict perspectives canvas',8,'V','matrix','Interests, needs and options for each side.'],
    ['Crazy eights',13,'B','matrix','Eight rapid ideas in eight minutes.'],
    ['SCAMPER prompts',13,'B','matrix','Substitute, combine, adapt, modify and more.'],
    ['How might we questions',13,'B','mind','Turn problems into open questions.'],
    ['Reverse brainstorming',2,'B','flow','Ask how to cause the problem, then flip it.'],
    ['Brainwriting grid',8,'B','table','Everyone writes ideas silently, then passes them on.'],
    ['Affinity diagram',8,'B','kanban','Cluster ideas into themes.'],
    ['Dot voting board',8,'B','chart','Vote on ideas and see the top picks.'],
    ['Starbursting questions',0,'B','mind','Who, what, where, when, why and how.'],
    ['Idea funnel',0,'B','funnel','Narrow many ideas down to a few to test.'],
    ['Sticky note wall',7,'B','kanban','Free ideas grouped by topic.'],
    ['Feature idea storm',9,'B','mind','Collect and sort ideas for the next release.'],
    ['Fundraising ideas',11,'B','mind','Events, appeals and partners to try.'],
    ['Campaign hook ideas',6,'B','mind','Angles, slogans and formats to test.'],
    ['Cost saving ideas',10,'B','mind','Where to cut spending without hurting quality.'],
    ['Process fix ideas',12,'B','fish','Causes and quick fixes for a process problem.'],
    ['Staff engagement ideas',5,'B','mind','Ways to raise morale and involvement.'],
    ['Party planning ideas',14,'B','mind','Themes, food, games and guests.'],
    ['Press release',6,'D','doc','Headline, key facts, quote and contact details.'],
    ['Request for proposal',0,'D','doc','Needs, criteria and timeline for bidders.'],
    ['Statement of work',1,'D','doc','Scope, deliverables, schedule and payment.'],
    ['Product requirements document',9,'D','doc','Problem, users, requirements and success measures.'],
    ['Release notes',9,'D','doc','New features, fixes and known issues.'],
    ['Employment offer letter',5,'D','doc','Role, pay, start date and conditions.'],
    ['Grant proposal',11,'D','doc','Need, approach, budget and expected results.'],
    ['Policy brief',2,'D','doc','Issue, evidence and recommended action.'],
    ['Lab report',7,'D','doc','Aim, method, results and conclusion.'],
    ['Purchase order',12,'D','table','Items, quantities, prices and delivery terms.'],
    ['Financial statement notes',10,'D','doc','Accounting policies and notes to the accounts.'],
    ['Privacy policy',15,'D','doc','What data you collect and how it is used.'],
    ['Service level agreement',15,'D','doc','Service levels, response times and remedies.'],
    ['Customer newsletter',6,'D','doc','News, tips and offers in one issue.'],
    ['Resume',14,'D','doc','Experience, skills and education on one page.'],
    ['Cover letter',14,'D','doc','Why you fit the role, in a clear structure.'],
    ['Referral letter',11,'D','doc','Patient details, reason and requested action.'],
    ['Design handover document',13,'D','doc','Assets, specs and notes for developers.']
  ];

  X.forEach(function (a, i) {
    var id = a[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (D.some(function (d) { return d[0] === id; })) return;
    D.push([id, a[0], CATS[a[1]][0], TN[a[2]], a[3], PAL[i % 9], 1500 + (i * 2371) % 11000, i % 10 === 6 ? 1 : 0, i % 7 === 3 ? 1 : 0, a[4]]);
  });

  var X2 = [
    ['UML class diagram',9,'W','uml','Classes, attributes and relationships for a system.'],
    ['UML sequence diagram',9,'W','seq','Messages between actors and services over time.'],
    ['UML use case diagram',9,'W','network','Actors and the goals they reach through a system.'],
    ['UML activity diagram',9,'W','flow','Actions, forks and joins in a workflow.'],
    ['State machine diagram',9,'W','flow','States and the events that move between them.'],
    ['BPMN business process',3,'W','swim','Pools, lanes, gateways and events for a process.'],
    ['PERT chart',1,'W','flow','Task network with earliest and latest times.'],
    ['Manufacturing fishbone (6M)',12,'W','fish','Man, machine, method, material, measurement, environment.'],
    ['Marketing fishbone (7P)',6,'W','fish','Find why a campaign missed using the seven Ps.'],
    ['Patient safety fishbone',11,'W','fish','Trace causes of a care incident by category.'],
    ['Software defect fishbone',9,'W','fish','Code, tools, process, people and environment causes.'],
    ['Pareto chart',12,'W','chart','Rank causes so the vital few stand out.'],
    ['Genogram',14,'W','org','Family members, relationships and health patterns.'],
    ['Cross-functional flowchart',3,'W','swim','Steps grouped by department or role.'],
    ['Troubleshooting flowchart',9,'W','flow','Yes or no questions that lead to a fix.'],
    ['Matrix organisation chart',5,'W','matrix','Functional and project reporting lines together.'],
    ['Network topology diagram',9,'W','network','Devices and links in star, ring or mesh layouts.'],
    ['Office floor plan',12,'W','floor','Desks, meeting rooms and exits.'],
    ['Home floor plan',14,'W','floor','Rooms, doors and furniture to scale.'],
    ['Wedding seating chart',14,'W','floor','Tables and guests for the reception.'],
    ['Skills radar chart',5,'W','radar','Compare skill levels across six areas.'],
    ['Competitor radar chart',0,'W','radar','Score you and rivals on key factors.'],
    ['House of quality',12,'W','matrix','Link customer needs to technical features.'],
    ['Cause and effect matrix',12,'W','matrix','Score inputs against what customers care about.'],
    ['Gap analysis',2,'W','matrix','Current state, target state and the steps between.'],
    ['Marketing mix (4Ps)',6,'W','matrix','Product, price, place and promotion.'],
    ['McKinsey 7S model',2,'W','network','Align strategy, structure, systems and culture.'],
    ['Kano model',13,'W','chart','Sort features into basic, performance and delight.'],
    ['Customer lifecycle',6,'W','cycle','Attract, convert, retain and grow.'],
    ['Product lifecycle curve',0,'W','chart','Introduction, growth, maturity and decline.'],
    ['Sailboat retrospective',8,'W','matrix','Wind, anchors, rocks and the goal ahead.'],
    ['Mad, sad, glad',8,'W','kanban','Team feelings about the last sprint.'],
    ['Opportunity solution tree',13,'W','org','Outcome, opportunities, solutions and tests.'],
    ['Impact map',2,'W','mind','Goal, actors, impacts and deliverables.'],
    ['Service ecosystem map',13,'W','network','People, systems and flows around a service.'],
    ['Product canvas',0,'W','matrix','Vision, users, features and metrics on one page.'],
    ['Hypothesis canvas',13,'W','matrix','Assumption, test, measure and result.'],
    ['Mobile app flow',9,'W','wire','Screens and taps through a mobile journey.'],
    ['Dashboard wireframe',9,'W','wire','Charts, filters and tables laid out.'],
    ['Landing page wireframe',13,'W','wire','Hero, benefits, proof and call to action.'],
    ['Scrum board',9,'K','kanban','Backlog, sprint, review and done for a team.'],
    ['Defect lifecycle board',9,'K','kanban','Defects from found to verified.'],
    ['Sprint backlog',9,'K','kanban','Stories chosen for the sprint with estimates.'],
    ['Incident management board',9,'K','kanban','Alerts triaged, mitigated and closed.'],
    ['Service desk queue',9,'K','kanban','Tickets by priority and assignee.'],
    ['Change management board',9,'K','kanban','Changes from request to approved and done.'],
    ['Test case board',9,'K','kanban','Cases planned, running, passed or failed.'],
    ['Technical debt board',9,'K','kanban','Debt items ranked by risk and cost.'],
    ['Lean coffee',8,'K','kanban','Propose, vote and discuss topics in timed rounds.'],
    ['Experiment board',0,'K','kanban','Ideas, running tests and learnings.'],
    ['Lead management board',6,'K','kanban','Leads from new to qualified.'],
    ['Customer success tracker',6,'K','kanban','Onboarding, adoption and renewal by account.'],
    ['Creative requests board',13,'K','kanban','Briefs, drafts, feedback and delivery.'],
    ['Task management board',1,'K','kanban','Weekly tasks by status and owner.'],
    ['Procurement request tracker',12,'K','kanban','Requests, quotes, approval and order.'],
    ['Vendor management board',12,'K','kanban','Vendors by onboarding and review stage.'],
    ['Customer feedback tracker',6,'K','kanban','Feedback sorted into new, planned and shipped.'],
    ['Social media content board',6,'K','kanban','Post ideas through to published.'],
    ['Event planning board',14,'K','kanban','Venue, guests, catering and logistics tasks.'],
    ['Clinic appointment board',11,'K','kanban','Patients from booked to seen.'],
    ['Learning tracker board',7,'K','kanban','Courses and modules by progress.'],
    ['Epic roadmap',9,'P','timeline','Epics and releases across quarters.'],
    ['Release train plan',9,'P','gantt','Teams, increments and release dates.'],
    ['Feature flag rollout',9,'P','timeline','Internal, beta and full release stages.'],
    ['Now, next, later roadmap',1,'P','kanban','Simple priorities without fixed dates.'],
    ['Quarterly planning board',1,'P','gantt','Teams, goals and dependencies for a quarter.'],
    ['Team capacity planner',1,'P','gantt','Available hours against planned work.'],
    ['Workshop agenda timer',8,'P','timeline','Timed blocks for each activity.'],
    ['Marketing campaign tracker',6,'P','gantt','Assets, channels, owners and dates.'],
    ['Team workload chart',1,'P','chart','See who is over or under capacity.'],
    ['Radial topic map',4,'M','mind','One subject with branches in every direction.'],
    ['Bubble map',4,'M','mind','Describe a topic with linked words.'],
    ['Tree hierarchy map',4,'M','org','Categories split into sub-categories.'],
    ['Brace map',4,'M','org','Break a whole into parts and sub-parts.'],
    ['Double bubble comparison',7,'M','venn','Compare two topics: shared and different.'],
    ['Flow map',7,'M','flow','Events in order with sub-steps.'],
    ['Spider diagram',7,'M','mind','Topic in the middle with spokes of detail.'],
    ['Onion diagram',0,'V','venn','Layers of stakeholders from core to outer.'],
    ['Customer and employee view',6,'V','venn','What each side sees in the same service.'],
    ['Multiple lenses analysis',2,'V','matrix','Same issue seen by finance, people and customers.'],
    ['Brain dump list',14,'B','check','Empty your head onto one page, then sort.'],
    ['Worst possible idea',13,'B','mind','Make bad ideas, then flip them into good ones.'],
    ['Round robin ideas',8,'B','table','Each person adds to the last idea.'],
    ['Idea scoring matrix',0,'B','matrix','Score ideas on cost, impact and risk.'],
    ['Icebreaker wall',8,'B','kanban','Quick prompts to start a session.'],
    ['Interview synthesis wall',13,'B','kanban','Group quotes into patterns and insights.'],
    ['How-to guide',0,'D','doc','Steps, tips and results for a task.'],
    ['Knowledge base article',0,'D','doc','Question, answer and related links.'],
    ['Troubleshooting article',9,'D','doc','Symptoms, causes and fixes.'],
    ['Team playbook',5,'D','doc','How the team works, tools and contacts.'],
    ['Project poster',1,'D','doc','Goal, status, team and links on one page.'],
    ['Team directory',5,'D','table','People, roles, locations and contacts.'],
    ['Retrospective notes',8,'D','doc','What happened, why and what changes.'],
    ['Competitive analysis document',0,'D','doc','Rivals, strengths, gaps and response.'],
    ['Customer interview notes',13,'D','doc','Questions, answers and key quotes.'],
    ['Technical design document',9,'D','doc','Goals, design, trade-offs and rollout.'],
    ['Runbook',9,'D','doc','Steps to operate and recover a system.'],
    ['New hire wiki page',5,'D','doc','Welcome, tools, people and first tasks.'],
    ['Roadmap document',1,'D','doc','Goals and themes for the coming year.'],
    ['Project retrospective report',1,'D','doc','Outcomes, lessons and recommendations.'],
    ['Blameless postmortem',9,'D','doc','Timeline, causes, impact and actions.'],
    ['Definition of done checklist',9,'D','check','Criteria before a story counts as done.'],
    ['Sprint review report',9,'D','doc','Demo notes, feedback and next steps.'],
    ['Project intake form',1,'D','doc','Request, benefit, cost and sponsor.'],
    ['Time tracking sheet',1,'D','table','Hours by task, person and day.'],
    ['Budget vs actual tracker',10,'D','table','Planned and real spend side by side.'],
    ['Inventory tracker',12,'D','table','Stock levels, reorder points and locations.'],
    ['IT asset tracker',9,'D','table','Devices, owners, warranty and status.'],
    ['Construction punch list',1,'D','check','Open items to close before handover.'],
    ['Performance goals tracker',5,'D','table','Goals, progress and reviews by person.'],
    ['Velocity chart',9,'W','chart','Work completed per sprint over time.'],
    ['Cumulative flow diagram',9,'W','chart','Work in each stage as it builds up.']
  ];

  X2.forEach(function (a, i) {
    var id = a[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (D.some(function (d) { return d[0] === id; })) return;
    D.push([id, a[0], CATS[a[1]][0], TN[a[2]], a[3], PAL[(i + 4) % 9], 2000 + (i * 3137) % 12000, i % 9 === 5 ? 1 : 0, i % 6 === 1 ? 1 : 0, a[4]]);
  });

  var base = D.map(function (a, i) {
    return {
      id: a[0], title: a[1], cat: a[2], type: a[3], kind: a[4], color: a[5],
      uses: a[6], pro: !!a[7], isNew: !!a[8], desc: a[9], author: BY[i % BY.length], order: i
    };
  });

  // Merge QuantalFlow's 26 EdrawMax Mind Map / Concept Map / Bubble Diagram templates
  if (Array.isArray(window.QFEdrawMindMapTemplates) && window.QFEdrawMindMapTemplates.length) {
    window.QFEdrawMindMapTemplates.forEach(function (et, idx) {
      if (!et || !et.id || base.some(function (b) { return b.id === et.id; })) return;
      base.push({
        id: et.id,
        title: et.label || et.id,
        cat: /education|math|teacher|course|english/i.test((et.label || '') + ' ' + (et.tag || '')) ? 'Education' : 'Mind maps',
        type: 'Mind map',
        kind: 'mind',
        color: '#db2777',
        uses: 4200 + idx * 310,
        pro: false,
        isNew: false,
        desc: et.blurb || et.structure || 'Interactive mind map template ready to edit on the canvas.',
        author: 'QuantalFlow Team',
        order: base.length + idx,
        previewImg: et.previewImg || '',
        edrawId: et.id
      });
    });
  }

  /* ---------- Quick-Start Blank Launchers (Unified QuantalFlow Routes) ---------- */
  var QUICK_STARTERS = [
    ['Blank whiteboard', 'Free-form canvas', 'whiteboard', '/app/?template=whiteboard&module=whiteboard'],
    ['Blank mind map', 'Branch out ideas', 'mindmap', '/app/?template=mindmap&module=mindmap'],
    ['Blank project plan', 'Tasks and timeline', 'project-planning', '/app/?board=project-planning-workspace&template=project-planning'],
    ['Blank kanban board', 'Columns and cards', 'kanban', '/app/?template=kanban&module=kanban'],
    ['Blank perspective', 'Compare viewpoints', 'perspective', '/app/?template=perspective&module=perspective'],
    ['Blank brainstorm', 'Capture ideas', 'brainstorm', '/app/?template=brainstorm&module=brainstorm'],
    ['Blank document', 'Write and format', 'documents', '/dashboard/documents/']
  ];

  /* ---------- Persistent User-Scoped Storage ---------- */
  var LEGACY_KEY = 'qf_templates_v1';
  var currentUserId = '';
  var st = { favs: [], recent: [], mine: [] };
  var ui = { tab: 'discover', cat: '', types: new Set(), plan: 'all', q: '', sort: 'pop', shown: 12 };
  var eventsBound = false;
  var launching = false;

  function storageKey() {
    var uid = currentUserId || (window.__qfUser && window.__qfUser.id) || localStorage.getItem('quantalflow_current_user_id') || '';
    return uid ? ('quantalflow_templates_v1_' + uid) : 'quantalflow_templates_v1';
  }

  function loadState() {
    var parsed = null;
    try {
      parsed = JSON.parse(localStorage.getItem(storageKey()) || 'null');
      if (!parsed) {
        var legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
        if (legacy && typeof legacy === 'object') parsed = legacy;
      }
    } catch (e) {
      parsed = null;
    }
    st = {
      favs: parsed && Array.isArray(parsed.favs) ? parsed.favs : [],
      recent: parsed && Array.isArray(parsed.recent) ? parsed.recent : [],
      mine: parsed && Array.isArray(parsed.mine) ? parsed.mine : []
    };
  }

  function saveState() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(st));
    } catch (e) {}
  }

  function ALL() {
    return st.mine.map(function (m) {
      return Object.assign({}, m, { mine: true });
    }).concat(base);
  }

  function byId(id) {
    return ALL().find(function (t) { return t.id === id; });
  }

  function renderThumb(t) {
    if (t.previewImg) {
      return '<img src="' + esc(t.previewImg) + '" alt="' + esc(t.title) + '" loading="lazy" />';
    }
    if (window.QFTemplateBlueprints && typeof window.QFTemplateBlueprints.renderPreviewSvg === 'function') {
      return window.QFTemplateBlueprints.renderPreviewSvg(t);
    }
    var fn = KIND[t.kind] || KIND.flow;
    return fn(t.color || '#2563eb');
  }

  /* ---------- Shared Portal Elements (Modal Overlay + Toast) ---------- */
  function ensurePortals() {
    var overlay = document.getElementById('qf-tpl-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'qf-tpl-overlay';
      overlay.className = 'qf-tpl-overlay';
      overlay.innerHTML = '<div class="qf-tpl-modal" id="qf-tpl-modal" role="dialog" aria-modal="true"></div>';
      overlay.addEventListener('mousedown', function (e) {
        if (e.target === overlay) closeModal();
      });
      document.body.appendChild(overlay);
    }
    var toastEl = document.getElementById('qf-tpl-toast');
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'qf-tpl-toast';
      toastEl.className = 'qf-tpl-toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
  }

  function toast(msg) {
    ensurePortals();
    var t = document.getElementById('qf-tpl-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  function closeModal() {
    var overlay = document.getElementById('qf-tpl-overlay');
    if (overlay) overlay.classList.remove('show');
  }

  /* ---------- Filtering & Rendering ---------- */
  function filtered() {
    var q = ui.q.trim().toLowerCase();
    var list = ALL();
    if (ui.tab === 'mine') list = list.filter(function (t) { return t.mine; });
    if (ui.tab === 'favs') list = list.filter(function (t) { return st.favs.indexOf(t.id) !== -1; });
    if (ui.tab === 'recent') list = st.recent.map(byId).filter(Boolean);

    list = list.filter(function (t) {
      if (ui.cat && t.cat !== ui.cat) return false;
      if (ui.types.size && !ui.types.has(t.type)) return false;
      if (ui.plan !== 'all' && (ui.plan === 'pro' ? !t.pro : t.pro)) return false;
      if (q) {
        var hay = (t.title + ' ' + t.cat + ' ' + t.type + ' ' + t.desc + ' ' + (KINDNAMES[t.kind] || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    if (ui.tab !== 'recent') {
      if (ui.sort === 'pop') list.sort(function (a, b) { return b.uses - a.uses; });
      if (ui.sort === 'new') list.sort(function (a, b) { return (Number(b.isNew) - Number(a.isNew)) || ((b.mine ? 1 : 0) - (a.mine ? 1 : 0)) || (a.order - b.order); });
      if (ui.sort === 'az') list.sort(function (a, b) { return a.title.localeCompare(b.title); });
    }
    return list;
  }

  function railHTML() {
    var all = ALL();
    var cnt = function (c) { return all.filter(function (t) { return t.cat === c; }).length; };
    return '<h4>Categories</h4>' +
      '<button type="button" class="qf-tpl-cat ' + (!ui.cat ? 'on' : '') + '" data-tpl-act="cat" data-c="">' +
        '<span class="dot" style="background:#9aa6bf"></span>All templates<span class="n">' + all.length + '</span>' +
      '</button>' +
      CATS.map(function (c) {
        return '<button type="button" class="qf-tpl-cat ' + (ui.cat === c[0] ? 'on' : '') + '" data-tpl-act="cat" data-c="' + esc(c[0]) + '">' +
          '<span class="dot" style="background:' + c[1] + '"></span>' + esc(c[0]) + '<span class="n">' + cnt(c[0]) + '</span>' +
        '</button>';
      }).join('') +
      '<h4>Board type</h4>' +
      FIX.map(function (t) {
        return '<label class="qf-tpl-chk"><input type="checkbox" data-tpl-type="' + esc(t) + '" ' + (ui.types.has(t) ? 'checked' : '') + '>' + esc(t) + '</label>';
      }).join('');
  }

  function cardHTML(t) {
    var fav = st.favs.indexOf(t.id) !== -1;
    return '<article class="qf-tpl-card">' +
      '<div class="qf-tpl-thumb">' + renderThumb(t) +
        '<div class="qf-tpl-badges">' +
          (t.mine ? '<span class="qf-tpl-bd mine">Mine</span>' : '') +
          (t.isNew ? '<span class="qf-tpl-bd new">New</span>' : '') +
        '</div>' +
        '<button type="button" class="qf-tpl-fav ' + (fav ? 'on' : '') + '" data-tpl-act="fav" data-id="' + esc(t.id) + '" aria-label="' + (fav ? 'Remove from favourites' : 'Add to favourites') + '" aria-pressed="' + fav + '">' +
          '<svg viewBox="0 0 24 24"><path d="M12 21s-7-4.6-9.3-9.2C1.2 8.6 3 5 6.5 5c2 0 3.5 1.1 5.5 3.2C14 6.1 15.5 5 17.5 5 21 5 22.8 8.6 21.3 11.8 19 16.4 12 21 12 21z"/></svg>' +
        '</button>' +
        '<div class="qf-tpl-over">' +
          '<button type="button" class="qf-tpl-btn primary sm" data-tpl-act="use" data-id="' + esc(t.id) + '">Use template</button>' +
          '<button type="button" class="qf-tpl-btn sm" data-tpl-act="preview" data-id="' + esc(t.id) + '">Preview</button>' +
          (t.mine ? '<button type="button" class="qf-tpl-btn sm danger" data-tpl-act="del" data-id="' + esc(t.id) + '">Delete</button>' : '') +
        '</div>' +
      '</div>' +
      '<h5 data-tpl-act="preview" data-id="' + esc(t.id) + '" tabindex="0">' + esc(t.title) + '</h5>' +
      '<div class="qf-tpl-meta"><span>' + esc(t.type) + '</span><span>' + (t.mine ? 'Created by you' : num(t.uses) + ' uses') + '</span></div>' +
    '</article>';
  }

  function render() {
    var railEl = document.getElementById('tpl-rail');
    var tabsEl = document.getElementById('tpl-tabs');
    var bodyEl = document.getElementById('tpl-body');
    if (!railEl || !tabsEl || !bodyEl) return;

    railEl.innerHTML = railHTML();
    var all = ALL();
    var tabs = [
      ['discover', 'Discover', all.length],
      ['mine', 'My templates', st.mine.length],
      ['favs', 'Favourites', st.favs.filter(function (id) { return Boolean(byId(id)); }).length],
      ['recent', 'Recently used', st.recent.filter(function (id) { return Boolean(byId(id)); }).length]
    ];
    tabsEl.innerHTML = tabs.map(function (t) {
      return '<button type="button" role="tab" aria-selected="' + (ui.tab === t[0]) + '" class="' + (ui.tab === t[0] ? 'on' : '') + '" data-tpl-act="tab" data-t="' + t[0] + '">' +
        t[1] + '<i>' + (t[0] === 'discover' ? '' : t[2]) + '</i>' +
      '</button>';
    }).join('');

    var list = filtered();
    var page = list.slice(0, ui.shown);
    var quick = (ui.tab === 'discover' && !ui.q && !ui.cat && !ui.types.size && ui.plan === 'all')
      ? '<div class="qf-tpl-quick"><h3>Start from scratch</h3><div class="qf-tpl-qgrid">' +
          QUICK_STARTERS.map(function (q) {
            return '<button type="button" class="qf-tpl-qtile" data-tpl-act="blank" data-fw="' + esc(q[2]) + '" data-u="' + esc(q[3]) + '">' +
              '<div class="pv"><span>+</span></div><b>' + esc(q[0]) + '</b><small>' + esc(q[1]) + '</small>' +
            '</button>';
          }).join('') +
        '</div></div>'
      : '';

    var activeTabMeta = tabs.find(function (t) { return t[0] === ui.tab; });
    var heading = ui.tab === 'discover'
      ? (ui.q ? ('Results for "' + esc(ui.q) + '"') : (ui.cat ? esc(ui.cat) : 'Popular templates'))
      : (activeTabMeta ? activeTabMeta[1] : 'Templates');

    var emptyMap = {
      discover: ['No templates match', 'Try a different word or clear the filters.'],
      mine: ['You have not saved a template yet', 'Select "+ Save as template" to turn a layout into a template your team can reuse.'],
      favs: ['No favourites yet', 'Select the heart on a template to keep it here.'],
      recent: ['Nothing used recently', 'Templates you launch appear here automatically.']
    };
    var emptyMsg = emptyMap[ui.tab] || emptyMap.discover;

    bodyEl.innerHTML = quick +
      '<div class="qf-tpl-sect">' +
        '<h3>' + heading + '</h3>' +
        '<div class="qf-tpl-count">' + list.length + ' template' + (list.length === 1 ? '' : 's') + '</div>' +
        '<div class="qf-tpl-grid">' +
          (page.length
            ? page.map(cardHTML).join('')
            : '<div class="qf-tpl-empty"><b>' + emptyMsg[0] + '</b>' + emptyMsg[1] + '</div>') +
        '</div>' +
        (list.length > page.length
          ? '<div class="qf-tpl-more"><button type="button" class="qf-tpl-btn" data-tpl-act="more">Show more templates (' + (list.length - page.length) + ' left)</button></div>'
          : '') +
      '</div>';
  }

  /* ---------- Preview Modal ---------- */
  function includes(t) {
    if (window.QFTemplateBlueprints && typeof window.QFTemplateBlueprints.describeIncluded === 'function') {
      return window.QFTemplateBlueprints.describeIncluded(t);
    }
    var k = t.kind;
    var map = {
      flow: ['Start, decision and end shapes', 'Connectors that follow the shapes', 'Space for notes on each step'],
      mind: ['Central topic and six branches', 'Colour-coded themes', 'Room for notes and links'],
      org: ['Three reporting levels', 'Role and name placeholders', 'Space for contact details'],
      kanban: ['Three columns with example cards', 'Labels and owner placeholders', 'Progress counters'],
      swim: ['Three lanes for teams or roles', 'Handover points', 'Start and end markers'],
      gantt: ['Weekly timeline grid', 'Task bars with owners', 'Milestone markers'],
      timeline: ['Dated stages along one line', 'Labels above and below', 'Space for notes'],
      swot: ['Four labelled quadrants', 'Prompt text for each quadrant', 'Priority markers'],
      doc: ['Headings and body text styles', 'Tables for key figures', 'Sign-off section'],
      matrix: ['Rows and columns ready to fill', 'Scoring cells', 'Totals row'],
      fish: ['Main problem on the right', 'Six cause categories', 'Space for sub-causes'],
      funnel: ['Four stages from top to bottom', 'Conversion figures per stage', 'Notes for each stage'],
      wire: ['Browser frame and navigation', 'Content cards', 'Sidebar and header areas'],
      cal: ['Monthly grid', 'Highlighted key dates', 'Notes area'],
      chart: ['Axes with example bars and a trend line', 'Space for targets and notes', 'Legend and labels'],
      venn: ['Three overlapping areas', 'Labels for each area and the overlap', 'Space for notes'],
      pyramid: ['Four levels from top to base', 'Label space on every level', 'Colour shading by level'],
      cycle: ['Four connected stages in a loop', 'Centre label for the aim', 'Space for notes on each stage'],
      table: ['Header row and five rows', 'Columns for names, values and notes', 'Totals-ready layout'],
      check: ['Checklist with completed and open items', 'Space for owners and dates', 'Sign-off area'],
      network: ['Central hub with six connected nodes', 'Labels for each node', 'Space for notes'],
      erd: ['Three linked tables', 'Key and column placeholders', 'Relationship lines'],
      floor: ['Outer walls and three rooms', 'Doors and furniture placeholders', 'Scale and notes area'],
      persona: ['Photo and name area', 'Goals and frustrations panels', 'Behaviour and needs notes']
    };
    return map[k] || ['Ready-made layout', 'Editable shapes and text', 'Space for your content'];
  }

  function openPreview(id) {
    var t = byId(id);
    if (!t) return;
    ensurePortals();
    var sim = ALL()
      .filter(function (x) { return x.id !== t.id && (x.cat === t.cat || x.kind === t.kind); })
      .sort(function (a, b) { return b.uses - a.uses; })
      .slice(0, 4);
    var fav = st.favs.indexOf(t.id) !== -1;
    var modal = document.getElementById('qf-tpl-modal');
    var overlay = document.getElementById('qf-tpl-overlay');
    if (!modal || !overlay) return;

    modal.className = 'qf-tpl-modal';
    modal.innerHTML =
      '<div class="qf-tpl-pv-wrap">' +
        '<div class="qf-tpl-pv-left"><div class="big">' + renderThumb(t) + '</div></div>' +
        '<div class="qf-tpl-pv-right">' +
          '<div><h2>' + esc(t.title) + '</h2><div class="by">' + (t.mine ? 'Created by you' : 'By ' + esc(t.author)) + '</div></div>' +
          '<p>' + esc(t.desc) + '</p>' +
          '<div class="qf-tpl-kv">' +
            '<span>Category</span><span>' + esc(t.cat) + '</span>' +
            '<span>Board type</span><span>' + esc(t.type) + '</span>' +
            '<span>Layout</span><span>' + esc(KINDNAMES[t.kind] || 'Canvas') + '</span>' +
            '<span>Uses</span><span>' + (t.mine ? 'Private workspace template' : num(t.uses)) + '</span>' +
          '</div>' +
          '<div><h4>What is included</h4><ul>' + includes(t).map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>' +
          '<div class="qf-tpl-acts">' +
            '<button type="button" class="qf-tpl-btn primary" data-tpl-act="use" data-id="' + esc(t.id) + '">Use this template</button>' +
            '<button type="button" class="qf-tpl-btn" data-tpl-act="fav-modal" data-id="' + esc(t.id) + '">' + (fav ? 'Remove favourite' : 'Add to favourites') + '</button>' +
            '<button type="button" class="qf-tpl-btn" data-tpl-act="close">Close</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      (sim.length
        ? '<div class="qf-tpl-similar"><h3>Similar templates</h3><div class="qf-tpl-sgrid">' +
            sim.map(function (s) {
              return '<div data-tpl-act="preview" data-id="' + esc(s.id) + '" tabindex="0">' +
                '<div class="qf-tpl-thumb">' + renderThumb(s) + '</div>' +
                '<small>' + esc(s.title) + '</small>' +
              '</div>';
            }).join('') +
          '</div></div>'
        : '');

    overlay.classList.add('show');
  }

  /* ---------- Save-As-Template Modal ---------- */
  function openCreate() {
    ensurePortals();
    var modal = document.getElementById('qf-tpl-modal');
    var overlay = document.getElementById('qf-tpl-overlay');
    if (!modal || !overlay) return;

    modal.className = 'qf-tpl-modal narrow';
    modal.innerHTML =
      '<h2>Save as template</h2>' +
      '<form id="qf-tpl-cform">' +
        '<div class="qf-tpl-fld" id="qf-tpl-board-picker-wrap" hidden>' +
          '<label for="c-source-board">Prefill from an existing workspace board (optional)</label>' +
          '<select id="c-source-board"><option value="">— Create custom template —</option></select>' +
        '</div>' +
        '<div class="qf-tpl-fld"><label for="c-name">Template name</label><input id="c-name" name="name" required minlength="3" maxlength="60" placeholder="For example: Monthly donor report"></div>' +
        '<div class="qf-tpl-two">' +
          '<div class="qf-tpl-fld"><label for="c-cat">Category</label><select id="c-cat" name="cat">' + CATS.map(function (c) { return '<option>' + esc(c[0]) + '</option>'; }).join('') + '</select></div>' +
          '<div class="qf-tpl-fld"><label for="c-type">Board type</label><select id="c-type" name="type">' + FIX.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
        '</div>' +
        '<div class="qf-tpl-fld"><label>Preview layout</label><div class="qf-tpl-layouts">' +
          Object.keys(KINDNAMES).slice(0, 12).map(function (k, i) {
            return '<label><input type="radio" name="kind" value="' + k + '" ' + (i === 0 ? 'checked' : '') + '>' + KIND[k]('#2563eb') + esc(KINDNAMES[k]) + '</label>';
          }).join('') +
        '</div></div>' +
        '<div class="qf-tpl-fld"><label for="c-desc">Description</label><textarea id="c-desc" name="desc" required minlength="6" placeholder="What is this template for?"></textarea></div>' +
        '<div class="qf-tpl-mfoot"><button type="button" class="qf-tpl-btn" data-tpl-act="close">Cancel</button><button class="qf-tpl-btn primary" type="submit">Save template</button></div>' +
      '</form>';

    overlay.classList.add('show');

    // Populate optional existing-board picker from the user's real QuantalFlow boards
    fetch('/api/boards', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !Array.isArray(data.boards) || !data.boards.length) return;
        var wrapEl = document.getElementById('qf-tpl-board-picker-wrap');
        var sel = document.getElementById('c-source-board');
        if (!wrapEl || !sel) return;
        var boardMap = {};
        data.boards.forEach(function (b) {
          if (!b || !b.id) return;
          boardMap[b.id] = b;
          var opt = document.createElement('option');
          opt.value = b.id;
          opt.textContent = b.title || b.id;
          sel.appendChild(opt);
        });
        wrapEl.hidden = false;
        sel.addEventListener('change', function () {
          var chosen = boardMap[sel.value];
          if (!chosen) return;
          var nameInput = document.getElementById('c-name');
          var descInput = document.getElementById('c-desc');
          var typeSelect = document.getElementById('c-type');
          if (nameInput && !nameInput.value.trim()) nameInput.value = chosen.title + ' Template';
          if (descInput && !descInput.value.trim()) descInput.value = 'Reusable workspace template created from "' + chosen.title + '".';
          var modMap = {
            'project-planning': 'Project plan',
            'mindmap': 'Mind map',
            'kanban': 'Kanban',
            'perspective': 'Perspective',
            'brainstorm': 'Brainstorm',
            'whiteboard': 'Whiteboard'
          };
          if (typeSelect && chosen.activeModule && modMap[chosen.activeModule]) {
            typeSelect.value = modMap[chosen.activeModule];
          }
        });
      })
      .catch(function () {});

    var form = document.getElementById('qf-tpl-cform');
    if (form) {
      form.onsubmit = function (e) {
        e.preventDefault();
        var fd = new FormData(form);
        var name = String(fd.get('name') || '').trim();
        var cat = String(fd.get('cat') || CATS[0][0]);
        var type = String(fd.get('type') || 'Whiteboard');
        var kind = String(fd.get('kind') || 'flow');
        var desc = String(fd.get('desc') || '').trim();
        var sourceBoardId = String((document.getElementById('c-source-board') || {}).value || '');
        if (!name || !desc) return;
        st.mine.unshift({
          id: 'mine-' + Date.now().toString(36),
          title: name,
          cat: cat,
          type: type,
          kind: kind,
          color: '#2563eb',
          uses: 0,
          pro: false,
          isNew: true,
          desc: desc,
          author: (window.__qfUser && window.__qfUser.name) ? window.__qfUser.name : 'You',
          sourceBoardId: sourceBoardId || '',
          order: -1
        });
        saveState();
        closeModal();
        ui.tab = 'mine';
        render();
        toast('Template saved to My templates');
      };
    }
    var nameEl = document.getElementById('c-name');
    if (nameEl) nameEl.focus();
  }

  /* ---------- Unified QuantalFlow Launcher (`window.openBoardFromTemplate`) ---------- */
  function stashLocalTemplateBundle(boardKey, title, mod, boardState, wbState, plan) {
    try {
      sessionStorage.setItem('qf_pending_tpl_' + boardKey, JSON.stringify({
        title: title,
        module: mod,
        boardState: boardState,
        whiteboardState: wbState || null,
        plan: plan || null
      }));
    } catch (e) {}
    try {
      if (wbState) {
        localStorage.setItem('quantalflow_wb_v1_' + boardKey, JSON.stringify(wbState));
      }
      if (plan) {
        localStorage.setItem('quantalflow_pp_state_v2_' + boardKey, JSON.stringify(plan));
      }
    } catch (e) {}
  }

  async function launchDocumentTemplate(t) {
    var DOC_KEY = 'qf_documents_v1';
    var docs = [];
    try { docs = JSON.parse(localStorage.getItem(DOC_KEY) || '[]') || []; } catch (e) { docs = []; }
    var now = Date.now();
    var bundle = (window.QFTemplateBlueprints && typeof window.QFTemplateBlueprints.buildWorkspaceBundle === 'function')
      ? window.QFTemplateBlueprints.buildWorkspaceBundle(t)
      : null;
    var html = bundle && bundle.docHtml
      ? bundle.docHtml
      : ('<h1>' + esc(t.title) + '</h1><p>' + esc(t.desc) + '</p>');
    var docType = (bundle && bundle.docType) ? bundle.docType : 'Report';
    var newDoc = {
      id: 'doc-' + now.toString(36),
      title: t.title,
      type: docType,
      source: 'Templates Library',
      items: [t.cat],
      status: 'Draft',
      html: html,
      updated: now,
      versions: [{ at: now, note: 'Created from template: ' + t.title, html: html }]
    };
    docs.unshift(newDoc);
    try {
      localStorage.setItem(DOC_KEY, JSON.stringify(docs));
      sessionStorage.setItem('qf_open_doc_id', newDoc.id);
    } catch (e) {}

    try {
      var osRes = await fetch('/api/os', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: { documents: docs } })
      });
      if (osRes.status === 401) {
        window.location.href = '/login/?next=' + encodeURIComponent('/dashboard/documents/?doc=' + newDoc.id);
        return;
      }
    } catch (e) {}

    var targetUrl = '/dashboard/documents/?doc=' + encodeURIComponent(newDoc.id);
    if (window.QuantalFlowRouter && typeof window.QuantalFlowRouter.navigate === 'function') {
      var handled = await window.QuantalFlowRouter.navigate(targetUrl, { push: true });
      if (handled) return;
    }
    window.location.href = targetUrl;
  }

  async function openBoardFromTemplate(t) {
    if (!t || launching) return;
    launching = true;
    toast('Creating "' + t.title + '"…');

    try {
      if (t.type === 'Document') {
        await launchDocumentTemplate(t);
        return;
      }

      // If this custom template was saved from an existing workspace board, clone its state
      var clonedState = null;
      if (t.sourceBoardId) {
        try {
          var srcRes = await fetch('/api/boards/' + encodeURIComponent(t.sourceBoardId), { credentials: 'same-origin' });
          if (srcRes.ok) {
            var srcJson = await srcRes.json();
            if (srcJson && srcJson.board && srcJson.board.state && typeof srcJson.board.state === 'object') {
              clonedState = srcJson.board.state;
            }
          }
        } catch (e) {}
      }

      var bundle = window.QFTemplateBlueprints.buildWorkspaceBundle(t);
      var mod = (clonedState && clonedState.activeModule) ? clonedState.activeModule : bundle.module;
      var payloadState = clonedState || bundle.boardState;
      var wbSnap = (clonedState && clonedState.modules && clonedState.modules.whiteboard && clonedState.modules.whiteboard.whiteboardState)
        ? clonedState.modules.whiteboard.whiteboardState
        : bundle.whiteboardState;
      var planSnap = bundle.plan;

      try {
        var res = await fetch('/api/boards', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: t.title,
            category: t.cat || 'Strategy & Planning',
            state: payloadState
          })
        });

        if (res.ok) {
          var data = await res.json();
          var boardId = data && data.board && data.board.id;
          if (boardId) {
            stashLocalTemplateBundle(boardId, t.title, mod, payloadState, wbSnap, planSnap);
            if (mod === 'project-planning' && planSnap) {
              try {
                await fetch('/api/projects/' + encodeURIComponent(boardId), {
                  method: 'PUT',
                  credentials: 'same-origin',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ plan: planSnap, stateVersion: 2 })
                });
              } catch (e) {}
            }
            window.location.href = '/app/?board=' + encodeURIComponent(boardId) +
              '&template=' + encodeURIComponent(mod) +
              '&module=' + encodeURIComponent(mod) +
              '&tpl=' + encodeURIComponent(t.id);
            return;
          }
        }
      } catch (e) {}

      // Anonymous / offline fallback -> cache exact compiled state locally & open directly on canvas
      var slug = String(t.id || 'template-board').replace(/[^a-z0-9-]+/gi, '-').toLowerCase() + '-' + Date.now().toString(36).slice(-4);
      stashLocalTemplateBundle(slug, t.title, mod, payloadState, wbSnap, planSnap);
      window.location.href = '/app/?board=' + encodeURIComponent(slug) +
        '&template=' + encodeURIComponent(mod) +
        '&module=' + encodeURIComponent(mod) +
        '&tpl=' + encodeURIComponent(t.id);
    } finally {
      launching = false;
    }
  }

  window.openBoardFromTemplate = openBoardFromTemplate;
  window.QFTemplatesCatalog = {
    byId: byId,
    all: ALL
  };

  function useTemplate(id) {
    var t = byId(id);
    if (!t) return;
    st.recent = [id].concat(st.recent.filter(function (x) { return x !== id; })).slice(0, 12);
    saveState();
    closeModal();
    render();
    openBoardFromTemplate(t);
  }

  async function deleteTemplate(id) {
    var t = byId(id);
    var confirmed = true;
    if (window.QFDialog && typeof window.QFDialog.confirm === 'function') {
      confirmed = await window.QFDialog.confirm({
        title: 'Delete "' + (t ? t.title : 'this template') + '"?',
        message: 'This custom template will be removed from My templates.',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        tone: 'danger'
      });
    } else {
      confirmed = window.confirm('Delete this template?');
    }
    if (!confirmed) return;
    st.mine = st.mine.filter(function (x) { return x.id !== id; });
    st.favs = st.favs.filter(function (x) { return x !== id; });
    st.recent = st.recent.filter(function (x) { return x !== id; });
    saveState();
    render();
    toast('Template deleted');
  }

  async function launchBlankStarter(fw, fallbackUrl) {
    if (fw === 'documents') {
      if (window.QuantalFlowRouter && typeof window.QuantalFlowRouter.navigate === 'function') {
        var ok = await window.QuantalFlowRouter.navigate('/dashboard/documents/', { push: true });
        if (ok) return;
      }
      window.location.href = '/dashboard/documents/';
      return;
    }
    if (fw === 'project-planning') {
      window.location.href = '/app/?board=project-planning-workspace&template=project-planning';
      return;
    }
    toast('Opening blank ' + fw + '…');
    var titles = {
      whiteboard: 'Untitled Whiteboard',
      mindmap: 'Untitled Mind Map',
      kanban: 'Untitled Kanban Board',
      perspective: 'Untitled Perspective Matrix',
      brainstorm: 'Untitled Brainstorm'
    };
    var blankTitle = titles[fw] || 'Untitled Board';
    var blankWb = (fw === 'whiteboard' && window.QFTemplateBlueprints)
      ? window.QFTemplateBlueprints.createBlankWhiteboardState(blankTitle)
      : null;
    var blankModules = {};
    if (fw === 'whiteboard' && blankWb) {
      blankModules.whiteboard = { version: 2, isBlank: true, items: [], connectors: [], paths: [], whiteboardState: blankWb };
    } else {
      blankModules[fw] = { version: 2, isBlank: true, items: [], connectors: [], paths: [] };
    }
    var blankState = {
      version: 2,
      isBlank: true,
      items: [],
      connectors: [],
      paths: [],
      modules: blankModules,
      enabledModules: [fw],
      workspaceMode: 'canvas',
      activeModule: fw
    };
    try {
      var res = await fetch('/api/boards', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: blankTitle,
          category: 'Strategy & Planning',
          state: blankState
        })
      });
      if (res.ok) {
        var data = await res.json();
        if (data && data.board && data.board.id) {
          stashLocalTemplateBundle(data.board.id, blankTitle, fw, blankState, blankWb, null);
          window.location.href = '/app/?board=' + encodeURIComponent(data.board.id) +
            '&template=blank&module=' + encodeURIComponent(fw);
          return;
        }
      }
    } catch (e) {}
    var blankSlug = 'blank-' + fw + '-' + Date.now().toString(36).slice(-4);
    stashLocalTemplateBundle(blankSlug, blankTitle, fw, blankState, blankWb, null);
    window.location.href = '/app/?board=' + encodeURIComponent(blankSlug) + '&template=blank&module=' + encodeURIComponent(fw);
  }

  /* ---------- Hydrate Shared `.dash-top` User Profile Pill ---------- */
  function hydrateTopUser() {
    var nameEl = document.getElementById('dash-profile-name');
    var initEl = document.getElementById('dash-initial');
    var mountEl = document.getElementById('clerk-user-mount');

    function applyUser(u) {
      if (!u) {
        if (nameEl) nameEl.textContent = 'Sign in';
        if (initEl) initEl.textContent = '→';
        if (mountEl) mountEl.setAttribute('href', '/login/?next=' + encodeURIComponent(window.location.pathname));
        return;
      }
      currentUserId = String(u.id || '');
      loadState();
      render();
      var displayName = (u.name && u.name.trim()) ? u.name.trim() : (u.email || 'Profile');
      var avatarUrl = u.avatar_url || u.avatarUrl || u.imageUrl || '';
      if (nameEl) nameEl.textContent = displayName;
      if (mountEl) mountEl.setAttribute('href', '/profile/');
      if (initEl) {
        if (avatarUrl) {
          initEl.textContent = '';
          var img = document.createElement('img');
          img.src = avatarUrl;
          img.alt = '';
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;';
          initEl.appendChild(img);
        } else {
          initEl.textContent = (displayName.charAt(0) || 'U').toUpperCase();
        }
      }
    }

    if (window.__qfUser) {
      applyUser(window.__qfUser);
      return;
    }

    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.user) {
          window.__qfUser = data.user;
          applyUser(data.user);
        } else {
          applyUser(null);
        }
      })
      .catch(function () {});
  }

  /* ---------- Event Delegation (Bound Once Globally) ---------- */
  function bindGlobalEvents() {
    if (eventsBound) return;
    eventsBound = true;

    var actions = {
      cat: function (el) { ui.cat = el.dataset.c || ''; ui.shown = 12; render(); },
      tab: function (el) { ui.tab = el.dataset.t || 'discover'; ui.shown = 12; render(); },
      more: function () { ui.shown += 24; render(); },
      fav: function (el) {
        var id = el.dataset.id;
        st.favs = st.favs.indexOf(id) !== -1 ? st.favs.filter(function (x) { return x !== id; }) : st.favs.concat([id]);
        saveState();
        render();
      },
      'fav-modal': function (el) {
        var id = el.dataset.id;
        st.favs = st.favs.indexOf(id) !== -1 ? st.favs.filter(function (x) { return x !== id; }) : st.favs.concat([id]);
        saveState();
        render();
        openPreview(id);
      },
      use: function (el) { useTemplate(el.dataset.id); },
      preview: function (el) { openPreview(el.dataset.id); },
      close: function () { closeModal(); },
      create: function () { openCreate(); },
      del: function (el) { deleteTemplate(el.dataset.id); },
      blank: function (el) { launchBlankStarter(el.dataset.fw, el.dataset.u); }
    };

    document.addEventListener('click', function (e) {
      if (!document.getElementById('tpl-gallery-app') && !e.target.closest('#qf-tpl-overlay')) return;
      if (e.target.closest('input,select,textarea,label')) return;
      var el = e.target.closest('[data-tpl-act]');
      if (!el) return;
      var inner = e.target.closest('button[data-tpl-act]');
      if (inner) el = inner;
      if (el.dataset.tplAct === 'preview' && e.target.closest('.qf-tpl-over') && !e.target.closest('button[data-tpl-act="preview"]')) return;
      var fn = actions[el.dataset.tplAct];
      if (fn) {
        e.stopPropagation();
        fn(el);
      }
    });

    document.addEventListener('change', function (e) {
      if (!document.getElementById('tpl-gallery-app')) return;
      var t = e.target;
      if (t.dataset && t.dataset.tplType) {
        if (t.checked) ui.types.add(t.dataset.tplType);
        else ui.types.delete(t.dataset.tplType);
        ui.shown = 12;
        render();
      }
      if (t.id === 'tpl-sort') {
        ui.sort = t.value;
        render();
      }
    });

    document.addEventListener('input', function (e) {
      if (!document.getElementById('tpl-gallery-app')) return;
      if (e.target && e.target.id === 'tpl-q') {
        ui.q = e.target.value;
        ui.shown = 12;
        if (ui.tab !== 'discover') ui.tab = 'discover';
        render();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (!document.getElementById('tpl-gallery-app') && !document.getElementById('qf-tpl-overlay')) return;
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Enter' && e.target && e.target.id === 'dash-search-input' && document.getElementById('tpl-q')) {
        var qBox = document.getElementById('tpl-q');
        qBox.value = e.target.value;
        ui.q = e.target.value;
        ui.shown = 12;
        ui.tab = 'discover';
        render();
      }
      if (e.key === 'Enter' && e.target && e.target.matches && e.target.matches('h5[data-tpl-act], .qf-tpl-sgrid [data-tpl-act]')) {
        openPreview(e.target.dataset.id);
      }
    });
  }

  /* ---------- Public Initializer (Direct Load & SPA Swap) ---------- */
  function initTemplatesGallery() {
    var root = document.getElementById('tpl-gallery-app');
    if (!root) return;
    ensurePortals();
    loadState();
    bindGlobalEvents();

    // Support `?q=...` or `?cat=...` deep links
    try {
      var params = new URLSearchParams(window.location.search || '');
      if (params.get('q')) {
        ui.q = params.get('q');
        var qInput = document.getElementById('tpl-q');
        if (qInput) qInput.value = ui.q;
      }
      if (params.get('cat')) ui.cat = params.get('cat');
    } catch (e) {}

    render();
    hydrateTopUser();
  }

  window.initTemplatesGallery = initTemplatesGallery;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTemplatesGallery);
  } else {
    initTemplatesGallery();
  }
})();
