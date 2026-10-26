import { describe, expect, it } from "vitest";
import { toCsv } from "./csv.js";

describe("toCsv", () => {
  it("writes a header and CRLF-terminated rows", () => {
    expect(toCsv(["a", "b"], [["x", 1]])).toBe("a,b\r\nx,1\r\n");
  });

  it("returns only the header when there are no rows", () => {
    expect(toCsv(["a", "b"], [])).toBe("a,b\r\n");
  });

  it("writes null and undefined as empty cells", () => {
    expect(toCsv(["a", "b", "c"], [["x", null, undefined]])).toBe("a,b,c\r\nx,,\r\n");
  });

  it("quotes cells with commas, quotes and line breaks, doubling quotes", () => {
    expect(toCsv(["a"], [['say "hi", ok'], ["two\nlines"]])).toBe(
      'a\r\n"say ""hi"", ok"\r\n"two\nlines"\r\n',
    );
  });

  it("prefixes text that a spreadsheet would run as a formula", () => {
    const rows = [["=SUM(A1)"], ["+1"], ["-1+2"], ["@cmd"], ["\tx"]];

    expect(toCsv(["a"], rows)).toBe("a\r\n'=SUM(A1)\r\n'+1\r\n'-1+2\r\n'@cmd\r\n'\tx\r\n");
  });

  it("leaves numbers alone, including negative ones", () => {
    expect(toCsv(["q"], [[-3], [0]])).toBe("q\r\n-3\r\n0\r\n");
  });
});
