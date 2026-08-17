export interface PdfItem {
  str: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

const LINE_TOLERANCE = 3;

const COLUMN_GAP = 18;

export function toPdfItem(raw: unknown): PdfItem | null {
  const item = raw as {
    str?: unknown;
    transform?: unknown;
    width?: unknown;
    height?: unknown;
  };
  if (typeof item.str !== "string" || item.str.trim() === "") return null;

  const transform = Array.isArray(item.transform)
    ? (item.transform as unknown[])
    : [];
  const x = typeof transform[4] === "number" ? transform[4] : 0;
  const y = typeof transform[5] === "number" ? transform[5] : 0;

  return {
    str: item.str,
    x,
    y,
    ...(typeof item.width === "number" ? { width: item.width } : {}),
    ...(typeof item.height === "number" ? { height: item.height } : {}),
  };
}

interface Line {
  y: number;
  items: PdfItem[];
}

function toLines(items: PdfItem[]): Line[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];

  for (const item of sorted) {
    const last = lines[lines.length - 1];

    if (last && Math.abs(last.y - item.y) <= LINE_TOLERANCE) {
      last.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }

  for (const line of lines) line.items.sort((a, b) => a.x - b.x);
  return lines;
}

function renderLine(line: Line): string {
  let out = "";
  let cursorX: number | null = null;

  for (const item of line.items) {
    if (cursorX !== null) {
      const gap = item.x - cursorX;
      if (gap >= COLUMN_GAP) out += "   ";
      else if (gap > 1 && !/\s$/.test(out) && !/^\s/.test(item.str)) out += " ";
    }
    out += item.str;
    cursorX = item.x + (item.width ?? item.str.length * 4.5);
  }

  return out.replace(/[ \t]{4,}/g, "   ").trimEnd();
}

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

  gutters.sort((a, b) => a - b);
  const median = gutters[Math.floor(gutters.length / 2)]!;
  const consistent = gutters.filter((g) => Math.abs(g - median) <= 25).length;
  if (consistent < Math.max(5, lines.length * 0.35)) return null;

  const right = lines.filter((l) => l.items.some((it) => it.x > median));
  const rightSubstantial = right.filter(
    (l) =>
      l.items
        .filter((it) => it.x > median)
        .map((it) => it.str)
        .join("")
        .trim().length > 12,
  ).length;

  return rightSubstantial >= 5 ? median : null;
}

export function reflowPage(rawItems: PdfItem[]): string {
  const lines = toLines(rawItems.filter((i) => i.str.trim() !== ""));
  if (lines.length === 0) return "";

  const boundary = findColumnBoundary(lines);

  if (boundary === null) {
    return lines
      .map(renderLine)
      .filter((l) => l.trim() !== "")
      .join("\n");
  }

  const columnLines = (predicate: (item: PdfItem) => boolean): string[] =>
    lines
      .map((line) => ({ y: line.y, items: line.items.filter(predicate) }))
      .filter((line) => line.items.length > 0)
      .map(renderLine)
      .filter((l) => l.trim() !== "");

  return [
    ...columnLines((item) => item.x <= boundary),
    "",
    ...columnLines((item) => item.x > boundary),
  ].join("\n");
}

export function reflowDocument(pages: PdfItem[][]): string {
  return pages
    .map(reflowPage)
    .filter((p) => p.trim() !== "")
    .join("\n\n");
}
