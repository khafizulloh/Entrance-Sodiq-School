/**
 * Minimal CSV builder. The output opens directly in Excel / Google Sheets.
 */

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Quote the cell if it contains a comma, quote, or newline.
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a CSV string from a header row and array of row objects.
 * `columns` maps a header label to a key/getter on each row.
 */
export function toCsv<T>(
  rows: T[],
  columns: { header: string; value: (row: T) => unknown }[],
): string {
  const headerLine = columns.map((c) => escapeCell(c.header)).join(",");
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCell(c.value(row))).join(","),
  );
  // Prepend a BOM so Excel detects UTF-8 correctly.
  return "﻿" + [headerLine, ...dataLines].join("\r\n");
}
