import type { RawRow } from "../../domain/ingest";

/**
 * File import adapter: turns an uploaded CSV or JSON export into untrusted rows.
 * Parsing happens locally in the browser; the file is never uploaded. This adapter
 * only parses. Validation and cleaning belong to the shared sanitizer in domain/ingest.
 */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 200_000;

export interface ParseResult { rows: RawRow[]; errors: Array<{ row: number; reason: string }>; format: "csv" | "json" | "unknown"; }

export function parseImportText(text: string, filename = ""): ParseResult {
  if (text.length > MAX_IMPORT_BYTES) return { rows: [], errors: [{ row: 0, reason: "File is larger than 5 MB." }], format: "unknown" };
  const body = text.replace(/^﻿/, "").trim();
  if (!body) return { rows: [], errors: [{ row: 0, reason: "File is empty." }], format: "unknown" };
  const looksJson = body.startsWith("[") || body.startsWith("{");
  if (looksJson || filename.toLowerCase().endsWith(".json")) return parseJson(body);
  return parseCsv(body);
}

export async function readImportFile(file: File): Promise<ParseResult> {
  if (file.size > MAX_IMPORT_BYTES) return { rows: [], errors: [{ row: 0, reason: "File is larger than 5 MB." }], format: "unknown" };
  return parseImportText(await file.text(), file.name);
}

function parseJson(body: string): ParseResult {
  let data: unknown;
  try { data = JSON.parse(body); } catch { return { rows: [], errors: [{ row: 0, reason: "File is not valid JSON." }], format: "json" }; }
  const list = Array.isArray(data) ? data : data && typeof data === "object" && Array.isArray((data as { readings?: unknown }).readings) ? (data as { readings: unknown[] }).readings : null;
  if (!list) return { rows: [], errors: [{ row: 0, reason: "JSON must be an array of readings or an object with a \"readings\" array." }], format: "json" };
  const errors: ParseResult["errors"] = [];
  const rows: RawRow[] = [];
  list.slice(0, MAX_IMPORT_ROWS).forEach((item, index) => {
    if (item && typeof item === "object" && !Array.isArray(item)) rows.push({ row: index + 1, fields: { ...(item as Record<string, unknown>) } });
    else errors.push({ row: index + 1, reason: "Reading is not an object." });
  });
  if (list.length > MAX_IMPORT_ROWS) errors.push({ row: MAX_IMPORT_ROWS + 1, reason: `Only the first ${MAX_IMPORT_ROWS} rows were read.` });
  return { rows, errors, format: "json" };
}

function parseCsv(body: string): ParseResult {
  const lines = body.split(/\r\n|\n|\r/);
  const header = splitCsvLine(lines[0]);
  if (header.length < 2) return { rows: [], errors: [{ row: 1, reason: "Missing CSV header row." }], format: "csv" };
  const rows: RawRow[] = [];
  const errors: ParseResult["errors"] = [];
  for (let i = 1; i < lines.length && rows.length < MAX_IMPORT_ROWS; i += 1) {
    if (!lines[i].trim()) continue;
    const cells = splitCsvLine(lines[i]);
    if (cells.length !== header.length) { errors.push({ row: i + 1, reason: `Expected ${header.length} columns but found ${cells.length}.` }); continue; }
    rows.push({ row: i + 1, fields: Object.fromEntries(header.map((name, index) => [name, cells[index]])) });
  }
  return { rows, errors, format: "csv" };
}

/** Minimal RFC 4180 line splitter: quoted fields, escaped quotes, commas inside quotes. */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = ""; let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { cells.push(cell.trim()); cell = ""; }
    else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}
