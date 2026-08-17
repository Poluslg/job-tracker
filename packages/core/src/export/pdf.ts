export const PDF_MIME_TYPE = "application/pdf";

export interface PdfTextStyle {
  size: number;
  bold: boolean;
  spaceAfter: number;
}

export type PdfBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullet"; text: string }
  | { type: "spacer" };

const PAGE = { width: 612, height: 792, margin: 54 };
const LINE_GAP = 1.35;

const STYLES: Record<string, PdfTextStyle> = {
  h1: { size: 18, bold: true, spaceAfter: 8 },
  h2: { size: 12, bold: true, spaceAfter: 5 },
  h3: { size: 11, bold: true, spaceAfter: 4 },
  body: { size: 10, bold: false, spaceAfter: 4 },
};

const WIDTHS_REGULAR: Record<string, number> = { default: 500 };
function charWidth(ch: string, bold: boolean): number {
  const code = ch.charCodeAt(0);

  if ("iljft.,:;'|()[]! ".includes(ch)) return bold ? 300 : 270;
  if ("mwMW@".includes(ch)) return bold ? 900 : 830;
  if (code >= 65 && code <= 90) return bold ? 700 : 660;
  if (code >= 48 && code <= 57) return 556;
  return WIDTHS_REGULAR["default"]! + (bold ? 60 : 0);
}

function textWidth(text: string, size: number, bold: boolean): number {
  let total = 0;
  for (const ch of text) total += charWidth(ch, bold);
  return (total / 1000) * size;
}

function wrap(
  text: string,
  maxWidth: number,
  size: number,
  bold: boolean,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size, bold) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);

      if (textWidth(word, size, bold) > maxWidth) {
        let chunk = "";
        for (const ch of word) {
          if (textWidth(chunk + ch, size, bold) > maxWidth) {
            lines.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
      } else line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function escapePdfText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[•·]/g, "-")
    .replace(/[‐-―]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

interface Line {
  text: string;
  size: number;
  bold: boolean;
  indent: number;
  spaceAfter: number;
}

function layout(blocks: PdfBlock[]): Line[][] {
  const usableWidth = PAGE.width - PAGE.margin * 2;
  const usableHeight = PAGE.height - PAGE.margin * 2;

  const flat: Line[] = [];
  for (const b of blocks) {
    if (b.type === "spacer") {
      flat.push({
        text: "",
        size: STYLES["body"]!.size,
        bold: false,
        indent: 0,
        spaceAfter: 6,
      });
      continue;
    }
    const style =
      b.type === "heading" ? STYLES[`h${b.level}`]! : STYLES["body"]!;
    const indent = b.type === "bullet" ? 14 : 0;
    const prefix = b.type === "bullet" ? "- " : "";
    const lines = wrap(
      prefix + b.text,
      usableWidth - indent,
      style.size,
      style.bold,
    );
    lines.forEach((text, i) => {
      flat.push({
        text,
        size: style.size,
        bold: style.bold,
        indent: i === 0 ? indent : indent + 8,
        spaceAfter: i === lines.length - 1 ? style.spaceAfter : 0,
      });
    });
  }

  const pages: Line[][] = [];
  let current: Line[] = [];
  let y = 0;
  for (const line of flat) {
    const height = line.size * LINE_GAP + line.spaceAfter;
    if (y + height > usableHeight && current.length) {
      pages.push(current);
      current = [];
      y = 0;
    }
    current.push(line);
    y += height;
  }
  if (current.length) pages.push(current);
  return pages.length ? pages : [[]];
}

export function buildPdf(blocks: PdfBlock[], title = "Document"): Uint8Array {
  const pages = layout(blocks);
  const objects: string[] = [];
  const add = (content: string): number => {
    objects.push(content);
    return objects.length;
  };

  const catalogId = add("");
  const pagesId = add("");
  const fontId = add(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  const fontBoldId = add(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );

  const pageIds: number[] = [];
  for (const lines of pages) {
    let y = PAGE.height - PAGE.margin;
    const ops: string[] = ["BT"];
    for (const line of lines) {
      y -= line.size * LINE_GAP;
      if (line.text) {
        ops.push(`${line.bold ? "/F2" : "/F1"} ${line.size} Tf`);
        ops.push(`1 0 0 1 ${PAGE.margin + line.indent} ${y.toFixed(2)} Tm`);
        ops.push(`(${escapePdfText(line.text)}) Tj`);
      }
      y -= line.spaceAfter;
    }
    ops.push("ET");
    const stream = ops.join("\n");
    const contentId = add(
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
    const pageId = add(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] ` +
        `/Resources << /Font << /F1 ${fontId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  }

  const infoId = add(
    `<< /Title (${escapePdfText(title)}) /Producer (AI Career Copilot) /CreationDate (D:${pdfDate()}) >>`,
  );

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] =
    `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const push = (s: string) => {
    const bytes = encoder.encode(s);
    chunks.push(bytes);
    offset += bytes.length;
  };

  push("%PDF-1.4\n");
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(offset);
    push(`${i + 1} 0 obj\n${body}\nendobj\n`);
  });

  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) xref += `${String(o).padStart(10, "0")} 00000 n \n`;
  push(xref);
  push(
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

function pdfDate(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

export function resumeTextToPdfBlocks(text: string): PdfBlock[] {
  const SECTION = /^[A-Z][A-Z\s&/]{2,30}$/;
  return text.split("\n").map((raw, i): PdfBlock => {
    const line = raw.trim();
    if (!line) return { type: "spacer" };
    if (i === 0) return { type: "heading", level: 1, text: line };
    if (SECTION.test(line)) return { type: "heading", level: 2, text: line };
    if (/^[•·*-]\s+/.test(line))
      return { type: "bullet", text: line.replace(/^[•·*-]\s+/, "") };
    return { type: "paragraph", text: line };
  });
}
