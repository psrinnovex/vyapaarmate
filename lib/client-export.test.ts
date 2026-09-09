import assert from "node:assert/strict";
import test from "node:test";
import { formatCsvCell } from "./client-export";

test("exports preserve text and money while neutralizing spreadsheet formula cells", () => {
  assert.equal(formatCsvCell('=HYPERLINK("https://example.test")'), '"\'=HYPERLINK(""https://example.test"")"');
  assert.equal(formatCsvCell("  +SUM(1:2)"), "'  +SUM(1:2)");
  assert.equal(formatCsvCell("+15550100010"), "'+15550100010");
  assert.equal(formatCsvCell(-123.45), "-123.45");
  assert.equal(formatCsvCell('Bakery, "Central"'), '"Bakery, ""Central"""');
});
