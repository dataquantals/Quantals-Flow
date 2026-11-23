/* ==========================================================================
   QuantalFlow Zero-Dependency Executive Document Exporter
   Generates genuine OpenXML (.pptx, .docx), standalone HTML, and Markdown.
   Uses only Node built-ins (node:zlib, node:buffer).
   ========================================================================== */
import zlib from 'node:zlib';

/* ---------- Minimal Standards-Compliant ZIP Writer ---------- */
const CRC_TABLE = (() => {
  const tbl = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    tbl[n] = c >>> 0;
  }
  return tbl;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const rawBuf = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8');
    const compBuf = zlib.deflateRawSync(rawBuf, { level: 6 });
    const crc = crc32(rawBuf);

    // Local file header (30 bytes + filename)
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);        // version needed
    lh.writeUInt16LE(0x0800, 6);    // UTF-8 flag
    lh.writeUInt16LE(8, 8);         // deflate
    lh.writeUInt16LE(0, 10);        // mod time
    lh.writeUInt16LE(0x5421, 12);   // mod date
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(compBuf.length, 18);
    lh.writeUInt32LE(rawBuf.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);

    localParts.push(lh, nameBuf, compBuf);

    // Central directory header (46 bytes + filename)
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);        // version made by
    cd.writeUInt16LE(20, 6);        // version needed
    cd.writeUInt16LE(0x0800, 8);    // UTF-8 flag
    cd.writeUInt16LE(8, 10);        // deflate
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0x5421, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(compBuf.length, 20);
    cd.writeUInt32LE(rawBuf.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);

    centralParts.push(cd, nameBuf);
    offset += lh.length + nameBuf.length + compBuf.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuf, eocd]);
}

function xmlEsc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripTags(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/** Parse either structured sections[] or editor HTML into normalized sections. */
export function normalizeDocumentPayload(raw = {}) {
  const title = String(raw.title || 'Untitled Document').trim();
  const type = String(raw.type || 'Executive Brief').trim();
  const source = String(raw.source || 'QuantalFlow').trim();
  const audience = String(raw.audience || 'Executive team').trim();
  const status = String(raw.status || 'Draft').trim();
  const dateStr = raw.updated
    ? new Date(raw.updated).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  let sections = [];
  if (Array.isArray(raw.sections) && raw.sections.length) {
    sections = raw.sections.map((s, idx) => ({
      heading: String(s.heading || `Section ${idx + 1}`).trim(),
      kicker: String(s.kicker || `SECTION ${String(idx + 1).padStart(2, '0')}`).trim(),
      paragraphs: Array.isArray(s.paragraphs) ? s.paragraphs.map((p) => String(p).trim()).filter(Boolean) : [],
      bullets: Array.isArray(s.bullets) ? s.bullets.map((b) => String(b).trim()).filter(Boolean) : [],
      speakerNotes: String(s.speakerNotes || '').trim()
    }));
  } else if (raw.html) {
    const cleaned = String(raw.html).replace(/<div class="dg-doc-meta"[\s\S]*?<\/div>/gi, '');
    const blocks = cleaned.split(/(?=<h2\b[^>]*>)/i).filter((b) => b.trim());
    blocks.forEach((blk, idx) => {
      const hMatch = blk.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
      const heading = hMatch ? stripTags(hMatch[1]) : `Section ${idx + 1}`;
      const rest = hMatch ? blk.slice(blk.indexOf(hMatch[0]) + hMatch[0].length) : blk;
      const paragraphs = [];
      const bullets = [];
      const pMatches = rest.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [];
      pMatches.forEach((m) => {
        const txt = stripTags(m);
        if (txt) paragraphs.push(txt);
      });
      const liMatches = rest.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) || [];
      liMatches.forEach((m) => {
        const txt = stripTags(m);
        if (txt) bullets.push(txt);
      });
      if (!paragraphs.length && !bullets.length) {
        const fallbackTxt = stripTags(rest);
        if (fallbackTxt) paragraphs.push(fallbackTxt);
      }
      sections.push({
        heading,
        kicker: `SECTION ${String(idx + 1).padStart(2, '0')}`,
        paragraphs,
        bullets,
        speakerNotes: `Present key points for ${heading} tailored to ${audience}.`
      });
    });
  }

  if (!sections.length) {
    sections = [{
      heading: 'Executive Summary',
      kicker: 'SECTION 01',
      paragraphs: [`Overview of ${title} prepared for ${audience}.`],
      bullets: ['Key objectives and deliverables', 'Timeline and ownership', 'Next steps and sign-off'],
      speakerNotes: `Introduce ${title} and align stakeholders on core objectives.`
    }];
  }

  return { title, type, source, audience, status, dateStr, sections };
}

/* ==========================================================================
   1. TOP-STANDARD EXECUTIVE PPTX GENERATOR (16:9 Widescreen OpenXML)
   ========================================================================== */
function rectShape(id, name, x, y, cx, cy, fillHex, borderHex = null, round = false) {
  const geom = round ? 'roundRect' : 'rect';
  const avLst = round ? '<a:avLst><a:gd name="adj" fmla="val 6500"/></a:avLst>' : '<a:avLst/>';
  const fill = fillHex ? `<a:solidFill><a:srgbClr val="${fillHex}"/></a:solidFill>` : '<a:noFill/>';
  const line = borderHex
    ? `<a:ln w="12700"><a:solidFill><a:srgbClr val="${borderHex}"/></a:solidFill></a:ln>`
    : '<a:ln><a:noFill/></a:ln>';
  return `<p:sp>
    <p:nvSpPr><p:cNvPr id="${id}" name="${xmlEsc(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
    <p:spPr>
      <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
      <a:prstGeom prst="${geom}">${avLst}</a:prstGeom>
      ${fill}
      ${line}
    </p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>
  </p:sp>`;
}

function textBox(id, name, x, y, cx, cy, paragraphsXml, anchor = 't') {
  return `<p:sp>
    <p:nvSpPr><p:cNvPr id="${id}" name="${xmlEsc(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
    <p:spPr>
      <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      <a:noFill/>
    </p:spPr>
    <p:txBody>
      <a:bodyPr wrap="square" lIns="72000" tIns="45000" rIns="72000" bIns="45000" anchor="${anchor}"/>
      <a:lstStyle/>
      ${paragraphsXml}
    </p:txBody>
  </p:sp>`;
}

function pRun(text, opts = {}) {
  const sz = Math.round((opts.size || 14) * 100);
  const b = opts.bold ? ' b="1"' : '';
  const color = opts.color || '111827';
  const align = opts.align || 'l';
  const spcAft = opts.spaceAfter != null ? opts.spaceAfter : 800;
  const bullet = opts.bullet ? '<a:buClr><a:srgbClr val="2563EB"/></a:buClr><a:buChar char="&#8226;"/>' : '<a:buNone/>';
  const marL = opts.bullet ? ' marL="228600" indent="-228600"' : '';
  return `<a:p>
    <a:pPr algn="${align}"${marL}><a:lnSpc><a:spcPct val="120000"/></a:lnSpc><a:spcAft><a:spcPts val="${spcAft}"/></a:spcAft>${bullet}</a:pPr>
    <a:r><a:rPr lang="en-US" sz="${sz}"${b} dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${xmlEsc(text)}</a:t></a:r>
  </a:p>`;
}

function wrapSlideXml(bgHex, shapesXml) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="${bgHex}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      ${shapesXml}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function buildNotesSlideXml(notesText) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
        <p:spPr/>
        <p:txBody><a:bodyPr/><a:lstStyle/>${pRun(notesText || 'QuantalFlow executive presentation slide.', { size: 12, color: '111827' })}</p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:notes>`;
}

export function buildPptxBuffer(rawDoc) {
  const doc = normalizeDocumentPayload(rawDoc);
  const slides = [];
  const totalSlides = doc.sections.length + 3; // Title + Agenda + Sections + Closing

  // Slide 1: Executive Cover Slide (Deep Navy #0C1630 + Electric Blue Accent)
  slides.push({
    notes: `Welcome the ${doc.audience} to ${doc.title}. Generated from QuantalFlow ${doc.source}.`,
    xml: wrapSlideXml('0C1630', [
      rectShape(2, 'LeftAccent', 0, 0, 140000, 6858000, '2563EB'),
      rectShape(3, 'TopBadge', 720000, 1250000, 3200000, 360000, '162243', '2563EB', true),
      textBox(4, 'Kicker', 760000, 1270000, 3100000, 320000, pRun(`QUANTALFLOW  •  ${doc.type.toUpperCase()}`, { size: 11, bold: true, color: '93C5FD', spaceAfter: 0 }), 'ctr'),
      textBox(5, 'HeroTitle', 720000, 1850000, 10500000, 1900000, pRun(doc.title, { size: 38, bold: true, color: 'FFFFFF', spaceAfter: 400 })),
      textBox(6, 'HeroSub', 720000, 3850000, 9600000, 900000, pRun(`Prepared for ${doc.audience}  •  Source: ${doc.source}`, { size: 16, color: 'CBD5E1', spaceAfter: 200 })),
      rectShape(7, 'FooterRule', 720000, 5650000, 10750000, 18000, '243357'),
      textBox(8, 'FooterMeta', 720000, 5820000, 7000000, 420000, pRun(`Status: ${doc.status}   |   ${doc.dateStr}`, { size: 12, color: '94A3B8', spaceAfter: 0 })),
      textBox(9, 'BrandRight', 8600000, 5820000, 2870000, 420000, pRun('QuantalFlow OS', { size: 12, bold: true, color: '60A5FA', align: 'r', spaceAfter: 0 }))
    ].join('\n'))
  });

  // Slide 2: Executive Agenda / Overview Slide
  const agendaCards = [];
  let sid = 10;
  doc.sections.slice(0, 6).forEach((sec, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 680000 + col * 5550000;
    const y = 1750000 + row * 1450000;
    agendaCards.push(
      rectShape(sid++, `AgCard${idx}`, x, y, 5250000, 1220000, 'FFFFFF', 'DDE2EC', true),
      rectShape(sid++, `AgNumBg${idx}`, x + 220000, y + 320000, 520000, 520000, 'EAF0FF', null, true),
      textBox(sid++, `AgNum${idx}`, x + 220000, y + 340000, 520000, 480000, pRun(String(idx + 1).padStart(2, '0'), { size: 15, bold: true, color: '2563EB', align: 'ctr', spaceAfter: 0 }), 'ctr'),
      textBox(sid++, `AgTxt${idx}`, x + 880000, y + 250000, 4150000, 760000, pRun(sec.heading, { size: 15, bold: true, color: '111827', spaceAfter: 0 }), 'ctr')
    );
  });

  slides.push({
    notes: `Walk through the ${doc.sections.length} sections of this ${doc.type}.`,
    xml: wrapSlideXml('FAF9F6', [
      rectShape(2, 'TopRule', 0, 0, 12192000, 95000, '2563EB'),
      textBox(3, 'Kicker', 680000, 380000, 6000000, 320000, pRun('EXECUTIVE AGENDA', { size: 11, bold: true, color: '2563EB', spaceAfter: 0 })),
      textBox(4, 'Title', 680000, 700000, 9500000, 680000, pRun('Key Sections & Discussion Roadmap', { size: 26, bold: true, color: '111827', spaceAfter: 0 })),
      ...agendaCards,
      textBox(90, 'FootL', 680000, 6320000, 7000000, 320000, pRun(`QuantalFlow  •  ${doc.title}`, { size: 10.5, color: '6B7280', spaceAfter: 0 })),
      textBox(91, 'FootR', 9800000, 6320000, 1700000, 320000, pRun(`02 / ${String(totalSlides).padStart(2, '0')}`, { size: 10.5, bold: true, color: '4B5563', align: 'r', spaceAfter: 0 }))
    ].join('\n'))
  });

  // Content Slides (Alternating Layout A: Narrative + Blue Callout / Layout B: Two-Column Cards)
  doc.sections.forEach((sec, idx) => {
    const slideNum = idx + 3;
    const numLabel = `${String(slideNum).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}`;
    const paras = sec.paragraphs.length ? sec.paragraphs : [`Key analysis and strategic context for ${sec.heading}.`];
    const bullets = sec.bullets.length ? sec.bullets : [
      `Core priority aligned with ${doc.audience}`,
      `Grounded in QuantalFlow ${doc.source}`,
      'Measurable owner and next-quarter checkpoint'
    ];

    const leftBodyXml = paras.slice(0, 3).map((p) => pRun(p, { size: 14, color: '1F2937', spaceAfter: 1100 })).join('');
    const rightBulletsXml = [
      pRun('KEY TAKEAWAYS', { size: 11, bold: true, color: '2563EB', spaceAfter: 900 }),
      ...bullets.slice(0, 5).map((b) => pRun(b, { size: 13.5, color: '111827', bullet: true, spaceAfter: 800 }))
    ].join('');

    const isLayoutA = idx % 2 === 0;
    const bodyShapes = isLayoutA
      ? [
          rectShape(10, 'LeftCard', 680000, 1680000, 6200000, 4300000, 'FFFFFF', 'DDE2EC', true),
          textBox(11, 'LeftTxt', 900000, 1920000, 5760000, 3850000, leftBodyXml),
          rectShape(12, 'RightCallout', 7160000, 1680000, 4350000, 4300000, 'EAF0FF', 'C7D7FE', true),
          rectShape(13, 'RightStripe', 7160000, 1680000, 95000, 4300000, '2563EB'),
          textBox(14, 'RightTxt', 7440000, 1920000, 3850000, 3850000, rightBulletsXml)
        ]
      : [
          rectShape(10, 'Col1', 680000, 1680000, 5260000, 4300000, 'FFFFFF', 'DDE2EC', true),
          rectShape(11, 'Col1Top', 680000, 1680000, 5260000, 85000, '0C1630'),
          textBox(12, 'Col1Txt', 900000, 1960000, 4820000, 3800000, pRun('STRATEGIC CONTEXT', { size: 11, bold: true, color: '0C1630', spaceAfter: 900 }) + leftBodyXml),
          rectShape(13, 'Col2', 6240000, 1680000, 5270000, 4300000, 'FFFFFF', 'DDE2EC', true),
          rectShape(14, 'Col2Top', 6240000, 1680000, 5270000, 85000, '2563EB'),
          textBox(15, 'Col2Txt', 6460000, 1960000, 4830000, 3800000, rightBulletsXml)
        ];

    slides.push({
      notes: sec.speakerNotes || `Discuss ${sec.heading}: ${paras[0] || ''}`,
      xml: wrapSlideXml('FAF9F6', [
        rectShape(2, 'TopRule', 0, 0, 12192000, 95000, '2563EB'),
        textBox(3, 'Kicker', 680000, 380000, 6000000, 300000, pRun((sec.kicker || `SECTION ${String(idx + 1).padStart(2, '0')}`).toUpperCase(), { size: 11, bold: true, color: '2563EB', spaceAfter: 0 })),
        textBox(4, 'Title', 680000, 690000, 10800000, 720000, pRun(sec.heading, { size: 25, bold: true, color: '111827', spaceAfter: 0 })),
        ...bodyShapes,
        textBox(90, 'FootL', 680000, 6320000, 7500000, 320000, pRun(`QuantalFlow  •  ${doc.title}`, { size: 10.5, color: '6B7280', spaceAfter: 0 })),
        textBox(91, 'FootR', 9800000, 6320000, 1700000, 320000, pRun(numLabel, { size: 10.5, bold: true, color: '4B5563', align: 'r', spaceAfter: 0 }))
      ].join('\n'))
    });
  });

  // Final Slide: Closing & Next Steps (Deep Navy #0C1630)
  const closingBullets = [
    `Review and approve ${doc.title} (${doc.status}) with ${doc.audience}`,
    `Publish approved deliverable to the QuantalFlow Knowledge Hub`,
    `Assign execution owners and track milestones in Project Planning`
  ];
  slides.push({
    notes: `Confirm alignment on next steps and approval workflow for ${doc.title}.`,
    xml: wrapSlideXml('0C1630', [
      rectShape(2, 'LeftAccent', 0, 0, 140000, 6858000, '2563EB'),
      textBox(3, 'Kicker', 720000, 1100000, 6000000, 320000, pRun('ALIGNMENT & SIGN-OFF', { size: 11, bold: true, color: '93C5FD', spaceAfter: 0 })),
      textBox(4, 'Title', 720000, 1500000, 10000000, 820000, pRun('Next Steps & Approval', { size: 32, bold: true, color: 'FFFFFF', spaceAfter: 0 })),
      rectShape(5, 'Card', 720000, 2550000, 10750000, 2650000, '162243', '243357', true),
      textBox(6, 'Bullets', 1020000, 2850000, 10100000, 2100000, closingBullets.map((b) => pRun(b, { size: 16, color: 'F1F5F9', bullet: true, spaceAfter: 1200 })).join('')),
      textBox(7, 'Foot', 720000, 5880000, 8000000, 400000, pRun(`QuantalFlow Intelligent Document Factory  •  ${doc.dateStr}`, { size: 12, color: '94A3B8', spaceAfter: 0 })),
      textBox(8, 'Num', 9800000, 5880000, 1670000, 400000, pRun(`${String(totalSlides).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}`, { size: 12, bold: true, color: '93C5FD', align: 'r', spaceAfter: 0 }))
    ].join('\n'))
  });

  // Assemble OOXML PPTX entries
  const entries = [];
  const slideOverrides = [];
  const presRels = [
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>'
  ];
  const sldIdLst = [];

  slides.forEach((s, i) => {
    const n = i + 1;
    const rId = `rId${n + 1}`;
    entries.push({ name: `ppt/slides/slide${n}.xml`, data: s.xml });
    entries.push({
      name: `ppt/slides/_rels/slide${n}.xml.rels`,
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${n}.xml"/>
</Relationships>`
    });
    entries.push({ name: `ppt/notesSlides/notesSlide${n}.xml`, data: buildNotesSlideXml(s.notes) });
    entries.push({
      name: `ppt/notesSlides/_rels/notesSlide${n}.xml.rels`,
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${n}.xml"/>
</Relationships>`
    });
    slideOverrides.push(`<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`);
    slideOverrides.push(`<Override PartName="/ppt/notesSlides/notesSlide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`);
    presRels.push(`<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${n}.xml"/>`);
    sldIdLst.push(`<p:sldId id="${256 + i}" r:id="${rId}"/>`);
  });

  entries.push({
    name: '[Content_Types].xml',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slideOverrides.join('\n  ')}
</Types>`
  });

  entries.push({
    name: '_rels/.rels',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  });

  entries.push({
    name: 'ppt/presentation.xml',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>${sldIdLst.join('')}</p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`
  });

  entries.push({
    name: 'ppt/_rels/presentation.xml.rels',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${presRels.join('\n  ')}
</Relationships>`
  });

  entries.push({
    name: 'ppt/slideMasters/slideMaster1.xml',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`
  });

  entries.push({
    name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`
  });

  entries.push({
    name: 'ppt/slideLayouts/slideLayout1.xml',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
</p:sldLayout>`
  });

  entries.push({
    name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`
  });

  entries.push({
    name: 'ppt/theme/theme1.xml',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="QuantalFlow Executive">
  <a:themeElements>
    <a:clrScheme name="QuantalFlow">
      <a:dk1><a:srgbClr val="111827"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="0C1630"/></a:dk2><a:lt2><a:srgbClr val="FAF9F6"/></a:lt2>
      <a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="16A34A"/></a:accent2>
      <a:accent3><a:srgbClr val="D97706"/></a:accent3><a:accent4><a:srgbClr val="6366F1"/></a:accent4>
      <a:accent5><a:srgbClr val="0E7490"/></a:accent5><a:accent6><a:srgbClr val="475569"/></a:accent6>
      <a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="1D4ED8"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="QuantalFlow">
      <a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="QuantalFlow">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="28575"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`
  });

  return buildZip(entries);
}

/* ==========================================================================
   2. GENUINE OPENXML DOCX GENERATOR (WordprocessingML)
   ========================================================================== */
function wPara(text, opts = {}) {
  const bold = opts.bold ? '<w:b/>' : '';
  const color = opts.color ? `<w:color w:val="${opts.color}"/>` : '<w:color w:val="1F2937"/>';
  const sz = Math.round((opts.size || 11) * 2);
  const before = opts.before != null ? opts.before : 60;
  const after = opts.after != null ? opts.after : 140;
  const border = opts.bottomBorder
    ? `<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="8" w:color="${opts.bottomBorder}"/></w:pBdr>`
    : '';
  const indent = opts.bullet ? '<w:ind w:left="420" w:hanging="220"/>' : '';
  const prefix = opts.bullet ? '•  ' : '';
  return `<w:p>
    <w:pPr>${border}<w:spacing w:before="${before}" w:after="${after}" w:line="276" w:lineRule="auto"/>${indent}</w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>${bold}${color}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${xmlEsc(prefix + text)}</w:t></w:r>
  </w:p>`;
}

export function buildDocxBuffer(rawDoc) {
  const doc = normalizeDocumentPayload(rawDoc);
  const body = [
    wPara(`QUANTALFLOW  •  ${doc.type.toUpperCase()}`, { size: 9.5, bold: true, color: '2563EB', before: 0, after: 80 }),
    wPara(doc.title, { size: 22, bold: true, color: '0C1630', before: 0, after: 140, bottomBorder: '2563EB' }),
    wPara(`Audience: ${doc.audience}   |   Source: ${doc.source}   |   Status: ${doc.status}   |   Updated: ${doc.dateStr}`, { size: 9.5, color: '6B7280', before: 80, after: 280 })
  ];

  for (const sec of doc.sections) {
    body.push(wPara(sec.heading, { size: 14, bold: true, color: '0C1630', before: 240, after: 100 }));
    for (const p of sec.paragraphs) {
      body.push(wPara(p, { size: 11, color: '1F2937', before: 40, after: 140 }));
    }
    for (const b of sec.bullets) {
      body.push(wPara(b, { size: 11, color: '1F2937', bullet: true, before: 20, after: 80 }));
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body.join('\n    ')}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;

  return buildZip([
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    },
    { name: 'word/document.xml', data: documentXml }
  ]);
}

/* ==========================================================================
   3. PUBLICATION-GRADE STANDALONE HTML & GITHUB-FLAVORED MARKDOWN
   ========================================================================== */
export function buildHtmlDocument(rawDoc) {
  const doc = normalizeDocumentPayload(rawDoc);
  const secs = doc.sections.map((s) => `
    <section>
      <h2>${xmlEsc(s.heading)}</h2>
      ${s.paragraphs.map((p) => `<p>${xmlEsc(p)}</p>`).join('\n      ')}
      ${s.bullets.length ? `<ul>${s.bullets.map((b) => `<li>${xmlEsc(b)}</li>`).join('')}</ul>` : ''}
    </section>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${xmlEsc(doc.title)}</title>
<style>
  body { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; background: #faf9f6; margin: 0; padding: 40px 20px; line-height: 1.65; }
  article { max-width: 780px; margin: 0 auto; background: #fff; border: 1px solid #e6e8ee; border-radius: 16px; padding: 48px 52px; }
  .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #2563eb; margin-bottom: 8px; }
  h1 { font-size: 28px; color: #0c1630; margin: 0 0 12px; line-height: 1.2; border-bottom: 2px solid #2563eb; padding-bottom: 14px; }
  .meta { font-size: 12.5px; color: #525866; margin-bottom: 28px; }
  h2 { font-size: 17px; color: #0c1630; margin: 28px 0 8px; }
  p { margin: 0 0 12px; color: #1f2937; }
  ul { margin: 0 0 14px 20px; padding: 0; }
  li { margin-bottom: 6px; }
  @media print { body { background: #fff; padding: 0; } article { border: 0; padding: 0; } }
</style>
</head>
<body>
  <article>
    <div class="eyebrow">QuantalFlow &bull; ${xmlEsc(doc.type)}</div>
    <h1>${xmlEsc(doc.title)}</h1>
    <div class="meta">Audience: ${xmlEsc(doc.audience)} &middot; Source: ${xmlEsc(doc.source)} &middot; Status: ${xmlEsc(doc.status)} &middot; Updated: ${xmlEsc(doc.dateStr)}</div>
    ${secs}
  </article>
</body>
</html>`;
}

export function buildMarkdownDocument(rawDoc) {
  const doc = normalizeDocumentPayload(rawDoc);
  const lines = [
    '---',
    `title: "${doc.title.replace(/"/g, '\\"')}"`,
    `type: "${doc.type}"`,
    `audience: "${doc.audience}"`,
    `source: "${doc.source}"`,
    `status: "${doc.status}"`,
    `updated: "${doc.dateStr}"`,
    '---',
    '',
    `# ${doc.title}`,
    ''
  ];
  for (const s of doc.sections) {
    lines.push(`## ${s.heading}`, '');
    for (const p of s.paragraphs) lines.push(p, '');
    if (s.bullets.length) {
      for (const b of s.bullets) lines.push(`- ${b}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}
