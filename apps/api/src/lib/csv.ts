// Minimal CSV writer (RFC 4180): CRLF line ends, cells quoted when they hold
// a comma, quote or line break.

export type CsvCell = string | number | null | undefined;

// Spreadsheets run a text cell that starts with one of these as a formula.
const FORMULA_START = /^[=+\-@\t\r]/;

const text = (value: string) => {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;

  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

// Numbers are written as they are (an ADJUSTMENT quantity can be -3); only
// strings are treated as text that could hold a formula.
const cell = (value: CsvCell) =>
  typeof value === "number" ? String(value) : value == null ? "" : text(value);

export const toCsv = (header: string[], rows: CsvCell[][]) =>
  [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
