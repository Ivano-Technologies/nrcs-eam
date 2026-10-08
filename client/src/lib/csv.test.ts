import { describe, expect, it } from "vitest";
import { escapeCsvCell, toCsv } from "./csv";

describe("escapeCsvCell", () => {
  it("passes plain values through", () => {
    expect(escapeCsvCell("abc")).toBe("abc");
    expect(escapeCsvCell(42)).toBe("42");
    expect(escapeCsvCell(-5)).toBe("-5");
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralises spreadsheet formula prefixes in text", () => {
    expect(escapeCsvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeCsvCell("+1")).toBe("'+1");
    expect(escapeCsvCell("@cmd")).toBe("'@cmd");
  });
});

describe("toCsv", () => {
  it("joins header and rows with CRLF", () => {
    expect(toCsv(["A", "B"], [[1, "x,y"], [null, "z"]])).toBe('A,B\r\n1,"x,y"\r\n,z');
  });
});
