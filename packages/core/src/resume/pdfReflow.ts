/**
 * Turn positioned PDF text runs back into lines.
 *
 * PDF has no concept of a line: an extractor hands back fragments with x/y
 * coordinates. Getting this wrong is the most common reason a resume that
 * "parses fine everywhere else" comes out mangled, so the reflow does three
 * things the naive version misses:
 *
 *  1. clusters fragments into lines by *proximity* rather than by rounding a
 *     coordinate into a bucket, which otherwise splits a line whose fragments
 *     straddle a bucket boundary;
 *  2. preserves horizontal gaps as runs of spaces, so a right-aligned date
 *     stays distinguishable from the job title it sits beside;
 *  3. detects a two-column layout and reads each column in full, instead of
 *     interleaving a sidebar into the middle of every sentence.
 */

export interface PdfItem {
  str: string;
  /** Horizontal position in PDF units (origin bottom-left). */
  x: number;
  /** Vertical position in PDF units. */
  y: number;
  /** Advance width of the fragment, when the extractor reports it. */
  width?: number;
  height?: number;
}

/** Fragments closer together than this vertically belong to the same line. */
const LINE_TOLERANCE = 3;

/** A horizontal gap wider than this is a column boundary, not a word space. */
const COLUMN_GAP = 18;

/** Read a pdf.js text-content item into our own shape. */
export function toPdfItem(raw: unknown): PdfItem | null {
  const item = raw as { str?: unknown; transform?: unknown; width?: unknown; height?: unknown };
  if (typeof item.str !== 'string' || item.str.trim() === '') return null;

  const transform = Array.isArray(item.transform) ? (item.transform as unknown[]) : [];
  const x = typeof transform[4] === 'number' ? transform[4] : 0;
  const y = typeof transform[5] === 'number' ? transform[5] : 0;

  return {
    str: item.str,
    x,
    y,
    ...(typeof item.width === 'number' ? { width: item.width } : {}),
    ...(typeof item.height === 'number' ? { height: item.height } : {}),
  };
}

interface Line {
  y: number;
  items: PdfItem[];
}

/** Group fragments into lines by vertical proximity. */
function toLines(items: PdfItem[]): Line[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];

  for (const item of sorted) {
    const last = lines[lines.length - 1];
    // Compare against the line's anchor, so a slow drift can't merge a whole
    // paragraph into one line.
    if (last && Math.abs(last.y - item.y) <= LINE_TOLERANCE) {
      last.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }

  for (const line of lines) line.items.sort((a, b) => a.x - b.x);
  return lines;
}

/**
 * Render one line, turning wide horizontal gaps into runs of spaces.
 *
 * The parser treats three or more spaces as a column separator, so this is what
 * lets "Senior Engineer          Jan 2021 - Present" split correctly.
 */
function renderLine(line: Line): string {
  let out = '';
  let cursorX: number | null = null;

  for (const item of line.items) {
    if (cursorX !== null) {
      const gap = item.x - cursorX;
      if (gap >= COLUMN_GAP) out += '   ';
      else if (gap > 1 && !/\s$/.test(out) && !/^\s/.test(item.str)) out += ' ';
    }
    out += item.str;
    cursorX = item.x + (item.width ?? item.str.length * 4.5);
  }

  return out.replace(/[ \t]{4,}/g, '   ').trimEnd();
}

/**
 * Decide whether a page is laid out in two columns.
 *
 * Deliberately conservative: a right-aligned date column produces a wide gap
 * too, so a split is only accepted when the gap sits at a *consistent* x across
 * many lines and the right-hand side carries substantial text of its own.
 */
function findColumnBoundary(lines: Line[]): number | null {
  const gutters: number[] = [];

  for (const line of lines) {
    for (let i = 1; i < line.items.length; i++) {
      const prev = line.items[i - 1]!;
      const next = line.items[i]!;
      const prevEnd = prev.x + (prev.width ?? prev.str.length * 4.5);
      if (next.x - prevEnd >= 40) gutters.push((prevEnd + next.x) / 2);
    }
  }

  if (gutters.length < 5) return null;

  // The candidate boundary is the most agreed-upon gap position.
  gutters.sort((a, b) => a - b);
  const median = gutters[Math.floor(gutters.length / 2)]!;
  const consistent = gutters.filter((g) => Math.abs(g - median) <= 25).length;
  if (consistent < Math.max(5, lines.length * 0.35)) return null;

  // Both sides must read like real columns, not a label and a date.
  const right = lines.filter((l) => l.items.some((it) => it.x > median));
  const rightSubstantial = right.filter(
    (l) =>
      l.items
        .filter((it) => it.x > median)
        .map((it) => it.str)
        .join('')
        .trim().length > 12,
  ).length;

  return rightSubstantial >= 5 ? median : null;
}

/** Reflow one page of positioned fragments into text. */
export function reflowPage(rawItems: PdfItem[]): string {
  const lines = toLines(rawItems.filter((i) => i.str.trim() !== ''));
  if (lines.length === 0) return '';

  const boundary = findColumnBoundary(lines);

  if (boundary === null) {
    return lines
      .map(renderLine)
      .filter((l) => l.trim() !== '')
      .join('\n');
  }

  // Two columns: emit the left in full, then the right. Reading them
  // interleaved is what turns a sidebar resume into nonsense.
  const columnLines = (predicate: (item: PdfItem) => boolean): string[] =>
    lines
      .map((line) => ({ y: line.y, items: line.items.filter(predicate) }))
      .filter((line) => line.items.length > 0)
      .map(renderLine)
      .filter((l) => l.trim() !== '');

  return [
    ...columnLines((item) => item.x <= boundary),
    '',
    ...columnLines((item) => item.x > boundary),
  ].join('\n');
}

/** Reflow a whole document, one page at a time. */
export function reflowDocument(pages: PdfItem[][]): string {
  return pages
    .map(reflowPage)
    .filter((p) => p.trim() !== '')
    .join('\n\n');
}
