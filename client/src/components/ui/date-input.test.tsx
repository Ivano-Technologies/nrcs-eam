/**
 * Coco (#151): every date field keeps the native picker and shows a small muted readback under it in the
 * table date format ("14 Jan 2027"), whatever the browser locale. Nothing shows when the field is empty.
 * No DD/MM/YYYY hints or tooltips remain anywhere in the client.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { DateInput, formatDateReadback } from "./date-input";

afterEach(cleanup);

function Controlled({ initial = "" }: { initial?: string }) {
  const [v, setV] = useState(initial);
  return <DateInput aria-label="Expiry" value={v} onChange={(e) => setV(e.target.value)} />;
}

describe("DateInput (Coco, #151)", () => {
  it("keeps the native date picker and has no format tooltip", () => {
    render(<Controlled />);
    const input = screen.getByLabelText("Expiry") as HTMLInputElement;
    expect(input.type).toBe("date");
    expect(input.getAttribute("title")).toBeNull();
  });

  it("shows nothing when the field is empty", () => {
    render(<Controlled />);
    expect(screen.queryByTestId("date-readback")).toBeNull();
    expect(screen.getByLabelText("Expiry").getAttribute("aria-describedby")).toBeNull();
  });

  it("spells out a picked date in the table format, in the muted text token, and links it to the input", () => {
    render(<Controlled />);
    const input = screen.getByLabelText("Expiry");
    fireEvent.change(input, { target: { value: "2027-01-14" } });
    const readback = screen.getByTestId("date-readback");
    expect(readback.textContent).toBe("14 Jan 2027");
    expect(readback).toHaveClass("text-muted-foreground", "text-xs");
    expect(readback.getAttribute("style")).toBeNull();
    expect(input.getAttribute("aria-describedby")).toContain(readback.id);
  });

  it("clears the readback when the date is cleared", () => {
    render(<Controlled initial="2026-09-04" />);
    expect(screen.getByTestId("date-readback").textContent).toBe("4 Sep 2026");
    fireEvent.change(screen.getByLabelText("Expiry"), { target: { value: "" } });
    expect(screen.queryByTestId("date-readback")).toBeNull();
  });

  it("keeps a caller's aria-describedby", () => {
    render(<DateInput aria-label="Due" aria-describedby="due-help" value="2026-11-01" onChange={() => {}} />);
    const ids = screen.getByLabelText("Due").getAttribute("aria-describedby")?.split(" ");
    expect(ids?.[0]).toBe("due-help");
    expect(ids).toHaveLength(2);
  });

  it("only reads back a whole, valid YYYY-MM-DD day", () => {
    expect(formatDateReadback("2027-01-14")).toBe("14 Jan 2027");
    expect(formatDateReadback("")).toBe("");
    expect(formatDateReadback(undefined)).toBe("");
    expect(formatDateReadback("2027-01")).toBe("");
    expect(formatDateReadback("Pending")).toBe("");
  });
});

describe("no leftover date format hints in the client", () => {
  const root = resolve(__dirname, "../..");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(p);
    }
  };
  walk(root);

  it("has no DD/MM/YYYY hint or tooltip text", () => {
    const hits = files.filter((f) => readFileSync(f, "utf8").includes("DD/MM/YYYY"));
    expect(hits).toEqual([]);
  });

  it("renders every date field through DateInput", () => {
    const hits = files.filter((f) => !f.endsWith(join("ui", "date-input.tsx")) && /type=["{]+date/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});
