export type CsvCell = string | number | boolean | null | undefined;
export type CsvRow = Record<string, CsvCell>;

export function formatCsvCell(value: CsvCell) {
  if (value === null || value === undefined) return "";

  // Spreadsheet programs interpret untrusted string cells as formulas, including
  // formulas preceded by whitespace. Numeric values should remain numeric.
  const raw = String(value);
  const text = typeof value === "string" && (/^\s*[=+@-]/.test(raw) || /^[\t\r\n]/.test(raw)) ? `'${raw}` : raw;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

export function downloadCsv(filename: string, rows: CsvRow[]) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const headers = Array.from(
    rows.reduce((keys, row) => {
      Object.keys(row).forEach((key) => keys.add(key));
      return keys;
    }, new Set<string>())
  );
  const content = [
    headers.map(formatCsvCell).join(","),
    ...rows.map((row) => headers.map((header) => formatCsvCell(row[header])).join(","))
  ].join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
