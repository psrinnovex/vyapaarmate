export type CsvCell = string | number | boolean | null | undefined;
export type CsvRow = Record<string, CsvCell>;

function formatCsvCell(value: CsvCell) {
  if (value === null || value === undefined) return "";

  const text = String(value);
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
