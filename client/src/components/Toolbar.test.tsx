import { cleanup, render, screen, within } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Toolbar, ToolbarSearch } from "./Toolbar";

afterEach(() => cleanup());

describe("Toolbar", () => {
  it("has no title or card chrome", () => {
    const { container } = render(<Toolbar filters={<span>q</span>} />);
    expect(screen.queryByText("Filters")).not.toBeInTheDocument();
    expect(container.querySelector('[data-slot="card"]')).toBeNull();
  });

  it("puts the count and end controls in a right aligned cluster", () => {
    render(<Toolbar filters={<span>q</span>} count="3 items" end={<button type="button">More</button>} />);
    const end = screen.getByTestId("toolbar-end");
    expect(end).toHaveClass("ml-auto");
    expect(within(end).getByTestId("toolbar-count")).toHaveTextContent("3 items");
    expect(within(end).getByRole("button", { name: "More" })).toBeInTheDocument();
  });

  it("omits the right cluster when there is nothing to show", () => {
    render(<Toolbar filters={<span>q</span>} />);
    expect(screen.queryByTestId("toolbar-end")).not.toBeInTheDocument();
  });

  it("search is h-9 and w-64 from sm", () => {
    render(<ToolbarSearch placeholder="Search" />);
    const input = screen.getByPlaceholderText("Search");
    expect(input).toHaveClass("h-9");
    expect(input.parentElement).toHaveClass("sm:w-64");
  });
});
