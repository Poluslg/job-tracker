import { zipSync, strToU8 } from 'fflate';

export type DocBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string; bold?: boolean }
  | { type: 'bullet'; text: string }
  | { type: 'spacer' };

export const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function runs(text: string, bold: boolean): string {
  const inner = esc(text)
    .split('\n')
    .map((line, i) => `${i > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${line}</w:t>`)
    .join('');
  return `<w:r><w:rPr>${bold ? '<w:b/>' : ''}</w:rPr>${inner}</w:r>`;
}

function block(b: DocBlock): string {
  switch (b.type) {
    case 'heading': {
      const size = { 1: 32, 2: 26, 3: 22 }[b.level];
      return `<w:p><w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="${size}"/><w:color w:val="111827"/></w:rPr><w:t xml:space="preserve">${esc(b.text)}</w:t></w:r></w:p>`;
    }
    case 'bullet':
      return `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="60"/></w:pPr>${runs(b.text, false)}</w:p>`;
    case 'spacer':
      return '<w:p/>';
    case 'paragraph':
      return `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr>${runs(b.text, b.bold ?? false)}</w:p>`;
  }
}

export function buildDocx(blocks: DocBlock[]): Uint8Array {
  const body = blocks.map(block).join('');

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body>
</w:document>`;

  const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
</w:styles>`;

  return zipSync(
    {
      '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`),
      '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`),
      'word/_rels/document.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
      'word/document.xml': strToU8(document),
      'word/numbering.xml': strToU8(numbering),
      'word/styles.xml': strToU8(stylesXml),
    },
    { level: 6 },
  );
}

export function resumeTextToBlocks(text: string): DocBlock[] {
  const blocks: DocBlock[] = [];
  const lines = text.split('\n');
  const SECTION = /^[A-Z][A-Z\s&/]{2,30}$/;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) {
      blocks.push({ type: 'spacer' });
      return;
    }
    if (i === 0) {
      blocks.push({ type: 'heading', level: 1, text: line });
      return;
    }
    if (SECTION.test(line)) {
      blocks.push({ type: 'heading', level: 2, text: line });
      return;
    }
    if (/^[•·*-]\s+/.test(line)) {
      blocks.push({ type: 'bullet', text: line.replace(/^[•·*-]\s+/, '') });
      return;
    }
    blocks.push({ type: 'paragraph', text: line });
  });

  return blocks;
}
