export type CsvValue = string | number | null | undefined;

export function escapeCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const row of rows) lines.push(row.map(escapeCsvCell).join(","));

  return `﻿${lines.join("\r\n")}\r\n`;
}

export const CSV_MIME_TYPE = "text/csv;charset=utf-8";
